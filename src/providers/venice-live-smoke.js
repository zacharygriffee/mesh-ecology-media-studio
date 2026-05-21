import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import {
  createLocalRunManifest,
  createWorkPacket,
  makeRef,
  nowIso
} from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import { writeProviderOutputAssets } from '../assets/provider-output-ingest.js'
import {
  assertSafeLocalPath
} from '../local/project-layout.js'
import { writeLocalAssetReview } from '../review/local-review.js'
import { executeProviderAdapter } from './adapter-runner.js'
import {
  classifyProviderFailure,
  writeProviderFailureEvidenceRecord
} from './provider-failures.js'
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

export function createVeniceSmokeCard({
  projectId = 'venice-smoke-project',
  cardId = 'venice-smoke-card',
  createdAt = nowIso()
} = {}) {
  return {
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
}

export function createVeniceSmokeGenerationRequest(options = {}) {
  const card = createVeniceSmokeCard(options)
  return createGenerationRequestFromCard({ card, createdAt: card.createdAt })
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

export function createVeniceLiveSmokeAdapter({ apiKey, fetchImpl, externalApiCall = true }) {
  if (!apiKey) throw new Error('Venice live smoke adapter is missing apiKey')
  if (typeof fetchImpl !== 'function') throw new Error('Venice live smoke adapter requires fetchImpl')

  return {
    adapterId: 'venice-image-live-smoke-adapter',
    providerId: veniceLiveSmokeConfig.providerId,
    endpointId: veniceLiveSmokeConfig.endpointId,
    supportedIntentFamilies: ['image-generation'],
    mapInput: buildVeniceLiveSmokeProviderInput,
    async execute(providerInput) {
      const response = await fetchImpl(veniceLiveSmokeConfig.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(providerInput)
      })

      return {
        httpStatus: response.status,
        responseJson: await response.json(),
        apiCalled: externalApiCall
      }
    },
    normalizeResult({ generationRequest, rawProviderOutput }) {
      return normalizeVeniceLiveImageResult({
        generationRequest,
        responseJson: rawProviderOutput.responseJson,
        httpStatus: rawProviderOutput.httpStatus,
        apiCalled: rawProviderOutput.apiCalled !== false
      })
    },
    summarizeProviderInput(providerInput) {
      return {
        model: providerInput.model,
        width: providerInput.width,
        height: providerInput.height,
        variants: providerInput.variants,
        format: providerInput.format,
        returnBinary: providerInput.return_binary,
        safeMode: providerInput.safe_mode,
        webSearch: providerInput.enable_web_search,
        promptPresent: typeof providerInput.prompt === 'string',
        negativePromptPresent: typeof providerInput.negative_prompt === 'string',
        apiKeyPresent: true
      }
    }
  }
}

export function normalizeVeniceLiveImageResult({ generationRequest, responseJson, httpStatus = 200, apiCalled = true }) {
  if (!responseJson || typeof responseJson !== 'object') {
    throw new Error('Venice live response must be an object')
  }

  const images = Array.isArray(responseJson.images) ? responseJson.images : []
  const status = httpStatus >= 200 && httpStatus < 300 ? 'succeeded' : 'failed'
  const failure = status === 'failed'
    ? classifyProviderFailure({
      providerId: veniceLiveSmokeConfig.providerId,
      httpStatus,
      responseJson
    })
    : undefined

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
    failure,
    rawProviderRef: {
      kind: apiCalled ? 'venice-live-response' : 'venice-local-simulated-response',
      responseId: responseJson.id,
      apiCalled,
      storedRawBytes: false,
      providerTruth: false
    }
  })
}

