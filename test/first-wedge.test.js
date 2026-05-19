import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { runFirstWedge } from '../src/local/run-first-wedge.js'
import { validateRequiredRecord } from '../src/contracts/schemas.js'
import {
  createGenerationRequestFromCard,
  createProviderCapability,
  createProviderProfile,
  normalizeProviderResult,
  validateProviderCapability
} from '../src/providers/provider-neutral.js'
import {
  assertLifecycleState,
  assertPlacementClass,
  assertSafeLocalPath,
  createAssetLifecycle,
  createLocalRef,
  placementClasses
} from '../src/local/project-layout.js'
import {
  assertAsyncPattern,
  assertOutputDelivery,
  createProviderEndpointShape,
  createProviderMapping,
  createProviderShape
} from '../src/providers/provider-shapes.js'
import {
  mapGenerationRequestToVeniceImageRequest,
  runVeniceDryRun
} from '../src/providers/venice-dry-run.js'
import {
  assertVeniceLiveGate,
  assertVeniceSmokeBudget,
  buildVeniceLiveSmokeProviderInput,
  createVeniceSmokeGenerationRequest,
  normalizeVeniceLiveImageResult,
  parseEnvText,
  resolveVeniceApiKey,
  runVeniceLiveSmoke
} from '../src/providers/venice-live-smoke.js'
import { inspectVeniceSmoke } from '../src/seams/inspect-venice-smoke.js'

async function createFixtureProject() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-wedge-'))
  await mkdir(path.join(dir, 'cards'), { recursive: true })
  await mkdir(path.join(dir, 'media', 'generated'), { recursive: true })

  await writeFile(path.join(dir, 'cards', 'card.json'), JSON.stringify({
    schema: 'media.card.v1',
    cardId: 'card-test',
    projectId: 'project-test',
    kind: 'image',
    prompt: 'test prompt',
    referenceAssetRefs: [],
    target: {
      contentType: 'image/png'
    },
    providerHints: {},
    acceptanceCriteria: ['hash recorded'],
    createdAt: '2026-05-19T00:00:00.000Z'
  }, null, 2))
  await writeFile(path.join(dir, 'media', 'generated', 'candidate.txt'), 'candidate bytes')

  return dir
}

test('first wedge creates local records without claiming mesh truth', async () => {
  const dir = await createFixtureProject()

  const result = await runFirstWedge({
    projectDir: dir,
    decision: 'accepted',
    operatorRef: 'operator-test'
  })

  assert.equal(result.outputs.workPacket.schema, 'media.work_packet.v1')
  assert.equal(result.outputs.assetDescriptor.schema, 'media.asset.descriptor.v1')
  assert.equal(result.outputs.operatorDecision.localDecisionOnly, true)
  assert.match(result.outputs.assetDescriptor.truthStatus, /not mesh truth/)
  assert.equal(result.outputs.localRunManifest.schema, 'media.local_run_manifest.v1')
  assert.equal(result.outputs.localRunManifest.mode, 'standalone-local')
  assert.equal(result.outputs.localRunManifest.operatorGuidanceOnly, true)
  assert.equal(result.outputs.localRunManifest.localOnly, true)
  assert.equal(result.outputs.localRunManifest.meshTruth, false)
  assert.equal(result.outputs.localRunManifest.distributedProof, false)
  assert.equal(result.outputs.localRunManifest.ratifiedSharedState, false)
  assert.equal(result.outputs.assetDescriptor.localRef.schema, 'media.local_ref.v1')
  assert.equal(result.outputs.assetDescriptor.localRef.placementClass, 'media-accepted')
  assert.equal(result.outputs.assetDescriptor.localRef.path, 'media/accepted/candidate.txt')
  assert.equal(result.outputs.workPacket.meshTruth, false)
  assert.equal(result.outputs.providerResult.schema, 'media.provider_result.v1')
  assert.equal(result.outputs.providerResult.providerTruth, false)
  assert.equal(result.outputs.providerResult.distributedProof, false)
  assert.equal(result.outputs.generationRequest.schema, 'media.generation_request.v1')
  assert.equal(result.outputs.providerProfile.schema, 'media.provider_profile.v1')
  assert.equal(result.outputs.operatorDecision.ratifiedSharedState, false)
  assert.equal(result.outputs.assetDescriptor.provenance.lifecycle.schema, 'media.asset_lifecycle.v1')
  assert.equal(result.projectLayout.schema, 'media.project_layout.v1')
  assert.equal(validateRequiredRecord(result.projectLayout), true)

  const decision = JSON.parse(
    await readFile(path.join(dir, 'records', 'decisions', 'media-operator-decision.local.json'), 'utf8')
  )
  assert.equal(decision.decisionType, 'accept')

  const manifest = JSON.parse(
    await readFile(path.join(dir, 'records', 'manifests', 'media-local-run-manifest.local.json'), 'utf8')
  )
  assert.equal(manifest.hashes.candidate.algorithm, 'sha256')
  assert.ok(manifest.artifactKinds.includes('media.provider_profile.v1'))
  assert.ok(manifest.artifactKinds.includes('media.provider_capability.v1'))
  assert.ok(manifest.artifactKinds.includes('media.generation_request.v1'))
  assert.ok(manifest.artifactKinds.includes('media.provider_result.v1'))
  assert.ok(manifest.artifactKinds.includes('media.local_ref.v1'))
  assert.ok(manifest.artifactKinds.includes('media.asset_lifecycle.v1'))
  assert.ok(manifest.doctrineLabels.includes('not provider truth'))
  assert.equal(manifest.generatedRecordRefs[0].path, 'records/work-packets/media-work-packet.local.json')
})

