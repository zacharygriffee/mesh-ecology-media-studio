import { artifactKinds } from '../contracts/artifact-kinds.js'
import { readProjectRecords } from '../seams/project-status.js'
import { createProductionAuthorityPrerequisiteReport } from './authority-prerequisites.js'
import { evaluateLocalOutputIntegrity } from './output-integrity.js'
import {
  evaluateLocalPackageReviewFreshness,
  latestLocalPackageReviewEntry
} from './package-authority-freshness.js'

export async function createLocalPackagePostureSummary({
  projectDir,
  records,
  prerequisiteReport,
  outputIntegritySummary
} = {}) {
  const normalizedRecords = normalizeRecordEntries(records ?? await readProjectRecords(projectDir))
  const report = prerequisiteReport ?? await createProductionAuthorityPrerequisiteReport({ projectDir })
  const integrity = outputIntegritySummary ?? (projectDir
    ? await evaluateLocalOutputIntegrity({ projectDir, records: normalizedRecords })
    : outputIntegrityFromReport(report))

  return summarizeLocalPackagePosture({
    records: normalizedRecords,
    prerequisiteReport: report,
    outputIntegritySummary: integrity
  })
}

export function summarizeLocalPackagePosture({
  records = [],
  prerequisiteReport = {},
  outputIntegritySummary
} = {}) {
  const normalizedRecords = normalizeRecordEntries(records)
  const latestReview = latestLocalPackageReviewEntry(normalizedRecords)
  const latestReviewRecord = latestReview?.record ?? null
  const latestReviewFreshness = latestReviewRecord?.localPackageReview?.localPackageReviewed === true
    ? evaluateLocalPackageReviewFreshness({
      decision: latestReviewRecord,
      records: normalizedRecords,
      prerequisiteReport
    })
    : null
  const integrity = outputIntegritySummary ?? outputIntegrityFromReport(prerequisiteReport)
  const publicationAuthorityRequests = normalizedRecords
    .filter((entry) => entry.record.schema === artifactKinds.mediaPublicationAuthorityRequestCandidateLocal).length
  const candidates = prerequisiteReport.candidates ?? 0
  const localProductionPackageComplete = prerequisiteReport.localProductionPackageComplete ?? 0
  const localDeliveryEvidenceIntact = prerequisiteReport.localDeliveryEvidenceIntact ?? integrity.localDeliveryEvidenceIntact ?? 0
  const outputIntegrityBlockingIssues = integrity.outputIntegrityBlockingIssues ?? prerequisiteReport.outputIntegrityBlockingIssues ?? 0
  const outputIntegrityAttentionIssues = integrity.outputIntegrityAttentionIssues ?? prerequisiteReport.outputIntegrityAttentionIssues ?? 0
  const reviewPosture = summarizeReviewPosture(latestReviewRecord, latestReviewFreshness)
  const integrityPosture = summarizeIntegrityPosture({
    outputIntegrityBlockingIssues,
    outputIntegrityAttentionIssues,
    localDeliveryEvidenceIntact,
    candidates
  })
  const packageState = summarizePackageState({
    candidates,
    localProductionPackageComplete,
    localDeliveryEvidenceIntact,
    outputIntegrityBlockingIssues,
    reviewPosture,
    latestReviewFreshness
  })

  return {
    summaryKind: 'studio-local-package-posture-summary',
    packageState,
    latestReviewPosture: reviewPosture,
    integrityPosture,
    candidates,
    localProductionPackageComplete,
    localDeliveryEvidenceIntact,
    outputIntegrityBlockingIssues,
    outputIntegrityAttentionIssues,
    publicationAuthorityRequests,
    pendingAuthority: prerequisiteReport.pendingAuthority ?? 0,
    productionReady: prerequisiteReport.productionReady ?? 0,
    latestReviewRef: latestReviewRecord
      ? {
          kind: 'media-operator-decision',
          id: latestReviewRecord.decisionId,
          schema: latestReviewRecord.schema,
          path: latestReview.path ?? latestReview.relativePath,
          localOnly: true
        }
      : null,
    latestReviewFreshness,
    issueCodes: issueCodesForPosture({
      packageState,
      reviewPosture,
      integrityPosture,
      latestReviewFreshness
    }),
    safeNextAction: safeNextActionForPackageState(packageState),
    nonClaims: {
      localOnly: true,
      operatorGuidanceOnly: true,
      approvalAuthority: false,
      ratifierAuthority: false,
      publicationAuthorization: false,
      productionReady: false,
      meshTruth: false,
      resourceAdmission: false,
      byteAvailabilityProof: false,
      materializationProof: false,
      causalTruth: false,
      edgeCalled: false,
      meshPublished: false
    },
    localOnly: true,
    operatorGuidanceOnly: true,
    authorityGranted: false,
    publicationAuthorization: false,
    productionReadyClaimed: false
  }
}

