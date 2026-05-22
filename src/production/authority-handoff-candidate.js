import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { artifactKinds } from '../contracts/artifact-kinds.js'
import { makeRef, nowIso } from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import { collectLayerInteropOptions, createLayerInteropPosture } from '../layer/layer-interop.js'
import { assertSafeLocalPath } from '../local/project-layout.js'
import { writeJsonAtomic } from '../local/atomic-json.js'
import { readProjectRecords } from '../seams/project-status.js'
import { createProductionAuthorityPrerequisiteReport } from './authority-prerequisites.js'
import { summarizeExportReceipts } from './export-receipts.js'

const modulePath = fileURLToPath(import.meta.url)
const defaultProjectDir = 'examples/venice-smoke'
const defaultOutput = 'records/production/media-authority-handoff-candidate.local.json'
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

  return {
    ...args,
    ...collectLayerInteropOptions(argv)
  }
}

export async function writeAuthorityHandoffCandidate({
  projectDir = defaultProjectDir,
  output = defaultOutput,
  print = false,
  quiet = false,
  createdAt = nowIso(),
  layerRef,
  layerProfileRef,
  continuityRef,
  desyncPostureRef,
  rbcProfileRefs
} = {}) {
  assertSafeLocalPath(output)

  const root = path.resolve(projectDir)
  const records = await readProjectRecords(root)
  const layerInteropOptions = {
    layerRef,
    layerProfileRef,
    continuityRef,
    desyncPostureRef,
    rbcProfileRefs
  }
  const prerequisiteReport = await createProductionAuthorityPrerequisiteReport({
    projectDir,
    ...layerInteropOptions
  })
  const candidate = createAuthorityHandoffCandidateFromRecords({
    records,
    prerequisiteReport,
    createdAt,
    ...layerInteropOptions
  })

  await writeJsonAtomic(root, output, candidate)

  if (print) {
    console.log(JSON.stringify(candidate, null, 2))
  } else if (!quiet) {
    console.log(formatAuthorityHandoffCandidateSummary(candidate, output))
    console.log(`nextAction: ${candidate.nextActions[0]}`)
    console.log('nonClaims: local-only; no mesh truth; no approval authority; no ratifier authority; no publication authorization; productionReady=false')
  }

  return {
    candidate,
    output
  }
}

