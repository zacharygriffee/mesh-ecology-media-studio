import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { makeRef, nowIso } from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import { assertSafeLocalPath } from '../local/project-layout.js'
import { createGenerationRequestFromCard, normalizeProviderResult } from './provider-neutral.js'
import { mapGenerationRequestToVeniceImageRequest } from './venice-dry-run.js'

export const veniceLiveSmokeConfig = Object.freeze({
  endpoint: 'https://api.venice.ai/api/v1/image/generate',
  providerId: 'venice',
  endpointId: 'venice.image.generate',
  allowedModels: Object.freeze(['venice-sd35']),
  defaultModel: 'venice-sd35',
  maxWidth: 512,
  maxHeight: 512,
  maxVariants: 1,
  defaultFormat: 'png'
})

export function parseEnvText(text) {
  const values = {}

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const equalsIndex = trimmed.indexOf('=')
    if (equalsIndex === -1) continue

    const key = trimmed.slice(0, equalsIndex).trim()
    let value = trimmed.slice(equalsIndex + 1).trim()
    if (!key) continue

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    values[key] = value
  }

  return values
}

export async function loadLocalEnv(envPath = '.env') {
  try {
    return parseEnvText(await readFile(envPath, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return {}
    throw error
  }
}

export function assertVeniceLiveGate(env = process.env) {
  if (env.VENICE_LIVE !== '1') {
    throw new Error('Venice live smoke is blocked: set VENICE_LIVE=1 to spend provider credits')
  }

  return true
}

export function resolveVeniceApiKey({ env = process.env, localEnv = {} } = {}) {
  const key = env.VENICE_INFERENCE_KEY ?? localEnv.VENICE_INFERENCE_KEY
  if (!key) {
    throw new Error('Venice live smoke is missing VENICE_INFERENCE_KEY')
  }

  return key
}

export function assertVeniceSmokeBudget(providerInput) {
  if (!veniceLiveSmokeConfig.allowedModels.includes(providerInput.model)) {
    throw new Error(`Venice smoke model is not allowed: ${providerInput.model}`)
  }

  if (!Number.isInteger(providerInput.width) || providerInput.width < 1 || providerInput.width > veniceLiveSmokeConfig.maxWidth) {
    throw new Error(`Venice smoke width must be 1-${veniceLiveSmokeConfig.maxWidth}`)
  }

  if (!Number.isInteger(providerInput.height) || providerInput.height < 1 || providerInput.height > veniceLiveSmokeConfig.maxHeight) {
    throw new Error(`Venice smoke height must be 1-${veniceLiveSmokeConfig.maxHeight}`)
  }

  if (providerInput.variants !== veniceLiveSmokeConfig.maxVariants) {
    throw new Error(`Venice smoke variants must be ${veniceLiveSmokeConfig.maxVariants}`)
  }

  if (providerInput.return_binary !== false) {
    throw new Error('Venice smoke must request JSON/base64 output with return_binary=false')
  }

  if (providerInput.enable_web_search !== false) {
    throw new Error('Venice smoke must set enable_web_search=false')
  }

  return true
}

export function createVeniceSmokeGenerationRequest({
  projectId = 'venice-smoke-project',
  cardId = 'venice-smoke-card',
  createdAt = nowIso()
} = {}) {
  const card = {
    schema: 'media.card.v1',
    cardId,
    projectId,
    kind: 'image',
    prompt: 'A simple studio lighting test frame with a single matte gray cube on a white background.',
    negativePrompt: 'text, watermark, logo, people',
    referenceAssetRefs: [],
    target: {
      contentType: 'image/png',
      width: veniceLiveSmokeConfig.maxWidth,
      height: veniceLiveSmokeConfig.maxHeight
    },
    providerHints: {
      providerId: veniceLiveSmokeConfig.providerId,
      model: veniceLiveSmokeConfig.defaultModel,
      seed: 7
    },
    acceptanceCriteria: ['provider response normalized locally'],
    createdAt
  }

  return createGenerationRequestFromCard({ card, createdAt })
}

export function buildVeniceLiveSmokeProviderInput(generationRequest) {
  const mapped = mapGenerationRequestToVeniceImageRequest(generationRequest)
  const providerInput = {
    model: mapped.model,
    prompt: mapped.prompt,
    negative_prompt: mapped.negative_prompt,
    width: Math.min(mapped.width, veniceLiveSmokeConfig.maxWidth),
    height: Math.min(mapped.height, veniceLiveSmokeConfig.maxHeight),
    seed: mapped.seed,
    format: veniceLiveSmokeConfig.defaultFormat,
    variants: veniceLiveSmokeConfig.maxVariants,
    return_binary: false,
    safe_mode: true,
    enable_web_search: false
  }

  assertVeniceSmokeBudget(providerInput)

  return providerInput
}

export function normalizeVeniceLiveImageResult({ generationRequest, responseJson, httpStatus = 200 }) {
  if (!responseJson || typeof responseJson !== 'object') {
    throw new Error('Venice live response must be an object')
  }

  const images = Array.isArray(responseJson.images) ? responseJson.images : []
  const status = httpStatus >= 200 && httpStatus < 300 ? 'succeeded' : 'failed'

  return normalizeProviderResult({
    generationRequest,
    providerId: veniceLiveSmokeConfig.providerId,
    providerJobRef: {
      kind: 'venice-live-smoke-job',
      id: responseJson.id ?? `venice-live-smoke:${generationRequest.requestId}`,
      localOnly: true,
      providerTruth: false
    },
    status,
    outputRefs: images.map((image, index) => ({
      kind: 'provider-output',
      id: `venice-live-image-${index}`,
      outputDelivery: 'inline-base64',
      contentType: `image/${responseJson.request?.format ?? veniceLiveSmokeConfig.defaultFormat}`,
      byteLengthApprox: typeof image === 'string' ? image.length : undefined,
      localOnly: true,
      providerTruth: false,
      meshTruth: false,
      distributedProof: false,
      ratifiedSharedState: false
    })),
    timing: responseJson.timing,
    rawProviderRef: {
      kind: 'venice-live-response',
      responseId: responseJson.id,
      apiCalled: true,
      storedRawBytes: false,
      providerTruth: false
    }
  })
}

export async function runVeniceLiveSmoke({
  env = process.env,
  envPath = '.env',
  projectDir = 'examples/venice-smoke',
  fetchImpl = globalThis.fetch
} = {}) {
  assertVeniceLiveGate(env)

  if (typeof fetchImpl !== 'function') {
    throw new Error('Venice live smoke requires a fetch implementation')
  }

  const localEnv = await loadLocalEnv(envPath)
  const apiKey = resolveVeniceApiKey({ env, localEnv })
  const generationRequest = createVeniceSmokeGenerationRequest()
  const providerInput = buildVeniceLiveSmokeProviderInput(generationRequest)

  const response = await fetchImpl(veniceLiveSmokeConfig.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(providerInput)
  })

  const responseJson = await response.json()
  const providerResult = normalizeVeniceLiveImageResult({
    generationRequest,
    responseJson,
    httpStatus: response.status
  })

  validateRequiredRecord(generationRequest)
  validateRequiredRecord(providerResult)

  const resultRef = 'records/provider-results/venice-live-smoke-provider-result.local.json'
  assertSafeLocalPath(resultRef)
  const outputPath = path.join(projectDir, resultRef)

  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, JSON.stringify({
    generationRequest,
    providerInput: {
      ...providerInput,
      apiKeyPresent: true
    },
    providerResult,
    doctrine: {
      localOnly: true,
      meshTruth: false,
      distributedProof: false,
      ratifiedSharedState: false,
      providerTruth: false,
      byteAvailabilityProof: false,
      materializationProof: false
    }
  }, null, 2))

  if (providerResult.status !== 'succeeded') {
    throw new Error(`Venice live smoke failed with HTTP ${response.status}; wrote local provider result to ${resultRef}`)
  }

  return {
    providerId: veniceLiveSmokeConfig.providerId,
    endpointId: veniceLiveSmokeConfig.endpointId,
    live: true,
    generationRequest,
    providerInput,
    providerResult,
    outputPath: makeRef('local-file', resultRef, 'media.local_ref.v1')
  }
}

async function main() {
  try {
    const result = await runVeniceLiveSmoke()
    console.log(`Venice live smoke wrote local provider result: ${result.outputPath.id}`)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main()
}
