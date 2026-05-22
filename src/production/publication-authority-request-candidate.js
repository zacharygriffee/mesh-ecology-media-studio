import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { artifactKinds } from '../contracts/artifact-kinds.js'
import { makeRef, nowIso } from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import { assertSafeLocalPath } from '../local/project-layout.js'
import { writeJsonAtomic } from '../local/atomic-json.js'
import { readProjectRecords } from '../seams/project-status.js'
import { createProductionAuthorityPrerequisiteReport } from './authority-prerequisites.js'
import {
  createPublicationAuthorityRequestFreshnessBasis,
  evaluatePublicationAuthorityRequestFreshness,
  latestLocalPackageReviewEntry
} from './package-authority-freshness.js'

const modulePath = fileURLToPath(import.meta.url)
const defaultProjectDir = 'examples/venice-smoke'
const defaultOutput = 'records/production/media-publication-authority-request-candidate.local.json'
const truthStatus = 'not mesh truth; not distributed proof; not ratified shared state'

function parseArgs(argv) {
  const args = {
    projectDir: defaultProjectDir,
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

export async function writePublicationAuthorityRequestCandidate({
  projectDir = defaultProjectDir,
  output = defaultOutput,
  print = false,
  quiet = false,
  createdAt = nowIso()
} = {}) {
  assertSafeLocalPath(output)

  const root = path.resolve(projectDir)
  const records = await readProjectRecords(root)
  const prerequisiteReport = await createProductionAuthorityPrerequisiteReport({ projectDir })
  const candidate = createPublicationAuthorityRequestCandidateFromRecords({
    records,
    prerequisiteReport,
    createdAt
  })

  await writeJsonAtomic(root, output, candidate)

  if (print) {
    console.log(JSON.stringify(candidate, null, 2))
  } else if (!quiet) {
    console.log(formatPublicationAuthorityRequestCandidateSummary(candidate, output))
    console.log(`nextAction: ${candidate.nextActions[0]}`)
    console.log('nonClaims: request-only; no approval authority; no ratifier authority; no publication authorization; productionReady=false')
  }

  return {
    candidate,
    output
  }
}

export function createPublicationAuthorityRequestCandidateFromRecords({
  records,
  prerequisiteReport,
  createdAt = nowIso()
}) {
  assertRequestable(prerequisiteReport)
  const projectId = prerequisiteReport.projectId
  const activeLocalPackageReviewEntry = latestLocalPackageReviewEntry(records)
  const localPackageReviewDecisionRefs = isLocalPackageReviewDecision(activeLocalPackageReviewEntry?.record)
    ? [localRecordRef(
      'media-operator-decision',
      idForRecord(activeLocalPackageReviewEntry.record),
      activeLocalPackageReviewEntry.record.schema,
      activeLocalPackageReviewEntry.path
    )]
    : []
  if (localPackageReviewDecisionRefs.length === 0) {
    throw new Error('Publication/export authority request candidate requires local package review decision as the latest active package review')
  }

  const authorityHandoffRefs = refsForSchema(records, artifactKinds.mediaAuthorityHandoffCandidateLocal, 'media-authority-handoff-candidate')
  const authorityPrereqRefs = refsForSchema(records, artifactKinds.mediaProductionAuthorityPrerequisitesLocal, 'media-production-authority-prerequisites')
  const roughCutRefs = refsForSchema(records, artifactKinds.mediaRoughCutCapsuleLocal, 'media-rough-cut-capsule')
  const renderReceiptRefs = refsForSchema(records, artifactKinds.mediaRenderReceiptLocal, 'media-render-receipt')
  const exportReceiptRefs = refsForSchema(records, artifactKinds.mediaExportReceiptLocal, 'media-export-receipt')
  const exportCandidateRefs = refsForSchema(records, artifactKinds.mediaExportCandidateLocal, 'media-export-candidate')
  const exportPlanRefs = refsForSchema(records, artifactKinds.mediaExportPlanCandidateLocal, 'media-export-plan-candidate')
  const sourceRefs = compactRefs([
    ...localPackageReviewDecisionRefs,
    ...authorityHandoffRefs,
    ...authorityPrereqRefs,
    ...roughCutRefs,
    ...renderReceiptRefs,
    ...exportReceiptRefs,
    ...exportCandidateRefs,
    ...exportPlanRefs
  ])

  const candidate = {
    schema: artifactKinds.mediaPublicationAuthorityRequestCandidateLocal,
    requestCandidateId: `publication-authority-request-${stableId([
      projectId,
      ...localPackageReviewDecisionRefs.map((ref) => ref.id),
      ...exportReceiptRefs.map((ref) => ref.id),
      ...authorityPrereqRefs.map((ref) => ref.id)
    ].join('|'))}`,
    projectId,
    requestKind: 'publication-export-authority-review-candidate',
    mode: 'standalone-local',
    targetAuthorityLane: 'future-publication-export-authority-lane',
    prerequisiteSummary: {
      schema: prerequisiteReport.schema,
      candidates: prerequisiteReport.candidates,
      localProductionPackageComplete: prerequisiteReport.localProductionPackageComplete ?? 0,
      localDeliveryEvidencePresent: prerequisiteReport.localDeliveryEvidencePresent ?? 0,
      localDeliveryEvidenceIntact: prerequisiteReport.localDeliveryEvidenceIntact ?? 0,
      outputIntegrityBlockingIssues: prerequisiteReport.outputIntegrityBlockingIssues ?? 0,
      outputIntegrityAttentionIssues: prerequisiteReport.outputIntegrityAttentionIssues ?? 0,
      exportReceipts: prerequisiteReport.exportReceipts ?? 0,
      ffmpegDeliveryReceipts: prerequisiteReport.ffmpegDeliveryReceipts ?? 0,
      exportAuthorizationMissing: prerequisiteReport.exportAuthorizationMissing ?? 0,
      publicationAuthorizationMissing: true,
      pendingAuthority: prerequisiteReport.pendingAuthority ?? 0,
      productionReady: false,
      operatorGuidanceOnly: true,
      localOnly: true
    },
    localPackageReviewDecisionRefs,
    authorityReviewInputs: [
      {
        inputKind: 'local-package-review-decision',
        refs: localPackageReviewDecisionRefs,
        required: true,
        present: true,
        localDecisionOnly: true,
        publicationAuthorization: false,
        localOnly: true
      },
      {
        inputKind: 'production-authority-prerequisites',
        refs: authorityPrereqRefs,
        required: true,
        present: authorityPrereqRefs.length > 0,
        localProductionPackageComplete: prerequisiteReport.localProductionPackageComplete ?? 0,
        localDeliveryEvidenceIntact: prerequisiteReport.localDeliveryEvidenceIntact ?? 0,
        localOnly: true
      },
      {
        inputKind: 'authority-handoff-candidate',
        refs: authorityHandoffRefs,
        required: false,
        present: authorityHandoffRefs.length > 0,
        approvalAuthority: false,
        ratifierAuthority: false,
        publicationAuthorization: false,
        localOnly: true
      },
      {
        inputKind: 'export-receipt',
        refs: exportReceiptRefs,
        required: true,
        present: exportReceiptRefs.length > 0,
        localDeliveryEvidencePresent: prerequisiteReport.localDeliveryEvidencePresent ?? 0,
        localDeliveryEvidenceIntact: prerequisiteReport.localDeliveryEvidenceIntact ?? 0,
        exportAuthorization: false,
        publicationAuthorization: false,
        productionReady: false,
        localOnly: true
      },
      {
        inputKind: 'render-receipt',
        refs: renderReceiptRefs,
        required: true,
        present: renderReceiptRefs.length > 0,
        renderAuthorization: false,
        exportAuthorization: false,
        publicationAuthorization: false,
        localOnly: true
      },
      {
        inputKind: 'rough-cut-capsule',
        refs: roughCutRefs,
        required: true,
        present: roughCutRefs.length > 0,
        publicationAuthorization: false,
        productionReady: false,
        localOnly: true
      }
    ],
    sourceRefs,
    authorityGaps: [
      'export_authorization_missing',
      'publication_authorization_missing',
      'ratifier_authority_missing',
      'production_ready_false',
      'mesh_publication_missing'
    ],
    nextActions: [
      'Submit this request candidate to a future publication/export authority lane for review.',
      'Do not treat this request candidate or local package review decision as publication authorization.'
    ],
    createdAt,
    operatorGuidanceOnly: true,
    requestOnly: true,
    productionReady: false,
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
    localTruthLabel: 'local publication authority request candidate',
    truthStatus
  }
  candidate.freshnessBasis = createPublicationAuthorityRequestFreshnessBasis({ records, prerequisiteReport })
  candidate.freshnessPosture = evaluatePublicationAuthorityRequestFreshness({ candidate, records, prerequisiteReport })

  validateRequiredRecord(candidate)
  return candidate
}

export function formatPublicationAuthorityRequestCandidateSummary(candidate, output = defaultOutput) {
  return [
    `publication authority request candidate: project=${candidate.projectId}`,
    `localPackageReviewed=${candidate.localPackageReviewDecisionRefs.length}`,
    `localProductionPackageComplete=${candidate.prerequisiteSummary.localProductionPackageComplete}`,
    `localDeliveryEvidenceIntact=${candidate.prerequisiteSummary.localDeliveryEvidenceIntact}`,
    `exportReceipts=${candidate.prerequisiteSummary.exportReceipts}`,
    `exportAuthorizationMissing=${candidate.prerequisiteSummary.exportAuthorizationMissing}`,
    `publicationAuthorization=${candidate.publicationAuthorization}`,
    `productionReady=${candidate.productionReady}`,
    `output=${output}`
  ].join(' | ')
}

function assertRequestable(prerequisiteReport) {
  if ((prerequisiteReport.candidates ?? 0) <= 0) {
    throw new Error('Publication/export authority request requires at least one production candidate')
  }

  if ((prerequisiteReport.localProductionPackageComplete ?? 0) !== prerequisiteReport.candidates) {
    throw new Error('Publication/export authority request requires complete local production package posture')
  }

  if ((prerequisiteReport.localDeliveryEvidenceIntact ?? 0) !== prerequisiteReport.candidates) {
    throw new Error('Publication/export authority request requires intact local delivery evidence')
  }

  if ((prerequisiteReport.outputIntegrityBlockingIssues ?? 0) > 0) {
    throw new Error('Publication/export authority request is blocked by output integrity issues')
  }
}

function isLocalPackageReviewDecision(record) {
  return record.decisionType === 'review_local_package' &&
    record.localPackageReview?.localPackageReviewed === true &&
    record.publicationAuthorization === false
}

function refsForSchema(records, schema, kind) {
  return refsForRecordPredicate(records, schema, kind, () => true)
}

function refsForRecordPredicate(records, schema, kind, predicate) {
  return records
    .filter((entry) => entry.record.schema === schema)
    .filter((entry) => predicate(entry.record))
    .sort(compareRecordCreatedAt)
    .map((entry) => localRecordRef(kind, idForRecord(entry.record), entry.record.schema, entry.path))
}

function localRecordRef(kind, id, schema, recordPath) {
  return {
    ...makeRef(kind, id, schema),
    path: recordPath,
    localOnly: true
  }
}

function idForRecord(record) {
  return record.decisionId ??
    record.handoffCandidateId ??
    record.reportId ??
    record.roughCutId ??
    record.renderReceiptId ??
    record.exportReceiptId ??
    record.exportCandidateId ??
    record.planId ??
    record.requestCandidateId ??
    record.schema
}

function compareRecordCreatedAt(left, right) {
  const rightTime = Date.parse(right.record.createdAt ?? '') || 0
  const leftTime = Date.parse(left.record.createdAt ?? '') || 0
  if (rightTime !== leftTime) return rightTime - leftTime
  return (right.path ?? '').localeCompare(left.path ?? '')
}

function stableId(input) {
  return createHash('sha256').update(input).digest('hex').slice(0, 24)
}

function compactRefs(refs) {
  const seen = new Set()
  return refs.filter((ref) => {
    if (!ref?.id) return false
    const key = `${ref.schema}:${ref.id}:${ref.path ?? ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

if (process.argv[1] === modulePath) {
  await writePublicationAuthorityRequestCandidate(parseArgs(process.argv.slice(2)))
}
