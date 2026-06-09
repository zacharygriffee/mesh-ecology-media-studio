import { artifactKinds } from '../contracts/artifact-kinds.js'
import { makeRef } from '../contracts/constructors.js'

export function summarizeLocalProofRehearsal(recordsOrSources = [], {
  localPackagePosture = null,
  swarmSeamPosture = null,
  adapterSummary = null
} = {}) {
  const entries = normalizeEntries(recordsOrSources)
    .filter((entry) => entry.record.schema === artifactKinds.mediaStudioLocalProofRehearsalLocal)
    .sort(sortNewestRecordFirst)
  const latest = entries[0]
  const record = latest?.record
  const state = record?.proofState ?? 'absent'
  const localPackageState = record?.localPackagePosture?.packageState ?? record?.summary?.localPackageState ?? 'absent'
  const swarmSeamState = record?.swarmSeamPosture?.state ?? record?.summary?.swarmSeamState ?? 'absent'
  const adapterDecisionStatus = record?.studioSourcePressureAdapterSummary?.latestDecisionStatus ??
    record?.summary?.adapterDecisionStatus ??
    'none'
  const observationStatus = record?.studioSourcePressureAdapterSummary?.observationStatus ??
    record?.summary?.observationStatus ??
    'absent'
  const targetGenericEnvelope = record?.studioSourcePressureAdapterSummary?.targetGenericEnvelope ??
    'layer_source_pressure_review.v0'
  const staleReasons = record ? proofStaleReasons({
    localPackageState,
    swarmSeamState,
    adapterDecisionStatus,
    observationStatus,
    targetGenericEnvelope,
    localPackagePosture,
    swarmSeamPosture,
    adapterSummary
  }) : []
  const proofFreshness = record
    ? staleReasons.length > 0 ? 'stale' : 'fresh'
    : 'absent'
  const proofNextAction = proofFreshness === 'stale'
    ? 'Run npm run proof:local to refresh local proof rehearsal evidence after local posture changes.'
    : record?.safeNextAction ??
      record?.summary?.safeNextAction ??
      'Run npm run proof:local to create local proof rehearsal evidence.'

  return {
    summaryKind: 'studio-local-proof-rehearsal-summary',
    proofs: entries.length,
    latestProofRef: latest ? localRecordRef(latest) : null,
    latestProofState: state,
    proofFreshness,
    staleReasons,
    proofNextAction,
    localPackageState,
    swarmSeamState,
    adapterDecisionStatus,
    observationStatus,
    targetGenericEnvelope,
    safeNextAction: proofNextAction,
    surfaced: record?.summary?.surfaced === true || Boolean(record?.surfaceRefs),
    surfaceRefs: record?.surfaceRefs ?? null,
    attentionRows: state === 'attention' || proofFreshness === 'stale' ? 1 : 0,
    readyProofs: entries.filter((entry) => entry.record.proofState === 'ready').length,
    attentionProofs: entries.filter((entry) => entry.record.proofState === 'attention').length,
    freshProofs: proofFreshness === 'fresh' ? 1 : 0,
    staleProofs: proofFreshness === 'stale' ? 1 : 0,
    publicSwarmProof: false,
    swarmRuntimeActivated: false,
    edgeDispatch: false,
    layerAdmission: false,
    publicationAuthorization: false,
    productionReady: false,
    localOnly: true,
    operatorGuidanceOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false
  }
}

function proofStaleReasons({
  localPackageState,
  swarmSeamState,
  adapterDecisionStatus,
  observationStatus,
  targetGenericEnvelope,
  localPackagePosture,
  swarmSeamPosture,
  adapterSummary
}) {
  const reasons = []
  const currentLocalPackageState = localPackagePosture?.packageState
  const currentSwarmSeamState = swarmSeamPosture?.state
  const currentAdapterDecisionStatus = adapterSummary?.latestDecisionStatus
  const currentObservationStatus = adapterSummary?.observationStatus
  const currentTargetGenericEnvelope = adapterSummary?.targetGenericEnvelope

  if (currentLocalPackageState && currentLocalPackageState !== localPackageState) {
    reasons.push('local_package_changed')
  }
  if (currentSwarmSeamState && currentSwarmSeamState !== swarmSeamState) {
    reasons.push('swarm_seam_changed')
  }
  if (currentAdapterDecisionStatus && currentAdapterDecisionStatus !== adapterDecisionStatus) {
    reasons.push('adapter_decision_changed')
  }
  if (currentObservationStatus && currentObservationStatus !== observationStatus) {
    reasons.push('observation_status_changed')
  }
  if (currentTargetGenericEnvelope && currentTargetGenericEnvelope !== targetGenericEnvelope) {
    reasons.push('target_generic_envelope_changed')
  }

  return reasons
}

function normalizeEntries(recordsOrSources) {
  const rawEntries = Array.isArray(recordsOrSources)
    ? recordsOrSources
    : Object.values(recordsOrSources ?? {})

  return rawEntries
    .map((entry) => ({
      record: entry.record ?? entry,
      relativePath: entry.relativePath ?? entry.path ?? entry.record?.path ?? null
    }))
    .filter((entry) => entry.record && typeof entry.record.schema === 'string')
}

function localRecordRef(entry) {
  const ref = makeRef(
    'media-studio-local-proof-rehearsal',
    entry.record.proofRehearsalId,
    entry.record.schema
  )
  if (entry.relativePath) {
    ref.path = entry.relativePath
  }
  return {
    ...ref,
    localOnly: true
  }
}

function sortNewestRecordFirst(left, right) {
  const rightTime = Date.parse(right.record.createdAt ?? '') || 0
  const leftTime = Date.parse(left.record.createdAt ?? '') || 0
  if (rightTime !== leftTime) return rightTime - leftTime
  return (right.relativePath ?? '').localeCompare(left.relativePath ?? '')
}
