import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { runFirstWedge } from '../src/local/run-first-wedge.js'
import { promoteCandidate } from '../src/local/promote-candidate.js'
import { readLocalImageMetadata } from '../src/assets/image-metadata.js'
import { ingestReferenceAsset } from '../src/assets/ingest-reference.js'
import { createByteDescriptorProposal, writeByteDescriptorProposals } from '../src/assets/byte-descriptor-proposal.js'
import { writeCandidateReview } from '../src/review/candidate-review.js'
import { createApprovalProposal, writeApprovalProposal } from '../src/review/approval-proposal.js'
import { writeOperatorDecisionRequest } from '../src/review/operator-decision-request.js'
import { validateRequiredRecord } from '../src/contracts/schemas.js'
import { executeProviderAdapter } from '../src/providers/adapter-runner.js'
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
import { inspectLocalRun } from '../src/seams/inspect-local-run.js'
import { exportInspectionBundle } from '../src/seams/export-inspection-bundle.js'
import { indexInspectionRecords } from '../src/seams/index-inspection-records.js'
import { indexProviderRuns } from '../src/seams/index-provider-runs.js'
import { inspectProviderFailure } from '../src/seams/inspect-provider-failure.js'
import { inspectVeniceSmoke } from '../src/seams/inspect-venice-smoke.js'
import { writeProjectStatus } from '../src/seams/project-status.js'
import { writeProjectHealth } from '../src/seams/project-health.js'
import { writeEdgeReadinessGuidance } from '../src/seams/edge-readiness-guidance.js'
import { writeControlSurfaceProjection } from '../src/seams/control-surface-projection.js'
import { writeEdgeCompatibilityBundle } from '../src/seams/edge-compatibility-bundle.js'
import { writeEdgeHandoffCandidate } from '../src/seams/edge-handoff-candidate.js'
import { writeOperatorPacketIndex } from '../src/seams/operator-packet-index.js'
import { writeCrossProjectOperatorIndex } from '../src/seams/cross-project-operator-index.js'
import { writeContinuityEvidence } from '../src/seams/continuity-evidence.js'
import { summarizeInspectionPacket } from '../src/seams/summarize-inspection-packet.js'
import { checkInspectionFixture } from '../src/local/generate-inspection-fixture.js'
import { checkUnhealthyFixtures } from '../src/local/generate-unhealthy-fixtures.js'
import {
  createLocalLayerResourceRefCandidate,
  writeLocalLayerResourceRefCandidates
} from '../src/local/resource-ref-candidates.js'
import {
  createProductionUnit,
  createSceneDescriptor,
  refForProductionRecord
} from '../src/production/strategy.js'
import { writeProductionRecordsFromCard } from '../src/production/create-production-records.js'
import { validateProductionRecordsInProject } from '../src/production/validate-production-records.js'

const onePixelPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

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

function slash(value) {
  return value.split(path.sep).join('/')
}

function createCrossProjectInputList(projects) {
  return {
    schema: 'media.cross_project_inspection_input_list.local.v1',
    inputListId: 'test-cross-project-input-list',
    createdAt: '2026-05-19T00:00:00.000Z',
    mode: 'standalone-local',
    projects: projects.map(({ projectId, rootPath }) => ({
      projectId,
      rootRef: {
        kind: 'local-directory',
        id: projectId,
        schema: 'media.local_ref.v1',
        path: rootPath,
        localOnly: true
      },
      artifactRefs: {
        projectHealth: {
          kind: 'media-project-health',
          id: 'project-health-project-test',
          schema: 'media.project_health.local.v1',
          path: 'records/manifests/media-project-health.local.json',
          localOnly: true
        },
        handoffCandidate: {
          kind: 'media-edge-handoff-candidate',
          id: 'edge-handoff-project-test',
          schema: 'media.edge_handoff_candidate.local.v1',
          path: 'records/exports/media-edge-handoff-candidate.local.json',
          localOnly: true
        },
        operatorDecisionRequest: {
          kind: 'media-operator-decision-request',
          id: 'operator-decision-request-project-test',
          schema: 'media.operator_decision_request.local.v1',
          path: 'records/requests/media-operator-decision-request.local.json',
          localOnly: true
        }
      }
    })),
    warnings: [
      'Test input list only.',
      'All referenced artifacts are local-only and not mesh truth.'
    ],
    operatorGuidanceOnly: true,
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    providerTruth: false,
    edgeRuntimeBuilt: false,
    edgeRuntimeVerified: false,
    localTruthLabel: 'local draft',
    truthStatus: 'not mesh truth; not distributed proof; not ratified shared state'
  }
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
  assert.equal(manifest.generatedRecordRefs[0].resolvabilityCategory, 'device_dependent_scaffold')
  assert.equal(manifest.candidateInputRef.resolvabilityCategory, 'device_dependent_scaffold')
  assert.equal(manifest.resolvabilityPosture.currentCategory, 'device_dependent_scaffold')
  assert.equal(manifest.resolvabilityPosture.targetCategory, 'local_layer_resource_ref')
  assert.equal(manifest.resolvabilityPosture.operatorFacingIdentityBoundary, false)
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

test('provider adapter runner wraps replaceable providers without provider truth', async () => {
  const generationRequest = {
    schema: 'media.generation_request.v1',
    requestId: 'request-runner-test',
    intentFamily: 'image-generation'
  }
  const result = await executeProviderAdapter({
    generationRequest,
    mode: 'dry-run',
    adapter: {
      adapterId: 'local-test-adapter',
      providerId: 'local-test-provider',
      endpointId: 'local.test.generate',
      supportedIntentFamilies: ['image-generation'],
      mapInput: (request) => ({ promptPresent: Boolean(request.requestId) }),
      async execute(providerInput) {
        return { providerInput, providerJobId: 'job-test' }
      },
      normalizeResult({ generationRequest: request, rawProviderOutput }) {
        return normalizeProviderResult({
          generationRequest: request,
          providerId: 'local-test-provider',
          providerJobRef: {
            kind: 'local-test-job',
            id: rawProviderOutput.providerJobId,
            localOnly: true
          },
          status: 'succeeded',
          outputRefs: []
        })
      }
    }
  })

  assert.equal(result.adapterRun.schema, 'media.provider_adapter_run.local.v1')
  assert.equal(result.adapterRun.providerTruth, false)
  assert.equal(result.adapterRun.mode, 'dry-run')
  assert.equal(validateRequiredRecord(result.adapterRun), true)
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
    'examples/provider-shapes/venice-provider-profile.json',
    'examples/provider-shapes/venice-failure-taxonomy.json',
    'examples/provider-shapes/venice-adapter-contract.json'
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
  assert.equal(dryRun.adapterRun.schema, 'media.provider_adapter_run.local.v1')
  assert.equal(dryRun.adapterRun.providerId, 'venice')
  assert.equal(validateRequiredRecord(dryRun.providerResult), true)
  assert.equal(validateRequiredRecord(dryRun.adapterRun), true)
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
            images: [onePixelPngBase64],
            request: { format: 'png' }
          }
        }
      }
    }
  })

  assert.equal(fetchCalled, true)
  assert.equal(result.live, true)
  assert.equal(result.providerResult.providerTruth, false)
  assert.equal(result.adapterRun.schema, 'media.provider_adapter_run.local.v1')
  assert.equal(result.adapterRun.providerTruth, false)
  assert.equal(result.generatedAssets.assets.length, 1)
  assert.equal(result.generatedAssets.assets[0].localRef.path, 'media/generated/provider-smoke/venice-live-smoke-0.png')
  assert.equal(result.generatedAssets.assets[0].imageMetadata.metadata.schema, 'media.image_metadata.local.v1')
  assert.equal(result.generatedAssets.assets[0].imageMetadata.metadata.width, 1)
  assert.equal(validateRequiredRecord(result.generatedAssets.assets[0].assetDescriptor), true)
  assert.equal(validateRequiredRecord(result.generatedAssets.assets[0].imageMetadata.metadata), true)
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
  assert.equal(written.generatedRecordRefs.length, 3)
  assert.equal(written.generatedAssets[0].localRef.path, 'media/generated/provider-smoke/venice-live-smoke-0.png')
  assert.equal(written.generatedAssets[0].imageMetadataRef.schema, 'media.image_metadata.local.v1')
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
  const imageMetadata = JSON.parse(
    await readFile(path.join(dir, 'records', 'assets', 'venice-live-smoke-image-metadata-0.local.json'), 'utf8')
  )
  assert.equal(assetRecord.schema, 'media.asset.descriptor.v1')
  assert.equal(assetRecord.source.apiCalled, true)
  assert.equal(assetRecord.localRef.placementClass, 'media-generated')
  assert.equal(assetRecord.meshTruth, false)
  assert.equal(imageMetadata.width, 1)
  assert.equal(validateRequiredRecord(imageMetadata), true)

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
  assert.ok(manifestRecord.artifactKinds.includes('media.image_metadata.local.v1'))
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
          images: [onePixelPngBase64],
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
  assert.equal(result.packet.recordRefs.imageMetadata.schema, 'media.image_metadata.local.v1')
  assert.equal(result.packet.generatedArtifactRefs[0].imageMetadataRef.path, 'records/assets/venice-live-smoke-image-metadata-0.local.json')
  assert.equal(validateRequiredRecord(result.packet), true)

  const written = JSON.parse(
    await readFile(path.join(dir, 'records', 'exports', 'venice-smoke-edge-inspection-packet.local.json'), 'utf8')
  )
  assert.equal(written.schema, 'media.edge_inspection_packet.local.v1')
  assert.equal(written.recordRefs.providerResult.path, 'records/provider-results/venice-live-smoke-provider-result.local.json')
})