test('provider profile validates with provider-neutral capability', () => {
  const capability = createProviderCapability({
    intentFamily: 'image-generation',
    outputKinds: ['image']
  })
  const profile = createProviderProfile({
    providerId: 'local-placeholder-provider',
    displayName: 'Local Placeholder Provider',
    capabilities: [capability]
  })

  assert.equal(validateRequiredRecord(capability), true)
  assert.equal(validateRequiredRecord(profile), true)
  assert.equal(profile.meshTruth, false)
})

test('provider capability rejects unsupported intent family', () => {
  assert.throws(
    () => createProviderCapability({
      intentFamily: 'text-generation',
      outputKinds: ['text']
    }),
    /Unsupported intent family/
  )

  assert.throws(
    () => validateProviderCapability({
      schema: 'media.provider_capability.v1',
      capabilityId: 'capability-bad',
      intentFamily: 'text-generation',
      outputKinds: ['text'],
      localOnly: true,
      meshTruth: false
    }),
    /Unsupported intent family/
  )
})

test('provider profile rejects missing provider id', () => {
  const capability = createProviderCapability({
    intentFamily: 'image-generation',
    outputKinds: ['image']
  })

  assert.throws(
    () => createProviderProfile({
      displayName: 'Missing Id',
      capabilities: [capability]
    }),
    /missing providerId/
  )
})

test('generation request can be derived from a card', () => {
  const card = {
    schema: 'media.card.v1',
    cardId: 'card-provider-test',
    projectId: 'project-test',
    kind: 'image',
    prompt: 'test prompt',
    negativePrompt: 'none',
    referenceAssetRefs: [],
    target: { contentType: 'image/png' },
    providerHints: { providerId: 'local-placeholder-provider' },
    acceptanceCriteria: [],
    createdAt: '2026-05-19T00:00:00.000Z'
  }
  const request = createGenerationRequestFromCard({ card })

  assert.equal(request.schema, 'media.generation_request.v1')
  assert.equal(request.intentFamily, 'image-generation')
  assert.equal(request.cardRef.id, 'card-provider-test')
  assert.equal(validateRequiredRecord(request), true)
})

