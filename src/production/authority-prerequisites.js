import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { artifactKinds } from '../contracts/artifact-kinds.js'
import { nowIso } from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import { collectLayerInteropOptions, createLayerInteropPosture } from '../layer/layer-interop.js'
import { readProjectRecords } from '../seams/project-status.js'
import { summarizeRecordReadDiagnostics, writeJsonAtomic } from '../local/atomic-json.js'
import { evaluateRenderExportCandidateFreshness } from './render-export-candidate.js'
import { summarizeRenderReceipts } from './render-receipts.js'
import { summarizeExportReceipts } from './export-receipts.js'
import { evaluateLocalOutputIntegrity } from './output-integrity.js'
import {
  evaluateLocalPackageReviewFreshness,
  evaluatePublicationAuthorityRequestFreshness
} from './package-authority-freshness.js'

const modulePath = fileURLToPath(import.meta.url)
const defaultProjectDir = 'examples/venice-smoke'
const defaultOutput = 'records/production/media-production-authority-prerequisites.local.json'

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

  return {
    ...args,
    ...collectLayerInteropOptions(argv)
  }
}

export async function createProductionAuthorityPrerequisiteReport({
  projectDir = defaultProjectDir,
  createdAt = nowIso(),
  layerRef,
  layerProfileRef,
  continuityRef,
  desyncPostureRef,
  rbcProfileRefs
} = {}) {
  const root = path.resolve(projectDir)
  const records = await readProjectRecords(root)
  const recordReadDiagnostics = summarizeRecordReadDiagnostics(records)
  const assetRecords = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaAssetDescriptor)
    .map((entry) => entry.record)
  const candidates = assetRecords
    .filter((asset) =>
      asset.localRef?.placementClass === 'media-accepted' &&
      asset.source?.sourceType === 'provider-result' &&
      isProductionAsset(asset)
    )
  const outputIntegrity = await evaluateLocalOutputIntegrity({ projectDir, records })
  const exportReceiptSummary = summarizeExportReceipts(records)
  const rows = candidates.map((asset) => summarizeCandidateAuthorityPrerequisites(asset, records, outputIntegrity))
  const projectId = rows[0]?.projectId ??
    records.find((entry) => typeof entry.record.projectId === 'string')?.record.projectId ??
    path.basename(root)
  const candidateCount = rows.length
  const localPackageComplete = rows.filter((row) => row.localPackageState === 'local-package-complete-authority-missing').length
  const localProductionPackageComplete = rows.filter((row) => row.localProductionPackageComplete).length
  const localProductionPackageState = rows.length > 0 && rows.every((row) => row.localProductionPackageComplete)
    ? 'local-production-package-complete-authority-missing'
    : 'local-production-package-incomplete'
  const exportReceiptCount = exportReceiptSummary.total
  const exportReceiptsFresh = exportReceiptSummary.fresh
  const exportReceiptsStale = exportReceiptSummary.stale
  const localPackageCopyExportReceipts = exportReceiptSummary.localPackageCopyExportReceipts
  const ffmpegDeliveryReceipts = exportReceiptSummary.ffmpegDeliveryReceipts
  const activeDeliveryReceipts = exportReceiptSummary.activeDeliveryReceipts
  const historicalExportReceipts = exportReceiptSummary.historicalExportReceipts
  const currentExportReceiptAttention = exportReceiptSummary.currentAttention
  const historicalExportReceiptAttention = exportReceiptSummary.historicalAttention
  const localDeliveryEvidencePresent = rows.filter((row) => row.exportReceiptPosture?.localDeliveryEvidencePresent).length
  const localDeliveryEvidenceIntact = rows.filter((row) => row.exportReceiptPosture?.localDeliveryEvidenceIntact).length
  const outputIntegrityBlockingIssues = rows.reduce((sum, row) => sum + (row.outputIntegrityBlockingIssues ?? 0), 0)
  const outputIntegrityAttentionIssues = rows.reduce((sum, row) => sum + (row.outputIntegrityAttentionIssues ?? 0), 0)
  const pendingAuthority = rows.filter((row) => row.authorityState === 'authority-missing').length
  const packageAuthoritySummary = summarizePackageAuthorityForPrereqs(records, {
    schema: artifactKinds.mediaProductionAuthorityPrerequisitesLocal,
    candidates: candidateCount,
    localProductionPackageComplete,
    localDeliveryEvidencePresent,
    localDeliveryEvidenceIntact,
    outputIntegrityBlockingIssues,
    outputIntegrityAttentionIssues,
    roughCutReviewed: rows.filter((row) => row.roughCutReviewPosture?.state === 'rough-cut-reviewed-local').length,
    roughCutChangesRequested: rows.filter((row) => row.roughCutReviewPosture?.state === 'rough-cut-changes-requested').length,
    renderReceipts: rows.filter((row) => row.renderReceiptPosture?.present).length,
    renderReceiptsFresh: rows.filter((row) => row.renderReceiptPosture?.freshnessState === 'fresh').length,
    renderReceiptsStale: rows.filter((row) => row.renderReceiptPosture?.freshnessState === 'stale').length,
    exportReceipts: exportReceiptCount,
    exportReceiptsFresh,
    exportReceiptsStale,
    localPackageCopyExportReceipts,
    ffmpegDeliveryReceipts,
    activeDeliveryReceipts,
    historicalExportReceipts,
    currentExportReceiptAttention,
    historicalExportReceiptAttention,
    pendingAuthority,
    productionReady: 0
  })

  return {
    schema: artifactKinds.mediaProductionAuthorityPrerequisitesLocal,
    reportId: `production-authority-prerequisites-${projectId}`,
    projectId,
    mode: 'standalone-local',
    candidates: candidateCount,
    localPackageComplete,
    localProductionPackageComplete,
    localProductionPackageState,
    authorityMissing: true,
    layerInteropPosture: createLayerInteropPosture({
      layerRef,
      layerProfileRef,
      continuityRef,
      desyncPostureRef,
      rbcProfileRefs
    }),
    missingLocalPrerequisites: rows.filter((row) => row.missingLocalPrerequisites.length > 0).length,
    roughCutReviewed: rows.filter((row) => row.roughCutReviewPosture?.state === 'rough-cut-reviewed-local').length,
    roughCutChangesRequested: rows.filter((row) => row.roughCutReviewPosture?.state === 'rough-cut-changes-requested').length,
    roughCutDeferred: rows.filter((row) => row.roughCutReviewPosture?.state === 'rough-cut-review-deferred').length,
    renderExportCandidates: rows.filter((row) => row.renderExportCandidatePosture?.present).length,
    renderExportCandidatesFresh: rows.filter((row) => row.renderExportCandidatePosture?.freshnessState === 'fresh').length,
    renderExportCandidatesStale: rows.filter((row) => row.renderExportCandidatePosture?.freshnessState === 'stale').length,
    renderReceipts: rows.filter((row) => row.renderReceiptPosture?.present).length,
    renderReceiptsFresh: rows.filter((row) => row.renderReceiptPosture?.freshnessState === 'fresh').length,
    renderReceiptsStale: rows.filter((row) => row.renderReceiptPosture?.freshnessState === 'stale').length,
    exportReceipts: exportReceiptCount,
    exportReceiptsFresh,
    exportReceiptsStale,
    localPackageCopyExportReceipts,
    ffmpegDeliveryReceipts,
    activeDeliveryReceipts,
    historicalExportReceipts,
    currentExportReceiptAttention,
    historicalExportReceiptAttention,
    localDeliveryEvidencePresent,
    localDeliveryEvidenceIntact,
    outputIntegrityBlockingIssues,
    outputIntegrityAttentionIssues,
    deliveryCreated: rows.filter((row) => row.exportReceiptPosture?.deliveryCreated).length,
    exportPerformed: rows.filter((row) => row.exportReceiptPosture?.exportPerformed).length,
    renderAuthorizationMissing: rows.length,
    exportAuthorizationMissing: rows.length,
    localPackageReviews: packageAuthoritySummary.localPackageReviews,
    localPackageReworkRequests: packageAuthoritySummary.packageReworkRequests,
    localPackageReviewsFresh: packageAuthoritySummary.freshReviews,
    localPackageReviewsStale: packageAuthoritySummary.staleReviews,
    publicationAuthorityRequests: packageAuthoritySummary.publicationAuthorityRequests,
    publicationAuthorityRequestsFresh: packageAuthoritySummary.freshRequests,
    publicationAuthorityRequestsStale: packageAuthoritySummary.staleRequests,
    publicationAuthorityRequestsBlocked: packageAuthoritySummary.blockingRequests,
    publicationAuthorityRequestsIntegrityBlocked: packageAuthoritySummary.integrityBlockingRequests,
    packageAuthoritySummary,
    recordReadDiagnostics,
    pendingAuthority,
    productionReady: 0,
    rows,
    outputIntegritySummary: {
      renderReceipts: outputIntegrity.renderReceipts,
      exportReceipts: outputIntegrity.exportReceipts,
      localDeliveryEvidenceIntact: outputIntegrity.localDeliveryEvidenceIntact,
      outputIntegrityBlockingIssues: outputIntegrity.outputIntegrityBlockingIssues,
      outputIntegrityAttentionIssues: outputIntegrity.outputIntegrityAttentionIssues,
      localOnly: true,
      operatorGuidanceOnly: true,
      productionReady: false,
      publicationAuthorization: false
    },
    futureAuthorityRequirements: [
      'authority-bearing approval or ratification artifact',
      'explicit publication or production authorization scope',
      'review of local proposal evidence and capsule or bundle refs',
      'no reliance on local proposal, local decision, capsule, or bundle as authority'
    ],
    localOnly: true,
    operatorGuidanceOnly: true,
    localTruthLabel: 'local guidance',
    truthStatus: 'local authority prerequisite guidance; not mesh truth; not authority',
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    approvalAuthority: false,
    ratifierAuthority: false,
    publicationAuthorization: false,
    providerTruth: false,
    byteAvailabilityProof: false,
    materializationProof: false,
    resourceAdmission: false,
    causalTruth: false,
    edgeApproval: false,
    nonClaims: {
      meshTruth: false,
      distributedProof: false,
      ratifiedSharedState: false,
      approvalAuthority: false,
      ratifierAuthority: false,
      publicationAuthorization: false,
      providerTruth: false,
      byteAvailabilityProof: false,
      materializationProof: false,
      resourceAdmission: false,
      causalTruth: false,
      edgeApproval: false
    },
    createdAt
  }
}

