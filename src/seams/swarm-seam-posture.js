const genericLayerEnvelope = 'layer_source_pressure_review.v0'
const genericLayerEnvelopeSchema = 'layer-source-pressure-review.v0'

export function summarizeSwarmSeamPosture({
  localPackagePosture = {},
  adapterSummary = {},
  edgeSourceRefs = [],
  layerSourceRefs = [],
  missingEdgeSourceSchemas = [],
  missingLayerSourceSchemas = [],
  layerInteropSummary = {}
} = {}) {
  const normalizedAdapter = normalizeAdapterSummary(adapterSummary)
  const targetSeams = [
    'mesh-ecology-layer:layer_source_pressure_review.v0',
    'mesh-ecology-edge:media-edge-operator-seam'
  ]
  const sourceRefCount = uniqueSourceRefCount([...edgeSourceRefs, ...layerSourceRefs])
  const missingSourceSchemas = [...new Set([
    ...missingEdgeSourceSchemas,
    ...missingLayerSourceSchemas
  ])]
  const attentionCodes = attentionCodesForPosture({
    localPackagePosture,
    adapter: normalizedAdapter,
    sourceRefCount,
    missingSourceSchemas,
    layerInteropSummary
  })
  const state = stateForAttention(attentionCodes)

  return {
    summaryKind: 'studio-swarm-seam-posture-summary',
    state,
    targetSeams,
    localPackage: localPackagePosture.packageState ?? 'unknown',
    adapterDecision: normalizedAdapter.latestDecisionStatus,
    adapterObservation: normalizedAdapter.observationStatus,
    genericLayerEnvelope: normalizedAdapter.targetGenericEnvelope,
    emittedEnvelopeSchemaVersion: normalizedAdapter.emittedEnvelopeSchemaVersion,
    sourceRefCount,
    missingSourceSchemas,
    layerInteropState: layerInteropSummary.state ?? 'layer-refs-not-attached',
    attentionCodes,
    safeNextAction: safeNextActionForState(state),
    nonClaims: swarmSeamNonClaims(),
    localOnly: true,
    operatorGuidanceOnly: true,
    reviewOnly: true,
    publicSwarmProof: false,
    swarmRuntimeActivated: false,
    activation: false,
    edgeDispatch: false,
    layerAdmission: false,
    durableAppend: false,
    acceptedContinuity: false,
    productionStorageSelected: false,
    productionReady: false,
    authorityGranted: false
  }
}

export function formatSwarmSeamPostureFields(posture = {}, { nextActionField = 'nextAction' } = {}) {
  return [
    `swarmSeam=${posture.state ?? 'unknown'}`,
    'swarmProof=false',
    'activation=false',
    `${nextActionField}=${posture.safeNextAction ?? 'Inspect Studio swarm seam posture.'}`
  ].join(' | ')
}

export function swarmSeamNonClaims() {
  return {
    localOnly: true,
    operatorGuidanceOnly: true,
    reviewOnly: true,
    publicSwarmProof: false,
    deviceBoundaryProof: false,
    swarmRuntimeActivated: false,
    activation: false,
    edgeQueueAction: false,
    edgeDispatch: false,
    edgeRuntimeVerified: false,
    edgeAuthority: false,
    layerAdmission: false,
    durableAppend: false,
    acceptedContinuity: false,
    productionStorageSelection: false,
    productionReady: false,
    publicationAuthorization: false,
    meshPublication: false,
    byteMaterializationProof: false,
    causalTruth: false,
    authorityGranted: false,
    autoExecute: false
  }
}

function normalizeAdapterSummary(adapter = {}) {
  const latestDecisionStatus = adapter.latestDecisionStatus ??
    adapter.operatorDecision?.decisionStatus ??
    (adapter.enabled === false ? 'none' : adapter.decision === 'approved'
      ? 'approved_bounded_studio_source_pressure_observation'
      : adapter.decision === 'rejected'
        ? 'rejected_bounded_studio_source_pressure_observation'
        : 'none')
  const observationStatus = adapter.observationStatus ??
    adapter.observationResult?.observationStatus ??
    (adapter.observationWritten === true
      ? 'studio_source_pressure_routed_through_generic_layer_seam'
      : latestDecisionStatus === 'rejected_bounded_studio_source_pressure_observation'
        ? 'skipped'
        : 'absent')

  return {
    latestDecisionStatus,
    observationStatus,
    targetGenericEnvelope: adapter.targetGenericEnvelope ?? genericLayerEnvelope,
    emittedEnvelopeSchemaVersion: adapter.emittedEnvelopeSchemaVersion ?? genericLayerEnvelopeSchema
  }
}

function attentionCodesForPosture({
  localPackagePosture,
  adapter,
  sourceRefCount,
  missingSourceSchemas,
  layerInteropSummary
}) {
  const codes = []

  if (localPackagePosture.packageState === 'output_integrity_blocked' ||
      localPackagePosture.integrityPosture === 'blocked') {
    codes.push('output_integrity_blocked')
  }

  if (localPackagePosture.packageState &&
      localPackagePosture.packageState !== 'complete_review_only_authority_missing' &&
      !codes.includes('output_integrity_blocked')) {
    codes.push(`local_package:${localPackagePosture.packageState}`)
  }

  if (sourceRefCount <= 0) codes.push('source_pressure_refs_missing')
  if ((layerInteropSummary.attentionRows?.length ?? 0) > 0) {
    codes.push('layer_interop_attention')
  }

  if (adapter.latestDecisionStatus === 'rejected_bounded_studio_source_pressure_observation') {
    codes.push('adapter_hold')
  } else if (adapter.latestDecisionStatus === 'none') {
    codes.push('source_pressure_adapter_chain_missing')
  } else if (adapter.observationStatus !== 'studio_source_pressure_routed_through_generic_layer_seam') {
    codes.push(`source_pressure_observation:${adapter.observationStatus}`)
  }

  return [...new Set(codes)]
}

function stateForAttention(attentionCodes) {
  if (attentionCodes.includes('output_integrity_blocked')) return 'integrity_blocked'
  if (attentionCodes.some((code) => code.startsWith('local_package:'))) return 'local_package_attention'
  if (attentionCodes.includes('adapter_hold')) return 'adapter_hold'
  if (attentionCodes.length > 0) return 'source_pressure_attention'
  return 'ready_for_review_only_swarm_pressure'
}

function safeNextActionForState(state) {
  if (state === 'ready_for_review_only_swarm_pressure') {
    return 'Carry Studio evidence to future family swarm-seam review only; do not activate swarm runtime locally.'
  }
  if (state === 'local_package_attention') {
    return 'Complete or refresh Studio local package evidence before future swarm-seam pressure.'
  }
  if (state === 'integrity_blocked') {
    return 'Resolve local output integrity blockers before future swarm-seam pressure.'
  }
  if (state === 'adapter_hold') {
    return 'Hold Studio source-pressure observation; keep candidate and decision as review-only local evidence.'
  }
  return 'Run npm run pressure:studio -- --adapter-chain after local package evidence is complete.'
}

function uniqueSourceRefCount(refs) {
  return new Set(refs.map((ref) => [
    ref.kind ?? 'record',
    ref.id ?? ref.path ?? ref.relativePath ?? 'unknown',
    ref.schema ?? 'unknown'
  ].join(':'))).size
}
