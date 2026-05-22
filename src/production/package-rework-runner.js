import { fileURLToPath } from 'node:url'

import { nowIso } from '../contracts/constructors.js'
import { readProjectRecords } from '../seams/project-status.js'
import { latestLocalPackageReviewEntry } from './package-authority-freshness.js'
import { runLocalProductionOutput } from './local-output-runner.js'

const modulePath = fileURLToPath(import.meta.url)
const defaultProjectDir = 'examples/venice-smoke'

function parseArgs(argv) {
  const args = {
    projectDir: defaultProjectDir,
    disableFfmpeg: false,
    skipContactSheet: false,
    skipLocalPackage: false,
    print: false,
    quiet: false
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]

    if (arg === '--project-dir') {
      args.projectDir = next
      i += 1
    } else if (arg === '--disable-ffmpeg') {
      args.disableFfmpeg = true
    } else if (arg === '--skip-contact-sheet') {
      args.skipContactSheet = true
    } else if (arg === '--skip-local-package') {
      args.skipLocalPackage = true
    } else if (arg === '--print') {
      args.print = true
    } else if (arg === '--quiet') {
      args.quiet = true
    }
  }

  return args
}

export async function runLocalPackageRework({
  projectDir = defaultProjectDir,
  disableFfmpeg = false,
  skipContactSheet = false,
  skipLocalPackage = false,
  print = false,
  quiet = false,
  createdAt = nowIso()
} = {}) {
  const records = await readProjectRecords(projectDir)
  const latestReview = latestLocalPackageReviewEntry(records)
  assertLatestPackageReviewNeedsRework(latestReview)

  const output = await runLocalProductionOutput({
    projectDir,
    disableFfmpeg,
    skipContactSheet,
    skipLocalPackage,
    quiet: true,
    createdAt
  })
  const result = {
    projectId: output.projectId,
    mode: 'standalone-local',
    reworkKind: 'local-package-rework-runner',
    sourcePackageReviewDecisionRef: {
      kind: 'media-operator-decision',
      id: latestReview.record.decisionId,
      schema: latestReview.record.schema,
      path: latestReview.path,
      localOnly: true
    },
    output,
    summary: {
      steps: output.steps.filter((step) => step.state === 'completed').length,
      totalSteps: output.steps.length,
      localPackageReviewed: output.summary.localPackageReviewed,
      publicationAuthorityRequests: output.summary.publicationAuthorityRequests,
      localProductionPackageComplete: output.summary.localProductionPackageComplete,
      pendingAuthority: output.summary.pendingAuthority,
      productionReady: output.summary.productionReady
    },
    nextAction: output.summary.localPackageReviewed === 1
      ? 'Inspect the regenerated local package and route the request candidate to a future authority lane only if desired.'
      : 'Resolve local output/package integrity blockers, then rerun package rework.',
    nonClaims: {
      localOnly: true,
      operatorGuidanceOnly: true,
      approvalAuthority: false,
      ratifierAuthority: false,
      publicationAuthorization: false,
      productionReady: false,
      meshTruth: false,
      distributedProof: false,
      ratifiedSharedState: false,
      resourceAdmission: false,
      byteAvailabilityProof: false,
      materializationProof: false,
      causalTruth: false,
      edgeCalled: false,
      meshPublished: false
    }
  }

  if (print) {
    console.log(JSON.stringify(result, null, 2))
  } else if (!quiet) {
    console.log(formatLocalPackageReworkSummary(result))
    console.log(`nextAction: ${result.nextAction}`)
    console.log('nonClaims: local-only package rework; no approval authority; no publication authorization; productionReady=false; no Edge call; no mesh publication')
  }

  return result
}

export function assertLatestPackageReviewNeedsRework(latestReview) {
  if (!latestReview) {
    throw new Error('Local package rework requires a latest local package review decision with needs_rework posture')
  }
  if (latestReview.record.localPackageReview?.needsRework !== true) {
    throw new Error('Local package rework requires the latest local package review decision to request changes')
  }
}

export function formatLocalPackageReworkSummary(result) {
  return [
    `local package rework: project=${result.projectId}`,
    `sourceReview=${result.sourcePackageReviewDecisionRef.id}`,
    `steps=${result.summary.steps}/${result.summary.totalSteps}`,
    `localPackageReviewed=${result.summary.localPackageReviewed}`,
    `publicationAuthorityRequests=${result.summary.publicationAuthorityRequests}`,
    `localProductionPackageComplete=${result.summary.localProductionPackageComplete}`,
    `pendingAuthority=${result.summary.pendingAuthority}`,
    `productionReady=${result.summary.productionReady}`
  ].join(' | ')
}

if (process.argv[1] === modulePath) {
  await runLocalPackageRework(parseArgs(process.argv.slice(2)))
}