test('provider result normalization creates non-truth-bearing provider result', () => {
  const generationRequest = {
    schema: 'media.generation_request.v1',
    requestId: 'request-test'
  }
  const result = normalizeProviderResult({
    generationRequest,
    providerId: 'local-placeholder-provider',
    providerJobRef: {
      kind: 'local-synthetic-provider-job',
      id: 'job-test'
    },
    status: 'succeeded',
    outputRefs: []
  })

  assert.equal(result.schema, 'media.provider_result.v1')
  assert.equal(result.providerTruth, false)
  assert.equal(result.requestRef.id, 'request-test')
  assert.equal(validateRequiredRecord(result), true)
})

test('provider shape registry validates endpoint shape and provider shape', () => {
  const endpoint = createProviderEndpointShape({
    endpointId: 'venice.image.generate',
    providerId: 'venice',
    intentFamily: 'image-generation',
    operationKind: 'generate-image',
    requestShape: { style: 'provider-json-request' },
    responseShape: { style: 'provider-image-response' },
    asyncPattern: 'synchronous',
    outputDelivery: 'inline-base64',
    knownFailureModes: ['provider_failed']
  })
  const shape = createProviderShape({
    providerId: 'venice',
    providerFamily: 'venice-media',
    authKind: 'api-key',
    endpoints: [endpoint]
  })

  assert.equal(endpoint.schema, 'media.provider_endpoint_shape.v1')
  assert.equal(shape.schema, 'media.provider_shape.v1')
  assert.equal(validateRequiredRecord(endpoint), true)
  assert.equal(validateRequiredRecord(shape), true)
})

test('provider shape registry rejects invalid async and output delivery values', () => {
  assert.throws(
    () => assertAsyncPattern('eventually'),
    /Unsupported provider async pattern/
  )

  assert.throws(
    () => assertOutputDelivery('magic-link'),
    /Unsupported provider output delivery/
  )
})

test('provider mapping validates Studio/provider field mapping without provider truth', () => {
  const mapping = createProviderMapping({
    providerId: 'venice',
    endpointId: 'venice.image.generate',
    studioInput: { schema: 'media.generation_request.v1' },
    providerInput: { prompt: 'prompt' },
    providerOutput: { status: 'status', outputRefs: 'images' },
    studioOutput: { schema: 'media.provider_result.v1', providerTruth: false },
    warnings: ['fixture only']
  })

  assert.equal(mapping.schema, 'media.provider_mapping.v1')
  assert.equal(mapping.providerTruth, false)
  assert.equal(validateRequiredRecord(mapping), true)

  assert.throws(
    () => createProviderMapping({
      providerId: 'venice',
      endpointId: 'venice.image.generate',
      studioInput: { schema: 'media.generation_request.v1' },
      providerInput: {},
      providerOutput: {},
      warnings: []
    }),
    /missing studioOutput/
  )
})

test('provider shape fixtures validate locally', async () => {
  for (const fixturePath of [
    'examples/provider-shapes/openai-image-shape.json',
    'examples/provider-shapes/venice-image-shape.json',
    'examples/provider-shapes/venice-image-mapping.json',
    'examples/provider-shapes/venice-provider-profile.json'
  ]) {
    const fixture = JSON.parse(await readFile(fixturePath, 'utf8'))
    assert.equal(validateRequiredRecord(fixture), true)
  }
})

test('Venice dry-run adapter maps Studio request to provider payload without network', async () => {
  const card = {
    schema: 'media.card.v1',
    cardId: 'card-venice-test',
    projectId: 'project-test',
    kind: 'image',
    prompt: 'test prompt',
    negativePrompt: 'none',
    referenceAssetRefs: [],
    target: {
      width: 512,
      height: 512,
      contentType: 'image/png'
    },
    providerHints: {
      model: 'venice-sd35',
      seed: 123
    },
    acceptanceCriteria: [],
    createdAt: '2026-05-19T00:00:00.000Z'
  }
  const generationRequest = createGenerationRequestFromCard({ card })
  const providerInput = mapGenerationRequestToVeniceImageRequest(generationRequest)

  assert.equal(providerInput.model, 'venice-sd35')
  assert.equal(providerInput.prompt, 'test prompt')
  assert.equal(providerInput.width, 512)
  assert.equal(providerInput.dryRun, true)

  const dryRun = await runVeniceDryRun({
    generationRequest,
    fixturePath: 'examples/provider-fixtures/venice-image-success.fixture.json'
  })

  assert.equal(dryRun.dryRun, true)
  assert.equal(dryRun.providerResult.schema, 'media.provider_result.v1')
  assert.equal(dryRun.providerResult.providerId, 'venice')
  assert.equal(dryRun.providerResult.providerTruth, false)
  assert.equal(validateRequiredRecord(dryRun.providerResult), true)
})