export async function writeProductionAuthorityPrerequisiteReport(options = {}) {
  const report = await createProductionAuthorityPrerequisiteReport(options)
  const output = options.output ?? defaultOutput
  const root = path.resolve(options.projectDir ?? defaultProjectDir)
  validateRequiredRecord(report)
  await writeJsonAtomic(root, output, report)

  if (options.print) {
    console.log(JSON.stringify(report, null, 2))
  } else if (!options.quiet) {
    printProductionAuthorityPrerequisiteReport(report, output)
  }

  return report
}

function summarizeCandidateAuthorityPrerequisites(asset, records, outputIntegrity) {
  const localDecision = latestRecord(records, artifactKinds.mediaOperatorDecision, (record) =>
    record.subjectRef?.id === asset.assetId
  )
  const approvalProposal = latestRecord(records, artifactKinds.mediaApprovalProposalLocal, (record) =>
    record.subjectRef?.id === asset.assetId
  )
  const capsule = latestRecord(records, artifactKinds.mediaProductionAssetCapsuleLocal, (record) =>
    [record.subjectAssetRef?.id, record.assetDescriptorRef?.id, record.subjectAssetRef?.path, record.localRef?.path]
      .filter(Boolean)
      .some((key) => [asset.assetId, asset.assetDescriptorRef?.id, asset.assetDescriptorRef?.path, asset.localRef?.path].includes(key))
  )
  const bundle = latestRecord(records, artifactKinds.mediaProductionBundleLocal, (record) =>
    (record.assetRefs ?? []).some((ref) =>
      [ref.id, ref.path].filter(Boolean).some((key) => [asset.assetId, asset.localRef?.path].includes(key))
    )
  )
  const byteProposal = latestRecord(records, artifactKinds.mediaByteDescriptorProposalLocal, (record) =>
    record.contentId === asset.contentId
  )
  const resourceCandidate = latestRecord(records, artifactKinds.mediaLocalLayerResourceRefCandidateLocal, (record) =>
    sameRef(record.sourceSituationRef, asset.situationRef) &&
    sameRef(record.sourcePlacementRef, asset.placementRef)
  )
  const derivativeRecords = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaDerivativeLocal)
    .filter((entry) =>
      sameRef(entry.record.sourceSituationRef, asset.situationRef) &&
      sameRef(entry.record.sourcePlacementRef, asset.placementRef)
    )
    .map((entry) => entry.record)
  const roughCutReviewPosture = summarizeRoughCutReviewPosture(asset, records)
  const renderExportCandidatePosture = summarizeRenderExportCandidatePosture(roughCutReviewPosture, records)
  const renderReceiptPosture = summarizeRenderReceiptPosture(roughCutReviewPosture, records, outputIntegrity)
  const exportReceiptPosture = summarizeExportReceiptPosture(roughCutReviewPosture, records, outputIntegrity)
  const missingLocalPrerequisites = [
    localDecision ? null : 'local_decision_missing',
    approvalProposal ? null : 'approval_proposal_missing',
    approvalProposal && hasSituatedApprovalRefs(approvalProposal) ? null : 'situated_approval_refs_missing',
    capsule ? null : 'production_capsule_missing',
    bundle ? null : 'production_bundle_missing',
    byteProposal ? null : 'byte_descriptor_proposal_missing',
    resourceCandidate ? null : 'resource_ref_candidate_missing'
  ].filter(Boolean)
  const localPackageComplete = missingLocalPrerequisites.length === 0
  const localProductionPackageComplete = localPackageComplete &&
    roughCutReviewPosture?.state === 'rough-cut-reviewed-local' &&
    renderExportCandidatePosture?.present === true &&
    renderExportCandidatePosture?.freshnessState === 'fresh' &&
    renderReceiptPosture?.present === true &&
    renderReceiptPosture?.freshnessState === 'fresh' &&
    renderReceiptPosture?.renderPerformed === true &&
    exportReceiptPosture?.present === true &&
    exportReceiptPosture?.freshnessState === 'fresh' &&
    exportReceiptPosture?.localDeliveryEvidenceIntact === true &&
    exportReceiptPosture?.outputIntegrityBlockingIssues === 0 &&
    exportReceiptPosture?.deliveryCreated === true &&
    exportReceiptPosture?.exportPerformed === true
  const localProductionPackageState = localProductionPackageComplete
    ? 'local-production-package-complete-authority-missing'
    : 'local-production-package-incomplete'

  return {
    projectId: asset.projectId,
    assetId: asset.assetId,
    path: asset.localRef?.path,
    contentId: asset.contentId,
    situationRef: asset.situationRef,
    placementRef: asset.placementRef,
    localDecision: localDecision ? refForRecord('media-operator-decision', localDecision) : null,
    approvalProposal: approvalProposal ? refForRecord('media-approval-proposal', approvalProposal) : null,
    approvalProposalIdentity: approvalProposal
      ? {
          subjectRef: approvalProposal.subjectRef ?? null,
          subjectAssetDescriptorRef: approvalProposal.subjectAssetDescriptorRef ?? null,
          subjectContentRef: approvalProposal.subjectContentRef ?? null,
          subjectSituationRef: approvalProposal.subjectSituationRef ?? null,
          subjectPlacementRef: approvalProposal.subjectPlacementRef ?? null,
          situatedRefsPresent: hasSituatedApprovalRefs(approvalProposal)
        }
      : null,
    productionCapsule: capsule ? refForRecord('media-production-asset-capsule', capsule) : null,
    productionBundle: bundle ? refForRecord('media-production-bundle', bundle) : null,
    byteDescriptorProposal: byteProposal ? refForRecord('media-byte-descriptor-proposal', byteProposal) : null,
    resourceRefCandidate: resourceCandidate ? refForRecord('media-local-layer-resource-ref-candidate', resourceCandidate) : null,
    derivativeKinds: Array.from(new Set(derivativeRecords.map((record) => record.derivativeKind).filter(Boolean))).sort(),
    roughCutReviewPosture,
    renderExportCandidatePosture,
    renderReceiptPosture,
    exportReceiptPosture,
    outputIntegrityBlockingIssues: exportReceiptPosture.outputIntegrityBlockingIssues ?? 0,
    outputIntegrityAttentionIssues: renderReceiptPosture.outputIntegrityAttentionIssues ?? 0,
    outputIntegrityBlockingIssueCodes: exportReceiptPosture.outputIntegrityBlockingIssueCodes ?? [],
    outputIntegrityAttentionIssueCodes: renderReceiptPosture.outputIntegrityAttentionIssueCodes ?? [],
    missingLocalPrerequisites,
    localPackageState: localPackageComplete
      ? 'local-package-complete-authority-missing'
      : 'local-package-incomplete',
    localProductionPackageComplete,
    localProductionPackageState,
    productionPackagePosture: {
      state: localProductionPackageState,
      localPackageComplete,
      localProductionPackageComplete,
      localDeliveryEvidenceIntact: exportReceiptPosture.localDeliveryEvidenceIntact === true,
      outputIntegrityBlockingIssues: exportReceiptPosture.outputIntegrityBlockingIssues ?? 0,
      outputIntegrityAttentionIssues: renderReceiptPosture.outputIntegrityAttentionIssues ?? 0,
      authorityMissing: true,
      productionReady: false,
      publicationAuthorization: false,
      renderAuthorization: false,
      exportAuthorization: false,
      localOnly: true,
      operatorGuidanceOnly: true
    },
    authorityState: 'authority-missing',
    safeNextAction: safeNextActionForRow(
      missingLocalPrerequisites,
      roughCutReviewPosture,
      renderExportCandidatePosture,
      renderReceiptPosture,
      exportReceiptPosture
    ),
    authorityGaps: [
      'approval_authority_missing',
      'ratifier_authority_missing',
      'render_authorization_missing',
      'export_authorization_missing',
      'publication_authorization_missing',
      'production_ready_false'
    ],
    productionReady: false,
    localOnly: true,
    operatorGuidanceOnly: true,
    approvalAuthority: false,
    ratifierAuthority: false,
    publicationAuthorization: false,
    byteAvailabilityProof: false,
    materializationProof: false,
    resourceAdmission: false,
    meshTruth: false,
    providerTruth: false
  }
}

