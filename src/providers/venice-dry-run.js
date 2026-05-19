import { readFile } from 'node:fs/promises'

import { executeProviderAdapter } from './adapter-runner.js'
import { normalizeProviderResult } from './provider-neutral.js'

const defaultModel = 'venice-sd35'
const veniceDryRunAdapterId = 'venice-image-dry-run-adapter'
const veniceEndpointId = 'venice.image.generate'

export function mapGenerationRequestToVeniceImageRequest(generationRequest) {
  if (generationRequest.schema !== 'media.generation_request.v1') {
    throw new Error('Venice dry-run adapter requires media.generation_request.v1 input')
  }

  if (generationRequest.intentFamily !== 'image-generation') {
    throw new Error(`Venice dry-run image adapter does not support ${generationRequest.intentFamily}`)
  }

  return {
    model: generationRequest.providerHints?.model ?? defaultModel,
    prompt: generationRequest.prompt,
    negative_prompt: generationRequest.negativePrompt,
    width: generationRequest.target?.width ?? 1024,
    height: generationRequest.target?.height ?? 1024,
    seed: generationRequest.providerHints?.seed,
    dryRun: true
  }
}

export function normalizeVeniceImageFixtureResult({ generationRequest, fixture }) {
  if (!fixture || typeof fixture !== 'object') {
    throw new Error('Venice fixture result must be an object')
  }

  const providerStatus = fixture.status ?? 'succeeded'
  const status = providerStatus === 'succeeded' ? 'succeeded' : 'failed'
  const imageOutputs = Array.isArray(fixture.images) ? fixture.images : []

  return normalizeProviderResult({
    generationRequest,
    providerId: 'venice',
    providerJobRef: {
      kind: 'venice-dry-run-job',
      id: fixture.id ?? `venice-dry-run:${generationRequest.requestId}`,
      localOnly: true
    },
    status,
    outputRefs: imageOutputs.map((image, index) => ({
      kind: 'provider-output',
      id: image.id ?? `fixture-image-${index}`,
      outputDelivery: image.outputDelivery ?? 'inline-base64',
      contentType: image.contentType ?? 'image/png',
      localOnly: true,
      providerTruth: false
    })),
    timing: fixture.timing,
    rawProviderRef: {
      kind: 'venice-fixture-response',
      fixtureId: fixture.id,
      apiCalled: false
    }
  })
}

export async function runVeniceDryRun({ generationRequest, fixturePath }) {
  return executeProviderAdapter({
    adapter: createVeniceDryRunAdapter({ fixturePath }),
    generationRequest,
    mode: 'dry-run'
  }).then((result) => ({
    ...result,
    dryRun: true
  }))
}

export function createVeniceDryRunAdapter({ fixturePath }) {
  return {
    adapterId: veniceDryRunAdapterId,
    providerId: 'venice',
    endpointId: veniceEndpointId,
    supportedIntentFamilies: ['image-generation'],
    mapInput: mapGenerationRequestToVeniceImageRequest,
    async execute() {
      return JSON.parse(await readFile(fixturePath, 'utf8'))
    },
    normalizeResult({ generationRequest, rawProviderOutput }) {
      return normalizeVeniceImageFixtureResult({
        generationRequest,
        fixture: rawProviderOutput
      })
    }
  }
}
