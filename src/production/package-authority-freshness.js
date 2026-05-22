import { artifactKinds } from '../contracts/artifact-kinds.js'
import { makeRef } from '../contracts/constructors.js'

const packageReviewSchemas = new Set([
  artifactKinds.mediaProductionAuthorityPrerequisitesLocal,
  artifactKinds.mediaRoughCutCapsuleLocal,
  artifactKinds.mediaRenderReceiptLocal,
  artifactKinds.mediaExportReceiptLocal
])

const publicationRequestSchemas = new Set([
  artifactKinds.mediaOperatorDecision,
  artifactKinds.mediaProductionAuthorityPrerequisitesLocal,
  artifactKinds.mediaRoughCutCapsuleLocal,
  artifactKinds.mediaRenderReceiptLocal,
  artifactKinds.mediaExportReceiptLocal,
  artifactKinds.mediaExportCandidateLocal,
  artifactKinds.mediaExportPlanCandidateLocal
])

export function createLocalPackageReviewFreshnessBasis({ records = [], prerequisiteReport }) {
  return {
    basisKind: 'local-package-review-freshness-basis',
    sourceRefSignature: sourceRefSignature(currentPackageReviewSourceRefs(records)),
    prerequisiteSignature: prerequisiteSignature(prerequisiteReport),
    localOnly: true,
    operatorGuidanceOnly: true,
    publicationAuthorization: false,
    productionReady: false
  }
}

export function createPublicationAuthorityRequestFreshnessBasis({ records = [], prerequisiteReport }) {
  return {
    basisKind: 'publication-authority-request-freshness-basis',
    sourceRefSignature: sourceRefSignature(currentPublicationRequestSourceRefs(records)),
    prerequisiteSignature: prerequisiteSignature(prerequisiteReport),
    localPackageReviewDecisionSignature: sourceRefSignature(currentLocalPackageReviewDecisionRefs(records)),
    localOnly: true,
    operatorGuidanceOnly: true,
    publicationAuthorization: false,
    productionReady: false
  }
}

export function evaluateLocalPackageReviewFreshness({
  decision,
  records = [],
  prerequisiteReport
}) {
  const issueCodes = []
  const currentBasis = createLocalPackageReviewFreshnessBasis({ records, prerequisiteReport })
  const recordedBasis = decision.freshnessBasis ?? {
    sourceRefSignature: sourceRefSignature(decision.evidenceRefs ?? []),
    prerequisiteSignature: prerequisiteSignature(decision.localPackageReview ?? {})
  }

  collectPrerequisiteIssues(issueCodes, prerequisiteReport)

  if (recordedBasis.sourceRefSignature !== currentBasis.sourceRefSignature) {
    issueCodes.push('local_package_review_source_refs_changed')
  }

  if (recordedBasis.prerequisiteSignature !== currentBasis.prerequisiteSignature) {
    issueCodes.push('local_package_review_prerequisites_changed')
  }

  const uniqueIssues = [...new Set(issueCodes)]
  return freshnessPosture({
    state: uniqueIssues.length === 0 ? 'fresh' : 'stale',
    issueCodes: uniqueIssues,
    checkedRefs: currentPackageReviewSourceRefs(records),
    nextAction: uniqueIssues.length === 0
      ? 'Local package review is current for the local output package; publication authorization remains separate.'
      : 'Regenerate local output, authority prerequisites, and local package review before requesting publication/export authority.'
  })
}