function summarizePackageAuthorityForPrereqs(records, report) {
  const packageReviewRows = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaOperatorDecision)
    .filter((entry) => entry.record.localPackageReview)
    .map((entry) => {
      const freshness = evaluateLocalPackageReviewFreshness({
        decision: entry.record,
        records,
        prerequisiteReport: report
      })
      return {
        kind: 'local-package-review',
        ref: refForEntry('media-operator-decision', entry),
        createdAt: entry.record.createdAt,
        freshnessState: freshness.state,
        issueCodes: [...new Set([
          ...(entry.record.localPackageReview?.issueCodes ?? []),
          ...freshness.issueCodes
        ])],
        blockingIssueCodes: freshness.blockingIssueCodes,
        attentionIssueCodes: freshness.attentionIssueCodes,
        requestReviewBlocked: freshness.requestReviewBlocked,
        integrityBlocking: freshness.integrityBlocking,
        localPackageReviewed: entry.record.localPackageReview?.localPackageReviewed === true,
        needsRework: entry.record.localPackageReview?.needsRework === true,
        packageReviewState: entry.record.localPackageReview?.packageReviewState ?? 'unknown',
        nextAction: entry.record.localPackageReview?.needsRework === true ? entry.record.nextAction : freshness.nextAction,
        publicationAuthorization: false,
        productionReady: false,
        localOnly: true,
        operatorGuidanceOnly: true
      }
    })
    .sort(comparePackageAuthorityRowsDescending)
  const activePackageReviewRow = packageReviewRows[0] ?? null
  const publicationRequestRows = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaPublicationAuthorityRequestCandidateLocal)
    .map((entry) => {
      const freshness = evaluatePublicationAuthorityRequestFreshness({
        candidate: entry.record,
        records,
        prerequisiteReport: report
      })
      return {
        kind: 'publication-authority-request',
        ref: refForEntry('media-publication-authority-request-candidate', entry),
        freshnessState: freshness.state,
        issueCodes: freshness.issueCodes,
        blockingIssueCodes: freshness.blockingIssueCodes,
        attentionIssueCodes: freshness.attentionIssueCodes,
        requestReviewBlocked: freshness.requestReviewBlocked,
        integrityBlocking: freshness.integrityBlocking,
        nextAction: freshness.nextAction,
        publicationAuthorization: false,
        productionReady: false,
        localOnly: true,
        operatorGuidanceOnly: true
      }
    })
  const activeRows = [
    ...(activePackageReviewRow ? [activePackageReviewRow] : []),
    ...publicationRequestRows
  ]

  return {
    localPackageReviews: activePackageReviewRow?.localPackageReviewed ? 1 : 0,
    packageReworkRequests: activePackageReviewRow?.needsRework ? 1 : 0,
    freshReviews: activePackageReviewRow?.localPackageReviewed && activePackageReviewRow.freshnessState === 'fresh' ? 1 : 0,
    staleReviews: activePackageReviewRow?.freshnessState === 'stale' ? 1 : 0,
    publicationAuthorityRequests: publicationRequestRows.length,
    freshRequests: publicationRequestRows.filter((row) => row.freshnessState === 'fresh').length,
    staleRequests: publicationRequestRows.filter((row) => row.freshnessState === 'stale').length,
    blockingRequests: publicationRequestRows.filter((row) => row.requestReviewBlocked).length,
    integrityBlockingRequests: publicationRequestRows.filter((row) => row.integrityBlocking).length,
    rows: activeRows,
    attentionRows: activeRows.filter((row) => row.issueCodes.length > 0),
    publicationAuthorization: false,
    productionReady: false,
    localOnly: true,
    operatorGuidanceOnly: true,
    approvalAuthority: false,
    ratifierAuthority: false,
    meshTruth: false
  }
}

