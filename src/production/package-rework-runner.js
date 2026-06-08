import { fileURLToPath } from 'node:url'

import { nowIso } from '../contracts/constructors.js'
import { readProjectRecords } from '../seams/project-status.js'
import { createProductionAuthorityPrerequisiteReport } from './authority-prerequisites.js'
import {
  evaluateLocalPackageReviewFreshness,
  latestLocalPackageReviewEntry
} from './package-authority-freshness.js'
import { formatLocalPackagePostureFields } from './local-package-posture.js'
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
  const prerequisiteReport = await createProductionAuthorityPrerequisiteReport({ projectDir })
  const eligibility = packageReworkEligibility({ latestReview, records, prerequisiteReport })
  assertCanRunLocalPackageRework(eligibility)

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
    reworkTrigger: eligibility.trigger,
    reworkIssueCodes: eligibility.issueCodes,
    reworkEligibility: {
      allowed: eligibility.allowed,
      trigger: eligibility.trigger,
      issueCodes: eligibility.issueCodes,
      reason: eligibility.reason,
      localOnly: true,
      operatorGuidanceOnly: true,
      authorityGranted: false,
      productionReady: false
    },
    output,
    localPackagePosture: output.localPackagePosture,
    summary: {
      steps: output.steps.filter((step) => step.state === 'completed').length,
      totalSteps: output.steps.length,
      localPackageReviewed: output.summary.localPackageReviewed,
      publicationAuthorityRequests: output.summary.publicationAuthorityRequests,
      localProductionPackageComplete: output.summary.localProductionPackageComplete,
      pendingAuthority: output.summary.pendingAuthority,
      productionReady: output.summary.productionReady,
      localPackageState: output.localPackagePosture.packageState,
      latestLocalPackageReviewPosture: output.localPackagePosture.latestReviewPosture,
      localPackageIntegrityPosture: output.localPackagePosture.integrityPosture,
      localPackageNextAction: output.localPackagePosture.safeNextAction
    },
    nextAction: output.localPackagePosture.safeNextAction,
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

export function assertLocalPackageReworkEligible(eligibility) {
  assertCanRunLocalPackageRework(eligibility)
}

export function assertLatestPackageReviewNeedsRework(latestReview) {
  assertCanRunLocalPackageRework(packageReworkEligibility({ latestReview }))
}

export function packageReworkEligibility({ latestReview, records = [], prerequisiteReport } = {}) {
  if (!latestReview) {
    return {
      allowed: false,
      trigger: 'missing-local-package-review',
      issueCodes: ['local_package_review_missing'],
      reason: 'Local package rework requires a latest local package review decision.'
    }
  }

  const review = latestReview.record.localPackageReview ?? {}
  if (review.needsRework === true) {
    return {
      allowed: true,
      trigger: 'local-package-review-request-changes',
      issueCodes: review.issueCodes ?? ['local_package_needs_rework'],
      reason: 'Latest local package review requested changes.'
    }
  }

  if (review.localPackageReviewed === true && prerequisiteReport) {
    const freshness = evaluateLocalPackageReviewFreshness({
      decision: latestReview.record,
      records,
      prerequisiteReport
    })
    if (freshness.state === 'stale') {
      return {
        allowed: true,
        trigger: 'stale-local-package-review',
        issueCodes: freshness.issueCodes,
        reason: 'Latest local package review is stale against current rough-cut/output prerequisites.'
      }
    }
  }

  return {
    allowed: false,
    trigger: review.localPackageReviewed === true ? 'fresh-local-package-review' : 'unsupported-local-package-review',
    issueCodes: [],
    reason: 'Local package rework requires request_changes posture or a stale reviewed local package.'
  }
}

function assertCanRunLocalPackageRework(eligibility) {
  if (!eligibility.allowed) {
    throw new Error(eligibility.reason)
  }
}

export function formatLocalPackageReworkSummary(result) {
  return [
    `local package rework: project=${result.projectId}`,
    `sourceReview=${result.sourcePackageReviewDecisionRef.id}`,
    `trigger=${result.reworkTrigger}`,
    `steps=${result.summary.steps}/${result.summary.totalSteps}`,
    `localPackageReviewed=${result.summary.localPackageReviewed}`,
    `publicationAuthorityRequests=${result.summary.publicationAuthorityRequests}`,
    `localProductionPackageComplete=${result.summary.localProductionPackageComplete}`,
    `pendingAuthority=${result.summary.pendingAuthority}`,
    `productionReady=${result.summary.productionReady}`,
    formatLocalPackagePostureFields(result.localPackagePosture)
  ].join(' | ')
}

if (process.argv[1] === modulePath) {
  await runLocalPackageRework(parseArgs(process.argv.slice(2)))
}
