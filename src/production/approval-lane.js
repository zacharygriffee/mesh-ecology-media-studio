import { artifactKinds } from '../contracts/artifact-kinds.js'

export function summarizeProductionApprovalLane({
  assetRecords,
  records,
  productionCapsules = { total: 0 },
  productionBundles = { total: 0 }
}) {
  const acceptedProviderAssets = assetRecords.filter((record) =>
    record.localRef?.placementClass === 'media-accepted' &&
    record.source?.sourceType === 'provider-result' &&
    isProductionAsset(record)
  )
  const localDecisionsBySubjectId = recordsBySubjectId(records, artifactKinds.mediaOperatorDecision)
  const proposalsBySubjectId = recordsBySubjectId(records, artifactKinds.mediaApprovalProposalLocal)
  const capsuleKeys = new Set()

  for (const entry of records.filter((candidate) => candidate.record.schema === artifactKinds.mediaProductionAssetCapsuleLocal)) {
    for (const key of [
      entry.record.subjectAssetRef?.id,
      entry.record.assetDescriptorRef?.id,
      entry.record.subjectAssetRef?.path,
      entry.record.localRef?.path
    ].filter(Boolean)) {
      capsuleKeys.add(key)
    }
  }

  const bundleAssetKeys = new Set()
  for (const entry of records.filter((candidate) => candidate.record.schema === artifactKinds.mediaProductionBundleLocal)) {
    for (const ref of entry.record.assetRefs ?? []) {
      if (ref.id) bundleAssetKeys.add(ref.id)
      if (ref.path) bundleAssetKeys.add(ref.path)
    }
  }

  const rows = acceptedProviderAssets.map((asset) => {
    const hasLocalDecision = (localDecisionsBySubjectId.get(asset.assetId)?.length ?? 0) > 0
    const hasApprovalProposal = (proposalsBySubjectId.get(asset.assetId)?.length ?? 0) > 0
    const hasCapsule = [
      asset.assetId,
      asset.assetDescriptorRef?.id,
      asset.assetDescriptorRef?.path,
      asset.localRef?.path
    ].filter(Boolean).some((key) => capsuleKeys.has(key))
    const hasBundle = [
      asset.assetId,
      asset.localRef?.path
    ].filter(Boolean).some((key) => bundleAssetKeys.has(key))
    const { laneState, issueCodes, nextAction } = productionApprovalState({
      hasLocalDecision,
      hasApprovalProposal,
      hasCapsule,
      hasBundle
    })

    return {
      assetId: asset.assetId,
      path: asset.localRef?.path,
      contentId: asset.contentId,
      situationRef: asset.situationRef,
      placementRef: asset.placementRef,
      laneState,
      localDecisionState: hasLocalDecision ? 'present' : 'missing',
      approvalProposalState: hasApprovalProposal ? 'proposed' : 'missing',
      capsuleState: hasCapsule ? 'present' : 'missing',
      bundleState: hasBundle ? 'present' : 'missing',
      issueCodes,
      nextAction,
      productionReady: false,
      approvalAuthority: false,
      ratifierAuthority: false,
      publicationAuthorization: false,
      localOnly: true,
      operatorGuidanceOnly: true,
      meshTruth: false,
      providerTruth: false,
      edgeApproval: false
    }
  })

  return {
    candidates: rows.length,
    localDecisions: rows.filter((row) => row.localDecisionState === 'present').length,
    approvalProposals: rows.filter((row) => row.approvalProposalState === 'proposed').length,
    capsules: rows.filter((row) => row.capsuleState === 'present').length,
    bundles: rows.filter((row) => row.bundleState === 'present').length,
    pendingAuthority: rows.filter((row) => row.issueCodes.includes('authority_not_granted')).length,
    productionReady: 0,
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
    edgeApproval: false,
    relatedTotals: {
      productionCapsules: productionCapsules.total,
      productionBundles: productionBundles.total
    }
  }
}

function productionApprovalState({
  hasLocalDecision,
  hasApprovalProposal,
  hasCapsule,
  hasBundle
}) {
  if (!hasLocalDecision) {
    return {
      laneState: 'needs-local-decision',
      issueCodes: ['local_decision_missing'],
      nextAction: 'Record an explicit local decision before requesting production approval.'
    }
  }

  if (!hasApprovalProposal) {
    return {
      laneState: 'needs-approval-proposal',
      issueCodes: ['approval_proposal_missing'],
      nextAction: 'Run npm run approval:proposal for this accepted generated asset before production use.'
    }
  }

  if (!hasCapsule) {
    return {
      laneState: 'needs-production-capsule',
      issueCodes: ['production_asset_capsule_missing', 'authority_not_granted'],
      nextAction: 'Run npm run production:capsule, then route the proposal through the proper authority lane.'
    }
  }

  if (!hasBundle) {
    return {
      laneState: 'needs-production-bundle',
      issueCodes: ['production_bundle_missing', 'authority_not_granted'],
      nextAction: 'Run npm run production:bundle to group capsules for review handoff; this still does not grant approval.'
    }
  }

  return {
    laneState: 'review-bundled-authority-missing',
    issueCodes: ['authority_not_granted'],
    nextAction: 'Route the bundled proposal through the proper authority lane before production use.'
  }
}

function recordsBySubjectId(records, schema) {
  const bySubjectId = new Map()
  for (const entry of records.filter((candidate) => candidate.record.schema === schema)) {
    const subjectId = entry.record.subjectRef?.id
    if (!subjectId) continue
    const existing = bySubjectId.get(subjectId) ?? []
    existing.push(entry.record)
    bySubjectId.set(subjectId, existing)
  }
  return bySubjectId
}

function isProductionAsset(asset) {
  const mediaKind = asset.metadataProbe?.mediaKind
  if (['image', 'video', 'audio'].includes(mediaKind)) return true
  const contentType = asset.contentType ?? asset.localRef?.contentType
  return ['image/', 'video/', 'audio/'].some((prefix) => contentType?.startsWith(prefix))
}
