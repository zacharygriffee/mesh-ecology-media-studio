import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { artifactKinds } from '../contracts/artifact-kinds.js'
import { summarizeProductionApprovalLane } from '../production/approval-lane.js'
import { evaluateRenderExportCandidateFreshness } from '../production/render-export-candidate.js'
import { summarizeRenderReceipts } from '../production/render-receipts.js'
import { summarizeExportReceipts } from '../production/export-receipts.js'
import { summarizeLayerInteropFromRecords } from '../layer/layer-interop.js'
import { writeProjectStatus, readProjectRecords } from '../seams/project-status.js'

const modulePath = fileURLToPath(import.meta.url)

function parseArgs(argv) {
  const args = {
    projectDir: 'examples/card-to-candidate',
    print: false
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]

    if (arg === '--project-dir') {
      args.projectDir = next
      i += 1
    } else if (arg === '--print') {
      args.print = true
    }
  }

  return args
}

export async function createMediaSummary({
  projectDir = 'examples/card-to-candidate'
} = {}) {
  const root = path.resolve(projectDir)
  const { status } = await writeProjectStatus({ projectDir, quiet: true })
  const records = await readProjectRecords(root)
  const assetRecords = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaAssetDescriptor)
    .map((entry) => entry.record)
  const derivativeRecords = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaDerivativeLocal)
    .map((entry) => entry.record)
  const mediaKinds = countBy(assetRecords, (record) => mediaKindForAsset(record))
  const placementClasses = countBy(assetRecords, (record) => record.localRef?.placementClass ?? 'unknown')
  const lifecycleStates = countBy(assetRecords, (record) => record.provenance?.lifecycle?.state ?? 'unknown')
  const derivativeKinds = countBy(derivativeRecords, (record) => record.derivativeKind ?? 'unknown')
  const generatedCandidates = summarizeGeneratedCandidates(assetRecords, records)
  const approvalLane = summarizeApprovalLane(records)
  const providerLoops = summarizeProviderLoops(records)
  const productionCapsules = summarizeProductionCapsules(assetRecords, records)
  const productionBundles = summarizeProductionBundles(records)
  const productionRoughCuts = summarizeProductionRoughCuts(records)
  const renderExportCandidates = summarizeRenderExportCandidates(records)
  const renderReceipts = summarizeRenderReceipts(records)
  const exportReceipts = summarizeExportReceipts(records)
  const layerInterop = summarizeLayerInteropFromRecords(records)
  const productionApprovalLane = summarizeProductionApprovalLane({
    assetRecords,
    records,
    productionCapsules,
    productionBundles
  })
  const derivativeReadiness = status.mediaDerivativeReadiness
  const attentionRows = derivativeReadiness.assetExplanations
    .filter((entry) => entry.state !== 'ready-for-local-inspection')
    .map((entry) => ({
      subjectRef: entry.subjectRef,
      path: entry.path,
      mediaKind: entry.mediaKind,
      issueCodes: entry.issueCodes,
      nextAction: entry.nextAction,
      localOnly: true,
      operatorGuidanceOnly: true,
      nonClaims: entry.nonClaims
    }))
  const safeNextAction = summarizeSafeNextAction({
    derivativeAttentionRows: attentionRows,
    generatedCandidates,
    approvalLane,
    providerLoops,
    productionCapsules,
    productionBundles,
    productionRoughCuts,
    renderExportCandidates,
    renderReceipts,
    exportReceipts,
    layerInterop,
    productionApprovalLane,
    bytePosture: status.assetResourceConsistency.bytePosture,
    resourcePosture: status.assetResourceConsistency.resourcePosture
  })

  return {
    schema: 'media.summary.local.v1',
    projectId: status.projectId,
    mode: 'standalone-local',
    assets: {
      total: assetRecords.length,
      byMediaKind: {
        image: mediaKinds.image ?? 0,
        video: mediaKinds.video ?? 0,
        audio: mediaKinds.audio ?? 0,
        unsupported: mediaKinds.unsupported ?? 0,
        unknown: mediaKinds.unknown ?? 0
      },
      byPlacementClass: placementClasses,
      byLifecycleState: lifecycleStates
    },
    metadataProbe: {
      unsupported: assetRecords.filter((record) => record.metadataProbe?.metadataProbeState === 'unsupported').length,
      unavailable: assetRecords.filter((record) => record.metadataProbe?.metadataProbeState === 'unavailable').length,
      failed: assetRecords.filter((record) => record.metadataProbe?.metadataProbeState === 'failed').length
    },
    derivativeReadiness: {
      readyAssets: derivativeReadiness.readyAssets,
      evaluatedAssets: derivativeReadiness.evaluatedAssets,
      attentionAssets: derivativeReadiness.attentionAssets,
      issueCodes: derivativeReadiness.issueCodes,
      attentionRows
    },
    derivatives: {
      total: derivativeRecords.length,
      byKind: {
        thumbnail: derivativeKinds.thumbnail ?? 0,
        proxy: derivativeKinds.proxy ?? 0,
        waveform: derivativeKinds.waveform ?? 0,
        unknown: derivativeKinds.unknown ?? 0
      }
    },
    generatedCandidates,
    approvalLane,
    providerLoops,
    productionCapsules,
    productionBundles,
    productionRoughCuts,
    renderExportCandidates,
    renderReceipts,
    exportReceipts,
    layerInterop,
    productionApprovalLane,
    safeNextAction,
    identity: {
      assetIdPosture: 'compatibility descriptor id',
      contentId: 'byte sameness',
      situationPlacement: 'situated media role',
      derivativeIdentity: 'descriptor/situation/placement-specific',
      byteContent: status.assetResourceConsistency.bytePosture,
      resourceSituations: status.assetResourceConsistency.resourcePosture
    },
    localOnly: true,
    operatorGuidanceOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    providerTruth: false,
    byteAvailabilityProof: false,
    materializationProof: false,
    resourceAdmission: false,
    causalTruth: false,
    publicationAuthorization: false,
    edgeApproval: false
  }
}

