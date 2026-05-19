import { randomUUID } from 'node:crypto'

import { artifactKinds } from '../contracts/artifact-kinds.js'
import { intentFamilyForCard, makeRef, nowIso } from '../contracts/constructors.js'

export const intentFamilies = Object.freeze([
  'image-generation',
  'video-generation',
  'audio-generation',
  'media-transformation',
  'media-evidence'
])

const resultStatuses = Object.freeze([
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled'
])

export function assertIntentFamily(intentFamily) {
  if (!intentFamilies.includes(intentFamily)) {
    throw new Error(`Unsupported intent family: ${intentFamily}`)
  }

  return true
}

export function validateProviderCapability(capability) {
  if (!capability || typeof capability !== 'object') {
    throw new Error('Provider capability must be an object')
  }

  if (!capability.capabilityId) {
    throw new Error('Provider capability is missing capabilityId')
  }

  assertIntentFamily(capability.intentFamily)

  if (!Array.isArray(capability.outputKinds) || capability.outputKinds.length === 0) {
    throw new Error('Provider capability must declare at least one output kind')
  }

  if (capability.localOnly !== true || capability.meshTruth !== false) {
    throw new Error('Provider capability must stay local-only and non-truth-bearing')
  }

  return true
}

export function createProviderCapability({
  intentFamily,
  outputKinds,
  constraints = {},
  createdAt = nowIso()
}) {
  assertIntentFamily(intentFamily)

  const capability = {
    schema: artifactKinds.mediaProviderCapability,
    capabilityId: `capability-${intentFamily}`,
    intentFamily,
    outputKinds,
    constraints,
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    createdAt
  }

  validateProviderCapability(capability)

  return capability
}

export function createProviderProfile({
  providerId,
  displayName,
  capabilities,
  createdAt = nowIso()
}) {
  if (!providerId) {
    throw new Error('Provider profile is missing providerId')
  }

  if (!displayName) {
    throw new Error('Provider profile is missing displayName')
  }

  if (!Array.isArray(capabilities) || capabilities.length === 0) {
    throw new Error('Provider profile must declare at least one capability')
  }

  for (const capability of capabilities) {
    validateProviderCapability(capability)
  }

  return {
    schema: artifactKinds.mediaProviderProfile,
    providerId,
    displayName,
    capabilities,
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    createdAt
  }
}

export function createGenerationRequestFromCard({
  card,
  providerHints = card.providerHints,
  createdAt = nowIso()
}) {
  const intentFamily = intentFamilyForCard(card)
  assertIntentFamily(intentFamily)

  return {
    schema: artifactKinds.mediaGenerationRequest,
    requestId: `request-${randomUUID()}`,
    projectId: card.projectId,
    cardRef: makeRef('media-card', card.cardId, card.schema),
    intentFamily,
    prompt: card.prompt,
    negativePrompt: card.negativePrompt ?? '',
    referenceAssetRefs: card.referenceAssetRefs,
    target: card.target,
    providerHints,
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    createdAt
  }
}

export function normalizeProviderResult({
  generationRequest,
  providerId,
  providerJobRef,
  status,
  outputRefs,
  costEstimate,
  timing,
  rawProviderRef,
  createdAt = nowIso()
}) {
  if (!providerId) {
    throw new Error('Provider result is missing providerId')
  }

  if (!providerJobRef || typeof providerJobRef !== 'object' || !providerJobRef.id) {
    throw new Error('Provider result is missing providerJobRef')
  }

  if (!resultStatuses.includes(status)) {
    throw new Error(`Unsupported provider result status: ${status}`)
  }

  if (!Array.isArray(outputRefs)) {
    throw new Error('Provider result outputRefs must be an array')
  }

  const result = {
    schema: artifactKinds.mediaProviderResult,
    resultId: `provider-result-${randomUUID()}`,
    requestRef: makeRef('media-generation-request', generationRequest.requestId, generationRequest.schema),
    providerId,
    providerJobRef,
    status,
    outputRefs,
    createdAt,
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    providerTruth: false
  }

  if (costEstimate !== undefined) result.costEstimate = costEstimate
  if (timing !== undefined) result.timing = timing
  if (rawProviderRef !== undefined) result.rawProviderRef = rawProviderRef

  return result
}