export function extractVeniceBase64Images(responseJson) {
  if (!responseJson || typeof responseJson !== 'object') {
    throw new Error('Venice live response must be an object')
  }

  const images = Array.isArray(responseJson.images) ? responseJson.images : []

  return images.map((image, index) => {
    if (typeof image === 'string') {
      return {
        index,
        base64: stripDataUrlPrefix(image)
      }
    }

    if (image && typeof image === 'object') {
      const base64 = image.b64_json ?? image.base64 ?? image.image
      if (typeof base64 === 'string') {
        return {
          index,
          base64: stripDataUrlPrefix(base64)
        }
      }
    }

    throw new Error(`Unsupported Venice image payload at index ${index}`)
  })
}

export async function writeVeniceSmokeGeneratedAssets({
  projectDir,
  card,
  generationRequest,
  operatorRef = 'local-operator',
  workPacket = createWorkPacket({ card, operatorRef }),
  providerResult,
  responseJson,
  sourceApiCalled = true
}) {
  const outputs = extractVeniceBase64Images(responseJson).map((image) => ({
    index: image.index,
    bytes: Buffer.from(image.base64, 'base64'),
    contentType: 'image/png',
    extension: 'png'
  }))

  return writeProviderOutputAssets({
    projectDir,
    card,
    generationRequest,
    workPacket,
    providerResult,
    outputs,
    outputSubdir: 'provider-smoke',
    filenamePrefix: 'venice-live-smoke',
    recordPrefix: 'venice-live-smoke',
    sourceApiCalled,
    lifecycleReason: sourceApiCalled
      ? 'Venice live smoke output placed locally after provider result normalization.'
      : 'Venice smoke dry-run output placed locally from an injected provider-shaped response.',
    transitionSummary: sourceApiCalled
      ? 'Venice live smoke output decoded from provider response and placed as a local generated asset.'
      : 'Venice smoke dry-run output decoded from injected provider-shaped response and placed as a local generated asset.'
  })
}

export async function writeVeniceSmokeReviews({
  projectDir,
  card,
  generatedAssets,
  decision = 'accepted',
  operatorRef = 'local-smoke-operator'
}) {
  const reviews = []

  for (const asset of generatedAssets.assets) {
    reviews.push(await writeLocalAssetReview({
      projectDir,
      card,
      assetDescriptor: asset.assetDescriptor,
      decision,
      operatorRef,
      recordPrefix: `venice-live-smoke-${asset.index}`,
      summary: `Local smoke review recorded ${decision} for Venice generated asset ${asset.assetDescriptor.assetId}.`
    }))
  }

  return reviews
}

export async function writeVeniceSmokeManifest({
  projectDir,
  card,
  generatedAssets,
  workPacket,
  generationRequest,
  providerResult,
  reviews,
  recordRefs,
  externalApiCall = true
}) {
  if (generatedAssets.assets.length === 0) return undefined

  const firstAsset = generatedAssets.assets[0]
  const firstReview = reviews[0]
  const generatedRecords = {
    workPacket,
    generationRequest,
    providerResult,
    assetDescriptor: firstAsset.assetDescriptor,
    ...(firstAsset.imageMetadata ? { imageMetadata: firstAsset.imageMetadata.metadata } : {}),
    reviewEvidence: firstReview.reviewEvidence,
    readiness: firstReview.readiness,
    operatorDecision: firstReview.operatorDecision
  }
  const generatedRecordPaths = {
    workPacket: recordRefs.workPacket,
    generationRequest: recordRefs.generationRequest,
    providerResult: recordRefs.providerResult,
    assetDescriptor: firstAsset.assetRecordRef,
    ...(firstAsset.imageMetadata ? { imageMetadata: firstAsset.imageMetadata.recordRef } : {}),
    reviewEvidence: firstReview.recordRefs.reviewEvidence,
    readiness: firstReview.recordRefs.readiness,
    operatorDecision: firstReview.recordRefs.operatorDecision
  }
  const manifest = createLocalRunManifest({
    card,
    candidateInputPath: firstAsset.localRef.path,
    candidateHash: firstAsset.localRef.hash,
    generatedRecords,
    generatedRecordPaths,
    warnings: [
      'Mode 0 standalone-local Venice smoke output only.',
      externalApiCall
        ? 'Provider result came from a live Venice smoke call but is still not provider truth.'
        : 'Provider result came from an injected Venice-shaped response and is not provider truth.',
      'Local file existence and local hashes are not byte availability or materialization proof.',
      'Operator decision is local-only and is not mesh authorization.'
    ]
  })

  validateRequiredRecord(manifest)

  const manifestRef = 'records/manifests/venice-live-smoke-manifest.local.json'
  assertSafeLocalPath(manifestRef)
  const manifestPath = path.join(projectDir, manifestRef)
  await mkdir(path.dirname(manifestPath), { recursive: true })
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

  return {
    manifest,
    manifestRef
  }
}