test('Venice live smoke gate refuses without explicit opt-in', () => {
  assert.throws(
    () => assertVeniceLiveGate({}),
    /VENICE_LIVE=1/
  )

  assert.equal(assertVeniceLiveGate({ VENICE_LIVE: '1' }), true)
})

test('Venice live smoke key resolution uses env or local env without exposing value', () => {
  const parsed = parseEnvText(['VENICE_INFERENCE_KEY=test-key', 'VENICE_LIVE=1'].join('\n'))

  assert.equal(parsed.VENICE_INFERENCE_KEY, 'test-key')
  assert.equal(resolveVeniceApiKey({ env: {}, localEnv: parsed }), 'test-key')

  assert.throws(
    () => resolveVeniceApiKey({ env: {}, localEnv: {} }),
    /missing VENICE_INFERENCE_KEY/
  )
})

test('Venice live smoke budget rejects unsupported model and oversized requests', () => {
  const request = createVeniceSmokeGenerationRequest({
    createdAt: '2026-05-19T00:00:00.000Z'
  })
  const providerInput = buildVeniceLiveSmokeProviderInput(request)

  assert.equal(providerInput.model, 'venice-sd35')
  assert.equal(providerInput.width, 512)
  assert.equal(providerInput.height, 512)
  assert.equal(providerInput.variants, 1)
  assert.equal(providerInput.return_binary, false)
  assert.equal(assertVeniceSmokeBudget(providerInput), true)

  assert.throws(
    () => assertVeniceSmokeBudget({ ...providerInput, model: 'expensive-model' }),
    /not allowed/
  )

  assert.throws(
    () => assertVeniceSmokeBudget({ ...providerInput, width: 1024 }),
    /width/
  )
})

test('Venice live smoke result normalizes to provider-neutral result', () => {
  const generationRequest = createVeniceSmokeGenerationRequest({
    createdAt: '2026-05-19T00:00:00.000Z'
  })
  const result = normalizeVeniceLiveImageResult({
    generationRequest,
    responseJson: {
      id: 'venice-live-test-response',
      images: ['base64-image-placeholder'],
      request: { format: 'png' },
      timing: { providerElapsedMs: 10 }
    },
    httpStatus: 200
  })

  assert.equal(result.schema, 'media.provider_result.v1')
  assert.equal(result.providerId, 'venice')
  assert.equal(result.providerTruth, false)
  assert.equal(result.outputRefs[0].outputDelivery, 'inline-base64')
  assert.equal(validateRequiredRecord(result), true)
})