test('generic local-run inspection packet exports first-wedge records', async () => {
  const dir = await createFixtureProject()
  await runFirstWedge({
    projectDir: dir,
    decision: 'accepted',
    operatorRef: 'operator-test'
  })

  const result = await inspectLocalRun({ projectDir: dir })

  assert.equal(result.packet.schema, 'media.edge_inspection_packet.local.v1')
  assert.equal(result.packet.recordRefs.assetDescriptor.path, 'records/assets/media-asset-descriptor.local.json')
  assert.equal(result.packet.generatedArtifactRefs[0].path, 'media/accepted/candidate.txt')
  assert.equal(result.packet.generatedArtifactRefs[0].byteRefPreview.schema, 'media.byte_reference.preview.local.v1')
  assert.equal(result.packet.generatedArtifactRefs[0].byteRefPreview.byteAvailabilityProof, false)
  assert.equal(result.packet.generatedArtifactRefs[0].byteRefPreview.byteDescriptorPreview.intendedSchema, 'media.byte_descriptor.v1')
  assert.equal(result.packet.generatedArtifactRefs[0].byteRefPreview.byteDescriptorPreview.materializationProof, false)
  assert.equal(validateRequiredRecord(result.packet.generatedArtifactRefs[0].byteRefPreview), true)
  assert.equal(validateRequiredRecord(result.packet), true)

  const written = JSON.parse(
    await readFile(path.join(dir, 'records', 'exports', 'local-run-edge-inspection-packet.local.json'), 'utf8')
  )
  assert.equal(written.schema, 'media.edge_inspection_packet.local.v1')
  assert.equal(written.materializationProof, false)
})

test('local inspection bundle copies packet records and artifacts without proof claims', async () => {
  const dir = await createFixtureProject()
  await runFirstWedge({ projectDir: dir })
  await inspectLocalRun({ projectDir: dir })

  const result = await exportInspectionBundle({
    projectDir: dir,
    packet: 'records/exports/local-run-edge-inspection-packet.local.json',
    outputDir: 'records/exports/bundles/test-bundle'
  })

  assert.equal(result.manifest.schema, 'media.edge_export_bundle.local.v1')
  assert.equal(result.manifest.meshTruth, false)
  assert.equal(result.manifest.materializationProof, false)
  assert.ok(result.manifest.includedRecordRefs.some((ref) => ref.sourcePath === 'records/assets/media-asset-descriptor.local.json'))
  assert.ok(result.manifest.includedArtifactRefs.some((ref) => ref.sourcePath === 'media/accepted/candidate.txt'))
  assert.equal(validateRequiredRecord(result.manifest), true)

  const copiedPacket = JSON.parse(
    await readFile(path.join(dir, 'records', 'exports', 'bundles', 'test-bundle', 'inspection-packet.local.json'), 'utf8')
  )
  assert.equal(copiedPacket.schema, 'media.edge_inspection_packet.local.v1')
})

test('inspection packet summary and index commands report local records', async () => {
  const dir = await createFixtureProject()
  await runFirstWedge({ projectDir: dir })
  await inspectLocalRun({ projectDir: dir })

  const summary = await summarizeInspectionPacket({
    projectDir: dir,
    packet: 'records/exports/local-run-edge-inspection-packet.local.json'
  })
  const index = await indexInspectionRecords({ projectDir: dir, json: false })

  assert.equal(summary.packet.schema, 'media.edge_inspection_packet.local.v1')
  assert.equal(summary.artifactRows.length, 1)
  assert.ok(summary.schemaRows.some(([schema, count]) => schema === 'media.asset.descriptor.v1' && count === '1'))
  assert.ok(summary.familyRows.some(([family, count]) => family === 'assets' && count === '1'))
  assert.equal(index.manifests.length, 1)
  assert.equal(index.providerResults.length, 1)
  assert.equal(index.inspectionPackets.length, 1)
})

test('provider run ledger indexes local provider attempts without truth claims', async () => {
  const dir = await createFixtureProject()
  await runFirstWedge({ projectDir: dir })

  const result = await indexProviderRuns({ projectDir: dir })

  assert.equal(result.ledger.schema, 'media.provider_run_ledger.local.v1')
  assert.equal(result.ledger.summary.total, 1)
  assert.equal(result.ledger.summary.byStatus.succeeded, 1)
  assert.equal(result.ledger.summary.byCard['card-test'], 1)
  assert.equal(result.ledger.runs[0].providerId, 'local-placeholder-provider')
  assert.equal(result.ledger.runs[0].cardId, 'card-test')
  assert.equal(result.ledger.runs[0].providerTruth, false)
  assert.equal(validateRequiredRecord(result.ledger), true)

  const written = JSON.parse(
    await readFile(path.join(dir, 'records', 'provider-results', 'media-provider-run-ledger.local.json'), 'utf8')
  )
  assert.equal(written.meshTruth, false)
  assert.equal(written.runs[0].providerResultRef.path, 'records/provider-results/media-provider-result.local.json')
})

test('reference ingest writes asset descriptor and local ingest receipt', async () => {
  const dir = await createFixtureProject()
  await writeFile(path.join(dir, 'media', 'generated', 'reference.txt'), 'reference bytes')

  const result = await ingestReferenceAsset({
    projectDir: dir,
    source: 'media/generated/reference.txt',
    filename: 'reference.txt',
    operatorRef: 'operator-test'
  })

  assert.equal(result.assetDescriptor.schema, 'media.asset.descriptor.v1')
  assert.equal(result.assetDescriptor.localRef.placementClass, 'media-reference')
  assert.equal(result.assetDescriptor.localRef.path, 'media/references/reference.txt')
  assert.equal(result.assetDescriptor.source.apiCalled, false)
  assert.equal(result.ingestRecord.schema, 'media.reference_ingest.local.v1')
  assert.equal(result.ingestRecord.providerTruth, false)
  assert.equal(result.ingestRecord.materializationProof, false)
  assert.equal(validateRequiredRecord(result.assetDescriptor), true)
  assert.equal(validateRequiredRecord(result.ingestRecord), true)

  const written = JSON.parse(
    await readFile(path.join(dir, result.ingestRecordRef), 'utf8')
  )
  assert.equal(written.assetRecordRef.path, result.assetRecordRef)
})

test('reference ingest blocks unsafe source refs', async () => {
  const dir = await createFixtureProject()

  await assert.rejects(
    () => ingestReferenceAsset({
      projectDir: dir,
      source: '../outside.png'
    }),
    /Local ref path/
  )
})

test('candidate review records local comparison without ratifier authority', async () => {
  const dir = await createFixtureProject()
  await runFirstWedge({ projectDir: dir })
  await writeFile(path.join(dir, 'media', 'generated', 'reference.txt'), 'reference bytes')
  const reference = await ingestReferenceAsset({
    projectDir: dir,
    source: 'media/generated/reference.txt',
    filename: 'reference.txt',
    operatorRef: 'operator-test'
  })

  const result = await writeCandidateReview({
    projectDir: dir,
    selectedAssetId: reference.assetDescriptor.assetId,
    operatorRef: 'operator-test'
  })

  assert.equal(result.review.schema, 'media.candidate_review.local.v1')
  assert.equal(result.review.candidateAssetRefs.length, 2)
  assert.equal(result.review.selectedAssetRef.id, reference.assetDescriptor.assetId)
  assert.equal(result.review.meshTruth, false)
  assert.equal(validateRequiredRecord(result.review), true)

  const written = JSON.parse(await readFile(path.join(dir, result.output), 'utf8'))
  assert.equal(written.operatorRef, 'operator-test')
})

