import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { artifactKinds, assertKnownArtifactKind } from './artifact-kinds.js'
import {
  assertLifecycleState,
  assertPlacementClass,
  assertSafeLocalPath
} from '../local/project-layout.js'
import {
  assertIntentFamily,
  validateProviderCapability
} from '../providers/provider-neutral.js'
import {
  validateProviderEndpointShape,
  validateProviderMapping,
  validateProviderShape
} from '../providers/provider-shapes.js'

export const schemaFiles = {
  'media.card.v1': 'schemas/media-card.schema.json',
  'media.asset.descriptor.v1': 'schemas/media-asset-descriptor.schema.json',
  'media.work_packet.v1': 'schemas/media-work-packet.schema.json',
  'media.provider_job_result.local.v1': 'schemas/media-provider-job-result-local.schema.json',
  'media.evidence.v1': 'schemas/media-evidence.schema.json',
  'media.readiness.v1': 'schemas/media-readiness.schema.json',
  'media.operator_decision.v1': 'schemas/media-operator-decision.schema.json',
  'media.local_run_manifest.v1': 'schemas/media-local-run-manifest.schema.json',
  'media.project_layout.v1': 'schemas/media-project-layout.schema.json',
  'media.local_ref.v1': 'schemas/media-local-ref.schema.json',
  'media.asset_lifecycle.v1': 'schemas/media-asset-lifecycle.schema.json',
  'media.generation_request.v1': 'schemas/media-generation-request.schema.json',
  'media.provider_profile.v1': 'schemas/media-provider-profile.schema.json',
  'media.provider_capability.v1': 'schemas/media-provider-capability.schema.json',
  'media.provider_result.v1': 'schemas/media-provider-result.schema.json',
  'media.provider_shape.v1': 'schemas/media-provider-shape.schema.json',
  'media.provider_endpoint_shape.v1': 'schemas/media-provider-endpoint-shape.schema.json',
  'media.provider_mapping.v1': 'schemas/media-provider-mapping.schema.json',
  'media.edge_inspection_packet.local.v1': 'schemas/media-edge-inspection-packet-local.schema.json'
}