export async function writeMediaSummary(options = {}) {
  const summary = await createMediaSummary(options)

  if (options.print) {
    console.log(JSON.stringify(summary, null, 2))
  } else {
    printMediaSummary(summary)
  }

  return summary
}

function printMediaSummary(summary) {
  console.log([
    `media summary: project=${summary.projectId}`,
    `assets=${summary.assets.total}`,
    `images=${summary.assets.byMediaKind.image}`,
    `videos=${summary.assets.byMediaKind.video}`,
    `audio=${summary.assets.byMediaKind.audio}`,
    `unsupported=${summary.assets.byMediaKind.unsupported}`
  ].join(' | '))
  console.log([
    `derivatives: ready=${summary.derivativeReadiness.readyAssets}/${summary.derivativeReadiness.evaluatedAssets}`,
    `attention=${summary.derivativeReadiness.attentionAssets}`,
    `thumbnail=${summary.derivatives.byKind.thumbnail}`,
    `proxy=${summary.derivatives.byKind.proxy}`,
    `waveform=${summary.derivatives.byKind.waveform}`
  ].join(' | '))
  console.log([
    `metadata: unsupported=${summary.metadataProbe.unsupported}`,
    `unavailable=${summary.metadataProbe.unavailable}`,
    `failed=${summary.metadataProbe.failed}`
  ].join(' | '))
  console.log([
    `generated candidates: total=${summary.generatedCandidates.total}`,
    `reviewed=${summary.generatedCandidates.reviewed}`,
    `pending=${summary.generatedCandidates.pendingReview}`,
    `promotedAccepted=${summary.generatedCandidates.promotedAccepted}`,
    `promotedRejected=${summary.generatedCandidates.promotedRejected}`
  ].join(' | '))
  console.log([
    `production review: ready=${summary.generatedCandidates.productionReview.ready}`,
    `needsReview=${summary.generatedCandidates.productionReview.needsReview}`,
    `proposed=${summary.generatedCandidates.productionReview.proposed}`,
    `notCandidates=${summary.generatedCandidates.productionReview.notCandidates}`
  ].join(' | '))
  console.log([
    `approval lane: proposals=${summary.approvalLane.proposals}`,
    `pendingAuthority=${summary.approvalLane.pendingAuthority}`,
    `approved=${summary.approvalLane.approved}`,
    `blocked=${summary.approvalLane.blocked}`
  ].join(' | '))
  console.log([
    `provider loops: total=${summary.providerLoops.total}`,
    `complete=${summary.providerLoops.completeReviewOnly}`,
    `needsDecision=${summary.providerLoops.needsRetryDecision}`,
    `productionReady=${summary.providerLoops.readyForProductionReview}`
  ].join(' | '))
  console.log([
    `production capsules: total=${summary.productionCapsules.total}`,
    `expected=${summary.productionCapsules.expected}`,
    `missing=${summary.productionCapsules.missing}`,
    `attention=${summary.productionCapsules.attentionRows.length}`
  ].join(' | '))
  console.log([
    `production bundles: total=${summary.productionBundles.total}`,
    `capsules=${summary.productionBundles.capsuleRefs}`,
    `attention=${summary.productionBundles.attentionRows.length}`
  ].join(' | '))
  console.log([
    `rough cuts: total=${summary.productionRoughCuts.total}`,
    `items=${summary.productionRoughCuts.itemRefs}`,
    `reviewed=${summary.productionRoughCuts.reviewed}`,
    `changesRequested=${summary.productionRoughCuts.changesRequested}`,
    `deferred=${summary.productionRoughCuts.deferred}`,
    `pendingAuthority=${summary.productionRoughCuts.pendingAuthorityItems}`,
    `rendered=${summary.productionRoughCuts.rendered}`,
    `attention=${summary.productionRoughCuts.attentionRows.length}`
  ].join(' | '))
  console.log([
    `render/export candidates: total=${summary.renderExportCandidates.total}`,
    `reviewed=${summary.renderExportCandidates.reviewed}`,
    `rendererSelected=${summary.renderExportCandidates.rendererSelected}`,
    `renderPerformed=${summary.renderExportCandidates.renderPerformed}`,
    `exportPerformed=${summary.renderExportCandidates.exportPerformed}`,
    `productionReady=${summary.renderExportCandidates.productionReady}`,
    `stale=${summary.renderExportCandidates.stale}`,
    `attention=${summary.renderExportCandidates.attentionRows.length}`
  ].join(' | '))
  console.log([
    `render receipts: total=${summary.renderReceipts.total}`,
    `contactSheet=${summary.renderReceipts.contactSheet}`,
    `ffmpegPreview=${summary.renderReceipts.ffmpegPreview}`,
    `renderPerformed=${summary.renderReceipts.renderPerformed}`,
    `exportPerformed=${summary.renderReceipts.exportPerformed}`,
    `productionReady=${summary.renderReceipts.productionReady}`,
    `stale=${summary.renderReceipts.stale}`,
    `attention=${summary.renderReceipts.attentionRows.length}`
  ].join(' | '))
  console.log([
    `export receipts: total=${summary.exportReceipts.total}`,
    `localPackageCopy=${summary.exportReceipts.localPackageCopyExportReceipts}`,
    `ffmpegDelivery=${summary.exportReceipts.ffmpegDeliveryReceipts}`,
    `localDeliveryEvidence=${summary.exportReceipts.localDeliveryEvidencePresent}`,
    `deliveryCreated=${summary.exportReceipts.deliveryCreated}`,
    `exportPerformed=${summary.exportReceipts.exportPerformed}`,
    `publicationAuthorization=${summary.exportReceipts.publicationAuthorization}`,
    `productionReady=${summary.exportReceipts.productionReady}`,
    `attention=${summary.exportReceipts.attentionRows.length}`
  ].join(' | '))
  console.log([
    `production approval: candidates=${summary.productionApprovalLane.candidates}`,
    `decisions=${summary.productionApprovalLane.localDecisions}`,
    `proposals=${summary.productionApprovalLane.approvalProposals}`,
    `capsules=${summary.productionApprovalLane.capsules}`,
    `bundles=${summary.productionApprovalLane.bundles}`,
    `pendingAuthority=${summary.productionApprovalLane.pendingAuthority}`,
    `productionReady=${summary.productionApprovalLane.productionReady}`
  ].join(' | '))
  console.log([
    `layer interop: state=${summary.layerInterop.state}`,
    `handoffs=${summary.layerInterop.authorityHandoffRecords}`,
    `layerRefs=${summary.layerInterop.layerRefs.length}`,
    `profileRefs=${summary.layerInterop.layerProfileRefs.length}`,
    `attention=${summary.layerInterop.attentionRows.length}`,
    `durableAppendApproved=${summary.layerInterop.durableAppendApproved}`,
    `continuityClaimed=${summary.layerInterop.continuityClaimed}`,
    `layerAuthority=${summary.layerInterop.layerAuthority}`
  ].join(' | '))
  console.log([
    `identity: byteContent=${summary.identity.byteContent.coveredContentIds}/${summary.identity.byteContent.expectedContentIds}`,
    `resourceSituations=${summary.identity.resourceSituations.coveredSituationPlacements}/${summary.identity.resourceSituations.expectedSituationPlacements}`
  ].join(' | '))
  console.log(`safeNextAction: ${summary.safeNextAction}`)

  for (const row of summary.derivativeReadiness.attentionRows) {
    console.log(`attention: ${row.path} | issues=${row.issueCodes.join(',')} | nextAction=${row.nextAction}`)
  }
  for (const row of summary.generatedCandidates.attentionRows) {
    console.log(`generated candidate: ${row.path} | issues=${row.issueCodes.join(',')} | nextAction=${row.nextAction}`)
  }
  for (const row of summary.generatedCandidates.productionReview.attentionRows) {
    console.log(`production-review: ${row.path} | state=${row.productionReviewState} | issues=${row.issueCodes.join(',')} | nextAction=${row.nextAction}`)
  }
  for (const row of summary.approvalLane.attentionRows) {
    console.log(`approval-lane: ${row.proposalId} | state=${row.laneState} | issues=${row.issueCodes.join(',')} | nextAction=${row.nextAction}`)
  }
  for (const row of summary.providerLoops.blockedProductionRows) {
    console.log(`provider-loop-production: ${row.providerId}:${row.loopKind} | blockers=${row.productionBlockers.join(',')} | nextAction=${row.productionNextAction}`)
  }
  for (const row of summary.providerLoops.attentionRows) {
    console.log(`provider-loop: ${row.providerId}:${row.loopKind} | state=${row.state} | readiness=${row.readinessState} | nextAction=${row.nextAction}`)
  }
  for (const row of summary.productionCapsules.attentionRows) {
    console.log(`production-capsule: ${row.path} | state=${row.capsuleState} | issues=${row.issueCodes.join(',')} | nextAction=${row.nextAction}`)
  }
  for (const row of summary.productionBundles.attentionRows) {
    console.log(`production-bundle: ${row.bundleId} | state=${row.bundleState} | issues=${row.issueCodes.join(',')} | nextAction=${row.nextAction}`)
  }
  for (const row of summary.productionRoughCuts.attentionRows) {
    console.log(`rough-cut: ${row.roughCutId} | state=${row.roughCutState} | issues=${row.issueCodes.join(',')} | nextAction=${row.nextAction}`)
  }
  for (const row of summary.renderExportCandidates.rows) {
    console.log([
      `render/export candidate: ${row.candidateId}`,
      `roughCut=${row.roughCutId}`,
      `reviewed=${row.reviewed}`,
      `rendererSelected=${row.rendererSelected}`,
      `renderPerformed=${row.renderPerformed}`,
      `exportPerformed=${row.exportPerformed}`,
      `productionReady=${row.productionReady}`,
      `freshness=${row.freshnessState}`,
      `issues=${row.issueCodes.join(',') || 'none'}`,
      `path=${row.candidatePath}`
    ].join(' | '))
  }
  for (const row of summary.renderReceipts.rows) {
    console.log([
      `render receipt: ${row.renderReceiptId}`,
      `kind=${row.renderKind}`,
      `renderPerformed=${row.renderPerformed}`,
      `exportPerformed=${row.exportPerformed}`,
      `productionReady=${row.productionReady}`,
      `freshness=${row.freshnessState}`,
      `issues=${row.issueCodes.join(',') || 'none'}`,
      `output=${row.outputLocalRef?.path ?? 'none'}`,
      `path=${row.receiptRef.path}`
    ].join(' | '))
  }
  for (const row of summary.exportReceipts.rows) {
    console.log([
      `export receipt: ${row.exportReceiptId}`,
      `kind=${row.exportKind}`,
      `deliveryCreated=${row.deliveryCreated}`,
      `exportPerformed=${row.exportPerformed}`,
      `publicationAuthorization=${row.publicationAuthorization}`,
      `productionReady=${row.productionReady}`,
      `issues=${row.issueCodes.join(',') || 'none'}`,
      `delivery=${row.deliveryLocalRef?.path ?? 'none'}`,
      `path=${row.receiptRef.path}`
    ].join(' | '))
  }
  for (const row of summary.productionApprovalLane.attentionRows) {
    console.log([
      `production-approval: ${row.path}`,
      `state=${row.laneState}`,
      `decision=${row.localDecisionState}`,
      `proposal=${row.approvalProposalState}`,
      `capsule=${row.capsuleState}`,
      `bundle=${row.bundleState}`,
      `authority=missing`,
      `issues=${row.issueCodes.join(',')}`,
      `nextAction=${row.nextAction}`
    ].join(' | '))
  }
  for (const row of summary.layerInterop.attentionRows) {
    console.log(`layer-interop: state=${row.healthState} | issues=${row.issueCodes.join(',')} | nextAction=${row.nextAction}`)
  }

  console.log('nonClaims: local-only; no mesh truth; no approval authority; no publication authorization; no byte/materialization proof; no resource admission')
}

