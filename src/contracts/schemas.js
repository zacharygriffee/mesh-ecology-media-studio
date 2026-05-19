import { readFile } from 'node:fs/promises'
import path from 'node:path'

export const schemaFiles = {
  'media.card.v1': 'schemas/media-card.schema.json',
  'media.asset.descriptor.v1': 'schemas/media-asset-descriptor.schema.json',
  'media.work_packet.v1': 'schemas/media-work-packet.schema.json',
  'media.evidence.v1': 'schemas/media-evidence.schema.json',
  'media.readiness.v1': 'schemas/media-readiness.schema.json',
  'media.operator_decision.v1': 'schemas/media-operator-decision.schema.json'
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
  ]
}

export async function readSchema(schemaId, options = {}) {
  const rootDir = options.rootDir ?? process.cwd()
  const file = schemaFiles[schemaId]

  if (!file) {
    throw new Error(`Unknown schema id: ${schemaId}`)
  }

  return JSON.parse(await readFile(path.join(rootDir, file), 'utf8'))
}

export function validateRequiredRecord(record, schemaId = record?.schema) {
  const fields = requiredFields[schemaId]

  if (!fields) {
    throw new Error(`Unknown schema id: ${schemaId}`)
  }

  const missing = fields.filter((field) => record[field] === undefined || record[field] === null)

  if (missing.length > 0) {
    throw new Error(`Record ${schemaId} is missing required fields: ${missing.join(', ')}`)
  }

  return true
}
