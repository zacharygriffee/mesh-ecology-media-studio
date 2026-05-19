import { readFile } from 'node:fs/promises'

import { normalizeProviderResult } from './provider-neutral.js'

const defaultModel = 'venice-sd35'

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
  const providerInput = mapGenerationRequestToVeniceImageRequest(generationRequest)
  const fixture = JSON.parse(await readFile(fixturePath, 'utf8'))
  const providerResult = normalizeVeniceImageFixtureResult({ generationRequest, fixture })

  return {
    providerId: 'venice',
    endpointId: 'venice.image.generate',
    dryRun: true,
    providerInput,
    providerResult
  }
}