export function createAuthorityHandoffCandidateFromRecords({
  records,
  prerequisiteReport,
  createdAt = nowIso(),
  layerRef,
  layerProfileRef,
  continuityRef,
  desyncPostureRef,
  rbcProfileRefs
}) {
  const projectId = prerequisiteReport.projectId ??
    records.find((entry) => typeof entry.record.projectId === 'string')?.record.projectId ??
    'unknown-project'
  const productionBundleRefs = refsForSchema(records, artifactKinds.mediaProductionBundleLocal, 'media-production-bundle')
  const productionCapsuleRefs = refsForSchema(records, artifactKinds.mediaProductionAssetCapsuleLocal, 'media-production-asset-capsule')
  const roughCutCapsuleRefs = refsForSchema(records, artifactKinds.mediaRoughCutCapsuleLocal, 'media-rough-cut-capsule')
  const renderExportCandidateRefs = refsForSchema(records, artifactKinds.mediaRenderExportCandidateLocal, 'media-render-export-candidate')
  const renderReceiptRefs = refsForSchema(records, artifactKinds.mediaRenderReceiptLocal, 'media-render-receipt')
  const exportReceiptRefs = refsForSchema(records, artifactKinds.mediaExportReceiptLocal, 'media-export-receipt')
  const exportReceiptInput = createExportReceiptInput(records, prerequisiteReport)
  const approvalProposalRefs = refsForSchema(records, artifactKinds.mediaApprovalProposalLocal, 'media-approval-proposal')
  const localDecisionRefs = refsForSchema(records, artifactKinds.mediaOperatorDecision, 'media-operator-decision')
  const localPackageReviewDecisionRefs = refsForRecordPredicate(
    records,
    artifactKinds.mediaOperatorDecision,
    'media-operator-decision',
    (record) => record.localPackageReview
  )
  const publicationAuthorityRequestRefs = refsForSchema(
    records,
    artifactKinds.mediaPublicationAuthorityRequestCandidateLocal,
    'media-publication-authority-request-candidate'
  )
  const roughCutReviewDecisionRefs = refsForRecordPredicate(
    records,
    artifactKinds.mediaOperatorDecision,
    'media-operator-decision',
    (record) => record.roughCutReview
  )
  const acceptedAssetRefs = refsForAcceptedAssets(records)
  const byteDescriptorProposalRefs = refsForSchema(records, artifactKinds.mediaByteDescriptorProposalLocal, 'media-byte-descriptor-proposal')
  const resourceRefCandidateRefs = refsForSchema(records, artifactKinds.mediaLocalLayerResourceRefCandidateLocal, 'media-local-layer-resource-ref-candidate')
  const derivativeRefs = refsForSchema(records, artifactKinds.mediaDerivativeLocal, 'media-derivative')
  const inspectionPacketRefs = refsForSchema(records, artifactKinds.mediaEdgeInspectionPacketLocal, 'media-edge-inspection-packet')
  const compatibilityBundleRefs = refsForSchema(records, artifactKinds.mediaEdgeCompatibilityBundleLocal, 'media-edge-compatibility-bundle')
  const acceptedCandidateRows = prerequisiteReport.rows.map((row) => ({
    acceptedAssetPath: row.path,
    assetId: row.assetId,
    contentId: row.contentId,
    situationRef: row.situationRef,
    placementRef: row.placementRef,
    localPackageState: row.localPackageState,
    localProductionPackageComplete: row.localProductionPackageComplete,
    localProductionPackageState: row.localProductionPackageState,
    productionPackagePosture: row.productionPackagePosture,
    authorityState: row.authorityState,
    missingLocalPrerequisites: row.missingLocalPrerequisites,
    approvalProposalIdentity: row.approvalProposalIdentity,
    derivativeKinds: row.derivativeKinds,
    roughCutReviewPosture: row.roughCutReviewPosture,
    renderExportCandidatePosture: row.renderExportCandidatePosture,
    renderReceiptPosture: row.renderReceiptPosture,
    exportReceiptPosture: row.exportReceiptPosture,
    authorityGaps: row.authorityGaps,
    productionReady: false,
    approvalAuthority: false,
    publicationAuthorization: false,
    localOnly: true
  }))
  const layerInteropPosture = prerequisiteReport.layerInteropPosture ?? createLayerInteropPosture({
    layerRef,
    layerProfileRef,
    continuityRef,
    desyncPostureRef,
    rbcProfileRefs
  })
  const sourceRefs = compactRefs([
    ...productionBundleRefs,
    ...productionCapsuleRefs,
    ...roughCutCapsuleRefs,
    ...renderExportCandidateRefs,
    ...renderReceiptRefs,
    ...exportReceiptRefs,
    ...approvalProposalRefs,
    ...localPackageReviewDecisionRefs,
    ...publicationAuthorityRequestRefs,
    ...roughCutReviewDecisionRefs,
    ...localDecisionRefs,
    ...acceptedAssetRefs,
    ...byteDescriptorProposalRefs,
    ...resourceRefCandidateRefs,
    ...derivativeRefs,
    ...inspectionPacketRefs,
    ...compatibilityBundleRefs
  ])
  const prerequisiteSummary = {
    schema: prerequisiteReport.schema,
    candidates: prerequisiteReport.candidates,
    localPackageComplete: prerequisiteReport.localPackageComplete,
    localProductionPackageComplete: prerequisiteReport.localProductionPackageComplete ?? 0,
    localProductionPackageState: prerequisiteReport.localProductionPackageState ?? 'local-production-package-incomplete',
    authorityMissing: prerequisiteReport.authorityMissing === true,
    missingLocalPrerequisites: prerequisiteReport.missingLocalPrerequisites,
    pendingAuthority: prerequisiteReport.pendingAuthority,
    roughCutReviewed: prerequisiteReport.roughCutReviewed ?? 0,
    roughCutChangesRequested: prerequisiteReport.roughCutChangesRequested ?? 0,
    roughCutDeferred: prerequisiteReport.roughCutDeferred ?? 0,
    renderExportCandidates: prerequisiteReport.renderExportCandidates ?? 0,
    renderExportCandidatesFresh: prerequisiteReport.renderExportCandidatesFresh ?? 0,
    renderExportCandidatesStale: prerequisiteReport.renderExportCandidatesStale ?? 0,
    renderReceipts: prerequisiteReport.renderReceipts ?? 0,
    renderReceiptsFresh: prerequisiteReport.renderReceiptsFresh ?? 0,
    renderReceiptsStale: prerequisiteReport.renderReceiptsStale ?? 0,
    exportReceipts: prerequisiteReport.exportReceipts ?? 0,
    exportReceiptsFresh: prerequisiteReport.exportReceiptsFresh ?? 0,
    exportReceiptsStale: prerequisiteReport.exportReceiptsStale ?? 0,
    localPackageCopyExportReceipts: prerequisiteReport.localPackageCopyExportReceipts ?? 0,
    ffmpegDeliveryReceipts: prerequisiteReport.ffmpegDeliveryReceipts ?? 0,
    activeDeliveryReceipts: prerequisiteReport.activeDeliveryReceipts ?? 0,
    currentExportReceiptAttention: prerequisiteReport.currentExportReceiptAttention ?? 0,
    historicalExportReceiptAttention: prerequisiteReport.historicalExportReceiptAttention ?? 0,
    localDeliveryEvidencePresent: prerequisiteReport.localDeliveryEvidencePresent ?? 0,
    localDeliveryEvidenceIntact: prerequisiteReport.localDeliveryEvidenceIntact ?? 0,
    outputIntegrityBlockingIssues: prerequisiteReport.outputIntegrityBlockingIssues ?? 0,
    outputIntegrityAttentionIssues: prerequisiteReport.outputIntegrityAttentionIssues ?? 0,
    deliveryCreated: prerequisiteReport.deliveryCreated ?? 0,
    exportPerformed: prerequisiteReport.exportPerformed ?? 0,
    localPackageReviews: prerequisiteReport.localPackageReviews ?? 0,
    localPackageReworkRequests: prerequisiteReport.localPackageReworkRequests ?? 0,
    publicationAuthorityRequests: prerequisiteReport.publicationAuthorityRequests ?? 0,
    publicationAuthorityRequestsStale: prerequisiteReport.publicationAuthorityRequestsStale ?? 0,
    publicationAuthorityRequestsBlocked: prerequisiteReport.publicationAuthorityRequestsBlocked ?? 0,
    layerInteropState: layerInteropPosture.interopState,
    renderAuthorizationMissing: prerequisiteReport.renderAuthorizationMissing ?? 0,
    exportAuthorizationMissing: prerequisiteReport.exportAuthorizationMissing ?? 0,
    productionReady: prerequisiteReport.productionReady,
    operatorGuidanceOnly: true,
    localOnly: true
  }

  const candidate = {
    schema: artifactKinds.mediaAuthorityHandoffCandidateLocal,
    handoffCandidateId: `authority-handoff-candidate-${stableId([
      projectId,
      ...productionBundleRefs.map((ref) => ref.id),
      ...approvalProposalRefs.map((ref) => ref.id),
      ...productionCapsuleRefs.map((ref) => ref.id),
      ...roughCutCapsuleRefs.map((ref) => ref.id),
      ...renderExportCandidateRefs.map((ref) => ref.id),
      ...renderReceiptRefs.map((ref) => ref.id),
      ...exportReceiptRefs.map((ref) => ref.id),
      ...roughCutReviewDecisionRefs.map((ref) => ref.id)
    ].join('|'))}`,
    projectId,
    handoffKind: 'production-authority-review-candidate',
    mode: 'standalone-local',
    targetAuthorityLane: 'future-authority-lane',
    prerequisiteSummary,
    authorityReviewInputs: [
      {
        inputKind: 'production-bundle',
        refs: productionBundleRefs,
        required: true,
        present: productionBundleRefs.length > 0,
        localOnly: true
      },
      {
        inputKind: 'approval-proposal',
        refs: approvalProposalRefs,
        required: true,
        present: approvalProposalRefs.length > 0,
        localOnly: true
      },
      {
        inputKind: 'production-asset-capsule',
        refs: productionCapsuleRefs,
        required: true,
        present: productionCapsuleRefs.length > 0,
        localOnly: true
      },
      {
        inputKind: 'rough-cut-capsule',
        refs: roughCutCapsuleRefs,
        required: false,
        present: roughCutCapsuleRefs.length > 0,
        localOnly: true
      },
      {
        inputKind: 'rough-cut-review-decision',
        refs: roughCutReviewDecisionRefs,
        required: false,
        present: roughCutReviewDecisionRefs.length > 0,
        reviewed: prerequisiteReport.roughCutReviewed ?? 0,
        changesRequested: prerequisiteReport.roughCutChangesRequested ?? 0,
        deferred: prerequisiteReport.roughCutDeferred ?? 0,
        localDecisionOnly: true,
        localOnly: true
      },
      {
        inputKind: 'render-export-candidate',
        refs: renderExportCandidateRefs,
        required: false,
        present: renderExportCandidateRefs.length > 0,
        fresh: prerequisiteReport.renderExportCandidatesFresh ?? 0,
        stale: prerequisiteReport.renderExportCandidatesStale ?? 0,
        rendererSelected: false,
        renderPerformed: false,
        exportPerformed: false,
        renderAuthorization: false,
        exportAuthorization: false,
        publicationAuthorization: false,
        productionReady: false,
        localOnly: true
      },
      {
        inputKind: 'render-receipt',
        refs: renderReceiptRefs,
        required: false,
        present: renderReceiptRefs.length > 0,
        fresh: prerequisiteReport.renderReceiptsFresh ?? 0,
        stale: prerequisiteReport.renderReceiptsStale ?? 0,
        renderPerformed: renderReceiptRefs.length > 0,
        exportPerformed: false,
        renderAuthorization: false,
        exportAuthorization: false,
        publicationAuthorization: false,
        productionReady: false,
        localPreviewEvidenceOnly: true,
        localOnly: true
      },
      exportReceiptInput,
      {
        inputKind: 'local-package-review-decision',
        refs: localPackageReviewDecisionRefs,
        required: false,
        present: localPackageReviewDecisionRefs.length > 0,
        reviewed: prerequisiteReport.localPackageReviews ?? 0,
        reworkRequested: prerequisiteReport.localPackageReworkRequests ?? 0,
        localDecisionOnly: true,
        publicationAuthorization: false,
        productionReady: false,
        localOnly: true,
        operatorGuidanceOnly: true
      },
      {
        inputKind: 'publication-authority-request-candidate',
        refs: publicationAuthorityRequestRefs,
        required: false,
        present: publicationAuthorityRequestRefs.length > 0,
        fresh: prerequisiteReport.publicationAuthorityRequestsFresh ?? 0,
        stale: prerequisiteReport.publicationAuthorityRequestsStale ?? 0,
        blocked: prerequisiteReport.publicationAuthorityRequestsBlocked ?? 0,
        requestOnly: true,
        approvalAuthority: false,
        ratifierAuthority: false,
        publicationAuthorization: false,
        productionReady: false,
        localOnly: true,
        operatorGuidanceOnly: true
      },
      {
        inputKind: 'layer-posture-ref',
        refs: compactLayerRefs([
          layerInteropPosture.layerRef,
          layerInteropPosture.layerProfileRef,
          layerInteropPosture.continuityRef,
          layerInteropPosture.desyncPostureRef,
          ...(layerInteropPosture.rbcProfileRefs ?? [])
        ]),
        required: false,
        present: layerInteropPosture.interopState === 'layer-refs-attached-review-only',
        interopState: layerInteropPosture.interopState,
        durableAppendApproved: false,
        continuityClaimed: false,
        layerAuthority: false,
        localOnly: true,
        operatorGuidanceOnly: true
      },
      {
        inputKind: 'situated-identity',
        refs: acceptedCandidateRows.map((row) => ({
          kind: 'media-situated-accepted-candidate',
          id: row.situationRef?.id ?? row.acceptedAssetPath,
          schema: 'media.situation_ref.v1',
          path: row.acceptedAssetPath,
          contentId: row.contentId,
          placementRef: row.placementRef,
          localOnly: true
        })),
        required: true,
        present: acceptedCandidateRows.every((row) => row.situationRef?.id && row.placementRef?.id),
        localOnly: true
      },
      {
        inputKind: 'local-prerequisite-state',
        refs: [],
        required: true,
        present: prerequisiteReport.localPackageComplete === prerequisiteReport.candidates,
        localProductionPackageComplete: prerequisiteReport.localProductionPackageComplete ?? 0,
        localProductionPackageState: prerequisiteReport.localProductionPackageState ?? 'local-production-package-incomplete',
        authorityMissing: true,
        productionReady: false,
        publicationAuthorization: false,
        embeddedSummaryOnly: true,
        localOnly: true
      }
    ],
    acceptedCandidateRows,
    layerInteropPosture,
    sourceRefs,
    authorityGaps: [
      'approval_authority_missing',
      'ratifier_authority_missing',
      'render_authorization_missing',
      'export_authorization_missing',
      'publication_authorization_missing',
      'production_ready_false',
      'mesh_publication_missing'
    ],
    nextActions: [
      'Submit this candidate to a future authority lane that can review the local proposal, capsule, bundle, situated identity refs, and prerequisite gaps.',
      'Do not treat this handoff candidate as approval, ratification, publication authorization, or production readiness.'
    ],
    notes: [
      'This record packages local refs for future authority review only.',
      'It does not implement the authority lane and does not grant production use.',
      'Local proposal, capsule, bundle, inspection, and prerequisite records remain non-authoritative.'
    ],
    createdAt,
    operatorGuidanceOnly: true,
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
    localTruthLabel: 'local authority handoff candidate',
    truthStatus
  }

  validateRequiredRecord(candidate)
  return candidate
}