export async function runVeniceLiveSmoke({
  env = process.env,
  envPath = '.env',
  projectDir = 'examples/venice-smoke',
  fetchImpl = globalThis.fetch,
  externalApiCall = true
} = {}) {
  assertVeniceLiveGate(env)

  if (typeof fetchImpl !== 'function') {
    throw new Error('Venice live smoke requires a fetch implementation')
  }

  const localEnv = await loadLocalEnv(envPath)
  const apiKey = resolveVeniceApiKey({ env, localEnv })
  const card = createVeniceSmokeCard()
  const workPacket = createWorkPacket({ card })
  const generationRequest = createGenerationRequestFromCard({ card })
  const adapterResult = await executeProviderAdapter({
    adapter: createVeniceLiveSmokeAdapter({ apiKey, fetchImpl, externalApiCall }),
    generationRequest,
    mode: externalApiCall ? 'live-smoke' : 'dry-run'
  })
  const { providerInput, providerResult, adapterRun } = adapterResult
  const { responseJson, httpStatus } = adapterResult.rawProviderOutput

  validateRequiredRecord(generationRequest)
  validateRequiredRecord(providerResult)

  const generatedAssets = providerResult.status === 'succeeded'
    ? await writeVeniceSmokeGeneratedAssets({
      projectDir,
      card,
      generationRequest,
      workPacket,
      providerResult,
      responseJson,
      sourceApiCalled: externalApiCall
    })
    : { workPacket: undefined, assets: [] }
  const reviews = providerResult.status === 'succeeded'
    ? await writeVeniceSmokeReviews({
      projectDir,
      card,
      generatedAssets
    })
    : []

  const resultRef = 'records/provider-results/venice-live-smoke-provider-result.local.json'
  const adapterRunRef = 'records/provider-results/venice-live-smoke-adapter-run.local.json'
  const failureEvidenceRef = 'records/evidence/venice-live-smoke-provider-failure-evidence.local.json'
  const cardRef = 'cards/card.json'
  const workPacketRef = 'records/work-packets/venice-live-smoke-work-packet.local.json'
  const generationRequestRef = 'records/work-packets/venice-live-smoke-generation-request.local.json'
  assertSafeLocalPath(resultRef)
  assertSafeLocalPath(adapterRunRef)
  assertSafeLocalPath(failureEvidenceRef)
  assertSafeLocalPath(cardRef)
  assertSafeLocalPath(workPacketRef)
  assertSafeLocalPath(generationRequestRef)
  const outputPath = path.join(projectDir, resultRef)
  const adapterRunPath = path.join(projectDir, adapterRunRef)
  const cardPath = path.join(projectDir, cardRef)
  const workPacketPath = path.join(projectDir, workPacketRef)
  const generationRequestPath = path.join(projectDir, generationRequestRef)
  const failureEvidenceRecord = providerResult.status === 'failed'
    ? await writeProviderFailureEvidenceRecord({
      projectDir,
      generationRequest,
      providerResult,
      classification: providerResult.failure,
      recordRef: failureEvidenceRef
    })
    : undefined
  const finalAdapterRun = failureEvidenceRecord
    ? {
      ...adapterRun,
      failureEvidenceRefs: [
        makeRef('media-evidence', failureEvidenceRecord.recordRef, failureEvidenceRecord.evidence.schema)
      ]
    }
    : adapterRun

  validateRequiredRecord(workPacket)
  validateRequiredRecord(finalAdapterRun)
  await mkdir(path.dirname(cardPath), { recursive: true })
  await writeFile(cardPath, `${JSON.stringify(card, null, 2)}\n`)
  await mkdir(path.dirname(workPacketPath), { recursive: true })
  await writeFile(workPacketPath, `${JSON.stringify(workPacket, null, 2)}\n`)
  await writeFile(generationRequestPath, `${JSON.stringify(generationRequest, null, 2)}\n`)
  await mkdir(path.dirname(adapterRunPath), { recursive: true })
  await writeFile(adapterRunPath, `${JSON.stringify(finalAdapterRun, null, 2)}\n`)
  const manifestRecord = providerResult.status === 'succeeded'
    ? await writeVeniceSmokeManifest({
      projectDir,
      card,
      generatedAssets,
      workPacket,
      generationRequest,
      providerResult,
      reviews,
      recordRefs: {
        workPacket: workPacketRef,
        generationRequest: generationRequestRef,
        providerResult: resultRef
      },
      externalApiCall
    })
    : undefined
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, JSON.stringify({
    generationRequest,
    providerInput: {
      ...providerInput,
      apiKeyPresent: true
    },
    providerResult,
    adapterRun: finalAdapterRun,
    generatedRecordRefs: [
      makeRef('media-card', cardRef, card.schema),
      makeRef('media-work-packet', workPacketRef, workPacket.schema),
      makeRef('media-generation-request', generationRequestRef, generationRequest.schema),
      makeRef('media-provider-adapter-run', adapterRunRef, finalAdapterRun.schema),
      ...(failureEvidenceRecord
        ? [makeRef('media-evidence', failureEvidenceRecord.recordRef, failureEvidenceRecord.evidence.schema)]
        : [])
    ],
    generatedAssets: generatedAssets.assets.map((asset) => ({
      localRef: asset.localRef,
      assetRef: makeRef('media-asset', asset.assetDescriptor.assetId, asset.assetDescriptor.schema),
      assetRecordRef: asset.assetRecordRef,
      imageMetadataRef: asset.imageMetadata
        ? makeRef('media-image-metadata', asset.imageMetadata.recordRef, asset.imageMetadata.metadata.schema)
        : undefined
    })),
    reviewRecords: reviews.map((review) => ({
      evidenceRef: makeRef('media-evidence', review.reviewEvidence.evidenceId, review.reviewEvidence.schema),
      readinessRef: makeRef('media-readiness', review.readiness.readinessId, review.readiness.schema),
      decisionRef: makeRef('media-operator-decision', review.operatorDecision.decisionId, review.operatorDecision.schema),
      recordRefs: review.recordRefs,
      localDecisionOnly: true
    })),
    failureEvidenceRef: failureEvidenceRecord
      ? makeRef('media-evidence', failureEvidenceRecord.recordRef, failureEvidenceRecord.evidence.schema)
      : undefined,
    manifestRef: manifestRecord
      ? makeRef('media-local-run-manifest', manifestRecord.manifestRef, manifestRecord.manifest.schema)
      : undefined,
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
    throw new Error(`Venice live smoke failed with HTTP ${httpStatus}; wrote local provider result to ${resultRef}`)
  }

  return {
    providerId: veniceLiveSmokeConfig.providerId,
    endpointId: veniceLiveSmokeConfig.endpointId,
    live: externalApiCall,
    generationRequest,
    providerInput,
    providerResult,
    adapterRun: finalAdapterRun,
    generatedAssets,
    reviews,
    manifestRecord,
    failureEvidenceRecord,
    outputPath: makeRef('local-file', resultRef, 'media.local_ref.v1')
  }
}

function stripDataUrlPrefix(value) {
  const commaIndex = value.indexOf(',')
  if (value.startsWith('data:') && commaIndex !== -1) {
    return value.slice(commaIndex + 1)
  }

  return value
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