test('approval proposal records local request without granting authority', async () => {
  const dir = await createFixtureProject()
  await runFirstWedge({
    projectDir: dir,
    decision: 'accepted',
    operatorRef: 'operator-test'
  })

  const { proposal, output } = await writeApprovalProposal({ projectDir: dir })

  assert.equal(proposal.schema, 'media.approval_proposal.local.v1')
  assert.equal(proposal.proposalType, 'acceptance-approval')
  assert.equal(proposal.proposedDecision, 'accept')
  assert.equal(proposal.authorityRequired, true)
  assert.equal(proposal.proposalOnly, true)
  assert.equal(proposal.approvalAuthority, false)
  assert.equal(proposal.ratifierAuthority, false)
  assert.equal(proposal.publicationAuthorization, false)
  assert.equal(validateRequiredRecord(proposal), true)

  const written = JSON.parse(await readFile(path.join(dir, output), 'utf8'))
  assert.equal(written.proposalId, proposal.proposalId)
})

test('approval proposal rejects authority claims', () => {
  const localDecision = {
    schema: 'media.operator_decision.v1',
    decisionId: 'decision-test',
    subjectRef: {
      kind: 'media-asset',
      id: 'asset-test',
      schema: 'media.asset.descriptor.v1'
    },
    decisionType: 'accept'
  }
  const proposal = createApprovalProposal({
    projectId: 'project-test',
    subjectRef: localDecision.subjectRef,
    localDecision,
    localDecisionPath: 'records/decisions/decision.local.json',
    evidenceRefs: [{
      kind: 'media-evidence',
      id: 'evidence-test',
      schema: 'media.evidence.v1'
    }]
  })

  proposal.ratifierAuthority = true

  assert.throws(
    () => validateRequiredRecord(proposal),
    /ratifierAuthority=false/
  )
})

test('byte descriptor proposal previews bytes without materialization proof', async () => {
  const dir = await createFixtureProject()
  const result = await runFirstWedge({
    projectDir: dir,
    decision: 'accepted',
    operatorRef: 'operator-test'
  })

  const { proposals } = await writeByteDescriptorProposals({ projectDir: dir })
  assert.equal(proposals.length, 1)
  const proposal = proposals[0].proposal
  assert.equal(proposal.schema, 'media.byte_descriptor_proposal.local.v1')
  assert.equal(proposal.sourceAssetRef.id, result.outputs.assetDescriptor.assetId)
  assert.equal(proposal.proposedByteDescriptor.intendedSchema, 'media.byte_descriptor.v1')
  assert.equal(proposal.byteAvailabilityProof, false)
  assert.equal(proposal.materializationProof, false)
  assert.equal(proposal.byteAuthority, false)
  assert.equal(validateRequiredRecord(proposal), true)
})

test('byte descriptor proposals dedupe duplicate asset descriptor records', async () => {
  const dir = await createFixtureProject()
  const result = await runFirstWedge({
    projectDir: dir,
    decision: 'accepted',
    operatorRef: 'operator-test'
  })
  const duplicateDir = path.join(dir, 'records', 'assets', 'duplicate')
  await mkdir(duplicateDir, { recursive: true })
  await writeFile(
    path.join(duplicateDir, 'media-asset-descriptor.local.json'),
    `${JSON.stringify(result.outputs.assetDescriptor, null, 2)}\n`
  )

  const { proposals } = await writeByteDescriptorProposals({ projectDir: dir })

  assert.equal(proposals.length, 1)
  assert.equal(proposals[0].proposal.sourceAssetRef.id, result.outputs.assetDescriptor.assetId)
})

test('byte descriptor proposal rejects byte proof claims', async () => {
  const dir = await createFixtureProject()
  const result = await runFirstWedge({
    projectDir: dir,
    decision: 'accepted',
    operatorRef: 'operator-test'
  })
  const proposal = createByteDescriptorProposal({
    assetDescriptor: result.outputs.assetDescriptor,
    assetRecordPath: 'records/assets/media-asset-descriptor.local.json'
  })

  proposal.byteAvailabilityProof = true

  assert.throws(
    () => validateRequiredRecord(proposal),
    /byteAvailabilityProof=false/
  )
})

test('resource ref candidate marks local asset refs as scaffold only', async () => {
  const dir = await createFixtureProject()
  const result = await runFirstWedge({
    projectDir: dir,
    decision: 'accepted',
    operatorRef: 'operator-test'
  })

  const { candidates } = await writeLocalLayerResourceRefCandidates({ projectDir: dir })
  assert.equal(candidates.length, 1)
  const candidate = candidates[0].candidate
  assert.equal(candidate.schema, 'media.local_layer_resource_ref_candidate.local.v1')
  assert.equal(candidate.sourceRef.id, result.outputs.assetDescriptor.assetId)
  assert.equal(candidate.currentRefCategory, 'device_dependent_scaffold')
  assert.equal(candidate.targetRefCategory, 'local_layer_resource_ref')
  assert.equal(candidate.localLayerResourceRef, false)
  assert.equal(candidate.replicatedPointerRef, false)
  assert.equal(candidate.causalReviewableRef, false)
  assert.equal(candidate.proposedResourceRef.candidateOnly, true)
  assert.equal(candidate.proposedResourceRef.promotionStatus, 'candidate-only')
  assert.equal(candidate.proposedResourceRef.promotionAuthority, false)
  assert.equal(candidate.promotionPosture.status, 'candidate-only')
  assert.equal(candidate.promotionPosture.admissionRequired, true)
  assert.equal(candidate.promotionPosture.promotionAuthority, false)
  assert.equal(candidate.byteDescriptorAlignment.status, 'missing-byte-descriptor-proposal')
  assert.equal(candidate.byteDescriptorAlignment.requiredBeforePromotion, true)
  assert.equal(candidate.resolvabilityPosture.operatorFacingIdentityBoundary, false)
  assert.equal(validateRequiredRecord(candidate), true)
})

test('resource ref candidate aligns with byte descriptor proposal when present', async () => {
  const dir = await createFixtureProject()
  const result = await runFirstWedge({
    projectDir: dir,
    decision: 'accepted',
    operatorRef: 'operator-test'
  })

  await writeByteDescriptorProposals({ projectDir: dir })
  const { candidates } = await writeLocalLayerResourceRefCandidates({ projectDir: dir })
  const candidate = candidates[0].candidate

  assert.equal(candidate.sourceRef.id, result.outputs.assetDescriptor.assetId)
  assert.equal(candidate.byteDescriptorAlignment.status, 'aligned')
  assert.equal(candidate.byteDescriptorAlignment.byteDescriptorProposalRef.schema, 'media.byte_descriptor_proposal.local.v1')
  assert.equal(candidate.proposedResourceRef.byteDescriptorProposalRef.id, `byte-descriptor-proposal-${result.outputs.assetDescriptor.assetId}`)
  assert.equal(validateRequiredRecord(candidate), true)
})

test('resource ref candidate rejects promoted-resource claims', async () => {
  const dir = await createFixtureProject()
  const result = await runFirstWedge({
    projectDir: dir,
    decision: 'accepted',
    operatorRef: 'operator-test'
  })
  const candidate = createLocalLayerResourceRefCandidate({
    assetDescriptor: result.outputs.assetDescriptor,
    assetRecordPath: 'records/assets/media-asset-descriptor.local.json'
  })

  candidate.localLayerResourceRef = true

  assert.throws(
    () => validateRequiredRecord(candidate),
    /localLayerResourceRef=false/
  )

  const proposedClaim = structuredClone(candidate)
  proposedClaim.localLayerResourceRef = false
  proposedClaim.proposedResourceRef.candidateOnly = false

  assert.throws(
    () => validateRequiredRecord(proposedClaim),
    /candidateOnly=true/
  )

  const postureClaim = structuredClone(candidate)
  postureClaim.localLayerResourceRef = false
  postureClaim.promotionPosture.status = 'promoted'

  assert.throws(
    () => validateRequiredRecord(postureClaim),
    /status=candidate-only/
  )
})