function comparePackageAuthorityRowsDescending(left, right) {
  const rightTime = Date.parse(right.createdAt ?? '') || 0
  const leftTime = Date.parse(left.createdAt ?? '') || 0
  if (rightTime !== leftTime) return rightTime - leftTime
  return (right.ref?.path ?? '').localeCompare(left.ref?.path ?? '')
}

function printProductionAuthorityPrerequisiteReport(report, output = defaultOutput) {
  console.log([
    `production authority prerequisites: project=${report.projectId}`,
    `candidates=${report.candidates}`,
    `localPackageComplete=${report.localPackageComplete}`,
    `localProductionPackageComplete=${report.localProductionPackageComplete ?? 0}`,
    `missingLocalPrerequisites=${report.missingLocalPrerequisites}`,
    `roughCutReviewed=${report.roughCutReviewed}`,
    `roughCutChangesRequested=${report.roughCutChangesRequested}`,
    `roughCutDeferred=${report.roughCutDeferred}`,
    `renderExportCandidates=${report.renderExportCandidates ?? 0}`,
    `renderReceipts=${report.renderReceipts ?? 0}`,
    `exportReceipts=${report.exportReceipts ?? 0}`,
    `ffmpegDeliveryReceipts=${report.ffmpegDeliveryReceipts ?? 0}`,
    `activeDeliveryReceipts=${report.activeDeliveryReceipts ?? 0}`,
    `historicalExportReceipts=${report.historicalExportReceipts ?? 0}`,
    `currentExportReceiptAttention=${report.currentExportReceiptAttention ?? 0}`,
    `historicalExportReceiptAttention=${report.historicalExportReceiptAttention ?? 0}`,
    `localDeliveryEvidencePresent=${report.localDeliveryEvidencePresent ?? 0}`,
    `localDeliveryEvidenceIntact=${report.localDeliveryEvidenceIntact ?? 0}`,
    `outputIntegrityBlockingIssues=${report.outputIntegrityBlockingIssues ?? 0}`,
    `outputIntegrityAttentionIssues=${report.outputIntegrityAttentionIssues ?? 0}`,
    `recordIODiagnostics=${report.recordReadDiagnostics?.diagnostics ?? 0}`,
    `deliveryCreated=${report.deliveryCreated ?? 0}`,
    `exportPerformed=${report.exportPerformed ?? 0}`,
    `localPackageReviews=${report.localPackageReviews ?? 0}`,
    `localPackageReworkRequests=${report.localPackageReworkRequests ?? 0}`,
    `publicationAuthorityRequests=${report.publicationAuthorityRequests ?? 0}`,
    `staleAuthorityRequests=${report.publicationAuthorityRequestsStale ?? 0}`,
    `blockedAuthorityRequests=${report.publicationAuthorityRequestsBlocked ?? 0}`,
    `renderAuthorizationMissing=${report.renderAuthorizationMissing ?? 0}`,
    `exportAuthorizationMissing=${report.exportAuthorizationMissing ?? 0}`,
    `pendingAuthority=${report.pendingAuthority}`,
    `productionReady=${report.productionReady}`,
    `output=${output}`
  ].join(' | '))

  for (const row of report.rows) {
    console.log([
      `authority-prereq: ${row.path}`,
      `localPackage=${row.localPackageState}`,
      `productionPackage=${row.localProductionPackageState}`,
      `authority=${row.authorityState}`,
      `missing=${row.missingLocalPrerequisites.join(',') || 'none'}`,
      `roughCut=${row.roughCutReviewPosture?.state ?? 'unknown'}`,
      `renderExport=${row.renderExportCandidatePosture?.state ?? 'unknown'}`,
      `renderReceipt=${row.renderReceiptPosture?.state ?? 'unknown'}`,
      `exportReceipt=${row.exportReceiptPosture?.state ?? 'unknown'}`,
      `activeDelivery=${row.exportReceiptPosture?.activeDeliveryReceipts ?? 0}`,
      `historicalExportReceipts=${row.exportReceiptPosture?.historicalExportReceipts ?? 0}`,
      `currentExportAttention=${row.exportReceiptPosture?.currentExportReceiptAttention ?? 0}`,
      `historicalExportAttention=${row.exportReceiptPosture?.historicalExportReceiptAttention ?? 0}`,
      `localDeliveryEvidence=${row.exportReceiptPosture?.localDeliveryEvidencePresent === true}`,
      `localDeliveryEvidenceIntact=${row.exportReceiptPosture?.localDeliveryEvidenceIntact === true}`,
      `outputIntegrityBlocking=${row.outputIntegrityBlockingIssueCodes.join(',') || 'none'}`,
      `outputIntegrityAttention=${row.outputIntegrityAttentionIssueCodes.join(',') || 'none'}`,
      `proposalSituatedRefs=${row.approvalProposalIdentity?.situatedRefsPresent === true}`,
      `derivatives=${row.derivativeKinds.join(',') || 'none'}`,
      `nextAction=${row.safeNextAction}`
    ].join(' | '))
  }

  console.log('nonClaims: local-only; no mesh truth; no approval authority; no publication authorization; no byte/materialization proof; no resource admission')
}