export const requiredFields = {
  'media.card.v1': [
    'schema',
    'cardId',
    'projectId',
    'kind',
    'prompt',
    'referenceAssetRefs',
    'target',
    'providerHints',
    'acceptanceCriteria',
    'createdAt'
  ],
  'media.asset.descriptor.v1': [
    'schema',
    'assetId',
    'projectId',
    'contentType',
    'hash',
    'size',
    'localRef',
    'source',
    'lineage',
    'provenance',
    'createdAt'
  ],
  'media.work_packet.v1': [
    'schema',
    'packetId',
    'intentFamily',
    'projectId',
    'cardRef',
    'inputs',
    'requestedOutputs',
    'operatorContext',
    'readiness',
    'createdAt'
  ],
  'media.evidence.v1': [
    'schema',
    'evidenceId',
    'evidenceKind',
    'projectId',
    'subjectRef',
    'source',
    'summary',
    'refs',
    'createdAt'
  ],
  'media.readiness.v1': [
    'schema',
    'readinessId',
    'subjectRef',
    'state',
    'reasons',
    'nextActions',
    'operatorGuidanceOnly',
    'createdAt'
  ],
  'media.operator_decision.v1': [
    'schema',
    'decisionId',
    'subjectRef',
    'decisionType',
    'operatorRef',
    'reason',
    'evidenceRefs',
    'createdAt'
  ],
  'media.provider_job_result.local.v1': [
    'schema',
    'providerJobResultId',
    'projectId',
    'packetRef',
    'cardRef',
    'provider',
    'result',
    'localTruthLabel',
    'truthStatus',
    'createdAt'
  ],
  'media.local_run_manifest.v1': [
    'schema',
    'runId',
    'createdAt',
    'mode',
    'inputCardRef',
    'candidateInputRef',
    'generatedRecordRefs',
    'artifactKinds',
    'hashes',
    'doctrineLabels',
    'warnings',
    'operatorGuidanceOnly',
    'localOnly',
    'meshTruth',
    'distributedProof',
    'ratifiedSharedState'
  ],
  'media.project_layout.v1': [
    'schema',
    'projectId',
    'mode',
    'directories',
    'localOnly',
    'meshTruth',
    'distributedProof',
    'ratifiedSharedState'
  ],
  'media.local_ref.v1': [
    'schema',
    'refKind',
    'placementClass',
    'path',
    'localOnly',
    'meshTruth',
    'distributedProof',
    'ratifiedSharedState'
  ],
  'media.asset_lifecycle.v1': [
    'schema',
    'assetId',
    'projectId',
    'state',
    'refs',
    'localOnly',
    'meshTruth',
    'distributedProof',
    'ratifiedSharedState'
  ],
  'media.generation_request.v1': [
    'schema',
    'requestId',
    'projectId',
    'cardRef',
    'intentFamily',
    'prompt',
    'negativePrompt',
    'referenceAssetRefs',
    'target',
    'providerHints',
    'createdAt',
    'localOnly',
    'meshTruth'
  ],
  'media.provider_profile.v1': [
    'schema',
    'providerId',
    'displayName',
    'capabilities',
    'localOnly',
    'meshTruth',
    'createdAt'
  ],
  'media.provider_capability.v1': [
    'schema',
    'capabilityId',
    'intentFamily',
    'outputKinds',
    'localOnly',
    'meshTruth',
    'createdAt'
  ],
  'media.provider_result.v1': [
    'schema',
    'resultId',
    'requestRef',
    'providerId',
    'providerJobRef',
    'status',
    'outputRefs',
    'createdAt',
    'localOnly',
    'meshTruth'
  ],
  'media.provider_shape.v1': [
    'schema',
    'providerId',
    'providerFamily',
    'endpoints',
    'authKind',
    'localOnly',
    'meshTruth',
    'providerTruth',
    'createdAt'
  ],
  'media.provider_endpoint_shape.v1': [
    'schema',
    'endpointId',
    'providerId',
    'intentFamily',
    'operationKind',
    'requestShape',
    'responseShape',
    'asyncPattern',
    'outputDelivery',
    'knownFailureModes',
    'localOnly',
    'meshTruth',
    'providerTruth',
    'createdAt'
  ],
  'media.provider_mapping.v1': [
    'schema',
    'mappingId',
    'providerId',
    'endpointId',
    'studioInput',
    'providerInput',
    'providerOutput',
    'studioOutput',
    'warnings',
    'localOnly',
    'meshTruth',
    'providerTruth',
    'createdAt'
  ],
  'media.edge_inspection_packet.local.v1': [
    'schema',
    'packetId',
    'createdAt',
    'mode',
    'seam',
    'sourceRunRef',
    'recordRefs',
    'artifactKinds',
    'generatedArtifactRefs',
    'warnings',
    'operatorGuidanceOnly',
    'localOnly',
    'meshTruth',
    'distributedProof',
    'ratifiedSharedState',
    'providerTruth',
    'byteAvailabilityProof',
    'materializationProof',
    'publicationAuthorization'
  ]
}