test('edge readiness guidance flags unresolved resource prerequisites', async () => {
  const dir = await createFixtureProject()
  await runFirstWedge({
    projectDir: dir,
    decision: 'accepted',
    operatorRef: 'operator-test'
  })
  await writeLocalLayerResourceRefCandidates({ projectDir: dir })

  const result = await writeEdgeReadinessGuidance({ projectDir: dir })

  assert.equal(result.readiness.schema, 'media.readiness.v1')
  assert.equal(result.readiness.state, 'caution')
  assert.equal(result.readiness.resolvabilitySummary.missingByteDescriptorProposalAssetIds.length, 1)
  assert.equal(result.readiness.resolvabilitySummary.unresolvedResourceCandidateIds.length, 1)
  assert.equal(result.readiness.edgeInspectionGuidance.edgeRequired, false)
  assert.equal(validateRequiredRecord(result.readiness), true)
})

test('edge readiness guidance is ready when byte proposals and resource refs align', async () => {
  const dir = await createFixtureProject()
  await runFirstWedge({
    projectDir: dir,
    decision: 'accepted',
    operatorRef: 'operator-test'
  })
  await writeByteDescriptorProposals({ projectDir: dir })
  await writeLocalLayerResourceRefCandidates({ projectDir: dir })

  const result = await writeEdgeReadinessGuidance({ projectDir: dir })

  assert.equal(result.readiness.state, 'ready')
  assert.equal(result.readiness.resolvabilitySummary.missingByteDescriptorProposalAssetIds.length, 0)
  assert.equal(result.readiness.resolvabilitySummary.unresolvedResourceCandidateIds.length, 0)
  assert.equal(validateRequiredRecord(result.readiness), true)
})

test('continuity evidence drafts local lineage without causal truth claims', async () => {
  const dir = await createFixtureProject()
  await runFirstWedge({ projectDir: dir })

  const result = await writeContinuityEvidence({ projectDir: dir })

  assert.equal(result.continuity.schema, 'media.continuity_evidence.local.v1')
  assert.equal(result.continuity.causalTruth, false)
  assert.equal(result.continuity.parentRefs.some((ref) => ref.kind === 'media-card'), true)
  assert.equal(validateRequiredRecord(result.continuity), true)
})

test('local inspection packet includes candidate review and continuity evidence when present', async () => {
  const dir = await createFixtureProject()
  await runFirstWedge({ projectDir: dir })
  await writeCandidateReview({ projectDir: dir })
  await writeContinuityEvidence({ projectDir: dir })

  const result = await inspectLocalRun({ projectDir: dir })
  const schemas = Object.values(result.packet.recordRefs).map((ref) => ref.schema)

  assert.ok(schemas.includes('media.candidate_review.local.v1'))
  assert.ok(schemas.includes('media.continuity_evidence.local.v1'))
  assert.ok(result.packet.artifactKinds.includes('media.candidate_review.local.v1'))
  assert.ok(result.packet.artifactKinds.includes('media.continuity_evidence.local.v1'))
})

test('project status summarizes local records without truth claims', async () => {
  const dir = await createFixtureProject()
  await runFirstWedge({ projectDir: dir })
  await inspectLocalRun({ projectDir: dir })
  await indexProviderRuns({ projectDir: dir })
  await writeCandidateReview({ projectDir: dir })
  await writeApprovalProposal({ projectDir: dir })
  await writeByteDescriptorProposals({ projectDir: dir })
  await writeLocalLayerResourceRefCandidates({ projectDir: dir })

  const productionDir = path.join(dir, 'records', 'production')
  await mkdir(productionDir, { recursive: true })
  const sceneUnit = createProductionUnit({
    projectId: 'project-test',
    unitKind: 'scene',
    title: 'Status scene unit',
    purpose: 'Project status production count fixture.'
  })
  const sceneDescriptor = createSceneDescriptor({
    projectId: 'project-test',
    productionUnitRef: refForProductionRecord(sceneUnit),
    title: 'Status scene descriptor'
  })
  await writeFile(path.join(productionDir, 'scene-unit.local.json'), `${JSON.stringify(sceneUnit, null, 2)}\n`)
  await writeFile(path.join(productionDir, 'scene-descriptor.local.json'), `${JSON.stringify(sceneDescriptor, null, 2)}\n`)

  const result = await writeProjectStatus({ projectDir: dir })

  assert.equal(result.status.schema, 'media.project_status.local.v1')
  assert.equal(result.status.counts.cards, 1)
  assert.equal(result.status.counts.providerResults, 1)
  assert.equal(result.status.counts.assets, 1)
  assert.equal(result.status.counts.candidateReviews, 1)
  assert.equal(result.status.counts.productionUnits, 1)
  assert.equal(result.status.counts.productionDescriptors, 1)
  assert.equal(result.status.counts.approvalProposals, 1)
  assert.equal(result.status.counts.byteDescriptorProposals, 1)
  assert.equal(result.status.counts.resourceRefCandidates, 1)
  assert.equal(result.status.assetResourceConsistency.readyForEdgeInspection, true)
  assert.equal(result.status.assetResourceConsistency.warningCount, 0)
  assert.equal(result.status.assetResourceConsistency.alignedResourceCandidateIds.length, 1)
  assert.equal(result.status.meshTruth, false)
  assert.equal(result.status.providerTruth, false)
  assert.equal(validateRequiredRecord(result.status), true)
})

test('project status flags unresolved byte and resource coverage', async () => {
  const dir = await createFixtureProject()
  await runFirstWedge({
    projectDir: dir,
    decision: 'accepted',
    operatorRef: 'operator-test'
  })

  const result = await writeProjectStatus({ projectDir: dir })

  assert.equal(result.status.assetResourceConsistency.readyForEdgeInspection, false)
  assert.equal(result.status.assetResourceConsistency.warningCount, 2)
  assert.equal(result.status.assetResourceConsistency.missingByteDescriptorProposalAssetIds.length, 1)
  assert.equal(result.status.assetResourceConsistency.missingResourceRefCandidateAssetIds.length, 1)
  assert.ok(result.status.warnings.some((warning) => warning.includes('missing byte proposals')))
  assert.equal(validateRequiredRecord(result.status), true)
})

test('project status and readiness flag stale byte proposals and resource candidates', async () => {
  const dir = await createFixtureProject()
  await runFirstWedge({
    projectDir: dir,
    decision: 'accepted',
    operatorRef: 'operator-test'
  })
  await writeByteDescriptorProposals({ projectDir: dir })
  await writeLocalLayerResourceRefCandidates({ projectDir: dir })
  const assetPath = path.join(dir, 'records', 'assets', 'media-asset-descriptor.local.json')
  const asset = JSON.parse(await readFile(assetPath, 'utf8'))
  asset.localRef = {
    ...asset.localRef,
    path: 'media/accepted/renamed-candidate.txt'
  }
  await writeFile(assetPath, `${JSON.stringify(asset, null, 2)}\n`)

  const status = await writeProjectStatus({ projectDir: dir })
  const readiness = await writeEdgeReadinessGuidance({ projectDir: dir })

  assert.equal(status.status.assetResourceConsistency.readyForEdgeInspection, false)
  assert.equal(status.status.assetResourceConsistency.staleByteDescriptorProposalIds.length, 1)
  assert.equal(status.status.assetResourceConsistency.staleResourceCandidateIds.length, 1)
  assert.equal(readiness.readiness.state, 'caution')
  assert.equal(readiness.readiness.resolvabilitySummary.staleByteDescriptorProposalIds.length, 1)
  assert.equal(readiness.readiness.resolvabilitySummary.staleResourceCandidateIds.length, 1)
})

test('project health combines status readiness and production validation', async () => {
  const dir = await createFixtureProject()
  await runFirstWedge({
    projectDir: dir,
    decision: 'accepted',
    operatorRef: 'operator-test'
  })
  await writeByteDescriptorProposals({ projectDir: dir })
  await writeLocalLayerResourceRefCandidates({ projectDir: dir })
  await writeProductionRecordsFromCard({ projectDir: dir })

  const result = await writeProjectHealth({ projectDir: dir })

  assert.equal(result.health.schema, 'media.project_health.local.v1')
  assert.equal(result.health.healthState, 'ready-for-local-inspection')
  assert.equal(result.health.assetResourceConsistency.readyForEdgeInspection, true)
  assert.equal(result.health.productionValidation.valid, true)
  assert.equal(result.health.meshTruth, false)
  assert.equal(result.health.edgeRuntimeVerified, false)
  assert.equal(validateRequiredRecord(result.health), true)
})

