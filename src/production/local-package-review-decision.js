import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { artifactKinds } from '../contracts/artifact-kinds.js'
import { makeRef, nowIso } from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import { assertSafeLocalPath } from '../local/project-layout.js'
import { readProjectRecords } from '../seams/project-status.js'
import { createProductionAuthorityPrerequisiteReport } from './authority-prerequisites.js'
import {
  createLocalPackageReviewFreshnessBasis,
  evaluateLocalPackageReviewFreshness
} from './package-authority-freshness.js'

const modulePath = fileURLToPath(import.meta.url)
const defaultProjectDir = 'examples/venice-smoke'
const defaultOutput = 'records/decisions/media-local-package-review-decision.local.json'
const truthStatus = 'not mesh truth; not distributed proof; not ratified shared state'

function parseArgs(argv) {
  const args = {
    projectDir: defaultProjectDir,
    decision: 'review_local_package',
    operatorRef: 'local-operator',
    reason: undefined,
    output: defaultOutput,
    print: false,
    quiet: false
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]

    if (arg === '--project-dir') {
      args.projectDir = next
      i += 1
    } else if (arg === '--decision') {
      args.decision = next
      i += 1
    } else if (arg === '--operator-ref') {
      args.operatorRef = next
      i += 1
    } else if (arg === '--reason') {
      args.reason = next
      i += 1
    } else if (arg === '--output') {
      args.output = next
      i += 1
    } else if (arg === '--print') {
      args.print = true
    } else if (arg === '--quiet') {
      args.quiet = true
    }
  }

  return args
}