const idFields = {
  [artifactKinds.mediaCard]: 'cardId',
  [artifactKinds.mediaWorkPacket]: 'packetId',
  [artifactKinds.mediaProviderJobResultLocal]: 'providerJobResultId',
  [artifactKinds.mediaAssetDescriptor]: 'assetId',
  [artifactKinds.mediaEvidence]: 'evidenceId',
  [artifactKinds.mediaReadiness]: 'readinessId',
  [artifactKinds.mediaOperatorDecision]: 'decisionId',
  [artifactKinds.mediaLocalRunManifest]: 'runId',
  [artifactKinds.mediaProjectLayout]: 'projectId',
  [artifactKinds.mediaLocalRef]: 'path',
  [artifactKinds.mediaAssetLifecycle]: 'assetId',
  [artifactKinds.mediaGenerationRequest]: 'requestId',
  [artifactKinds.mediaProviderProfile]: 'providerId',
  [artifactKinds.mediaProviderCapability]: 'capabilityId',
  [artifactKinds.mediaProviderResult]: 'resultId',
  [artifactKinds.mediaProviderShape]: 'providerId',
  [artifactKinds.mediaProviderEndpointShape]: 'endpointId',
  [artifactKinds.mediaProviderMapping]: 'mappingId',
  [artifactKinds.mediaEdgeInspectionPacketLocal]: 'packetId'
}

const domainProjectSchemas = new Set([
  artifactKinds.mediaCard,
  artifactKinds.mediaWorkPacket,
  artifactKinds.mediaProviderJobResultLocal,
  artifactKinds.mediaAssetDescriptor,
  artifactKinds.mediaEvidence,
  artifactKinds.mediaProjectLayout,
  artifactKinds.mediaAssetLifecycle,
  artifactKinds.mediaGenerationRequest
])

const localGeneratedSchemas = new Set([
  artifactKinds.mediaWorkPacket,
  artifactKinds.mediaProviderJobResultLocal,
  artifactKinds.mediaAssetDescriptor,
  artifactKinds.mediaEvidence,
  artifactKinds.mediaReadiness,
  artifactKinds.mediaOperatorDecision,
  artifactKinds.mediaLocalRunManifest,
  artifactKinds.mediaEdgeInspectionPacketLocal
])

const readinessStates = new Set(['draft', 'blocked', 'ready', 'caution', 'complete'])
const decisionTypes = new Set(['accept', 'reject', 'request_changes', 'defer'])

export async function readSchema(schemaId, options = {}) {
  const rootDir = options.rootDir ?? process.cwd()
  const file = schemaFiles[schemaId]

  if (!file) {
    throw new Error(`Unknown schema id: ${schemaId}`)
  }

  return JSON.parse(await readFile(path.join(rootDir, file), 'utf8'))
}

export function validateRequiredRecord(record, schemaId = record?.schema) {
  if (!record || typeof record !== 'object') {
    throw new Error('Record must be an object')
  }

  if (!record.schema) {
    throw new Error('Record is missing schema')
  }

  assertKnownArtifactKind(schemaId)

  if (record.schema !== schemaId) {
    throw new Error(`Record schema mismatch: expected ${schemaId}, received ${record.schema}`)
  }

  const fields = requiredFields[schemaId]

  if (!fields) {
    throw new Error(`Unknown schema id: ${schemaId}`)
  }

  const missing = fields.filter((field) => record[field] === undefined || record[field] === null)

  if (missing.length > 0) {
    throw new Error(`Record ${schemaId} is missing required fields: ${missing.join(', ')}`)
  }

  validateRecordShape(record, schemaId)

  return true
}