function summarizeSafeNextAction({
  derivativeAttentionRows,
  generatedCandidates,
  approvalLane,
  providerLoops,
  productionCapsules,
  productionBundles,
  productionRoughCuts,
  renderExportCandidates,
  renderReceipts,
  exportReceipts,
  layerInterop,
  productionApprovalLane,
  bytePosture,
  resourcePosture
}) {
  if (providerLoops.needsRetryDecision > 0) {
    return 'Create a provider-loop retry/defer request and decision before any retry; no retry is automatic.'
  }

  if ((bytePosture.missingContentIds?.length ?? 0) > 0) {
    return 'Run npm run bytes:proposal, then npm run resource:refs to repair local byte/resource posture.'
  }

  if ((resourcePosture.missingSubjectRefs?.length ?? 0) > 0 || (resourcePosture.staleSubjectRefs?.length ?? 0) > 0) {
    return 'Run npm run resource:refs after byte proposals are current.'
  }

  if (generatedCandidates.pendingReview > 0) {
    return 'Review or promote generated candidates with an explicit local decision.'
  }

  const actionableDerivative = derivativeAttentionRows.find((row) => !row.issueCodes.includes('unsupported_media_type'))
  if (actionableDerivative) return actionableDerivative.nextAction

  if (generatedCandidates.productionReview.needsReview > 0) {
    return 'Run npm run approval:proposal for accepted generated assets before production use.'
  }

  if (productionCapsules.missing > 0) {
    return 'Run npm run production:capsule for accepted assets before broader production handoff.'
  }

  if (productionCapsules.total > 0 && productionBundles.total === 0) {
    return 'Run npm run production:bundle to group local production capsules for review handoff.'
  }

  if (productionBundles.total > 0 && productionRoughCuts.total === 0) {
    return 'Run npm run production:rough-cut to assemble accepted production item refs into a local review cut.'
  }

  if (productionRoughCuts.total > 0 && productionRoughCuts.reviewed === 0) {
    return 'Run npm run production:rough-cut-review to record a local rough-cut review decision.'
  }

  if (productionRoughCuts.reviewed > 0 && renderExportCandidates.total === 0) {
    return 'Run npm run production:render-export-candidate to prepare a reviewed rough cut for a future render/export lane.'
  }

  if (renderReceipts.attentionRows.length > 0) {
    return renderReceipts.attentionRows[0].nextAction
  }

  if (exportReceipts.attentionRows.length > 0) {
    return exportReceipts.attentionRows[0].nextAction
  }

  if (layerInterop.attentionRows.length > 0) {
    return layerInterop.attentionRows[0].nextAction
  }

  if (productionApprovalLane.pendingAuthority > 0 || approvalLane.pendingAuthority > 0) {
    return 'Route pending approval proposals through the proper authority lane; local proposals and bundles are not approval.'
  }

  if (providerLoops.blockedProductionRows.length > 0) {
    return providerLoops.blockedProductionRows[0].productionNextAction
  }

  if (derivativeAttentionRows.length > 0) return derivativeAttentionRows[0].nextAction

  return 'No local media summary attention is blocking inspection; continue with the next operator-selected work.'
}