function summarizeExportReceiptPosture(roughCutReviewPosture, records, outputIntegrity) {
  const roughCutId = roughCutReviewPosture?.roughCutRef?.id
  if (!roughCutId) {
    return missingExportReceiptPosture()
  }

  const receiptRows = summarizeExportReceipts(records).rows
    .filter((row) => row.sourceRoughCutRef?.id === roughCutId)
  const integrityRows = (outputIntegrity?.exportRows ?? [])
    .filter((row) => row.sourceRoughCutRef?.id === roughCutId)

  if (receiptRows.length === 0) {
    return missingExportReceiptPosture()
  }

  const freshRows = receiptRows.filter((row) => row.freshnessState === 'fresh')
  const freshDeliveryRows = freshRows.filter((row) => row.deliveryCreated && row.exportPerformed)
  const currentIntegrityRows = integrityRows.filter((row) => !row.historicalAuditOnly)
  const intactDeliveryRows = currentIntegrityRows.filter((row) => row.localDeliveryEvidenceIntact)
  const localPackageCopyExportReceipts = receiptRows.filter((row) => row.exportKind === 'local-review-package-copy').length
  const ffmpegDeliveryReceipts = receiptRows.filter((row) => row.exportKind === 'local-ffmpeg-review-delivery').length
  const activeDeliveryReceipts = receiptRows.filter((row) => row.activeLocalDelivery).length
  const historicalExportReceipts = receiptRows.filter((row) => row.historicalAuditOnly).length
  const currentExportReceiptAttention = receiptRows
    .filter((row) => row.deliveryAttentionState === 'needs-local-attention').length
  const historicalExportReceiptAttention = receiptRows
    .filter((row) => row.deliveryAttentionState === 'historical-stale-receipt').length
  const localDeliveryEvidencePresent = freshDeliveryRows.length > 0
  const outputIntegrityBlockingIssueCodes = [...new Set(currentIntegrityRows.flatMap((row) => row.blockingIssueCodes ?? []))]
  const outputIntegrityBlockingIssues = outputIntegrityBlockingIssueCodes.length
  const localDeliveryEvidenceIntact = localDeliveryEvidencePresent &&
    intactDeliveryRows.length > 0 &&
    outputIntegrityBlockingIssues === 0
  const primary = freshDeliveryRows[0] ?? receiptRows[0]
  return {
    state: localDeliveryEvidencePresent && localDeliveryEvidenceIntact
      ? 'export-receipt-present-delivery-only'
      : localDeliveryEvidencePresent
        ? 'export-receipt-output-integrity-blocked'
      : 'export-receipt-stale',
    present: true,
    receiptRef: primary.receiptRef,
    receiptRefs: receiptRows.map((row) => row.receiptRef),
    exportKind: primary.exportKind,
    deliveryLocalRef: primary.deliveryLocalRef,
    deliveryLocalRefs: receiptRows
      .map((row) => row.deliveryLocalRef)
      .filter((ref) => ref?.path),
    freshnessState: localDeliveryEvidencePresent ? 'fresh' : primary.freshnessState,
    issueCodes: [...new Set(receiptRows.flatMap((row) => row.issueCodes ?? []))],
    exportReceipts: receiptRows.length,
    exportReceiptsFresh: freshRows.length,
    exportReceiptsStale: receiptRows.filter((row) => row.freshnessState === 'stale').length,
    localPackageCopyExportReceipts,
    ffmpegDeliveryReceipts,
    activeDeliveryReceipts,
    historicalExportReceipts,
    currentExportReceiptAttention,
    historicalExportReceiptAttention,
    localDeliveryEvidencePresent,
    localDeliveryEvidenceIntact,
    outputIntegrityBlockingIssues,
    outputIntegrityBlockingIssueCodes,
    exportPerformed: localDeliveryEvidencePresent,
    deliveryCreated: localDeliveryEvidencePresent,
    productionReady: false,
    renderAuthorization: false,
    exportAuthorization: false,
    publicationAuthorization: false,
    nextAction: outputIntegrityBlockingIssues > 0
      ? 'Regenerate local delivery/export artifacts; receipt refs are present but referenced bytes are missing or invalid.'
      : primary.nextAction,
    localOnly: true,
    operatorGuidanceOnly: true
  }
}