test('inspection summary and Edge bundle include project health records', async () => {
  const dir = await createFixtureProject()
  await runFirstWedge({
    projectDir: dir,
    decision: 'accepted',
    operatorRef: 'operator-test'
  })
  await writeByteDescriptorProposals({ projectDir: dir })
  await writeLocalLayerResourceRefCandidates({ projectDir: dir })
  await writeProductionRecordsFromCard({ projectDir: dir })
  await writeProjectHealth({ projectDir: dir, summary: true })
  await inspectLocalRun({ projectDir: dir })

  const summary = await summarizeInspectionPacket({
    projectDir: dir,
    packet: 'records/exports/local-run-edge-inspection-packet.local.json'
  })

  assert.ok(summary.healthRows.some((row) => row[1] === 'ready-for-local-inspection' && row[3] === 'true'))

  await writeControlSurfaceProjection({ projectDir: dir })
  const { bundle } = await writeEdgeCompatibilityBundle({ projectDir: dir })
  assert.ok(bundle.studioSourceRefs.some((ref) => ref.schema === 'media.project_health.local.v1'))
  assert.equal(validateRequiredRecord(bundle), true)
})

test('operator packet index and Edge handoff candidate stay local-only', async () => {
  const dir = await createFixtureProject()
  await runFirstWedge({
    projectDir: dir,
    decision: 'accepted',
    operatorRef: 'operator-test'
  })
  await writeByteDescriptorProposals({ projectDir: dir })
  await writeLocalLayerResourceRefCandidates({ projectDir: dir })
  await writeProductionRecordsFromCard({ projectDir: dir })
  await writeProjectHealth({ projectDir: dir, summary: true })
  await inspectLocalRun({ projectDir: dir })
  await writeControlSurfaceProjection({ projectDir: dir })
  await writeEdgeCompatibilityBundle({ projectDir: dir })

  const firstIndex = await writeOperatorPacketIndex({ projectDir: dir })
  const handoffResult = await writeEdgeHandoffCandidate({ projectDir: dir })
  const requestResult = await writeOperatorDecisionRequest({ projectDir: dir })
  const secondIndex = await writeOperatorPacketIndex({ projectDir: dir })
  await inspectLocalRun({ projectDir: dir })
  const summary = await summarizeInspectionPacket({
    projectDir: dir,
    packet: 'records/exports/local-run-edge-inspection-packet.local.json'
  })

  assert.equal(firstIndex.index.schema, 'media.operator_packet_index.local.v1')
  assert.equal(firstIndex.index.packetRefs.length, 1)
  assert.ok(firstIndex.index.bundleRefs.some((ref) => ref.schema === 'media.edge_compatibility_bundle.local.v1'))
  assert.equal(firstIndex.index.meshTruth, false)
  assert.equal(validateRequiredRecord(firstIndex.index), true)

  assert.equal(handoffResult.handoff.schema, 'media.edge_handoff_candidate.local.v1')
  assert.equal(handoffResult.handoff.handoffState, 'ready-for-edge-inspection')
  assert.equal(handoffResult.handoff.readinessDiagnosis.readyForEdgeInspection, true)
  assert.equal(handoffResult.handoff.readinessDiagnosis.productionFreshness.fresh, true)
  assert.equal(handoffResult.handoff.targetSurface, 'media-edge-operator-seam')
  assert.equal(handoffResult.handoff.edgeRuntimeBuilt, false)
  assert.equal(handoffResult.handoff.edgeRuntimeVerified, false)
  assert.equal(handoffResult.handoff.providerTruth, false)
  assert.equal(validateRequiredRecord(handoffResult.handoff), true)

  assert.equal(requestResult.request.schema, 'media.operator_decision_request.local.v1')
  assert.equal(requestResult.request.requestKind, 'review-ready-handoff')
  assert.equal(requestResult.request.requestOnly, true)
  assert.equal(requestResult.request.edgeRuntimeBuilt, false)
  assert.equal(requestResult.request.approvalAuthority, false)
  assert.equal(validateRequiredRecord(requestResult.request), true)

  assert.equal(secondIndex.index.handoffCandidateRefs.length, 1)
  assert.equal(secondIndex.index.operatorDecisionRequestRefs.length, 1)
  assert.equal(secondIndex.index.summary.operatorDecisionRequests, 1)
  assert.ok(summary.familyRows.some((row) => row[0] === 'handoff' && Number(row[1]) >= 2))
  assert.ok(summary.familyRows.some((row) => row[0] === 'requests' && Number(row[1]) === 1))
})

test('Edge handoff diagnosis explains stale production descriptors', async () => {
  const dir = await createFixtureProject()
  await runFirstWedge({
    projectDir: dir,
    decision: 'accepted',
    operatorRef: 'operator-test'
  })
  await writeByteDescriptorProposals({ projectDir: dir })
  await writeLocalLayerResourceRefCandidates({ projectDir: dir })
  await writeProductionRecordsFromCard({ projectDir: dir })
  const sceneUnitPath = path.join(dir, 'records', 'production', 'sceneUnit.local.json')
  const sceneUnit = JSON.parse(await readFile(sceneUnitPath, 'utf8'))
  sceneUnit.createdAt = '2099-01-01T00:00:00.000Z'
  await writeFile(sceneUnitPath, `${JSON.stringify(sceneUnit, null, 2)}\n`)

  const healthResult = await writeProjectHealth({ projectDir: dir, summary: true })
  await inspectLocalRun({ projectDir: dir })
  await writeControlSurfaceProjection({ projectDir: dir })
  await writeEdgeCompatibilityBundle({ projectDir: dir })
  await writeOperatorPacketIndex({ projectDir: dir })
  const handoffResult = await writeEdgeHandoffCandidate({ projectDir: dir })
  const requestResult = await writeOperatorDecisionRequest({ projectDir: dir })

  assert.equal(healthResult.health.healthState, 'needs-local-attention')
  assert.ok(healthResult.health.blockingIssues.includes('production-freshness-stale'))
  assert.equal(handoffResult.handoff.handoffState, 'needs-local-attention')
  assert.equal(handoffResult.handoff.readinessDiagnosis.readyForEdgeInspection, false)
  assert.equal(handoffResult.handoff.readinessDiagnosis.productionFreshness.fresh, false)
  assert.ok(handoffResult.handoff.readinessDiagnosis.reasons.some((reason) => reason.includes('production descriptors are stale')))
  assert.ok(handoffResult.handoff.readinessDiagnosis.nextActions.some((action) => action.includes('Regenerate or update production descriptors')))
  assert.equal(validateRequiredRecord(handoffResult.handoff), true)
  assert.equal(requestResult.request.requestKind, 'resolve-local-attention')
  assert.ok(requestResult.request.requestedDecisionTypes.includes('resolve_blockers'))
  assert.ok(requestResult.request.nextActions.some((action) => action.includes('Regenerate or update production descriptors')))
  assert.equal(validateRequiredRecord(requestResult.request), true)
})

test('promote candidate copies placement and records local decision without provider work', async () => {
  const dir = await createFixtureProject()
  await runFirstWedge({ projectDir: dir })

  const result = await promoteCandidate({
    projectDir: dir,
    decision: 'rejected',
    operatorRef: 'operator-test'
  })

  assert.equal(result.assetDescriptor.localRef.path, 'media/rejected/candidate.txt')
  assert.equal(result.assetDescriptor.source.apiCalled, false)
  assert.equal(result.review.operatorDecision.decisionType, 'reject')
  assert.equal(result.exportRecord.packet.schema, 'media.edge_inspection_packet.local.v1')
  assert.equal(result.exportRecord.packet.generatedArtifactRefs[0].byteRefPreview.schema, 'media.byte_reference.preview.local.v1')
  assert.equal(validateRequiredRecord(result.assetDescriptor), true)
  assert.equal(validateRequiredRecord(result.exportRecord.packet), true)

  const decision = JSON.parse(
    await readFile(path.join(dir, 'records', 'decisions', 'promoted-candidate-rejected-decision.local.json'), 'utf8')
  )
  assert.equal(decision.localDecisionOnly, true)
  assert.equal(decision.decisionType, 'reject')
})