function summarizeProductionCapsules(assetRecords, records) {
  const acceptedProviderAssets = assetRecords.filter((record) =>
    record.localRef?.placementClass === 'media-accepted' &&
    record.source?.sourceType === 'provider-result' &&
    isProductionCapsuleEligibleAsset(record)
  )
  const capsules = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaProductionAssetCapsuleLocal)
    .map((entry) => ({ ...entry.record, path: entry.path }))
    .sort((left, right) => (right.createdAt ?? '').localeCompare(left.createdAt ?? ''))
  const capsulesBySubjectPath = new Map()

  for (const capsule of capsules) {
    for (const key of [capsule.subjectAssetRef?.path, capsule.localRef?.path].filter(Boolean)) {
      if (!capsulesBySubjectPath.has(key)) capsulesBySubjectPath.set(key, capsule)
    }
  }

  const missingRows = acceptedProviderAssets
    .filter((asset) => !capsulesBySubjectPath.has(asset.assetDescriptorRef?.path ?? asset.localRef?.path))
    .map((asset) => ({
      path: asset.localRef?.path,
      assetId: asset.assetId,
      contentId: asset.contentId,
      situationRef: asset.situationRef,
      placementRef: asset.placementRef,
      capsuleState: 'missing',
      issueCodes: ['missing_production_asset_capsule'],
      nextAction: 'Run npm run production:capsule for this accepted generated asset.',
      localOnly: true,
      operatorGuidanceOnly: true,
      productionReady: false,
      approvalAuthority: false,
      publicationAuthorization: false
    }))
  const capsuleRows = capsules.map((capsule) => {
    const state = capsule.productionPosture?.state ?? 'unknown'
    const missingApproval = state === 'needs-approval-proposal'
    const issueCodes = missingApproval
      ? ['approval_proposal_missing']
      : (capsule.productionPosture?.blockers ?? []).filter((issue) => issue !== 'authority_not_granted')

    return {
      capsuleId: capsule.capsuleId,
      path: capsule.localRef?.path ?? capsule.subjectAssetRef?.path,
      capsulePath: capsule.path,
      capsuleState: state,
      issueCodes,
      nextAction: missingApproval
        ? 'Run npm run approval:proposal, then regenerate the production capsule.'
        : capsule.productionPosture?.nextAction ?? 'Route through the proper authority lane before production use.',
      productionReady: false,
      approvalAuthority: false,
      publicationAuthorization: false,
      localOnly: true,
      operatorGuidanceOnly: true
    }
  })
  const attentionRows = [
    ...missingRows,
    ...capsuleRows.filter((row) => row.issueCodes.length > 0)
  ]

  return {
    total: capsules.length,
    expected: acceptedProviderAssets.length,
    missing: missingRows.length,
    presentForAcceptedAssets: acceptedProviderAssets.length - missingRows.length,
    rows: capsuleRows,
    attentionRows,
    productionReady: 0,
    localOnly: true,
    operatorGuidanceOnly: true,
    meshTruth: false,
    approvalAuthority: false,
    publicationAuthorization: false
  }
}