export async function writeLocalPackageReviewDecision({
  projectDir = defaultProjectDir,
  decision: requestedDecision = 'review_local_package',
  operatorRef = 'local-operator',
  reason,
  output = defaultOutput,
  print = false,
  quiet = false,
  createdAt = nowIso()
} = {}) {
  assertSafeLocalPath(output)

  const root = path.resolve(projectDir)
  const records = await readProjectRecords(root)
  const prerequisiteReport = await createProductionAuthorityPrerequisiteReport({ projectDir })
  const decision = createLocalPackageReviewDecision({
    records,
    prerequisiteReport,
    decision: requestedDecision,
    operatorRef,
    reason,
    createdAt
  })

  const outputPath = path.join(root, output)
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(decision, null, 2)}\n`)

  if (print) {
    console.log(JSON.stringify(decision, null, 2))
  } else if (!quiet) {
    console.log(formatLocalPackageReviewDecisionSummary(decision, output))
    console.log(`nextAction: ${decision.nextAction}`)
    console.log('nonClaims: local-only package review; no approval authority; no publication authorization; productionReady=false')
  }

  return {
    decision,
    output
  }
}

export function createLocalPackageReviewDecision({
  records,
  prerequisiteReport,
  decision: requestedDecision = 'review_local_package',
  operatorRef = 'local-operator',
  reason,
  createdAt = nowIso()
}) {
  assertPackageReviewable(prerequisiteReport)
  assertLocalPackageReviewDecision(requestedDecision)
  const projectId = prerequisiteReport.projectId
  const sourceRefs = packageReviewSourceRefs(records)
  const reviewed = requestedDecision === 'review_local_package'
  const needsRework = requestedDecision === 'request_changes'
  const decision = {
    schema: artifactKinds.mediaOperatorDecision,
    decisionId: `decision-local-package-${projectId}-${requestedDecision}`,
    projectId,
    subjectRef: makeRef('media-local-production-package', `local-production-package-${projectId}`, 'media.local_production_package.local.v1'),
    decisionType: requestedDecision,
    operatorRef,
    reason: reason ?? localPackageReviewReason(requestedDecision),
    evidenceRefs: sourceRefs,
    localPackageReview: {
      projectId,
      packageReviewState: reviewed ? 'reviewed_local_authority_missing' : 'needs_rework',
      localPackageReviewed: reviewed,
      requestChanges: needsRework,
      needsRework,
      issueCodes: needsRework ? ['local_package_needs_rework'] : [],
      localProductionPackageComplete: prerequisiteReport.localProductionPackageComplete ?? 0,
      localDeliveryEvidencePresent: prerequisiteReport.localDeliveryEvidencePresent ?? 0,
      localDeliveryEvidenceIntact: prerequisiteReport.localDeliveryEvidenceIntact ?? 0,
      outputIntegrityBlockingIssues: prerequisiteReport.outputIntegrityBlockingIssues ?? 0,
      outputIntegrityAttentionIssues: prerequisiteReport.outputIntegrityAttentionIssues ?? 0,
      exportReceipts: prerequisiteReport.exportReceipts ?? 0,
      ffmpegDeliveryReceipts: prerequisiteReport.ffmpegDeliveryReceipts ?? 0,
      publicationAuthorization: false,
      productionReady: false,
      localOnly: true,
      operatorGuidanceOnly: true
    },
    reviewAcknowledged: true,
    nextAction: localPackageReviewNextAction(requestedDecision),
    localDecisionOnly: true,
    operatorGuidanceOnly: true,
    executionPerformed: false,
    authorityGranted: false,
    approvalAuthority: false,
    ratifierAuthority: false,
    publicationAuthorization: false,
    providerTruth: false,
    byteAvailabilityProof: false,
    materializationProof: false,
    resourceAdmission: false,
    causalTruth: false,
    edgeCalled: false,
    meshPublished: false,
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    localTruthLabel: 'local decision',
    truthStatus,
    createdAt
  }
  decision.freshnessBasis = createLocalPackageReviewFreshnessBasis({ records, prerequisiteReport })
  decision.freshnessPosture = evaluateLocalPackageReviewFreshness({ decision, records, prerequisiteReport })

  validateRequiredRecord(decision)
  return decision
}

export function assertPackageReviewable(prerequisiteReport) {
  if ((prerequisiteReport.candidates ?? 0) <= 0) {
    throw new Error('Local package review requires at least one production candidate')
  }

  if ((prerequisiteReport.localProductionPackageComplete ?? 0) !== prerequisiteReport.candidates) {
    throw new Error('Local package review requires complete local production package posture')
  }

  if ((prerequisiteReport.localDeliveryEvidenceIntact ?? 0) !== prerequisiteReport.candidates) {
    throw new Error('Local package review requires intact local delivery evidence')
  }

  if ((prerequisiteReport.outputIntegrityBlockingIssues ?? 0) > 0) {
    throw new Error('Local package review is blocked by output integrity issues')
  }
}

function assertLocalPackageReviewDecision(decision) {
  if (!['review_local_package', 'request_changes'].includes(decision)) {
    throw new Error(`Unsupported local package review decision: ${decision}`)
  }
}

function localPackageReviewReason(decision) {
  if (decision === 'request_changes') {
    return 'Operator locally reviewed the completed output package and requested changes before any publication/export authority request.'
  }
  return 'Operator locally reviewed the complete local output package after output integrity checks passed.'
}

function localPackageReviewNextAction(decision) {
  if (decision === 'request_changes') {
    return 'Revise the rough cut or local output package, regenerate output integrity, and review the local package again before requesting publication/export authority.'
  }
  return 'Create a publication/export authority request candidate if the operator wants future authority review; this local review does not authorize publication.'
}

export function formatLocalPackageReviewDecisionSummary(decision, output = defaultOutput) {
  return [
    `local package review decision: ${decision.decisionType}`,
    `project=${decision.projectId}`,
    `state=${decision.localPackageReview.packageReviewState}`,
    `needsRework=${decision.localPackageReview.needsRework}`,
    `localProductionPackageComplete=${decision.localPackageReview.localProductionPackageComplete}`,
    `localDeliveryEvidenceIntact=${decision.localPackageReview.localDeliveryEvidenceIntact}`,
    `outputIntegrityBlockingIssues=${decision.localPackageReview.outputIntegrityBlockingIssues}`,
    `publicationAuthorization=${decision.publicationAuthorization}`,
    `productionReady=${decision.localPackageReview.productionReady}`,
    `output=${output}`
  ].join(' | ')
}

function packageReviewSourceRefs(records) {
  return records
    .filter((entry) => [
      artifactKinds.mediaProductionAuthorityPrerequisitesLocal,
      artifactKinds.mediaAuthorityHandoffCandidateLocal,
      artifactKinds.mediaRoughCutCapsuleLocal,
      artifactKinds.mediaRenderReceiptLocal,
      artifactKinds.mediaExportReceiptLocal,
      artifactKinds.mediaOperatorPacketIndexLocal,
      artifactKinds.mediaEdgeCompatibilityBundleLocal
    ].includes(entry.record.schema))
    .map((entry) => localRecordRef(kindForSchema(entry.record.schema), idForRecord(entry.record), entry.record.schema, entry.path))
}

function localRecordRef(kind, id, schema, recordPath) {
  return {
    ...makeRef(kind, id, schema),
    path: recordPath,
    localOnly: true
  }
}

function kindForSchema(schema) {
  return {
    [artifactKinds.mediaProductionAuthorityPrerequisitesLocal]: 'media-production-authority-prerequisites',
    [artifactKinds.mediaAuthorityHandoffCandidateLocal]: 'media-authority-handoff-candidate',
    [artifactKinds.mediaRoughCutCapsuleLocal]: 'media-rough-cut-capsule',
    [artifactKinds.mediaRenderReceiptLocal]: 'media-render-receipt',
    [artifactKinds.mediaExportReceiptLocal]: 'media-export-receipt',
    [artifactKinds.mediaOperatorPacketIndexLocal]: 'media-operator-packet-index',
    [artifactKinds.mediaEdgeCompatibilityBundleLocal]: 'media-edge-compatibility-bundle'
  }[schema] ?? 'media-local-record'
}

function idForRecord(record) {
  return record.reportId ??
    record.handoffCandidateId ??
    record.roughCutId ??
    record.renderReceiptId ??
    record.exportReceiptId ??
    record.indexId ??
    record.compatibilityBundleId ??
    record.schema
}

if (process.argv[1] === modulePath) {
  await writeLocalPackageReviewDecision(parseArgs(process.argv.slice(2)))
}