test('local image metadata probes PNG dimensions without byte proof claims', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-image-metadata-'))
  await mkdir(path.join(dir, 'media', 'generated'), { recursive: true })
  await writeFile(
    path.join(dir, 'media', 'generated', 'pixel.png'),
    Buffer.from(onePixelPngBase64, 'base64')
  )
  const assetDescriptor = {
    schema: 'media.asset.descriptor.v1',
    assetId: 'asset-pixel',
    contentType: 'image/png',
    localRef: {
      path: 'media/generated/pixel.png',
      placementClass: 'media-generated'
    }
  }
  const metadata = await readLocalImageMetadata({ projectDir: dir, assetDescriptor })

  assert.equal(metadata.schema, 'media.image_metadata.local.v1')
  assert.equal(metadata.width, 1)
  assert.equal(metadata.height, 1)
  assert.equal(metadata.meshTruth, false)
  assert.equal(validateRequiredRecord(metadata), true)
})

test('committed local-run inspection fixture validates', async () => {
  const packet = JSON.parse(
    await readFile('examples/inspection-fixtures/card-to-candidate/inspection-packets/local-run-edge-inspection-packet.local.json', 'utf8')
  )

  assert.equal(packet.schema, 'media.edge_inspection_packet.local.v1')
  assert.equal(packet.recordRefs.assetDescriptor.path, 'records/assets/media-asset-descriptor.local.json')
  assert.equal(packet.generatedArtifactRefs[0].byteRefPreview.schema, 'media.byte_reference.preview.local.v1')
  assert.equal(packet.generatedArtifactRefs[0].byteRefPreview.materializationProof, false)
  assert.equal(packet.generatedArtifactRefs[0].byteRefPreview.byteDescriptorPreview.intendedSchema, 'media.byte_descriptor.v1')
  assert.ok(Object.values(packet.recordRefs).some((ref) => ref.schema === 'media.candidate_review.local.v1'))
  assert.ok(Object.values(packet.recordRefs).some((ref) => ref.schema === 'media.continuity_evidence.local.v1'))
  assert.equal(validateRequiredRecord(packet), true)

  const bundleManifest = JSON.parse(
    await readFile('examples/inspection-fixtures/card-to-candidate/inspection-bundle/local-run/bundle-manifest.local.json', 'utf8')
  )
  assert.equal(bundleManifest.schema, 'media.edge_export_bundle.local.v1')
  assert.equal(bundleManifest.materializationProof, false)
  assert.equal(validateRequiredRecord(bundleManifest), true)
})

test('committed local-run inspection fixture shape check passes', async () => {
  await checkInspectionFixture({
    projectDir: 'examples/inspection-fixtures/card-to-candidate'
  })
})

test('committed unhealthy inspection fixtures validate', async () => {
  for (const caseName of ['missing-byte-proposal', 'stale-resource-ref', 'stale-production-descriptor']) {
    const root = path.join('examples', 'inspection-fixtures', 'unhealthy', caseName)
    const health = JSON.parse(await readFile(path.join(root, 'media-project-health.local.json'), 'utf8'))
    const handoff = JSON.parse(await readFile(path.join(root, 'media-edge-handoff-candidate.local.json'), 'utf8'))
    const request = JSON.parse(await readFile(path.join(root, 'media-operator-decision-request.local.json'), 'utf8'))
    const summary = JSON.parse(await readFile(path.join(root, 'summary.local.json'), 'utf8'))

    assert.equal(health.healthState, 'needs-local-attention')
    assert.equal(handoff.handoffState, 'needs-local-attention')
    assert.equal(request.requestKind, 'resolve-local-attention')
    assert.equal(summary.meshTruth, false)
    assert.equal(validateRequiredRecord(health), true)
    assert.equal(validateRequiredRecord(handoff), true)
    assert.equal(validateRequiredRecord(request), true)
  }
})

test('committed unhealthy inspection fixture shape check passes', async () => {
  await checkUnhealthyFixtures({
    projectDir: 'examples/inspection-fixtures/unhealthy'
  })
})

test('cross-project operator index summarizes explicit local project inputs', async () => {
  const readyDir = await createFixtureProject()
  await runFirstWedge({ projectDir: readyDir })
  await writeByteDescriptorProposals({ projectDir: readyDir })
  await writeLocalLayerResourceRefCandidates({ projectDir: readyDir })
  await writeEdgeReadinessGuidance({ projectDir: readyDir })
  await inspectLocalRun({ projectDir: readyDir })
  await writeProjectStatus({ projectDir: readyDir })
  await writeProductionRecordsFromCard({ projectDir: readyDir })
  await writeProjectHealth({ projectDir: readyDir })
  await writeControlSurfaceProjection({ projectDir: readyDir })
  await writeEdgeCompatibilityBundle({ projectDir: readyDir })
  await writeOperatorPacketIndex({ projectDir: readyDir })
  await writeEdgeHandoffCandidate({ projectDir: readyDir })
  await writeOperatorDecisionRequest({ projectDir: readyDir })

  const blockedDir = await createFixtureProject()
  await runFirstWedge({ projectDir: blockedDir })
  await writeEdgeReadinessGuidance({ projectDir: blockedDir })
  await inspectLocalRun({ projectDir: blockedDir })
  await writeProjectStatus({ projectDir: blockedDir })
  await writeProjectHealth({ projectDir: blockedDir })
  await writeControlSurfaceProjection({ projectDir: blockedDir })
  await writeEdgeCompatibilityBundle({ projectDir: blockedDir })
  await writeOperatorPacketIndex({ projectDir: blockedDir })
  await writeEdgeHandoffCandidate({ projectDir: blockedDir })
  await writeOperatorDecisionRequest({ projectDir: blockedDir })

  const baseDir = '/'
  const indexRoot = await mkdtemp(path.join(os.tmpdir(), 'media-studio-cross-project-index-'))
  const inputListPath = path.join(indexRoot, 'input-list.local.json')
  const outputPath = path.join(indexRoot, 'cross-project-index.local.json')
  const inputList = createCrossProjectInputList([
    { projectId: 'ready-project', rootPath: slash(path.relative(baseDir, readyDir)) },
    { projectId: 'blocked-project', rootPath: slash(path.relative(baseDir, blockedDir)) }
  ])
  await writeFile(inputListPath, `${JSON.stringify(inputList, null, 2)}\n`)

  const result = await writeCrossProjectOperatorIndex({
    baseDir,
    inputList: slash(path.relative(baseDir, inputListPath)),
    output: slash(path.relative(baseDir, outputPath))
  })

  assert.equal(result.index.schema, 'media.cross_project_operator_index.local.v1')
  assert.equal(result.index.summary.projects, 2)
  assert.equal(result.index.summary.readyForEdgeInspection, 1)
  assert.equal(result.index.summary.needsLocalAttention, 1)
  assert.equal(result.index.meshTruth, false)
  assert.equal(result.index.edgeRuntimeVerified, false)
  assert.equal(validateRequiredRecord(inputList), true)
  assert.equal(validateRequiredRecord(result.index), true)
})

test('cross-project input list rejects unsafe project refs', () => {
  const inputList = createCrossProjectInputList([
    { projectId: 'unsafe-project', rootPath: '../outside' }
  ])

  assert.throws(
    () => validateRequiredRecord(inputList),
    /Local ref path/
  )
})