function isProductionCapsuleEligibleAsset(asset) {
  const mediaKind = asset.metadataProbe?.mediaKind
  if (['image', 'video', 'audio'].includes(mediaKind)) return true

  const contentType = asset.contentType ?? asset.localRef?.contentType
  return ['image/', 'video/', 'audio/'].some((prefix) => contentType?.startsWith(prefix))
}

function summarizeProductionBundles(records) {
  const bundles = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaProductionBundleLocal)
    .map((entry) => ({ ...entry.record, path: entry.path }))
    .sort((left, right) => (right.createdAt ?? '').localeCompare(left.createdAt ?? ''))
  const rows = bundles.map((bundle) => {
    const state = bundle.productionPosture?.state ?? 'unknown'
    const issueCodes = state === 'needs-capsules'
      ? ['production_capsules_missing']
      : (bundle.productionPosture?.blockers ?? []).filter((issue) => issue !== 'authority_not_granted')

    return {
      bundleId: bundle.bundleId,
      bundlePath: bundle.path,
      bundleState: state,
      capsuleRefs: bundle.capsuleRefs?.length ?? 0,
      assetRefs: bundle.assetRefs?.length ?? 0,
      contentRefs: bundle.contentRefs?.length ?? 0,
      issueCodes,
      nextAction: issueCodes.length > 0
        ? bundle.productionPosture?.nextAction
        : 'Inspect bundled capsules and route approval proposals through the proper authority lane before production use.',
      productionReady: false,
      approvalAuthority: false,
      publicationAuthorization: false,
      localOnly: true,
      operatorGuidanceOnly: true
    }
  })

  return {
    total: bundles.length,
    capsuleRefs: rows.reduce((sum, row) => sum + row.capsuleRefs, 0),
    assetRefs: rows.reduce((sum, row) => sum + row.assetRefs, 0),
    contentRefs: rows.reduce((sum, row) => sum + row.contentRefs, 0),
    rows,
    attentionRows: rows.filter((row) => row.issueCodes.length > 0),
    productionReady: 0,
    localOnly: true,
    operatorGuidanceOnly: true,
    meshTruth: false,
    approvalAuthority: false,
    publicationAuthorization: false
  }
}

function summarizeProductionRoughCuts(records) {
  const productionBundles = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaProductionBundleLocal)
    .map((entry) => ({ ...entry.record, path: entry.path }))
    .sort((left, right) => (right.createdAt ?? '').localeCompare(left.createdAt ?? ''))
  const latestProductionBundle = productionBundles[0]
  const roughCuts = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaRoughCutCapsuleLocal)
    .map((entry) => ({ ...entry.record, path: entry.path }))
    .sort((left, right) => (right.createdAt ?? '').localeCompare(left.createdAt ?? ''))
  const reviewDecisionsBySubject = new Map()
  for (const entry of records) {
    if (entry.record.schema !== artifactKinds.mediaOperatorDecision) continue
    if (!entry.record.roughCutReview || !entry.record.subjectRef?.id) continue
    const decisions = reviewDecisionsBySubject.get(entry.record.subjectRef.id) ?? []
    decisions.push({ ...entry.record, path: entry.path })
    reviewDecisionsBySubject.set(entry.record.subjectRef.id, decisions)
  }
  const rows = roughCuts.map((roughCut) => {
    const state = roughCut.assemblyPosture?.state ?? 'unknown'
    const reviewDecisions = (reviewDecisionsBySubject.get(roughCut.roughCutId) ?? [])
      .sort(compareRecordCreatedAtDescending)
    const latestDecision = reviewDecisions[0]
    const reviewed = latestDecision?.decisionType === 'review_rough_cut'
    const changesRequested = latestDecision?.decisionType === 'request_changes'
    const deferred = latestDecision?.decisionType === 'defer'
    const staleProductionBundle = isRoughCutStaleForProductionBundle(roughCut, latestProductionBundle)
    const issueCodes = roughCutIssueCodes({ state, reviewed, changesRequested, deferred, staleProductionBundle })
    const nextAction = roughCutNextAction(issueCodes)

    return {
      roughCutId: roughCut.roughCutId,
      roughCutPath: roughCut.path,
      roughCutState: state,
      itemRefs: roughCut.orderedItems?.length ?? 0,
      sourceRefs: roughCut.sourceRefs?.length ?? 0,
      pendingAuthorityItems: roughCut.assemblyPosture?.pendingAuthorityItems ?? 0,
      rendered: roughCut.renderPosture?.rendered === true,
      reviewed,
      changesRequested,
      deferred,
      staleProductionBundle,
      latestProductionBundleRef: latestProductionBundle
        ? {
            kind: 'media-production-bundle',
            id: latestProductionBundle.bundleId,
            schema: latestProductionBundle.schema,
            path: latestProductionBundle.path,
            localOnly: true
          }
        : null,
      latestReviewDecisionRef: latestDecision
        ? {
            kind: 'media-operator-decision',
            id: latestDecision.decisionId,
            schema: latestDecision.schema,
            path: latestDecision.path,
            decisionType: latestDecision.decisionType,
            localOnly: true
          }
        : null,
      reviewDecisionRefs: reviewDecisions.map((decision) => ({
        kind: 'media-operator-decision',
        id: decision.decisionId,
        schema: decision.schema,
        path: decision.path,
        decisionType: decision.decisionType,
        localOnly: true
      })),
      issueCodes,
      nextAction,
      productionReady: false,
      approvalAuthority: false,
      publicationAuthorization: false,
      localOnly: true,
      operatorGuidanceOnly: true
    }
  })

  return {
    total: roughCuts.length,
    itemRefs: rows.reduce((sum, row) => sum + row.itemRefs, 0),
    sourceRefs: rows.reduce((sum, row) => sum + row.sourceRefs, 0),
    pendingAuthorityItems: rows.reduce((sum, row) => sum + row.pendingAuthorityItems, 0),
    rendered: rows.filter((row) => row.rendered).length,
    reviewed: rows.filter((row) => row.reviewed).length,
    changesRequested: rows.filter((row) => row.changesRequested).length,
    deferred: rows.filter((row) => row.deferred).length,
    rows,
    attentionRows: rows.filter((row) => row.issueCodes.length > 0),
    productionReady: 0,
    localOnly: true,
    operatorGuidanceOnly: true,
    meshTruth: false,
    approvalAuthority: false,
    publicationAuthorization: false
  }
}