export function formatLocalPackagePostureFields(posture) {
  return [
    `localPackage=${posture.packageState}`,
    `review=${posture.latestReviewPosture}`,
    `integrity=${posture.integrityPosture}`,
    `nextAction=${posture.safeNextAction}`
  ].join(' | ')
}

function normalizeRecordEntries(records = []) {
  return records.map((entry) => ({
    ...entry,
    path: entry.path ?? entry.relativePath
  }))
}

function outputIntegrityFromReport(report = {}) {
  return {
    localDeliveryEvidenceIntact: report.localDeliveryEvidenceIntact ?? 0,
    outputIntegrityBlockingIssues: report.outputIntegrityBlockingIssues ?? 0,
    outputIntegrityAttentionIssues: report.outputIntegrityAttentionIssues ?? 0,
    localOnly: true,
    operatorGuidanceOnly: true,
    productionReady: false
  }
}

function summarizeReviewPosture(latestReview, freshness) {
  if (!latestReview?.localPackageReview) return 'missing'
  if (latestReview.localPackageReview.needsRework === true) return 'request_changes'
  if (latestReview.localPackageReview.localPackageReviewed === true) {
    return freshness?.state === 'stale' ? 'reviewed_stale' : 'reviewed_fresh'
  }
  return 'unsupported'
}

function summarizeIntegrityPosture({
  outputIntegrityBlockingIssues,
  outputIntegrityAttentionIssues,
  localDeliveryEvidenceIntact,
  candidates
}) {
  if (outputIntegrityBlockingIssues > 0) return 'blocked'
  if (candidates > 0 && localDeliveryEvidenceIntact !== candidates) return 'incomplete'
  if (outputIntegrityAttentionIssues > 0) return 'attention'
  return 'clear'
}

function summarizePackageState({
  candidates,
  localProductionPackageComplete,
  localDeliveryEvidenceIntact,
  outputIntegrityBlockingIssues,
  reviewPosture,
  latestReviewFreshness
}) {
  if (reviewPosture === 'request_changes') return 'review_requested_changes'
  if (outputIntegrityBlockingIssues > 0) return 'output_integrity_blocked'
  if (latestReviewFreshness?.state === 'stale' || reviewPosture === 'reviewed_stale') return 'stale_review'
  if (candidates <= 0 || localProductionPackageComplete !== candidates || localDeliveryEvidenceIntact !== candidates) {
    return 'incomplete_local_package'
  }
  if (reviewPosture === 'missing' || reviewPosture === 'unsupported') return 'no_package_review'
  return 'complete_review_only_authority_missing'
}

function issueCodesForPosture({
  packageState,
  reviewPosture,
  integrityPosture,
  latestReviewFreshness
}) {
  const issues = []
  if (packageState !== 'complete_review_only_authority_missing') issues.push(packageState)
  if (reviewPosture !== 'reviewed_fresh') issues.push(`local_package_review_${reviewPosture}`)
  if (!['clear', 'attention'].includes(integrityPosture)) issues.push(`local_package_integrity_${integrityPosture}`)
  issues.push(...(latestReviewFreshness?.issueCodes ?? []))
  return [...new Set(issues)]
}

function safeNextActionForPackageState(packageState) {
  if (packageState === 'complete_review_only_authority_missing') {
    return 'Route the reviewed local package and request candidate to a future authority lane; no publication authorization is granted locally.'
  }
  if (packageState === 'review_requested_changes') {
    return 'Run npm run production:package-rework to regenerate local output from the request-changes review.'
  }
  if (packageState === 'stale_review') {
    return 'Run npm run production:package-rework to refresh the stale reviewed local package.'
  }
  if (packageState === 'output_integrity_blocked') {
    return 'Resolve output integrity blockers, then rerun production:local-output or production:package-rework.'
  }
  if (packageState === 'no_package_review') {
    return 'Run npm run production:local-package-review after local package evidence is complete.'
  }
  return 'Run npm run production:local-output to create or refresh complete local package evidence.'
}