function missingExportReceiptPosture() {
  return {
    state: 'export-receipt-missing',
    present: false,
    receiptRef: null,
    receiptRefs: [],
    freshnessState: 'missing',
    exportReceipts: 0,
    exportReceiptsFresh: 0,
    exportReceiptsStale: 0,
    localPackageCopyExportReceipts: 0,
    ffmpegDeliveryReceipts: 0,
    activeDeliveryReceipts: 0,
    historicalExportReceipts: 0,
    currentExportReceiptAttention: 0,
    historicalExportReceiptAttention: 0,
    localDeliveryEvidencePresent: false,
    localDeliveryEvidenceIntact: false,
    outputIntegrityBlockingIssues: 0,
    outputIntegrityBlockingIssueCodes: [],
    exportPerformed: false,
    deliveryCreated: false,
    productionReady: false,
    renderAuthorization: false,
    exportAuthorization: false,
    publicationAuthorization: false,
    localOnly: true,
    operatorGuidanceOnly: true
  }
}

function summarizeRenderReceiptPosture(roughCutReviewPosture, records, outputIntegrity) {
  const roughCutId = roughCutReviewPosture?.roughCutRef?.id
  if (!roughCutId) {
    return missingRenderReceiptPosture()
  }

  const receiptRows = summarizeRenderReceipts(records).rows
    .filter((row) => row.sourceRoughCutRef?.id === roughCutId)
  const integrityRows = (outputIntegrity?.renderRows ?? [])
    .filter((row) => row.sourceRoughCutRef?.id === roughCutId)

  if (receiptRows.length === 0) {
    return missingRenderReceiptPosture()
  }

  const latest = receiptRows[0]
  const outputIntegrityAttentionIssueCodes = [...new Set(integrityRows.flatMap((row) => row.attentionIssueCodes ?? []))]
  return {
    state: latest.freshnessState === 'fresh'
      ? 'render-receipt-present-preview-only'
      : 'render-receipt-stale',
    present: true,
    receiptRef: latest.receiptRef,
    renderKind: latest.renderKind,
    outputLocalRef: latest.outputLocalRef,
    freshnessState: latest.freshnessState,
    issueCodes: latest.issueCodes,
    outputIntegrityAttentionIssues: outputIntegrityAttentionIssueCodes.length,
    outputIntegrityAttentionIssueCodes,
    renderPerformed: latest.renderPerformed,
    exportPerformed: false,
    productionReady: false,
    renderAuthorization: false,
    exportAuthorization: false,
    publicationAuthorization: false,
    nextAction: latest.nextAction,
    localOnly: true,
    operatorGuidanceOnly: true
  }
}