function summarizeRenderExportCandidates(records) {
  const candidates = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaRenderExportCandidateLocal)
    .map((entry) => ({ ...entry.record, path: entry.path }))
    .sort(compareRecordCreatedAtDescending)
  const rows = candidates.map((candidate) => {
    const freshness = evaluateRenderExportCandidateFreshness({ candidate, records })
    return {
      candidateId: candidate.candidateId,
      candidatePath: candidate.path,
      roughCutId: candidate.sourceRoughCutRef?.id ?? null,
      reviewed: candidate.reviewPosture?.reviewed === true,
      itemRefs: candidate.orderedItemRefs?.length ?? 0,
      rendererSelected: candidate.renderPosture?.rendererSelected === true,
      renderPerformed: candidate.renderPosture?.renderPerformed === true,
      exportPerformed: candidate.exportPosture?.exportPerformed === true,
      productionReady: candidate.productionReady === true,
      freshnessState: freshness.state,
      issueCodes: freshness.issueCodes,
      nextAction: freshness.nextAction,
      localOnly: true,
      operatorGuidanceOnly: true,
      approvalAuthority: false,
      publicationAuthorization: false
    }
  })

  return {
    total: rows.length,
    reviewed: rows.filter((row) => row.reviewed).length,
    itemRefs: rows.reduce((sum, row) => sum + row.itemRefs, 0),
    rendererSelected: rows.filter((row) => row.rendererSelected).length,
    renderPerformed: rows.filter((row) => row.renderPerformed).length,
    exportPerformed: rows.filter((row) => row.exportPerformed).length,
    productionReady: rows.filter((row) => row.productionReady).length,
    fresh: rows.filter((row) => row.freshnessState === 'fresh').length,
    stale: rows.filter((row) => row.freshnessState === 'stale').length,
    rows,
    attentionRows: rows.filter((row) => row.issueCodes.length > 0),
    localOnly: true,
    operatorGuidanceOnly: true,
    meshTruth: false,
    approvalAuthority: false,
    publicationAuthorization: false
  }
}

function roughCutIssueCodes({ state, reviewed, changesRequested, deferred, staleProductionBundle }) {
  if (state === 'needs-production-items') return ['rough_cut_items_missing']
  if (staleProductionBundle) return ['rough_cut_stale_production_bundle']
  if (changesRequested) return ['rough_cut_changes_requested']
  if (deferred) return ['rough_cut_review_deferred']
  if (!reviewed) return ['rough_cut_review_missing']
  return []
}

function roughCutNextAction(issueCodes) {
  if (issueCodes.includes('rough_cut_items_missing')) {
    return 'Create production capsules and a production bundle before regenerating the rough-cut capsule.'
  }
  if (issueCodes.includes('rough_cut_stale_production_bundle')) {
    return 'Regenerate the rough-cut capsule from the current production bundle.'
  }
  if (issueCodes.includes('rough_cut_changes_requested')) {
    return 'Regenerate or revise the rough-cut capsule before authority handoff review.'
  }
  if (issueCodes.includes('rough_cut_review_deferred')) {
    return 'Resolve deferred rough-cut review before authority handoff review.'
  }
  if (issueCodes.includes('rough_cut_review_missing')) {
    return 'Run npm run production:rough-cut-review to record a local rough-cut review decision.'
  }
  return 'Review decision is recorded locally; render/export/publication remain separate future work.'
}

function isRoughCutStaleForProductionBundle(roughCut, latestProductionBundle) {
  if (!latestProductionBundle?.bundleId) return false
  const roughCutBundleRefs = roughCut.sourceRefs ?? []
  const includesLatestBundle = roughCutBundleRefs.some((ref) =>
    ref.schema === artifactKinds.mediaProductionBundleLocal &&
    ref.id === latestProductionBundle.bundleId
  )
  if (includesLatestBundle) return false

  const latestBundleTime = Date.parse(latestProductionBundle.createdAt ?? '') || 0
  const roughCutTime = Date.parse(roughCut.createdAt ?? '') || 0
  return latestBundleTime >= roughCutTime
}

function compareRecordCreatedAtDescending(left, right) {
  const rightTime = Date.parse(right.createdAt ?? '') || 0
  const leftTime = Date.parse(left.createdAt ?? '') || 0
  if (rightTime !== leftTime) return rightTime - leftTime
  return (right.path ?? '').localeCompare(left.path ?? '')
}