export function validateRecordShape(record, schemaId = record.schema) {
  const idField = idFields[schemaId]

  if (!idField || !isNonEmptyString(record[idField])) {
    throw new Error(`Record ${schemaId} is missing id field: ${idField}`)
  }

  if (requiredFields[schemaId]?.includes('createdAt') && !isNonEmptyString(record.createdAt)) {
    throw new Error(`Record ${schemaId} is missing createdAt`)
  }

  if (domainProjectSchemas.has(schemaId) && !isNonEmptyString(record.projectId)) {
    throw new Error(`Record ${schemaId} is missing projectId`)
  }

  if (record.subjectRef !== undefined) {
    validateRef(record.subjectRef, `${schemaId}.subjectRef`)
  }

  if (record.cardRef !== undefined) {
    validateRef(record.cardRef, `${schemaId}.cardRef`)
  }

  if (record.requestRef !== undefined) {
    validateRef(record.requestRef, `${schemaId}.requestRef`)
  }

  if (record.packetRef !== undefined) {
    validateRef(record.packetRef, `${schemaId}.packetRef`)
  }

  if (Array.isArray(record.evidenceRefs)) {
    record.evidenceRefs.forEach((ref, index) => validateRef(ref, `${schemaId}.evidenceRefs[${index}]`))
  }

  if (Array.isArray(record.generatedRecordRefs)) {
    record.generatedRecordRefs.forEach((ref, index) => validateGeneratedRecordRef(ref, `${schemaId}.generatedRecordRefs[${index}]`))
  }

  if (schemaId === artifactKinds.mediaReadiness && !readinessStates.has(record.state)) {
    throw new Error(`Record ${schemaId} has invalid readiness state: ${record.state}`)
  }

  if (schemaId === artifactKinds.mediaOperatorDecision && !decisionTypes.has(record.decisionType)) {
    throw new Error(`Record ${schemaId} has invalid decision type: ${record.decisionType}`)
  }

  if (schemaId === artifactKinds.mediaLocalRef) {
    assertPlacementClass(record.placementClass)
    assertSafeLocalPath(record.path)
    validateLocalFalseFlags(record, schemaId)
  }

  if (schemaId === artifactKinds.mediaProjectLayout) {
    validateLocalFalseFlags(record, schemaId)
  }

  if (schemaId === artifactKinds.mediaAssetLifecycle) {
    assertLifecycleState(record.state)
    validateLocalFalseFlags(record, schemaId)
  }

  if (schemaId === artifactKinds.mediaAssetDescriptor && record.localRef?.schema === artifactKinds.mediaLocalRef) {
    assertPlacementClass(record.localRef.placementClass)
    assertSafeLocalPath(record.localRef.path)
  }

  if (schemaId === artifactKinds.mediaGenerationRequest) {
    assertIntentFamily(record.intentFamily)
    validateLocalFalseFlags(record, schemaId)
  }

  if (schemaId === artifactKinds.mediaProviderCapability) {
    validateProviderCapability(record)
    validateLocalFalseFlags(record, schemaId)
  }

  if (schemaId === artifactKinds.mediaProviderProfile) {
    if (!Array.isArray(record.capabilities) || record.capabilities.length === 0) {
      throw new Error('Provider profile must declare at least one capability')
    }

    record.capabilities.forEach(validateProviderCapability)
    validateLocalFalseFlags(record, schemaId)
  }

  if (schemaId === artifactKinds.mediaProviderResult) {
    if (!record.providerId) {
      throw new Error('Provider result is missing providerId')
    }

    if (!record.providerJobRef || typeof record.providerJobRef !== 'object' || !record.providerJobRef.id) {
      throw new Error('Provider result is missing providerJobRef')
    }

    validateLocalFalseFlags(record, schemaId)

    if (record.providerTruth !== false) {
      throw new Error('Provider result must set providerTruth=false')
    }
  }

  if (schemaId === artifactKinds.mediaProviderShape) {
    validateProviderShape(record)
  }

  if (schemaId === artifactKinds.mediaProviderEndpointShape) {
    validateProviderEndpointShape(record)
  }

  if (schemaId === artifactKinds.mediaProviderMapping) {
    validateProviderMapping(record)
  }

  if (schemaId === artifactKinds.mediaEdgeInspectionPacketLocal) {
    if (record.seam !== 'media-edge-operator-seam') {
      throw new Error(`Record ${schemaId} has invalid seam: ${record.seam}`)
    }

    if (record.operatorGuidanceOnly !== true) {
      throw new Error(`Record ${schemaId} must set operatorGuidanceOnly=true`)
    }

    if (!record.recordRefs || typeof record.recordRefs !== 'object') {
      throw new Error(`Record ${schemaId} must include recordRefs`)
    }

    for (const [name, ref] of Object.entries(record.recordRefs)) {
      validateInspectionRef(ref, `${schemaId}.recordRefs.${name}`)
    }

    if (!Array.isArray(record.generatedArtifactRefs)) {
      throw new Error(`Record ${schemaId} generatedArtifactRefs must be an array`)
    }

    record.generatedArtifactRefs.forEach((ref, index) => validateInspectionRef(ref, `${schemaId}.generatedArtifactRefs[${index}]`))
  }

  if (localGeneratedSchemas.has(schemaId)) {
    validateLocalDoctrineFlags(record, schemaId)
  }

  return true
}