export function formatAuthorityHandoffCandidateSummary(candidate, output = defaultOutput) {
  return [
    `authority handoff candidate: project=${candidate.projectId}`,
    `candidates=${candidate.prerequisiteSummary.candidates}`,
    `localPackageComplete=${candidate.prerequisiteSummary.localPackageComplete}`,
    `localProductionPackageComplete=${candidate.prerequisiteSummary.localProductionPackageComplete ?? 0}`,
    `pendingAuthority=${candidate.prerequisiteSummary.pendingAuthority}`,
    `bundles=${candidate.authorityReviewInputs.find((input) => input.inputKind === 'production-bundle')?.refs.length ?? 0}`,
    `proposals=${candidate.authorityReviewInputs.find((input) => input.inputKind === 'approval-proposal')?.refs.length ?? 0}`,
    `capsules=${candidate.authorityReviewInputs.find((input) => input.inputKind === 'production-asset-capsule')?.refs.length ?? 0}`,
    `roughCuts=${candidate.authorityReviewInputs.find((input) => input.inputKind === 'rough-cut-capsule')?.refs.length ?? 0}`,
    `roughCutReviewed=${candidate.prerequisiteSummary.roughCutReviewed ?? 0}`,
    `renderExportCandidates=${candidate.prerequisiteSummary.renderExportCandidates ?? 0}`,
    `renderReceipts=${candidate.prerequisiteSummary.renderReceipts ?? 0}`,
    `exportReceipts=${candidate.prerequisiteSummary.exportReceipts ?? 0}`,
    `ffmpegDeliveryReceipts=${candidate.prerequisiteSummary.ffmpegDeliveryReceipts ?? 0}`,
    `activeDeliveryReceipts=${candidate.prerequisiteSummary.activeDeliveryReceipts ?? 0}`,
    `currentExportReceiptAttention=${candidate.prerequisiteSummary.currentExportReceiptAttention ?? 0}`,
    `historicalExportReceiptAttention=${candidate.prerequisiteSummary.historicalExportReceiptAttention ?? 0}`,
    `localDeliveryEvidencePresent=${candidate.prerequisiteSummary.localDeliveryEvidencePresent ?? 0}`,
    `deliveryCreated=${candidate.prerequisiteSummary.deliveryCreated ?? 0}`,
    `exportPerformed=${candidate.prerequisiteSummary.exportPerformed ?? 0}`,
    `localPackageReviews=${candidate.prerequisiteSummary.localPackageReviews ?? 0}`,
    `publicationAuthorityRequests=${candidate.prerequisiteSummary.publicationAuthorityRequests ?? 0}`,
    `layerInterop=${candidate.prerequisiteSummary.layerInteropState ?? 'layer-refs-not-attached'}`,
    `renderAuthorizationMissing=${candidate.prerequisiteSummary.renderAuthorizationMissing ?? 0}`,
    `exportAuthorizationMissing=${candidate.prerequisiteSummary.exportAuthorizationMissing ?? 0}`,
    `authorityGaps=${candidate.authorityGaps.length}`,
    `productionReady=${candidate.productionReady}`,
    `output=${output}`
  ].join(' | ')
}