export function evaluatePublicationAuthorityRequestFreshness({
  candidate,
  records = [],
  prerequisiteReport
}) {
  const issueCodes = []
  const currentBasis = createPublicationAuthorityRequestFreshnessBasis({ records, prerequisiteReport })
  const recordedBasis = candidate.freshnessBasis ?? {
    sourceRefSignature: sourceRefSignature(candidate.sourceRefs ?? []),
    prerequisiteSignature: prerequisiteSignature(candidate.prerequisiteSummary ?? {}),
    localPackageReviewDecisionSignature: sourceRefSignature(candidate.localPackageReviewDecisionRefs ?? [])
  }

  collectPrerequisiteIssues(issueCodes, prerequisiteReport)

  if (recordedBasis.sourceRefSignature !== currentBasis.sourceRefSignature) {
    issueCodes.push('publication_authority_request_source_refs_changed')
  }

  if (recordedBasis.prerequisiteSignature !== currentBasis.prerequisiteSignature) {
    issueCodes.push('publication_authority_request_prerequisites_changed')
  }

  if (recordedBasis.localPackageReviewDecisionSignature !== currentBasis.localPackageReviewDecisionSignature) {
    issueCodes.push('publication_authority_request_local_package_review_changed')
  }

  const currentReviewRefs = currentLocalPackageReviewDecisionRefs(records)
  if (currentReviewRefs.length === 0) {
    issueCodes.push('publication_authority_request_local_package_review_missing')
  }

  const uniqueIssues = [...new Set(issueCodes)]
  return freshnessPosture({
    state: uniqueIssues.length === 0 ? 'fresh' : 'stale',
    issueCodes: uniqueIssues,
    checkedRefs: currentPublicationRequestSourceRefs(records),
    nextAction: uniqueIssues.length === 0
      ? 'Publication/export authority request candidate is current and still request-only; route it to a future authority lane if desired.'
      : 'Regenerate authority prerequisites, local package review, and publication/export authority request candidate before future authority review.'
  })
}

export function currentPackageReviewSourceRefs(records = []) {
  return refsForRecords(records.filter((entry) => packageReviewSchemas.has(entry.record.schema)))
}

export function currentPublicationRequestSourceRefs(records = []) {
  return refsForRecords(records
    .filter((entry) => publicationRequestSchemas.has(entry.record.schema))
    .filter((entry) => entry.record.schema !== artifactKinds.mediaOperatorDecision || entry.record.decisionType === 'review_local_package'))
}

export function currentLocalPackageReviewDecisionRefs(records = []) {
  const latestReviewEntry = latestLocalPackageReviewEntry(records)
  if (
    latestReviewEntry?.record.decisionType !== 'review_local_package' ||
    latestReviewEntry.record.localPackageReview?.localPackageReviewed !== true
  ) {
    return []
  }
  return refsForRecords([latestReviewEntry])
}

export function latestLocalPackageReviewEntry(records = []) {
  return records
    .filter((entry) => entry.record.schema === artifactKinds.mediaOperatorDecision)
    .filter((entry) => entry.record.localPackageReview)
    .sort(compareRecordEntriesDescending)[0] ?? null
}

function collectPrerequisiteIssues(issueCodes, prerequisiteReport = {}) {
  if ((prerequisiteReport.candidates ?? 0) <= 0) {
    issueCodes.push('current_production_candidates_missing')
  }

  if ((prerequisiteReport.localProductionPackageComplete ?? 0) !== (prerequisiteReport.candidates ?? 0)) {
    issueCodes.push('current_local_production_package_incomplete')
  }

  if ((prerequisiteReport.localDeliveryEvidenceIntact ?? 0) !== (prerequisiteReport.candidates ?? 0)) {
    issueCodes.push('current_local_delivery_evidence_not_intact')
  }

  if ((prerequisiteReport.outputIntegrityBlockingIssues ?? 0) > 0) {
    issueCodes.push('current_output_integrity_blocking')
  }

  if ((prerequisiteReport.productionReady ?? 0) !== 0) {
    issueCodes.push('unexpected_production_ready_claim')
  }
}

function prerequisiteSignature(report = {}) {
  return stableSignature({
    schema: report.schema,
    candidates: report.candidates ?? 0,
    localProductionPackageComplete: report.localProductionPackageComplete ?? 0,
    localDeliveryEvidencePresent: report.localDeliveryEvidencePresent ?? 0,
    localDeliveryEvidenceIntact: report.localDeliveryEvidenceIntact ?? 0,
    outputIntegrityBlockingIssues: report.outputIntegrityBlockingIssues ?? 0,
    outputIntegrityAttentionIssues: report.outputIntegrityAttentionIssues ?? 0,
    roughCutReviewed: report.roughCutReviewed ?? 0,
    roughCutChangesRequested: report.roughCutChangesRequested ?? 0,
    renderReceipts: report.renderReceipts ?? 0,
    renderReceiptsFresh: report.renderReceiptsFresh ?? 0,
    renderReceiptsStale: report.renderReceiptsStale ?? 0,
    exportReceipts: report.exportReceipts ?? 0,
    exportReceiptsFresh: report.exportReceiptsFresh ?? 0,
    exportReceiptsStale: report.exportReceiptsStale ?? 0,
    localPackageCopyExportReceipts: report.localPackageCopyExportReceipts ?? 0,
    ffmpegDeliveryReceipts: report.ffmpegDeliveryReceipts ?? 0,
    activeDeliveryReceipts: report.activeDeliveryReceipts ?? 0,
    currentExportReceiptAttention: report.currentExportReceiptAttention ?? 0,
    historicalExportReceiptAttention: report.historicalExportReceiptAttention ?? 0,
    pendingAuthority: report.pendingAuthority ?? 0,
    productionReady: report.productionReady ?? false
  })
}

