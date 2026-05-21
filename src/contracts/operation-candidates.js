import { randomUUID } from 'node:crypto'

import { artifactKinds } from './artifact-kinds.js'
import { makeRef, nowIso } from './constructors.js'

export const operationArtifactClasses = Object.freeze([
  'media.card',
  'media.asset',
  'media.provider_job',
  'media.review',
  'media.production',
  'media.byte_descriptor_proposal',
  'media.resource_ref_candidate',
  'media.export',
  'media.local_file'
])

export const operationClasses = Object.freeze([
  'prepare_provider_job',
  'submit_live_provider_job',
  'move_candidate_to_accepted',
  'move_candidate_to_rejected',
  'propose_byte_descriptor',
  'propose_resource_ref',
  'prepare_export',
  'prepare_render_export',
  'delete_local_media',
  'generate_proxy',
  'generate_thumbnail'
])

export const operationScopeDeltas = Object.freeze([
  'local_record_only',
  'local_file_change',
  'external_provider_call',
  'byte_reference_candidate',
  'resource_candidate',
  'export_artifact',
  'mesh_facing_candidate'
])

export const operationRiskTiers = Object.freeze(['low', 'medium', 'high', 'critical'])

export const operationReversibility = Object.freeze([
  'reversible',
  'partially_reversible',
  'irreversible',
  'irreversible_cost'
])

export const operationAuthorityBoundaries = Object.freeze([
  'local_project',
  'operator_boundary',
  'external_provider',
  'bytes_boundary',
  'edge_boundary',
  'mesh_boundary',
  'platform_boundary'
])

export const operationEvidenceRequirements = Object.freeze([
  'none',
  'card_required',
  'review_evidence_required',
  'quote_required',
  'byte_descriptor_required',
  'resource_candidate_required',
  'operator_decision_required',
  'backup_or_materialization_required'
])

const localFalseFlags = Object.freeze({
  localOnly: true,
  meshTruth: false,
  distributedProof: false,
  ratifiedSharedState: false
})

export function createMediaOperationCandidate({
  operationId = `operation-${randomUUID()}`,
  projectId,
  artifactClass,
  operationClass,
  subjectRef,
  scopeDelta,
  riskTier,
  reversibility,
  authorityBoundary,
  evidenceRequirement = 'none',
  requestedBy = 'local-operator',
  sourceRefs = [],
  createdAt = nowIso()
}) {
  const candidate = {
    schema: artifactKinds.mediaOperationCandidateLocal,
    operationId,
    projectId,
    artifactClass,
    operationClass,
    subjectRef,
    scopeDelta,
    riskTier,
    reversibility,
    authorityBoundary,
    evidenceRequirement,
    requestedBy,
    sourceRefs,
    createdAt,
    localTruthLabel: 'local draft',
    truthStatus: 'not mesh truth; not distributed proof; not ratified shared state',
    ...localFalseFlags
  }

  assertMediaOperationCandidateDimensions(candidate)
  return candidate
}

export function refForOperationCandidate(candidate) {
  return makeRef('media-operation-candidate', candidate.operationId, candidate.schema)
}

export function assertMediaOperationCandidateDimensions(candidate) {
  assertAllowed(candidate.artifactClass, operationArtifactClasses, 'artifactClass')
  assertAllowed(candidate.operationClass, operationClasses, 'operationClass')
  assertAllowed(candidate.scopeDelta, operationScopeDeltas, 'scopeDelta')
  assertAllowed(candidate.riskTier, operationRiskTiers, 'riskTier')
  assertAllowed(candidate.reversibility, operationReversibility, 'reversibility')
  assertAllowed(candidate.authorityBoundary, operationAuthorityBoundaries, 'authorityBoundary')
  assertAllowed(candidate.evidenceRequirement, operationEvidenceRequirements, 'evidenceRequirement')

  if (!candidate.subjectRef || typeof candidate.subjectRef !== 'object') {
    throw new Error('Operation candidate must include subjectRef')
  }

  if (!Array.isArray(candidate.sourceRefs)) {
    throw new Error('Operation candidate sourceRefs must be an array')
  }

  return true
}

function assertAllowed(value, allowed, field) {
  if (!allowed.includes(value)) {
    throw new Error(`Invalid media operation ${field}: ${value}`)
  }
}