function createExportReceiptInput(records, prerequisiteReport) {
  const exportEntries = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaExportReceiptLocal)
    .sort(compareRecordCreatedAt)
  const refs = exportEntries.map((entry) =>
    localRecordRef('media-export-receipt', entry.record.exportReceiptId, entry.record.schema, entry.path)
  )
  const receiptRows = summarizeExportReceipts(records).rows

  return {
    inputKind: 'export-receipt',
    refs,
    required: false,
    present: refs.length > 0,
    fresh: prerequisiteReport.exportReceiptsFresh ?? 0,
    stale: prerequisiteReport.exportReceiptsStale ?? 0,
    localPackageCopyExportReceipts: prerequisiteReport.localPackageCopyExportReceipts ?? 0,
    ffmpegDeliveryReceipts: prerequisiteReport.ffmpegDeliveryReceipts ?? 0,
    activeDeliveryReceipts: prerequisiteReport.activeDeliveryReceipts ?? 0,
    currentExportReceiptAttention: prerequisiteReport.currentExportReceiptAttention ?? 0,
    historicalExportReceiptAttention: prerequisiteReport.historicalExportReceiptAttention ?? 0,
    localDeliveryEvidencePresent: prerequisiteReport.localDeliveryEvidencePresent ?? 0,
    deliveryCreated: prerequisiteReport.deliveryCreated ?? 0,
    exportPerformed: prerequisiteReport.exportPerformed ?? 0,
    rows: receiptRows.map(authorityExportReceiptRow),
    attentionRows: receiptRows
      .filter((row) => row.issueCodes.length > 0)
      .map(authorityExportReceiptRow),
    currentAttentionRows: receiptRows
      .filter((row) => row.deliveryAttentionState === 'needs-local-attention')
      .map(authorityExportReceiptRow),
    historicalAttentionRows: receiptRows
      .filter((row) => row.deliveryAttentionState === 'historical-stale-receipt')
      .map(authorityExportReceiptRow),
    deliveryLocalRefs: exportEntries
      .map((entry) => entry.record.deliveryLocalRef)
      .filter((ref) => ref?.path)
      .map((ref) => ({ ...ref, localOnly: true })),
    sourceRenderReceiptRefs: compactRefs(exportEntries.map((entry) => entry.record.sourceRenderReceiptRef)),
    sourceRoughCutRefs: compactRefs(exportEntries.map((entry) => entry.record.sourceRoughCutRef)),
    sourceExportPlanRefs: compactRefs(exportEntries.map((entry) => entry.record.sourceExportPlanRef)),
    sourceExportCandidateRefs: compactRefs(exportEntries.map((entry) => entry.record.sourceExportCandidateRef)),
    renderAuthorization: false,
    exportAuthorization: false,
    publicationAuthorization: false,
    productionReady: false,
    localDeliveryEvidenceOnly: true,
    localOnly: true,
    operatorGuidanceOnly: true
  }
}