test('committed cross-project inspection fixture validates', async () => {
  const inputList = JSON.parse(
    await readFile('examples/inspection-fixtures/cross-project/input-list.local.json', 'utf8')
  )
  const index = JSON.parse(
    await readFile('examples/inspection-fixtures/cross-project/media-cross-project-operator-index.local.json', 'utf8')
  )

  assert.equal(validateRequiredRecord(inputList), true)
  assert.equal(validateRequiredRecord(index), true)
  assert.equal(index.summary.projects, 3)
  assert.equal(index.summary.needsLocalAttention, 3)
  assert.equal(index.meshTruth, false)
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

test('provider failure inspection packet exports failed provider posture', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-provider-failure-inspect-'))
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

  const result = await inspectProviderFailure({ projectDir: dir })

  assert.equal(result.packet.schema, 'media.edge_inspection_packet.local.v1')
  assert.equal(result.packet.generatedArtifactRefs.length, 0)
  assert.equal(result.packet.recordRefs.providerResult.path, 'records/provider-results/venice-live-smoke-provider-result.local.json')
  assert.equal(result.packet.recordRefs.failureEvidence.path, 'records/evidence/venice-live-smoke-provider-failure-evidence.local.json')
  assert.equal(validateRequiredRecord(result.packet), true)

  const written = JSON.parse(
    await readFile(path.join(dir, 'records', 'exports', 'provider-failure-edge-inspection-packet.local.json'), 'utf8')
  )
  assert.equal(written.providerTruth, false)
  assert.equal(written.generatedArtifactRefs.length, 0)
  assert.equal(written.recordRefs.adapterRun.schema, 'media.provider_adapter_run.local.v1')
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
  assert.equal(written.providerResult.failure.failureKind, 'auth-failure')
  assert.deepEqual(written.generatedAssets, [])
  assert.deepEqual(written.reviewRecords, [])
  assert.equal(written.failureEvidenceRef.schema, 'media.evidence.v1')
  assert.equal(written.manifestRef, undefined)

  const adapterRun = JSON.parse(
    await readFile(path.join(dir, 'records', 'provider-results', 'venice-live-smoke-adapter-run.local.json'), 'utf8')
  )
  const failureEvidence = JSON.parse(
    await readFile(path.join(dir, 'records', 'evidence', 'venice-live-smoke-provider-failure-evidence.local.json'), 'utf8')
  )
  assert.equal(adapterRun.failureEvidenceRefs.length, 1)
  assert.equal(adapterRun.providerTruth, false)
  assert.equal(failureEvidence.evidenceKind, 'provider-failure-classification')
  assert.equal(failureEvidence.source.classification.failureKind, 'auth-failure')
  assert.equal(validateRequiredRecord(adapterRun), true)
  assert.equal(validateRequiredRecord(failureEvidence), true)
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

test('control surface projection maps Packs planes without UI contract', async () => {
  const dir = await createFixtureProject()
  await runFirstWedge({
    projectDir: dir,
    decision: 'accepted',
    operatorRef: 'operator-test'
  })
  await writeCandidateReview({ projectDir: dir, operatorRef: 'operator-test' })
  await writeContinuityEvidence({ projectDir: dir })
  await inspectLocalRun({ projectDir: dir })
  await indexProviderRuns({ projectDir: dir })
  await writeProjectStatus({ projectDir: dir })

  const { projection, output } = await writeControlSurfaceProjection({ projectDir: dir })

  assert.equal(projection.schema, 'media.control_surface_projection.local.v1')
  assert.equal(projection.mode, 'standalone-local')
  assert.equal(projection.posture.controlPlaneOwner, 'mesh-ecology-packs')
  assert.equal(projection.posture.authorityPosture, 'observer')
  assert.equal(projection.posture.readonlyFirst, true)
  assert.equal(projection.authoritySurface, false)
  assert.equal(projection.rendererContract, false)
  assert.deepEqual(projection.planes.map((entry) => entry.plane), ['presentation', 'operational', 'authoring'])
  assert.ok(projection.actions.some((entry) => entry.actionId === 'review-candidates'))
  assert.ok(projection.observationRefs.inspectionPacket)
  assert.ok(projection.observationRefs.projectStatus)
  assert.ok(projection.observationRefs.providerRunLedger)
  assert.ok(projection.observationRefs.candidateReviews.length > 0)
  assert.ok(projection.observationRefs.continuityEvidence.length > 0)
  assert.equal(validateRequiredRecord(projection), true)

  const written = JSON.parse(await readFile(path.join(dir, output), 'utf8'))
  assert.equal(written.projectionId, projection.projectionId)
})

test('edge compatibility bundle targets Edge review shapes without runtime claims', async () => {
  const dir = await createFixtureProject()
  await runFirstWedge({
    projectDir: dir,
    decision: 'accepted',
    operatorRef: 'operator-test'
  })
  await inspectLocalRun({ projectDir: dir })
  await writeProjectStatus({ projectDir: dir })
  await writeEdgeReadinessGuidance({ projectDir: dir })
  await writeControlSurfaceProjection({ projectDir: dir })

  const { bundle, output } = await writeEdgeCompatibilityBundle({ projectDir: dir })

  assert.equal(bundle.schema, 'media.edge_compatibility_bundle.local.v1')
  assert.equal(bundle.targetSurface, 'media-edge-operator-seam')
  assert.equal(bundle.edgeRuntimeBuilt, false)
  assert.equal(bundle.edgeRuntimeVerified, false)
  assert.equal(bundle.studioReviewEvidence.schema, 'media.edge_review_evidence.local.v1')
  assert.equal(bundle.studioReviewEvidence.edgeImportClassification.edgeOwnsSchema, false)
  assert.equal(bundle.edgeWorkPacketCandidate.edgeArtifactKind, 'edge_cross_project_work_packet')
  assert.equal(bundle.edgeWorkPacketCandidate.edgeSchemaVersion, 'edge_cross_project_work_packet.v1')
  assert.equal(bundle.edgeWorkPacketCandidate.packetState, 'ready_for_operator_export')
  assert.equal(bundle.edgeEvidenceImportCandidate.edgeArtifactKind, 'edge_cross_project_evidence_import')
  assert.equal(bundle.edgeEvidenceImportCandidate.edgeReadinessEffect, 'ready_for_operator_review')
  assert.equal(bundle.edgeReadinessViewCandidate.edgeArtifactKind, 'edge_cross_project_readiness_view')
  assert.equal(bundle.readinessResourceSummary.assetResourceReady, false)
  assert.equal(bundle.readinessResourceSummary.operatorGuidanceOnly, true)
  assert.equal(bundle.studioReviewEvidence.readinessResourceSummary.edgeRuntimeVerified, false)
  assert.equal(bundle.edgeReturnSurfaceCandidate.edgeArtifactKind, 'edge_operator_return_surface')
  assert.ok(bundle.edgeShapeTargets.some((target) => target.edgeArtifactKind === 'edge_operator_decision'))
  assert.equal(validateRequiredRecord(bundle.studioReviewEvidence), true)
  assert.equal(validateRequiredRecord(bundle), true)

  const written = JSON.parse(await readFile(path.join(dir, output), 'utf8'))
  assert.equal(written.compatibilityBundleId, bundle.compatibilityBundleId)
})

test('edge compatibility bundle includes aligned readiness resource summary', async () => {
  const dir = await createFixtureProject()
  await runFirstWedge({
    projectDir: dir,
    decision: 'accepted',
    operatorRef: 'operator-test'
  })
  await writeByteDescriptorProposals({ projectDir: dir })
  await writeLocalLayerResourceRefCandidates({ projectDir: dir })
  await writeEdgeReadinessGuidance({ projectDir: dir })
  await inspectLocalRun({ projectDir: dir })
  await writeProjectStatus({ projectDir: dir })
  await writeControlSurfaceProjection({ projectDir: dir })

  const { bundle } = await writeEdgeCompatibilityBundle({ projectDir: dir })

  assert.equal(bundle.readinessResourceSummary.assetResourceReady, true)
  assert.equal(bundle.readinessResourceSummary.edgeReadinessState, 'ready')
  assert.equal(bundle.edgeReadinessViewCandidate.readinessSummary.assetResourceReady, true)
  assert.equal(bundle.edgeReadinessViewCandidate.readinessSummary.assetResourceWarnings, 0)
  assert.equal(validateRequiredRecord(bundle), true)
})

test('Edge inspection includes production strategy records when present', async () => {
  const dir = await createFixtureProject()
  await runFirstWedge({
    projectDir: dir,
    decision: 'accepted',
    operatorRef: 'operator-test'
  })

  const productionDir = path.join(dir, 'records', 'production')
  await mkdir(productionDir, { recursive: true })
  const sceneUnit = createProductionUnit({
    projectId: 'project-test',
    unitKind: 'scene',
    title: 'Inspection scene unit',
    purpose: 'Optional production strategy inspection fixture.'
  })
  const sceneDescriptor = createSceneDescriptor({
    projectId: 'project-test',
    productionUnitRef: refForProductionRecord(sceneUnit),
    title: 'Inspection scene descriptor',
    scene: {
      summary: 'Optional local scene descriptor for Edge inspection.'
    }
  })
  await writeFile(path.join(productionDir, 'scene-unit.local.json'), `${JSON.stringify(sceneUnit, null, 2)}\n`)
  await writeFile(path.join(productionDir, 'scene-descriptor.local.json'), `${JSON.stringify(sceneDescriptor, null, 2)}\n`)

  const { packet } = await inspectLocalRun({ projectDir: dir })
  assert.ok(Object.values(packet.recordRefs).some((ref) => ref.schema === 'media.production_unit.v1'))
  assert.ok(Object.values(packet.recordRefs).some((ref) => ref.schema === 'media.production_descriptor.local.v1'))
  assert.ok(packet.artifactKinds.includes('media.production_descriptor.local.v1'))

  await writeProjectStatus({ projectDir: dir })
  await writeControlSurfaceProjection({ projectDir: dir })
  const { bundle } = await writeEdgeCompatibilityBundle({ projectDir: dir })
  assert.ok(bundle.studioSourceRefs.some((ref) => ref.schema === 'media.production_unit.v1'))
  assert.ok(bundle.studioSourceRefs.some((ref) => ref.schema === 'media.production_descriptor.local.v1'))
  assert.equal(validateRequiredRecord(bundle), true)
})

test('production from card writes local records without UI or provider work', async () => {
  const dir = await createFixtureProject()

  const result = await writeProductionRecordsFromCard({ projectDir: dir })

  assert.equal(Object.keys(result.records).length, 8)
  assert.equal(result.records.sceneUnit.schema, 'media.production_unit.v1')
  assert.equal(result.records.shotUnit.schema, 'media.production_unit.v1')
  assert.equal(result.records.clipUnit.schema, 'media.production_unit.v1')
  assert.equal(result.records.continuityBand.schema, 'media.continuity_band.v1')
  assert.equal(result.records.renderStrategy.schema, 'media.render_strategy.v1')
  assert.equal(result.records.sceneDescriptor.schema, 'media.production_descriptor.local.v1')
  assert.equal(result.records.clipDescriptor.descriptor.clip.candidateOnly, true)
  assert.equal(result.records.renderStrategy.guidanceOnly, true)
  assert.equal(result.records.renderStrategy.providerCapabilityPosture.providerSpecific, false)
  assert.equal(result.records.sceneUnit.meshTruth, false)
  assert.equal(result.outputs.length, 8)
  assert.ok(result.outputs.every((entry) => entry.output.startsWith('records/production/')))
  assert.equal(validateRequiredRecord(result.records.renderStrategy), true)

  const status = await writeProjectStatus({ projectDir: dir })
  assert.equal(status.status.counts.productionUnits, 3)
  assert.equal(status.status.counts.productionDescriptors, 3)
  assert.equal(status.status.counts.continuityBands, 1)
  assert.equal(status.status.counts.renderStrategies, 1)
  const validation = await validateProductionRecordsInProject({ projectDir: dir })
  assert.equal(validation.valid, true)
  assert.equal(validation.count, 8)
  assert.equal(validation.freshness.fresh, true)
  assert.equal(validation.freshness.staleDescriptorIds.length, 0)

  await runFirstWedge({ projectDir: dir })
  const { packet } = await inspectLocalRun({ projectDir: dir })
  assert.ok(packet.artifactKinds.includes('media.production_unit.v1'))
  assert.ok(packet.artifactKinds.includes('media.render_strategy.v1'))

  const summary = await summarizeInspectionPacket({
    projectDir: dir,
    packet: 'records/exports/local-run-edge-inspection-packet.local.json'
  })
  assert.ok(summary.familyRows.some(([family, count]) => family === 'production' && count === '8'))
})

test('production validation flags stale descriptors after production unit changes', async () => {
  const dir = await createFixtureProject()
  const result = await writeProductionRecordsFromCard({ projectDir: dir })
  const sceneUnitPath = path.join(dir, 'records', 'production', 'sceneUnit.local.json')
  const sceneUnit = JSON.parse(await readFile(sceneUnitPath, 'utf8'))
  sceneUnit.createdAt = '2099-01-01T00:00:00.000Z'
  await writeFile(sceneUnitPath, `${JSON.stringify(sceneUnit, null, 2)}\n`)

  const validation = await validateProductionRecordsInProject({ projectDir: dir })

  assert.equal(validation.valid, true)
  assert.equal(validation.freshness.fresh, false)
  assert.ok(validation.freshness.staleDescriptorIds.includes(result.records.sceneDescriptor.descriptorId))
  assert.ok(validation.freshness.staleDescriptorIds.includes(result.records.shotDescriptor.descriptorId))
})

test('Edge inspection includes approval proposal records when present', async () => {
  const dir = await createFixtureProject()
  await runFirstWedge({
    projectDir: dir,
    decision: 'accepted',
    operatorRef: 'operator-test'
  })
  await writeApprovalProposal({ projectDir: dir })

  const { packet } = await inspectLocalRun({ projectDir: dir })
  assert.ok(Object.values(packet.recordRefs).some((ref) => ref.schema === 'media.approval_proposal.local.v1'))
  assert.ok(packet.artifactKinds.includes('media.approval_proposal.local.v1'))

  await writeProjectStatus({ projectDir: dir })
  await writeControlSurfaceProjection({ projectDir: dir })
  const { bundle } = await writeEdgeCompatibilityBundle({ projectDir: dir })
  assert.ok(bundle.studioSourceRefs.some((ref) => ref.schema === 'media.approval_proposal.local.v1'))
  assert.equal(validateRequiredRecord(bundle), true)
})

test('Edge inspection includes byte descriptor proposal records when present', async () => {
  const dir = await createFixtureProject()
  await runFirstWedge({
    projectDir: dir,
    decision: 'accepted',
    operatorRef: 'operator-test'
  })
  await writeByteDescriptorProposals({ projectDir: dir })

  const { packet } = await inspectLocalRun({ projectDir: dir })
  assert.ok(Object.values(packet.recordRefs).some((ref) => ref.schema === 'media.byte_descriptor_proposal.local.v1'))
  assert.ok(packet.artifactKinds.includes('media.byte_descriptor_proposal.local.v1'))

  await writeProjectStatus({ projectDir: dir })
  await writeControlSurfaceProjection({ projectDir: dir })
  const { bundle } = await writeEdgeCompatibilityBundle({ projectDir: dir })
  assert.ok(bundle.studioSourceRefs.some((ref) => ref.schema === 'media.byte_descriptor_proposal.local.v1'))
  assert.equal(validateRequiredRecord(bundle), true)
})

test('Edge inspection includes resource ref candidate records when present', async () => {
  const dir = await createFixtureProject()
  await runFirstWedge({
    projectDir: dir,
    decision: 'accepted',
    operatorRef: 'operator-test'
  })
  await writeLocalLayerResourceRefCandidates({ projectDir: dir })

  const { packet } = await inspectLocalRun({ projectDir: dir })
  assert.ok(Object.values(packet.recordRefs).some((ref) => ref.schema === 'media.local_layer_resource_ref_candidate.local.v1'))
  assert.ok(packet.artifactKinds.includes('media.local_layer_resource_ref_candidate.local.v1'))

  const summary = await summarizeInspectionPacket({
    projectDir: dir,
    packet: 'records/exports/local-run-edge-inspection-packet.local.json'
  })
  assert.ok(summary.familyRows.some(([family, count]) => family === 'resources' && count === '1'))

  await writeProjectStatus({ projectDir: dir })
  await writeControlSurfaceProjection({ projectDir: dir })
  const { bundle } = await writeEdgeCompatibilityBundle({ projectDir: dir })
  assert.ok(bundle.studioSourceRefs.some((ref) => ref.schema === 'media.local_layer_resource_ref_candidate.local.v1'))
  assert.equal(validateRequiredRecord(bundle), true)
})

test('inspection summary surfaces Edge readiness posture rows', async () => {
  const dir = await createFixtureProject()
  await runFirstWedge({
    projectDir: dir,
    decision: 'accepted',
    operatorRef: 'operator-test'
  })
  await writeByteDescriptorProposals({ projectDir: dir })
  await writeLocalLayerResourceRefCandidates({ projectDir: dir })
  await writeEdgeReadinessGuidance({ projectDir: dir })
  await inspectLocalRun({ projectDir: dir })

  const summary = await summarizeInspectionPacket({
    projectDir: dir,
    packet: 'records/exports/local-run-edge-inspection-packet.local.json'
  })

  assert.ok(summary.readinessRows.some((row) => row[0] === 'readiness-edge-inspection-project-test' && row[1] === 'ready'))
  assert.ok(summary.readinessRows.some((row) => row[3].includes('device_dependent_scaffold->local_layer_resource_ref aligned')))
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