test('Venice live smoke command path can be tested without network by injected fetch', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-venice-smoke-'))
  let fetchCalled = false

  const result = await runVeniceLiveSmoke({
    env: {
      VENICE_LIVE: '1',
      VENICE_INFERENCE_KEY: 'test-key'
    },
    envPath: path.join(dir, '.env-missing'),
    projectDir: dir,
    fetchImpl: async (_url, options) => {
      fetchCalled = true
      assert.match(options.headers.Authorization, /^Bearer /)
      assert.doesNotMatch(options.body, /test-key/)

      return {
        status: 200,
        async json() {
          return {
            id: 'venice-live-test-response',
            images: ['base64-image-placeholder'],
            request: { format: 'png' }
          }
        }
      }
    }
  })

  assert.equal(fetchCalled, true)
  assert.equal(result.live, true)
  assert.equal(result.providerResult.providerTruth, false)
  assert.equal(result.generatedAssets.assets.length, 1)
  assert.equal(result.generatedAssets.assets[0].localRef.path, 'media/generated/provider-smoke/venice-live-smoke-0.png')
  assert.equal(validateRequiredRecord(result.generatedAssets.assets[0].assetDescriptor), true)
  assert.equal(result.reviews.length, 1)
  assert.equal(result.reviews[0].operatorDecision.decisionType, 'accept')
  assert.equal(validateRequiredRecord(result.reviews[0].operatorDecision), true)
  assert.equal(result.manifestRecord.manifest.schema, 'media.local_run_manifest.v1')
  assert.equal(validateRequiredRecord(result.manifestRecord.manifest), true)

  const written = JSON.parse(
    await readFile(path.join(dir, 'records', 'provider-results', 'venice-live-smoke-provider-result.local.json'), 'utf8')
  )
  assert.equal(written.providerInput.apiKeyPresent, true)
  assert.equal(JSON.stringify(written).includes('test-key'), false)
  assert.equal(written.generatedRecordRefs.length, 2)
  assert.equal(written.generatedAssets[0].localRef.path, 'media/generated/provider-smoke/venice-live-smoke-0.png')
  assert.equal(written.reviewRecords.length, 1)
  assert.equal(written.reviewRecords[0].localDecisionOnly, true)
  assert.equal(written.manifestRef.id, 'records/manifests/venice-live-smoke-manifest.local.json')

  const workPacket = JSON.parse(
    await readFile(path.join(dir, 'records', 'work-packets', 'venice-live-smoke-work-packet.local.json'), 'utf8')
  )
  const generationRequest = JSON.parse(
    await readFile(path.join(dir, 'records', 'work-packets', 'venice-live-smoke-generation-request.local.json'), 'utf8')
  )
  assert.equal(validateRequiredRecord(workPacket), true)
  assert.equal(validateRequiredRecord(generationRequest), true)

  const assetRecord = JSON.parse(
    await readFile(path.join(dir, 'records', 'assets', 'venice-live-smoke-asset-0.local.json'), 'utf8')
  )
  assert.equal(assetRecord.schema, 'media.asset.descriptor.v1')
  assert.equal(assetRecord.source.apiCalled, true)
  assert.equal(assetRecord.localRef.placementClass, 'media-generated')
  assert.equal(assetRecord.meshTruth, false)

  const evidenceRecord = JSON.parse(
    await readFile(path.join(dir, 'records', 'evidence', 'venice-live-smoke-0-evidence.local.json'), 'utf8')
  )
  const readinessRecord = JSON.parse(
    await readFile(path.join(dir, 'records', 'readiness', 'venice-live-smoke-0-readiness.local.json'), 'utf8')
  )
  const decisionRecord = JSON.parse(
    await readFile(path.join(dir, 'records', 'decisions', 'venice-live-smoke-0-decision.local.json'), 'utf8')
  )
  assert.equal(validateRequiredRecord(evidenceRecord), true)
  assert.equal(readinessRecord.state, 'complete')
  assert.equal(decisionRecord.decisionType, 'accept')
  assert.equal(decisionRecord.localDecisionOnly, true)

  const manifestRecord = JSON.parse(
    await readFile(path.join(dir, 'records', 'manifests', 'venice-live-smoke-manifest.local.json'), 'utf8')
  )
  assert.equal(validateRequiredRecord(manifestRecord), true)
  assert.equal(manifestRecord.candidateInputRef.path, 'media/generated/provider-smoke/venice-live-smoke-0.png')
  assert.ok(manifestRecord.warnings.some((warning) => warning.includes('live Venice smoke call')))
})