function authorityExportReceiptRow(row) {
  return {
    receiptRef: row.receiptRef,
    exportKind: row.exportKind,
    freshnessState: row.freshnessState,
    activeLocalDelivery: row.activeLocalDelivery,
    deliveryAttentionState: row.deliveryAttentionState,
    issueCodes: row.issueCodes,
    nextAction: row.nextAction,
    localDeliveryEvidencePresent: row.localDeliveryEvidencePresent,
    deliveryCreated: row.deliveryCreated,
    exportPerformed: row.exportPerformed,
    deliveryLocalRef: row.deliveryLocalRef,
    sourceRoughCutRef: row.sourceRoughCutRef,
    sourceRenderReceiptRef: row.sourceRenderReceiptRef,
    sourceExportPlanRef: row.sourceExportPlanRef,
    exportAuthorization: false,
    publicationAuthorization: false,
    productionReady: false,
    localOnly: true,
    operatorGuidanceOnly: true
  }
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

function refsForAcceptedAssets(records) {
  return records
    .filter((entry) => entry.record.schema === artifactKinds.mediaAssetDescriptor)
    .filter((entry) => entry.record.localRef?.placementClass === 'media-accepted')
    .sort(compareRecordCreatedAt)
    .map((entry) => ({
      ...localRecordRef('media-asset', entry.record.assetId, entry.record.schema, entry.path),
      contentId: entry.record.contentId,
      localRef: entry.record.localRef,
      situationRef: entry.record.situationRef,
      placementRef: entry.record.placementRef
    }))
}

function localRecordRef(kind, id, schema, relativePath) {
  return {
    ...makeRef(kind, id, schema),
    path: relativePath,
    localOnly: true
  }
}

function idForRecord(record) {
  return record.bundleId ??
    record.capsuleId ??
    record.roughCutId ??
    record.proposalId ??
    record.decisionId ??
    record.assetId ??
    record.byteDescriptorProposalId ??
    record.resourceRefCandidateId ??
    record.candidateId ??
    record.derivativeId ??
    record.packetId ??
    record.schema
}

function compactRefs(refs) {
  const output = []
  const seen = new Set()
  for (const ref of refs.filter((candidate) => candidate?.id && candidate?.path)) {
    const key = `${ref.schema}:${ref.id}:${ref.path}`
    if (seen.has(key)) continue
    seen.add(key)
    output.push(ref)
  }
  return output
}

function compactLayerRefs(refs) {
  const output = []
  const seen = new Set()
  for (const ref of refs.filter((candidate) => candidate?.id)) {
    const key = `${ref.kind}:${ref.id}`
    if (seen.has(key)) continue
    seen.add(key)
    output.push(ref)
  }
  return output
}

function compareRecordCreatedAt(left, right) {
  const rightTime = Date.parse(right.record?.createdAt ?? '') || 0
  const leftTime = Date.parse(left.record?.createdAt ?? '') || 0
  if (rightTime !== leftTime) return rightTime - leftTime
  return left.path.localeCompare(right.path)
}

function stableId(seed) {
  return createHash('sha256').update(seed).digest('hex').slice(0, 24)
}

if (process.argv[1] === modulePath) {
  await writeAuthorityHandoffCandidate(parseArgs(process.argv.slice(2)))
}
