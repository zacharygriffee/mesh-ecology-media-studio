import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { artifactKinds, assertKnownArtifactKind } from './artifact-kinds.js'

export const schemaFiles = {
  'media.card.v1': 'schemas/media-card.schema.json',
  'media.asset.descriptor.v1': 'schemas/media-asset-descriptor.schema.json',
  'media.work_packet.v1': 'schemas/media-work-packet.schema.json',
  'media.provider_job_result.local.v1': 'schemas/media-provider-job-result-local.schema.json',
  'media.evidence.v1': 'schemas/media-evidence.schema.json',
  'media.readiness.v1': 'schemas/media-readiness.schema.json',
  'media.operator_decision.v1': 'schemas/media-operator-decision.schema.json',
  'media.local_run_manifest.v1': 'schemas/media-local-run-manifest.schema.json'
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
  [artifactKinds.mediaLocalRunManifest]: 'runId'
}

const domainProjectSchemas = new Set([
  artifactKinds.mediaCard,
  artifactKinds.mediaWorkPacket,
  artifactKinds.mediaProviderJobResultLocal,
  artifactKinds.mediaAssetDescriptor,
  artifactKinds.mediaEvidence
])

const localGeneratedSchemas = new Set([
  artifactKinds.mediaWorkPacket,
  artifactKinds.mediaProviderJobResultLocal,
  artifactKinds.mediaAssetDescriptor,
  artifactKinds.mediaEvidence,
  artifactKinds.mediaReadiness,
  artifactKinds.mediaOperatorDecision,
  artifactKinds.mediaLocalRunManifest
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

  if (localGeneratedSchemas.has(schemaId)) {
    validateLocalDoctrineFlags(record, schemaId)
  }

  return true
}

function validateLocalDoctrineFlags(record, schemaId) {
  if (record.localOnly !== true) {
    throw new Error(`Record ${schemaId} must set localOnly=true`)
  }

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

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0
}