function validateLocalFalseFlags(record, schemaId) {
  const falseFlags = ['meshTruth', 'distributedProof', 'ratifiedSharedState']

  if (record.localOnly !== true) {
    throw new Error(`Record ${schemaId} must set localOnly=true`)
  }

  for (const flag of falseFlags) {
    if (record[flag] !== false) {
      throw new Error(`Record ${schemaId} must set ${flag}=false`)
    }
  }
}

function validateLocalDoctrineFlags(record, schemaId) {
  validateLocalFalseFlags(record, schemaId)

  if (!isNonEmptyString(record.localTruthLabel)) {
    throw new Error(`Record ${schemaId} is missing localTruthLabel`)
  }

  if (!isNonEmptyString(record.truthStatus) || !record.truthStatus.includes('not mesh truth')) {
    throw new Error(`Record ${schemaId} is missing doctrine truthStatus`)
  }

  if (schemaId === artifactKinds.mediaOperatorDecision && record.localDecisionOnly !== true) {
    throw new Error(`Record ${schemaId} must set localDecisionOnly=true`)
  }

  if (schemaId === artifactKinds.mediaLocalRunManifest) {
    const requiredFalseFlags = [
      'meshTruth',
      'distributedProof',
      'ratifiedSharedState',
      'providerTruth',
      'byteAvailabilityProof',
      'materializationProof',
      'causalTruth',
      'publicationAuthorization'
    ]

    if (record.operatorGuidanceOnly !== true) {
      throw new Error(`Record ${schemaId} must set operatorGuidanceOnly=true`)
    }

    for (const flag of requiredFalseFlags) {
      if (record[flag] !== false) {
        throw new Error(`Record ${schemaId} must set ${flag}=false`)
      }
    }
  }

  if (schemaId === artifactKinds.mediaEdgeInspectionPacketLocal) {
    const requiredFalseFlags = [
      'meshTruth',
      'distributedProof',
      'ratifiedSharedState',
      'providerTruth',
      'byteAvailabilityProof',
      'materializationProof',
      'publicationAuthorization'
    ]

    for (const flag of requiredFalseFlags) {
      if (record[flag] !== false) {
        throw new Error(`Record ${schemaId} must set ${flag}=false`)
      }
    }
  }
}

function validateRef(ref, label) {
  if (!ref || typeof ref !== 'object') {
    throw new Error(`${label} must be an object ref`)
  }

  if (!isNonEmptyString(ref.kind)) {
    throw new Error(`${label}.kind must be a string`)
  }

  if (!isNonEmptyString(ref.id)) {
    throw new Error(`${label}.id must be a string`)
  }

  if (ref.schema !== undefined && !isNonEmptyString(ref.schema)) {
    throw new Error(`${label}.schema must be a string when present`)
  }
}

function validateGeneratedRecordRef(ref, label) {
  validateRef(ref, label)

  if (!isNonEmptyString(ref.path)) {
    throw new Error(`${label}.path must be a string`)
  }

  if (ref.localOnly !== true) {
    throw new Error(`${label}.localOnly must be true`)
  }
}

function validateInspectionRef(ref, label) {
  validateRef(ref, label)

  if (!isNonEmptyString(ref.path)) {
    throw new Error(`${label}.path must be a string`)
  }

  assertSafeLocalPath(ref.path)

  if (ref.localOnly !== true) {
    throw new Error(`${label}.localOnly must be true`)
  }
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0
}