test('Venice smoke inspection packet exports local refs without provider calls', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-venice-inspect-'))

  await runVeniceLiveSmoke({
    env: {
      VENICE_LIVE: '1',
      VENICE_INFERENCE_KEY: 'test-key'
    },
    envPath: path.join(dir, '.env-missing'),
    projectDir: dir,
    fetchImpl: async () => ({
      status: 200,
      async json() {
        return {
          id: 'venice-live-test-response',
          images: ['base64-image-placeholder'],
          request: { format: 'png' }
        }
      }
    })
  })

  const result = await inspectVeniceSmoke({ projectDir: dir })

  assert.equal(result.packet.schema, 'media.edge_inspection_packet.local.v1')
  assert.equal(result.packet.seam, 'media-edge-operator-seam')
  assert.equal(result.packet.operatorGuidanceOnly, true)
  assert.equal(result.packet.meshTruth, false)
  assert.equal(result.packet.generatedArtifactRefs[0].path, 'media/generated/provider-smoke/venice-live-smoke-0.png')
  assert.equal(validateRequiredRecord(result.packet), true)

  const written = JSON.parse(
    await readFile(path.join(dir, 'records', 'exports', 'venice-smoke-edge-inspection-packet.local.json'), 'utf8')
  )
  assert.equal(written.schema, 'media.edge_inspection_packet.local.v1')
  assert.equal(written.recordRefs.providerResult.path, 'records/provider-results/venice-live-smoke-provider-result.local.json')
})

test('Venice smoke inspection packet fails on missing records', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-venice-inspect-missing-'))

  await runVeniceLiveSmoke({
    env: {
      VENICE_LIVE: '1',
      VENICE_INFERENCE_KEY: 'test-key'
    },
    envPath: path.join(dir, '.env-missing'),
    projectDir: dir,
    fetchImpl: async () => ({
      status: 200,
      async json() {
        return {
          id: 'venice-live-test-response',
          images: ['base64-image-placeholder'],
          request: { format: 'png' }
        }
      }
    })
  })

  await rm(path.join(dir, 'records', 'assets', 'venice-live-smoke-asset-0.local.json'))

  await assert.rejects(
    () => inspectVeniceSmoke({ projectDir: dir }),
    /Missing Venice smoke inspection record: records\/assets\/venice-live-smoke-asset-0.local.json/
  )
})

test('Venice live smoke normalizes failure fixtures without claiming provider truth', async () => {
  const generationRequest = createVeniceSmokeGenerationRequest({
    createdAt: '2026-05-19T00:00:00.000Z'
  })

  for (const fixturePath of [
    'examples/provider-fixtures/venice-image-auth-failure.fixture.json',
    'examples/provider-fixtures/venice-image-rate-limit.fixture.json'
  ]) {
    const fixture = JSON.parse(await readFile(fixturePath, 'utf8'))
    const result = normalizeVeniceLiveImageResult({
      generationRequest,
      responseJson: fixture,
      httpStatus: fixture.httpStatus
    })

    assert.equal(result.status, 'failed')
    assert.equal(result.providerTruth, false)
    assert.equal(validateRequiredRecord(result), true)
  }
})

test('Venice live smoke persists failed provider result without creating assets', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-venice-failed-smoke-'))
  const fixture = JSON.parse(
    await readFile('examples/provider-fixtures/venice-image-auth-failure.fixture.json', 'utf8')
  )

  await assert.rejects(
    () => runVeniceLiveSmoke({
      env: {
        VENICE_LIVE: '1',
        VENICE_INFERENCE_KEY: 'test-key'
      },
      envPath: path.join(dir, '.env-missing'),
      projectDir: dir,
      fetchImpl: async () => ({
        status: fixture.httpStatus,
        async json() {
          return fixture
        }
      })
    }),
    /failed with HTTP 401/
  )

  const written = JSON.parse(
    await readFile(path.join(dir, 'records', 'provider-results', 'venice-live-smoke-provider-result.local.json'), 'utf8')
  )
  assert.equal(written.providerResult.status, 'failed')
  assert.equal(written.providerResult.providerTruth, false)
  assert.deepEqual(written.generatedAssets, [])
  assert.deepEqual(written.reviewRecords, [])
  assert.equal(written.manifestRef, undefined)
})

test('Venice live smoke rejects malformed image payload fixtures', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-malformed-smoke-'))
  const fixture = JSON.parse(
    await readFile('examples/provider-fixtures/venice-image-malformed.fixture.json', 'utf8')
  )

  await assert.rejects(
    () => runVeniceLiveSmoke({
      env: {
        VENICE_LIVE: '1',
        VENICE_INFERENCE_KEY: 'test-key'
      },
      envPath: path.join(dir, '.env-missing'),
      projectDir: dir,
      fetchImpl: async () => ({
        status: 200,
        async json() {
          return fixture
        }
      })
    }),
    /Unsupported Venice image payload/
  )
})

