import { randomUUID } from 'node:crypto'

import { artifactKinds } from '../contracts/artifact-kinds.js'
import { makeRef, nowIso } from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import { assertIntentFamily } from './provider-neutral.js'

const runnerModes = Object.freeze(['dry-run', 'live-smoke'])
const truthStatus = 'not mesh truth; not distributed proof; not ratified shared state'

export function createProviderAdapterRun({
  adapterId,
  providerId,
  endpointId,
  generationRequest,
  providerInputSummary,
  providerResult,
  mode = 'dry-run',
  failureEvidenceRefs = [],
  startedAt,
  completedAt = nowIso(),
  createdAt = completedAt
}) {
  if (!adapterId) throw new Error('Provider adapter run is missing adapterId')
  if (!providerId) throw new Error('Provider adapter run is missing providerId')
  if (!endpointId) throw new Error('Provider adapter run is missing endpointId')
  if (!runnerModes.includes(mode)) throw new Error(`Unsupported provider adapter runner mode: ${mode}`)

  const run = {
    schema: artifactKinds.mediaProviderAdapterRunLocal,
    adapterRunId: `adapter-run-${randomUUID()}`,
    adapterId,
    providerId,
    endpointId,
    requestRef: makeRef('media-generation-request', generationRequest.requestId, generationRequest.schema),
    mode,
    providerInputSummary,
    providerResultRef: makeRef('media-provider-result', providerResult.resultId, providerResult.schema),
    status: providerResult.status,
    failureEvidenceRefs,
    startedAt: startedAt ?? createdAt,
    completedAt,
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    providerTruth: false,
    localTruthLabel: 'local receipt',
    truthStatus,
    createdAt
  }

  validateRequiredRecord(run)

  return run
}

export async function executeProviderAdapter({
  adapter,
  generationRequest,
  mode = 'dry-run',
  context = {}
}) {
  validateProviderAdapter(adapter)

  if (!adapter.supportedIntentFamilies.includes(generationRequest.intentFamily)) {
    throw new Error(`Provider adapter ${adapter.adapterId} does not support ${generationRequest.intentFamily}`)
  }

  const startedAt = nowIso()
  const providerInput = adapter.mapInput(generationRequest, context)
  const rawProviderOutput = await adapter.execute(providerInput, context)
  const providerResult = adapter.normalizeResult({
    generationRequest,
    providerInput,
    rawProviderOutput,
    context
  })
  validateRequiredRecord(providerResult)

  const adapterRun = createProviderAdapterRun({
    adapterId: adapter.adapterId,
    providerId: adapter.providerId,
    endpointId: adapter.endpointId,
    generationRequest,
    providerInputSummary: adapter.summarizeProviderInput
      ? adapter.summarizeProviderInput(providerInput)
      : defaultProviderInputSummary(providerInput),
    providerResult,
    mode,
    startedAt
  })

  return {
    adapterId: adapter.adapterId,
    providerId: adapter.providerId,
    endpointId: adapter.endpointId,
    mode,
    providerInput,
    rawProviderOutput,
    providerResult,
    adapterRun
  }
}

export function validateProviderAdapter(adapter) {
  if (!adapter || typeof adapter !== 'object') {
    throw new Error('Provider adapter must be an object')
  }

  for (const field of ['adapterId', 'providerId', 'endpointId']) {
    if (!adapter[field]) throw new Error(`Provider adapter is missing ${field}`)
  }

  if (!Array.isArray(adapter.supportedIntentFamilies) || adapter.supportedIntentFamilies.length === 0) {
    throw new Error('Provider adapter must declare supportedIntentFamilies')
  }

  adapter.supportedIntentFamilies.forEach(assertIntentFamily)

  for (const field of ['mapInput', 'execute', 'normalizeResult']) {
    if (typeof adapter[field] !== 'function') {
      throw new Error(`Provider adapter is missing ${field}`)
    }
  }

  return true
}

function defaultProviderInputSummary(providerInput) {
  return {
    keys: Object.keys(providerInput ?? {}).sort(),
    promptPresent: typeof providerInput?.prompt === 'string',
    negativePromptPresent: typeof providerInput?.negative_prompt === 'string',
    model: providerInput?.model,
    width: providerInput?.width,
    height: providerInput?.height,
    variants: providerInput?.variants
  }
}