function summarizeProviderLoops(records) {
  const statuses = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaProviderLoopStatusLocal)
    .map((entry) => ({ ...entry.record, path: entry.path }))
    .sort((left, right) => (right.createdAt ?? '').localeCompare(left.createdAt ?? ''))
  const rows = statuses.map((status) => {
    const readinessState = readinessStateForProviderLoop(status)
    return {
      statusId: status.statusId,
      path: status.path,
      providerId: status.providerId,
      loopKind: status.loopKind,
      state: status.state,
      failedStep: status.failedStep ?? null,
      completionScope: status.completionScope ?? 'generated-candidate-local-loop',
      productionReady: status.productionReady === true,
      productionReadiness: status.productionReadiness ?? 'not assessed; provider-loop status only',
      readinessState,
      nextAction: nextActionForProviderLoop(status, readinessState),
      productionBlockers: productionBlockersForProviderLoop(status),
      productionNextAction: productionNextActionForProviderLoop(status),
      completedSteps: status.completedSteps?.length ?? 0,
      localOnly: true,
      operatorGuidanceOnly: true,
      meshTruth: false,
      providerTruth: false,
      edgeCalled: false,
      meshPublished: false,
      resourceAdmission: false
    }
  })
  const attentionRows = rows.filter((row) => row.readinessState !== 'loop-complete-local-review-only')

  return {
    total: rows.length,
    completeReviewOnly: rows.filter((row) => row.state === 'complete_review_only').length,
    needsRetryDecision: rows.filter((row) => row.readinessState === 'needs-retry-decision').length,
    readyForProductionReview: rows.filter((row) => row.productionReady === true).length,
    blockedProductionRows: rows.filter((row) => row.productionBlockers.length > 0),
    rows,
    attentionRows,
    latest: rows[0],
    localOnly: true,
    operatorGuidanceOnly: true,
    meshTruth: false,
    providerTruth: false,
    resourceAdmission: false
  }
}

function readinessStateForProviderLoop(status) {
  if (status.state === 'failed_review_only') return 'needs-retry-decision'
  if (status.state === 'complete_with_attention') return 'loop-complete-with-local-attention'
  if (status.state === 'complete_review_only') return 'loop-complete-local-review-only'
  return 'loop-incomplete-local-review-only'
}

function productionBlockersForProviderLoop(status) {
  if (status.productionReady === true) return []
  if (status.state === 'complete_review_only') {
    return [
      'provider_loop_complete_review_only',
      'production_review_or_authority_not_granted'
    ]
  }
  if (status.state === 'complete_with_attention') {
    return [
      'local_attention_required_before_production_review',
      'production_review_or_authority_not_granted'
    ]
  }
  if (status.state === 'failed_review_only') {
    return [
      'provider_loop_failed_review_only',
      'retry_or_defer_decision_required'
    ]
  }
  return ['provider_loop_not_complete']
}

function productionNextActionForProviderLoop(status) {
  if (status.productionReady === true) return 'No local provider-loop production blocker is reported.'
  if (status.state === 'complete_review_only') {
    return 'Inspect accepted assets in media:summary and route any approval proposals before production use.'
  }
  if (status.state === 'complete_with_attention') {
    return status.nextAction ?? 'Clear local attention rows before production review.'
  }
  if (status.state === 'failed_review_only') {
    return 'Request retry or defer decision; do not treat the failed loop as production-ready.'
  }
  return status.nextAction ?? 'Complete the provider loop before production review.'
}

function nextActionForProviderLoop(status, readinessState) {
  if (readinessState === 'needs-retry-decision') {
    return 'Run npm run operator:provider-loop-request to request retry/defer; retry is not automatic.'
  }

  if (readinessState === 'loop-complete-with-local-attention') {
    return status.nextAction ?? 'Review media summary attention rows before production review.'
  }

  if (readinessState === 'loop-complete-local-review-only') {
    return 'Run npm run operator:provider-loop-request to request review/defer before broader production use.'
  }

  return status.nextAction ?? 'Inspect provider-loop status before continuing.'
}

function summarizeApprovalLane(records) {
  const proposals = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaApprovalProposalLocal)
    .map((entry) => ({ ...entry.record, path: entry.path }))
    .sort((left, right) => (right.createdAt ?? '').localeCompare(left.createdAt ?? ''))
  const rows = proposals.map((proposal) => {
    const proposed = proposal.status === 'proposed'
    const laneState = proposed ? 'pending-authority-review' : `proposal-${proposal.status}`
    const issueCodes = proposed ? ['authority_required'] : [`proposal_${proposal.status}`]
    return {
      proposalId: proposal.proposalId,
      path: proposal.path,
      subjectRef: proposal.subjectRef,
      proposalType: proposal.proposalType,
      proposedDecision: proposal.proposedDecision,
      status: proposal.status,
      laneState,
      issueCodes,
      nextAction: proposed
        ? 'Route this proposal through the proper authority lane; do not treat the local proposal as approval.'
        : 'Inspect proposal status before further action.',
      localOnly: true,
      operatorGuidanceOnly: true,
      proposalOnly: true,
      meshTruth: false,
      distributedProof: false,
      ratifiedSharedState: false,
      approvalAuthority: false,
      ratifierAuthority: false,
      publicationAuthorization: false,
      edgeApproval: false
    }
  })

  return {
    proposals: rows.length,
    pendingAuthority: rows.filter((row) => row.laneState === 'pending-authority-review').length,
    approved: 0,
    blocked: rows.filter((row) => row.issueCodes.length > 0).length,
    byProposalType: countBy(rows, (row) => row.proposalType ?? 'unknown'),
    rows,
    attentionRows: rows.filter((row) => row.issueCodes.length > 0),
    localOnly: true,
    operatorGuidanceOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    approvalAuthority: false,
    ratifierAuthority: false,
    publicationAuthorization: false,
    edgeApproval: false
  }
}

