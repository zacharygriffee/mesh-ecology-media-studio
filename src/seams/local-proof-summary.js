import { artifactKinds } from '../contracts/artifact-kinds.js'
import { makeRef } from '../contracts/constructors.js'

export function summarizeLocalProofRehearsal(recordsOrSources = []) {
  const entries = normalizeEntries(recordsOrSources)
    .filter((entry) => entry.record.schema === artifactKinds.mediaStudioLocalProofRehearsalLocal)
    .sort(sortNewestRecordFirst)
  const latest = entries[0]
  const record = latest?.record
  const state = record?.proofState ?? 'absent'

  return {
    summaryKind: 'studio-local-proof-rehearsal-summary',
    proofs: entries.length,
    latestProofRef: latest ? localRecordRef(latest) : null,
    latestProofState: state,
    localPackageState: record?.localPackagePosture?.packageState ?? record?.summary?.localPackageState ?? 'absent',
    swarmSeamState: record?.swarmSeamPosture?.state ?? record?.summary?.swarmSeamState ?? 'absent',
    adapterDecisionStatus: record?.studioSourcePressureAdapterSummary?.latestDecisionStatus ??
      record?.summary?.adapterDecisionStatus ??
      'none',
    observationStatus: record?.studioSourcePressureAdapterSummary?.observationStatus ??
      record?.summary?.observationStatus ??
      'absent',
    targetGenericEnvelope: record?.studioSourcePressureAdapterSummary?.targetGenericEnvelope ??
      'layer_source_pressure_review.v0',
    safeNextAction: record?.safeNextAction ??
      record?.summary?.safeNextAction ??
      'Run npm run proof:local to create local proof rehearsal evidence.',
    surfaced: record?.summary?.surfaced === true || Boolean(record?.surfaceRefs),
    surfaceRefs: record?.surfaceRefs ?? null,
    attentionRows: state === 'attention' ? 1 : 0,
    readyProofs: entries.filter((entry) => entry.record.proofState === 'ready').length,
    attentionProofs: entries.filter((entry) => entry.record.proofState === 'attention').length,
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