function missingRenderReceiptPosture() {
  return {
    state: 'render-receipt-missing',
    present: false,
    receiptRef: null,
    freshnessState: 'missing',
    outputIntegrityAttentionIssues: 0,
    outputIntegrityAttentionIssueCodes: [],
    renderPerformed: false,
    exportPerformed: false,
    productionReady: false,
    renderAuthorization: false,
    exportAuthorization: false,
    publicationAuthorization: false,
    localOnly: true,
    operatorGuidanceOnly: true
  }
}

function summarizeRenderExportCandidatePosture(roughCutReviewPosture, records) {
  const roughCutId = roughCutReviewPosture?.roughCutRef?.id
  if (!roughCutId) {
    return {
      state: 'render-export-candidate-missing',
      present: false,
      candidateRef: null,
      freshnessState: 'missing',
      rendererSelected: false,
      renderPerformed: false,
      exportPerformed: false,
      productionReady: false,
      renderAuthorization: false,
      exportAuthorization: false,
      publicationAuthorization: false,
      localOnly: true,
      operatorGuidanceOnly: true
    }
  }

  const candidateEntry = latestRecordEntry(records, artifactKinds.mediaRenderExportCandidateLocal, (record) =>
    record.sourceRoughCutRef?.id === roughCutId
  )

  if (!candidateEntry) {
    return {
      state: 'render-export-candidate-missing',
      present: false,
      candidateRef: null,
      freshnessState: 'missing',
      rendererSelected: false,
      renderPerformed: false,
      exportPerformed: false,
      productionReady: false,
      renderAuthorization: false,
      exportAuthorization: false,
      publicationAuthorization: false,
      localOnly: true,
      operatorGuidanceOnly: true
    }
  }

  const freshness = evaluateRenderExportCandidateFreshness({ candidate: candidateEntry.record, records })
  return {
    state: freshness.state === 'fresh'
      ? 'render-export-candidate-present-review-only'
      : 'render-export-candidate-stale',
    present: true,
    candidateRef: refForEntry('media-render-export-candidate', candidateEntry),
    freshnessState: freshness.state,
    issueCodes: freshness.issueCodes,
    rendererSelected: candidateEntry.record.renderPosture?.rendererSelected === true,
    renderPerformed: candidateEntry.record.renderPosture?.renderPerformed === true,
    exportPerformed: candidateEntry.record.exportPosture?.exportPerformed === true,
    productionReady: false,
    renderAuthorization: false,
    exportAuthorization: false,
    publicationAuthorization: false,
    nextAction: freshness.state === 'fresh'
      ? 'Future authority review may inspect this render/export candidate, but render/export/publication remain unauthorized.'
      : freshness.nextAction,
    localOnly: true,
    operatorGuidanceOnly: true
  }
}

function latestRecord(records, schema, predicate) {
  return latestRecordEntry(records, schema, predicate)?.record
}

function latestRecordEntry(records, schema, predicate) {
  return records
    .filter((entry) => entry.record.schema === schema)
    .filter((entry) => predicate(entry.record))
    .sort((left, right) => (Date.parse(right.record.createdAt ?? '') || 0) - (Date.parse(left.record.createdAt ?? '') || 0))[0]
}

function summarizeRoughCutReviewPosture(asset, records) {
  const roughCutEntry = latestRecordEntry(records, artifactKinds.mediaRoughCutCapsuleLocal, (record) =>
    (record.orderedItems ?? []).some((item) => roughCutItemMatchesAsset(item, asset))
  )

  if (!roughCutEntry) {
    return {
      state: 'rough-cut-missing',
      roughCutRef: null,
      reviewDecisionRef: null,
      reviewed: false,
      requestChanges: false,
      deferred: false,
      productionReady: false,
      authorityGranted: false,
      localOnly: true,
      operatorGuidanceOnly: true
    }
  }

  const roughCut = roughCutEntry.record
  const reviewDecisionEntry = latestRecordEntry(records, artifactKinds.mediaOperatorDecision, (record) =>
    record.roughCutReview &&
    record.subjectRef?.id === roughCut.roughCutId
  )
  const decision = reviewDecisionEntry?.record
  const state = roughCutReviewState(decision)

  return {
    state,
    roughCutRef: refForEntry('media-rough-cut-capsule', roughCutEntry),
    reviewDecisionRef: reviewDecisionEntry ? refForEntry('media-operator-decision', reviewDecisionEntry) : null,
    decisionType: decision?.decisionType ?? null,
    reviewed: state === 'rough-cut-reviewed-local',
    requestChanges: state === 'rough-cut-changes-requested',
    deferred: state === 'rough-cut-review-deferred',
    rendered: roughCut.renderPosture?.rendered === true,
    productionReady: false,
    authorityGranted: false,
    localOnly: true,
    operatorGuidanceOnly: true
  }
}