function summarizeGeneratedCandidates(assetRecords, records) {
  const generated = assetRecords.filter((record) =>
    record.localRef?.placementClass === 'media-generated' &&
    record.source?.sourceType === 'provider-result'
  )
  const providerPromotions = assetRecords.filter((record) =>
    ['media-accepted', 'media-rejected'].includes(record.localRef?.placementClass) &&
    record.source?.sourceType === 'provider-result'
  )
  const decisionsByAssetId = new Map()
  const approvalProposalsBySubjectId = new Map()

  for (const entry of records) {
    const record = entry.record
    const subjectId = record.subjectRef?.id
    if (!subjectId) continue
    if (record.schema === artifactKinds.mediaOperatorDecision) {
      const decisions = decisionsByAssetId.get(subjectId) ?? []
      decisions.push(record)
      decisionsByAssetId.set(subjectId, decisions)
    } else if (record.schema === artifactKinds.mediaApprovalProposalLocal) {
      const proposals = approvalProposalsBySubjectId.get(subjectId) ?? []
      proposals.push(record)
      approvalProposalsBySubjectId.set(subjectId, proposals)
    }
  }

  const rows = generated.map((asset) => {
    const decisions = decisionsByAssetId.get(asset.assetId) ?? []
    const decisionTypes = Array.from(new Set(decisions.map((decision) => decision.decisionType).filter(Boolean))).sort()
    const reviewed = decisions.length > 0

    return {
      assetId: asset.assetId,
      path: asset.localRef?.path,
      contentId: asset.contentId,
      situationRef: asset.situationRef,
      placementRef: asset.placementRef,
      reviewState: reviewed ? 'reviewed-locally' : 'needs-local-review',
      decisionTypes,
      issueCodes: reviewed ? [] : ['missing_local_review'],
      nextAction: reviewed
        ? 'Promote accepted or rejected generated candidate when placement should change.'
        : 'Run npm run review:candidates or promote the generated candidate with an explicit local decision.',
      localOnly: true,
      operatorGuidanceOnly: true,
      meshTruth: false,
      providerTruth: false,
      publicationAuthorization: false
    }
  })
  const attentionRows = rows.filter((row) => row.issueCodes.length > 0)
  const productionReview = summarizeGeneratedProductionReview(providerPromotions, {
    approvalProposalsBySubjectId
  })

  return {
    total: generated.length,
    reviewed: rows.length - attentionRows.length,
    pendingReview: attentionRows.length,
    acceptedDecisions: rows.filter((row) => row.decisionTypes.includes('accept')).length,
    rejectedDecisions: rows.filter((row) => row.decisionTypes.includes('reject')).length,
    promotedAccepted: providerPromotions.filter((record) => record.localRef?.placementClass === 'media-accepted').length,
    promotedRejected: providerPromotions.filter((record) => record.localRef?.placementClass === 'media-rejected').length,
    productionReview,
    rows,
    attentionRows,
    localOnly: true,
    operatorGuidanceOnly: true,
    meshTruth: false,
    providerTruth: false,
    publicationAuthorization: false
  }
}

function summarizeGeneratedProductionReview(providerPromotions, {
  approvalProposalsBySubjectId
}) {
  const rows = providerPromotions.map((asset) => {
    const accepted = asset.localRef?.placementClass === 'media-accepted'
    const rejected = asset.localRef?.placementClass === 'media-rejected'
    const proposals = approvalProposalsBySubjectId.get(asset.assetId) ?? []
    const proposalRefs = proposals.map((proposal) => ({
      kind: 'media-approval-proposal',
      id: proposal.proposalId,
      schema: proposal.schema,
      localOnly: true
    }))
    let productionReviewState = 'not-production-candidate'
    let issueCodes = []
    let nextAction = 'No production review action is needed for rejected provider output.'

    if (accepted && proposals.length > 0) {
      productionReviewState = 'production-review-proposed'
      issueCodes = ['production_review_proposal_pending']
      nextAction = 'Route the approval proposal through the proper authority lane before production use.'
    } else if (accepted) {
      productionReviewState = 'needs-production-review'
      issueCodes = ['missing_production_review_proposal']
      nextAction = 'Run npm run approval:proposal for this accepted generated asset before production use.'
    } else if (rejected) {
      productionReviewState = 'not-production-candidate'
    }

    return {
      assetId: asset.assetId,
      path: asset.localRef?.path,
      contentId: asset.contentId,
      situationRef: asset.situationRef,
      placementRef: asset.placementRef,
      placementClass: asset.localRef?.placementClass,
      productionReviewState,
      productionReady: false,
      proposalRefs,
      issueCodes,
      nextAction,
      localOnly: true,
      operatorGuidanceOnly: true,
      meshTruth: false,
      providerTruth: false,
      approvalAuthority: false,
      ratifierAuthority: false,
      publicationAuthorization: false
    }
  })
  const attentionRows = rows.filter((row) => row.issueCodes.length > 0)

  return {
    ready: rows.filter((row) => row.productionReady).length,
    needsReview: rows.filter((row) => row.productionReviewState === 'needs-production-review').length,
    proposed: rows.filter((row) => row.productionReviewState === 'production-review-proposed').length,
    notCandidates: rows.filter((row) => row.productionReviewState === 'not-production-candidate').length,
    rows,
    attentionRows,
    localOnly: true,
    operatorGuidanceOnly: true,
    meshTruth: false,
    providerTruth: false,
    approvalAuthority: false,
    ratifierAuthority: false,
    publicationAuthorization: false
  }
}

function countBy(records, classifier) {
  const counts = {}

  for (const record of records) {
    const key = classifier(record)
    counts[key] = (counts[key] ?? 0) + 1
  }

  return counts
}

function mediaKindForAsset(record) {
  return record.metadataProbe?.mediaKind ??
    (record.contentType?.startsWith('image/')
      ? 'image'
      : record.contentType?.startsWith('video/')
        ? 'video'
        : record.contentType?.startsWith('audio/')
          ? 'audio'
          : 'unsupported')
}

if (process.argv[1] === modulePath) {
  await writeMediaSummary(parseArgs(process.argv.slice(2)))
}
