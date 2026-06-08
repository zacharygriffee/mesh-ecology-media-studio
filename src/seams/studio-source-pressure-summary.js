import { artifactKinds } from '../contracts/artifact-kinds.js'
import { makeRef } from '../contracts/constructors.js'

const genericLayerEnvelope = 'layer_source_pressure_review.v0'
const genericLayerEnvelopeSchema = 'layer-source-pressure-review.v0'

export function summarizeStudioSourcePressure(recordsOrSources = []) {
  const entries = normalizeEntries(recordsOrSources)
  const adapterSummary = summarizeStudioSourcePressureAdapter(entries)

  return {
    studioSourcePressureAdapterSummary: adapterSummary,
    edgeSourceRefs: latestPressureSourceRefs(entries, artifactKinds.mediaEdgePressureArtifactLocal),
    layerSourceRefs: latestPressureSourceRefs(entries, artifactKinds.mediaLayerPressureArtifactLocal),
    missingEdgeSourceSchemas: latestPressureMissingSourceSchemas(entries, artifactKinds.mediaEdgePressureArtifactLocal),
    missingLayerSourceSchemas: latestPressureMissingSourceSchemas(entries, artifactKinds.mediaLayerPressureArtifactLocal)
  }
}

export function summarizeStudioSourcePressureAdapter(recordsOrSources = []) {
  const entries = normalizeEntries(recordsOrSources)
  const candidates = entries
    .filter((entry) => entry.record.schema === artifactKinds.mediaStudioSourcePressureAdapterCandidateLocal)
    .sort(sortNewestRecordFirst)
  const decisions = entries
    .filter((entry) => entry.record.schema === artifactKinds.mediaStudioSourcePressureAdapterOperatorDecisionLocal)
    .sort(sortNewestRecordFirst)
  const observations = entries
    .filter((entry) => entry.record.schema === artifactKinds.mediaStudioSourcePressureObservationResultLocal)
    .sort(sortNewestRecordFirst)
  const latestCandidate = candidates[0]
  const latestDecision = decisions[0]
  const latestObservation = observations[0]

  return {
    summaryKind: 'studio-source-pressure-adapter-summary',
    candidates: candidates.length,
    decisions: decisions.length,
    observations: observations.length,
    latestCandidateRef: latestCandidate ? localRecordRef(latestCandidate) : null,
    latestDecisionRef: latestDecision ? localRecordRef(latestDecision) : null,
    latestObservationRef: latestObservation ? localRecordRef(latestObservation) : null,
    latestDecisionStatus: latestDecision?.record.decisionStatus ?? 'none',
    observationStatus: latestObservation
      ? latestObservation.record.observationStatus
      : latestDecision?.record.decisionStatus === 'rejected_bounded_studio_source_pressure_observation'
        ? 'skipped'
        : 'absent',
    targetGenericEnvelope: latestCandidate?.record.targetGenericEnvelope ?? genericLayerEnvelope,
    emittedEnvelopeSchemaVersion: latestObservation?.record.emittedEnvelopeSchemaVersion ?? genericLayerEnvelopeSchema,
    layerAdmissionApproved: false,
    durableAppendApproved: false,
    edgeActionQueued: false,
    autoExecute: false,
    operatorGuidanceOnly: true,
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false
  }
}

function latestPressureSourceRefs(entries, schema) {
  return latestPressureRecord(entries, schema)?.record.sourceRefs ?? []
}

function latestPressureMissingSourceSchemas(entries, schema) {
  return (latestPressureRecord(entries, schema)?.record.readinessBlockers ?? [])
    .filter((blocker) => typeof blocker === 'string' && blocker.startsWith('missing_source_schema:'))
    .map((blocker) => blocker.slice('missing_source_schema:'.length))
}

function latestPressureRecord(entries, schema) {
  return entries
    .filter((entry) => entry.record.schema === schema)
    .sort(sortNewestRecordFirst)[0]
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
  const ref = makeRef(kindForSchema(entry.record.schema), idForRecord(entry.record), entry.record.schema)
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

function kindForSchema(schema) {
  return {
    [artifactKinds.mediaEdgePressureArtifactLocal]: 'media-edge-pressure-artifact',
    [artifactKinds.mediaLayerPressureArtifactLocal]: 'media-layer-pressure-artifact',
    [artifactKinds.mediaStudioSourcePressureAdapterCandidateLocal]: 'media-studio-source-pressure-adapter-candidate',
    [artifactKinds.mediaStudioSourcePressureAdapterOperatorDecisionLocal]: 'media-studio-source-pressure-adapter-operator-decision',
    [artifactKinds.mediaStudioSourcePressureObservationResultLocal]: 'media-studio-source-pressure-observation-result'
  }[schema] ?? schema
}

function idForRecord(record) {
  return record.pressureArtifactId ??
    record.adapterCandidateId ??
    record.decisionId ??
    record.observationId ??
    record.id ??
    record.schema
}