function roughCutItemMatchesAsset(item, asset) {
  return [
    item.acceptedAssetRef?.id,
    item.acceptedAssetRef?.path,
    item.contentRef?.id,
    item.situationRef?.id,
    item.placementRef?.id,
    item.localRef?.path
  ].filter(Boolean).some((key) => [
    asset.assetId,
    asset.localRef?.path,
    asset.contentId,
    asset.situationRef?.id,
    asset.placementRef?.id
  ].includes(key))
}

function roughCutReviewState(decision) {
  if (!decision) return 'rough-cut-review-missing'
  if (decision.decisionType === 'review_rough_cut') return 'rough-cut-reviewed-local'
  if (decision.decisionType === 'request_changes') return 'rough-cut-changes-requested'
  if (decision.decisionType === 'defer') return 'rough-cut-review-deferred'
  return 'rough-cut-review-unknown'
}

function refForEntry(kind, entry) {
  return {
    ...refForRecord(kind, entry.record),
    path: entry.path
  }
}

function refForRecord(kind, record) {
  return {
    kind,
    id: idForRecord(record),
    schema: record.schema,
    localOnly: true
  }
}

function idForRecord(record) {
  return record.decisionId ??
    record.proposalId ??
    record.capsuleId ??
    record.bundleId ??
    record.roughCutId ??
    record.byteDescriptorProposalId ??
    record.resourceRefCandidateId ??
    record.candidateId ??
    record.assetId
}

function hasSituatedApprovalRefs(proposal) {
  return Boolean(
    proposal.subjectAssetDescriptorRef?.id &&
    proposal.subjectContentRef?.id &&
    proposal.subjectSituationRef?.id &&
    proposal.subjectPlacementRef?.id
  )
}

function nextActionForMissingPrerequisite(issueCode) {
  if (issueCode === 'local_decision_missing') return 'Record an explicit local decision for the accepted provider asset.'
  if (issueCode === 'approval_proposal_missing') return 'Run npm run approval:proposal for the accepted provider asset.'
  if (issueCode === 'situated_approval_refs_missing') return 'Regenerate the approval proposal so it includes situated asset refs.'
  if (issueCode === 'production_capsule_missing') return 'Run npm run production:capsule for the accepted provider asset.'
  if (issueCode === 'production_bundle_missing') return 'Run npm run production:bundle to group production capsules.'
  if (issueCode === 'byte_descriptor_proposal_missing') return 'Run npm run bytes:proposal for content-keyed byte posture.'
  if (issueCode === 'resource_ref_candidate_missing') return 'Run npm run resource:refs for situation-specific resource posture.'
  return 'Inspect local production prerequisites before authority review.'
}

function safeNextActionForRow(
  missingLocalPrerequisites,
  roughCutReviewPosture,
  renderExportCandidatePosture,
  renderReceiptPosture,
  exportReceiptPosture
) {
  if (missingLocalPrerequisites.length > 0) return nextActionForMissingPrerequisite(missingLocalPrerequisites[0])
  if (roughCutReviewPosture?.state === 'rough-cut-changes-requested') {
    return 'Regenerate or revise the rough-cut capsule before future authority review.'
  }
  if (roughCutReviewPosture?.state === 'rough-cut-review-deferred') {
    return 'Resolve the deferred rough-cut review before future authority review.'
  }
  if (roughCutReviewPosture?.state === 'rough-cut-review-missing') {
    return 'Run npm run production:rough-cut-review to record local rough-cut review before future authority review.'
  }
  if (roughCutReviewPosture?.state === 'rough-cut-missing') {
    return 'Run npm run production:rough-cut to create a local reviewable rough cut before future authority review.'
  }
  if (renderExportCandidatePosture?.present !== true) {
    return 'Run npm run production:render-export-candidate to prepare the reviewed rough cut for local render/export packaging.'
  }
  if (renderExportCandidatePosture?.freshnessState === 'stale') {
    return 'Regenerate the render/export candidate from the latest reviewed rough cut before future authority review.'
  }
  if (renderReceiptPosture?.present !== true) {
    return 'Run npm run production:render-plan and a local render command to create local preview evidence before future authority review.'
  }
  if (renderReceiptPosture?.freshnessState === 'stale') {
    return 'Regenerate local render evidence from the latest reviewed rough cut before future authority review.'
  }
  if (exportReceiptPosture?.present !== true) {
    return 'Run npm run production:export-plan and a local export command to create a local delivery candidate before future authority review.'
  }
  if ((exportReceiptPosture?.outputIntegrityBlockingIssues ?? 0) > 0) {
    return 'Regenerate local delivery/export artifacts; receipt refs are present but referenced bytes are missing or invalid.'
  }
  if (exportReceiptPosture?.freshnessState === 'stale') {
    return 'Regenerate local export delivery evidence from the latest reviewed rough cut before future authority review.'
  }
  return 'Route the local proposal and production bundle through a future authority lane; do not treat local records as authorization.'
}

function sameRef(left, right) {
  if (!left?.id || !right?.id) return false
  return left.id === right.id
}

function isProductionAsset(asset) {
  const mediaKind = asset.metadataProbe?.mediaKind
  if (['image', 'video', 'audio'].includes(mediaKind)) return true
  const contentType = asset.contentType ?? asset.localRef?.contentType
  return ['image/', 'video/', 'audio/'].some((prefix) => contentType?.startsWith(prefix))
}

if (process.argv[1] === modulePath) {
  await writeProductionAuthorityPrerequisiteReport(parseArgs(process.argv.slice(2)))
}
