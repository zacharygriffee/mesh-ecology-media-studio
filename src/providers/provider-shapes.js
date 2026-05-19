import { randomUUID } from 'node:crypto'

import { artifactKinds } from '../contracts/artifact-kinds.js'
import { nowIso } from '../contracts/constructors.js'
import { assertIntentFamily } from './provider-neutral.js'

export const operationKinds = Object.freeze([
  'generate-image',
  'edit-image',
  'generate-video',
  'extend-video',
  'remix-video',
  'text-to-speech',
  'transcribe-audio',
  'transform-media'
])

export const asyncPatterns = Object.freeze([
  'synchronous',
  'async-job-poll',
  'async-webhook',
  'streaming',
  'batch'
])

export const outputDeliveryKinds = Object.freeze([
  'inline-base64',
  'file-id',
  'temporary-url',
  'download-endpoint',
  'provider-hosted-asset',
  'local-file'
])

export const authKinds = Object.freeze([
  'api-key',
  'bearer-token',
  'oauth',
  'none',
  'external'
])

export function assertOperationKind(operationKind) {
  if (!operationKinds.includes(operationKind)) {
    throw new Error(`Unsupported provider operation kind: ${operationKind}`)
  }

  return true
}

export function assertAsyncPattern(asyncPattern) {
  if (!asyncPatterns.includes(asyncPattern)) {
    throw new Error(`Unsupported provider async pattern: ${asyncPattern}`)
  }

  return true
}

export function assertOutputDelivery(outputDelivery) {
  if (!outputDeliveryKinds.includes(outputDelivery)) {
    throw new Error(`Unsupported provider output delivery: ${outputDelivery}`)
  }

  return true
}

export function assertAuthKind(authKind) {
  if (!authKinds.includes(authKind)) {
    throw new Error(`Unsupported provider auth kind: ${authKind}`)
  }

  return true
}

export function createProviderEndpointShape({
  endpointId,
  providerId,
  intentFamily,
  operationKind,
  requestShape,
  responseShape,
  asyncPattern,
  outputDelivery,
  knownFailureModes = [],
  createdAt = nowIso()
}) {
  const shape = {
    schema: artifactKinds.mediaProviderEndpointShape,
    endpointId,
    providerId,
    intentFamily,
    operationKind,
    requestShape,
    responseShape,
    asyncPattern,
    outputDelivery,
    knownFailureModes,
    localOnly: true,
    meshTruth: false,
    providerTruth: false,
    createdAt
  }

  validateProviderEndpointShape(shape)

  return shape
}

export function createProviderShape({
  providerId,
  providerFamily,
  endpoints,
  authKind,
  createdAt = nowIso()
}) {
  const shape = {
    schema: artifactKinds.mediaProviderShape,
    providerId,
    providerFamily,
    endpoints,
    authKind,
    localOnly: true,
    meshTruth: false,
    providerTruth: false,
    createdAt
  }

  validateProviderShape(shape)

  return shape
}

export function createProviderMapping({
  providerId,
  endpointId,
  studioInput,
  providerInput,
  providerOutput,
  studioOutput,
  warnings = [],
  createdAt = nowIso()
}) {
  const mapping = {
    schema: artifactKinds.mediaProviderMapping,
    mappingId: `mapping-${randomUUID()}`,
    providerId,
    endpointId,
    studioInput,
    providerInput,
    providerOutput,
    studioOutput,
    warnings,
    localOnly: true,
    meshTruth: false,
    providerTruth: false,
    createdAt
  }

  validateProviderMapping(mapping)

  return mapping
}

export function validateProviderShape(shape) {
  if (!shape || typeof shape !== 'object') {
    throw new Error('Provider shape must be an object')
  }

  if (!shape.providerId) {
    throw new Error('Provider shape is missing providerId')
  }

  if (!shape.providerFamily) {
    throw new Error('Provider shape is missing providerFamily')
  }

  assertAuthKind(shape.authKind)

  if (!Array.isArray(shape.endpoints) || shape.endpoints.length === 0) {
    throw new Error('Provider shape must declare at least one endpoint')
  }

  shape.endpoints.forEach(validateProviderEndpointShape)
  validateLocalShapeFlags(shape, 'Provider shape')

  return true
}

export function validateProviderEndpointShape(endpoint) {
  if (!endpoint || typeof endpoint !== 'object') {
    throw new Error('Provider endpoint shape must be an object')
  }

  if (!endpoint.endpointId) {
    throw new Error('Provider endpoint shape is missing endpointId')
  }

  if (!endpoint.providerId) {
    throw new Error('Provider endpoint shape is missing providerId')
  }

  assertIntentFamily(endpoint.intentFamily)
  assertOperationKind(endpoint.operationKind)
  assertAsyncPattern(endpoint.asyncPattern)
  assertOutputDelivery(endpoint.outputDelivery)

  if (!endpoint.requestShape || typeof endpoint.requestShape !== 'object') {
    throw new Error('Provider endpoint shape is missing requestShape')
  }

  if (!endpoint.responseShape || typeof endpoint.responseShape !== 'object') {
    throw new Error('Provider endpoint shape is missing responseShape')
  }

  if (!Array.isArray(endpoint.knownFailureModes)) {
    throw new Error('Provider endpoint shape knownFailureModes must be an array')
  }

  validateLocalShapeFlags(endpoint, 'Provider endpoint shape')

  return true
}

export function validateProviderMapping(mapping) {
  if (!mapping || typeof mapping !== 'object') {
    throw new Error('Provider mapping must be an object')
  }

  if (!mapping.mappingId) {
    throw new Error('Provider mapping is missing mappingId')
  }

  if (!mapping.providerId) {
    throw new Error('Provider mapping is missing providerId')
  }

  if (!mapping.endpointId) {
    throw new Error('Provider mapping is missing endpointId')
  }

  for (const field of ['studioInput', 'providerInput', 'providerOutput', 'studioOutput']) {
    if (!mapping[field] || typeof mapping[field] !== 'object') {
      throw new Error(`Provider mapping is missing ${field}`)
    }
  }

  if (!Array.isArray(mapping.warnings)) {
    throw new Error('Provider mapping warnings must be an array')
  }

  validateLocalShapeFlags(mapping, 'Provider mapping')

  return true
}

function validateLocalShapeFlags(record, label) {
  if (record.localOnly !== true) {
    throw new Error(`${label} must set localOnly=true`)
  }

  if (record.meshTruth !== false) {
    throw new Error(`${label} must set meshTruth=false`)
  }

  if (record.providerTruth !== false) {
    throw new Error(`${label} must set providerTruth=false`)
  }
}