function sourceRefSignature(refs = []) {
  return stableSignature(refs
    .map((ref) => ({
      schema: ref.schema,
      kind: ref.kind,
      id: ref.id,
      path: ref.path
    }))
    .sort(compareRefParts))
}

function refsForRecords(entries = []) {
  return entries
    .map((entry) => localRecordRef(kindForSchema(entry.record.schema), idForRecord(entry.record), entry.record.schema, entry.path))
    .filter((ref) => ref.id)
    .sort(compareRefs)
}

function compareRecordEntriesDescending(left, right) {
  const rightTime = Date.parse(right.record.createdAt ?? '') || 0
  const leftTime = Date.parse(left.record.createdAt ?? '') || 0
  if (rightTime !== leftTime) return rightTime - leftTime
  return (right.path ?? '').localeCompare(left.path ?? '')
}

function freshnessPosture({ state, issueCodes, checkedRefs, nextAction }) {
  const blockingIssueCodes = issueCodes.filter(isBlockingIssueCode)
  const attentionIssueCodes = issueCodes.filter((issueCode) => !isBlockingIssueCode(issueCode))
  return {
    state,
    issueCodes,
    blockingIssueCodes,
    attentionIssueCodes,
    requestReviewBlocked: blockingIssueCodes.length > 0,
    integrityBlocking: blockingIssueCodes.includes('current_output_integrity_blocking') ||
      blockingIssueCodes.includes('current_local_delivery_evidence_not_intact'),
    checkedRefs,
    nextAction,
    localOnly: true,
    operatorGuidanceOnly: true,
    reviewOnly: true,
    requestOnly: true,
    authorityGranted: false,
    approvalAuthority: false,
    ratifierAuthority: false,
    publicationAuthorization: false,
    productionReady: false,
    meshTruth: false,
    edgeCalled: false,
    meshPublished: false
  }
}

function isBlockingIssueCode(issueCode) {
  return [
    'current_production_candidates_missing',
    'current_local_production_package_incomplete',
    'current_local_delivery_evidence_not_intact',
    'current_output_integrity_blocking',
    'unexpected_production_ready_claim'
  ].includes(issueCode)
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
    [artifactKinds.mediaOperatorDecision]: 'media-operator-decision',
    [artifactKinds.mediaAuthorityHandoffCandidateLocal]: 'media-authority-handoff-candidate',
    [artifactKinds.mediaProductionAuthorityPrerequisitesLocal]: 'media-production-authority-prerequisites',
    [artifactKinds.mediaRoughCutCapsuleLocal]: 'media-rough-cut-capsule',
    [artifactKinds.mediaRenderReceiptLocal]: 'media-render-receipt',
    [artifactKinds.mediaExportReceiptLocal]: 'media-export-receipt',
    [artifactKinds.mediaExportCandidateLocal]: 'media-export-candidate',
    [artifactKinds.mediaExportPlanCandidateLocal]: 'media-export-plan-candidate'
  }[schema] ?? 'media-local-record'
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

function compareRefs(left, right) {
  return compareRefParts(
    { schema: left.schema, kind: left.kind, id: left.id, path: left.path },
    { schema: right.schema, kind: right.kind, id: right.id, path: right.path }
  )
}

function compareRefParts(left, right) {
  return `${left.schema}:${left.kind}:${left.id}:${left.path ?? ''}`
    .localeCompare(`${right.schema}:${right.kind}:${right.id}:${right.path ?? ''}`)
}

function stableSignature(value) {
  return JSON.stringify(value)
}