test('local refs accept safe project-relative paths', () => {
  const localRef = createLocalRef({
    placementClass: placementClasses.mediaAccepted,
    relativePath: 'media/accepted/candidate.txt',
    contentType: 'text/plain'
  })

  assert.equal(localRef.schema, 'media.local_ref.v1')
  assert.equal(localRef.localOnly, true)
  assert.equal(localRef.meshTruth, false)
  assert.equal(validateRequiredRecord(localRef), true)
})

test('local refs block unsafe paths', () => {
  for (const unsafePath of [
    '/tmp/candidate.txt',
    '../candidate.txt',
    'media/../candidate.txt',
    '~/candidate.txt',
    'https://example.com/candidate.txt',
    'file:///tmp/candidate.txt',
    'media\\accepted\\candidate.txt'
  ]) {
    assert.throws(
      () => assertSafeLocalPath(unsafePath),
      /Local ref path/
    )
  }
})

test('placement class validation rejects unknown classes', () => {
  assert.equal(assertPlacementClass(placementClasses.mediaGenerated), true)

  assert.throws(
    () => assertPlacementClass('media-final'),
    /Invalid placement class/
  )
})

test('lifecycle state validation rejects unknown states', () => {
  assert.equal(assertLifecycleState('accepted'), true)

  assert.throws(
    () => assertLifecycleState('approved'),
    /Invalid asset lifecycle state/
  )
})

test('asset lifecycle helper creates local-only lifecycle records', () => {
  const lifecycle = createAssetLifecycle({
    assetId: 'asset-test',
    projectId: 'project-test',
    state: 'accepted',
    refs: [],
    reason: 'test'
  })

  assert.equal(lifecycle.schema, 'media.asset_lifecycle.v1')
  assert.equal(lifecycle.localOnly, true)
  assert.equal(lifecycle.meshTruth, false)
  assert.equal(validateRequiredRecord(lifecycle), true)
})

test('validator rejects missing schema', async () => {
  const record = { packetId: 'packet-test' }

  assert.throws(
    () => validateRequiredRecord(record),
    /missing schema/
  )
})

test('validator rejects missing id for known record type', async () => {
  const dir = await createFixtureProject()
  const result = await runFirstWedge({ projectDir: dir })
  const record = { ...result.outputs.workPacket }
  delete record.packetId

  assert.throws(
    () => validateRequiredRecord(record),
    /missing required fields: packetId/
  )
})

test('validator rejects missing projectId where expected', async () => {
  const dir = await createFixtureProject()
  const result = await runFirstWedge({ projectDir: dir })
  const record = { ...result.outputs.assetDescriptor }
  delete record.projectId

  assert.throws(
    () => validateRequiredRecord(record),
    /missing required fields: projectId/
  )
})

test('validator rejects missing local-only doctrine flags', async () => {
  const dir = await createFixtureProject()
  const result = await runFirstWedge({ projectDir: dir })
  const record = { ...result.outputs.reviewEvidence }
  delete record.localOnly

  assert.throws(
    () => validateRequiredRecord(record),
    /localOnly=true/
  )
})

test('validator rejects invalid readiness state', async () => {
  const dir = await createFixtureProject()
  const result = await runFirstWedge({ projectDir: dir })
  const record = {
    ...result.outputs.readiness,
    state: 'approved'
  }

  assert.throws(
    () => validateRequiredRecord(record),
    /invalid readiness state/
  )
})

test('validator rejects invalid decision type', async () => {
  const dir = await createFixtureProject()
  const result = await runFirstWedge({ projectDir: dir })
  const record = {
    ...result.outputs.operatorDecision,
    decisionType: 'approve'
  }

  assert.throws(
    () => validateRequiredRecord(record),
    /invalid decision type/
  )
})
