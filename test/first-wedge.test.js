import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { runFirstWedge } from '../src/local/run-first-wedge.js'
import { promoteCandidate } from '../src/local/promote-candidate.js'
import { readLocalImageMetadata } from '../src/assets/image-metadata.js'
import { ingestReferenceAsset } from '../src/assets/ingest-reference.js'
import { importMediaAsset } from '../src/assets/import-media.js'
import { writeProviderOutputAssets } from '../src/assets/provider-output-ingest.js'
import { generateThumbnailDerivatives } from '../src/assets/generate-thumbnails.js'
import { createMediaSummary, writeMediaSummary } from '../src/assets/media-summary.js'
import {
  derivativeIssueCodesForContentType,
  normalizeFfprobeProbeResult,
  probeLocalMediaMetadata,
  summarizeFfprobe
} from '../src/assets/media-metadata.js'
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
import {
  runVeniceOperationalLoop,
  selectVenicePromotionCandidate
} from '../src/providers/venice-operational-loop.js'
import { inspectLocalRun } from '../src/seams/inspect-local-run.js'
import { exportInspectionBundle } from '../src/seams/export-inspection-bundle.js'
import { indexInspectionRecords } from '../src/seams/index-inspection-records.js'
import { indexProviderRuns } from '../src/seams/index-provider-runs.js'
import { inspectProviderFailure } from '../src/seams/inspect-provider-failure.js'
import { inspectVeniceSmoke } from '../src/seams/inspect-venice-smoke.js'
import { inspectVeniceLoop } from '../src/seams/inspect-venice-loop.js'
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
import { repairLocalPosture } from '../src/local/repair-local-posture.js'
import {
  createMediaOperationCandidate
} from '../src/contracts/operation-candidates.js'
import {
  resolveMediaOperationCandidate,
  writeRuleResolutionExample
} from '../src/contracts/rule-resolution.js'

import {
  createProductionUnit,
  createSceneDescriptor,
  refForProductionRecord
} from '../src/production/strategy.js'
import { writeProductionRecordsFromCard } from '../src/production/create-production-records.js'
import { validateProductionRecordsInProject } from '../src/production/validate-production-records.js'

const onePixelPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

async function captureConsole(fn) {
  const original = console.log
  const lines = []
  console.log = (...args) => {
    lines.push(args.join(' '))
  }
  try {
    const result = await fn()
    return { result, lines }
  } finally {
    console.log = original
  }
}

function ref(kind, id, schema) {
  return { kind, id, schema }
}

function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function assertLayeredAssetIdentity(assetDescriptor, {
  expectedPlacementClass,
  expectedPath,
  expectedRole
} = {}) {
  assert.equal(assetDescriptor.contentId, `sha256:${assetDescriptor.hash.value}`)
  assert.equal(assetDescriptor.assetId, `asset-${assetDescriptor.hash.value.slice(0, 16)}`)
  assert.equal(assetDescriptor.assetDescriptorRef.kind, 'media-asset-descriptor')
  assert.equal(assetDescriptor.assetDescriptorRef.id, assetDescriptor.assetId)
  assert.equal(assetDescriptor.assetDescriptorRef.schema, assetDescriptor.schema)
  assert.deepEqual(assetDescriptor.artifactDescriptorRef, assetDescriptor.assetDescriptorRef)
  assert.equal(assetDescriptor.placementRef.kind, 'path-placement')
  assert.equal(assetDescriptor.placementRef.id, `placement:${assetDescriptor.projectId}:${assetDescriptor.localRef.path}`)
  assert.equal(assetDescriptor.placementRef.path, expectedPath ?? assetDescriptor.localRef.path)
  assert.equal(assetDescriptor.placementRef.placementClass, expectedPlacementClass ?? assetDescriptor.localRef.placementClass)
  assert.equal(assetDescriptor.situationRef.kind, 'studio-media-situation')
  assert.equal(assetDescriptor.situationRef.role, expectedRole ?? assetDescriptor.provenance?.lifecycle?.state)
  assert.equal(assetDescriptor.situationRef.placementRef.id, assetDescriptor.placementRef.id)
  assert.equal(assetDescriptor.situationRef.contextRef.id, `project:${assetDescriptor.projectId}`)
  assert.equal(assetDescriptor.basisRef.kind, 'media-basis')
  assert.equal(assetDescriptor.originRef.localOnly, true)
  assert.equal(assetDescriptor.causalRefs.deferred, true)
  assert.equal(assetDescriptor.causalRefs.causalTruth, false)
}

function createTestOperationCandidate(overrides = {}) {
  return createMediaOperationCandidate({
    operationId: 'operation-test',
    projectId: 'project-test',
    artifactClass: 'media.provider_job',
    operationClass: 'prepare_provider_job',
    subjectRef: ref('media-card', 'card-test', 'media.card.v1'),
    scopeDelta: 'local_record_only',
    riskTier: 'low',
    reversibility: 'reversible',
    authorityBoundary: 'local_project',
    evidenceRequirement: 'card_required',
    requestedBy: 'operator-test',
    sourceRefs: [ref('media-card', 'card-test', 'media.card.v1')],
    createdAt: '2026-05-19T00:00:00.000Z',
    ...overrides
  })
}

async function createFixtureProject(projectDir) {
  const dir = projectDir ?? await mkdtemp(path.join(os.tmpdir(), 'media-studio-wedge-'))
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

async function countJsonFiles(dir) {
  let dirents
  try {
    dirents = await readdir(dir, { withFileTypes: true })
  } catch (error) {
    if (error.code === 'ENOENT') return 0
    throw error
  }

  let count = 0
  for (const dirent of dirents) {
    const child = path.join(dir, dirent.name)
    if (dirent.isDirectory()) {
      count += await countJsonFiles(child)
    } else if (dirent.isFile() && dirent.name.endsWith('.json')) {
      count += 1
    }
  }

  return count
}

async function firstJsonFile(dir) {
  const entries = await readdir(dir)
  const file = entries.filter((entry) => entry.endsWith('.json')).sort()[0]
  if (!file) {
    throw new Error(`Expected a JSON file in ${dir}`)
  }
  return path.join(dir, file)
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
  assertLayeredAssetIdentity(result.outputs.assetDescriptor, {
    expectedPlacementClass: 'media-accepted',
    expectedPath: 'media/accepted/candidate.txt',
    expectedRole: 'accepted'
  })
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

test('provider output ingest gives generated images derivative readiness', async () => {
  const dir = await createFixtureProject()
  const card = JSON.parse(await readFile(path.join(dir, 'cards', 'card.json'), 'utf8'))
  const generationRequest = createGenerationRequestFromCard({ card })
  const providerResult = normalizeProviderResult({
    generationRequest,
    providerId: 'local-test-provider',
    providerJobRef: {
      kind: 'local-provider-job',
      id: 'job-provider-output-test',
      localOnly: true
    },
    status: 'succeeded',
    outputRefs: [
      {
        kind: 'provider-output',
        id: 'provider-output-0',
        outputDelivery: 'inline-base64',
        contentType: 'image/png',
        localOnly: true,
        providerTruth: false
      }
    ]
  })

  const generated = await writeProviderOutputAssets({
    projectDir: dir,
    card,
    generationRequest,
    providerResult,
    outputs: [
      {
        index: 0,
        bytes: Buffer.from(onePixelPngBase64, 'base64'),
        contentType: 'image/png',
        extension: 'png'
      }
    ],
    filenamePrefix: 'provider-generated',
    recordPrefix: 'provider-generated'
  })
  const before = await createMediaSummary({ projectDir: dir })
  const thumbnails = await generateThumbnailDerivatives({ projectDir: dir, maxSize: 64 })
  const after = await createMediaSummary({ projectDir: dir })
  const asset = generated.assets[0].assetDescriptor

  assert.equal(generated.assets.length, 1)
  assert.equal(asset.localRef.path, 'media/generated/provider-generated-0.png')
  assert.equal(asset.localRef.placementClass, 'media-generated')
  assertLayeredAssetIdentity(asset, {
    expectedPlacementClass: 'media-generated',
    expectedPath: 'media/generated/provider-generated-0.png',
    expectedRole: 'generated'
  })
  assert.equal(asset.source.apiCalled, false)
  assert.equal(asset.provenance.providerResultLocalOnly, true)
  assert.equal(asset.metadataProbe.mediaKind, 'image')
  assert.equal(asset.metadataProbe.image.width, 1)
  assert.deepEqual(asset.derivativeReadiness.issueCodes, ['missing_thumbnail'])
  assert.equal(asset.derivativeReadiness.materializationProof, false)
  assert.equal(before.assets.byMediaKind.image, 1)
  assert.equal(before.generatedCandidates.total, 1)
  assert.equal(before.generatedCandidates.pendingReview, 1)
  assert.equal(before.generatedCandidates.attentionRows[0].issueCodes[0], 'missing_local_review')
  assert.equal(before.derivativeReadiness.evaluatedAssets, 1)
  assert.equal(before.derivativeReadiness.attentionAssets, 1)
  assert.equal(before.derivativeReadiness.attentionRows[0].path, 'media/generated/provider-generated-0.png')
  assert.equal(thumbnails.generated.length, 1)
  assert.equal(after.derivativeReadiness.readyAssets, 1)
  assert.equal(after.derivativeReadiness.attentionAssets, 0)
  assert.equal(after.derivatives.byKind.thumbnail, 1)
  assert.equal(after.byteAvailabilityProof, false)
  assert.equal(after.materializationProof, false)
  assert.equal(after.resourceAdmission, false)
})

test('provider generated image can be explicitly promoted with fresh derivative readiness', async () => {
  const dir = await createFixtureProject()
  const card = JSON.parse(await readFile(path.join(dir, 'cards', 'card.json'), 'utf8'))
  const generationRequest = createGenerationRequestFromCard({ card })
  const providerResult = normalizeProviderResult({
    generationRequest,
    providerId: 'local-test-provider',
    providerJobRef: {
      kind: 'local-provider-job',
      id: 'job-provider-promotion-test',
      localOnly: true
    },
    status: 'succeeded',
    outputRefs: [
      {
        kind: 'provider-output',
        id: 'provider-output-0',
        outputDelivery: 'inline-base64',
        contentType: 'image/png',
        localOnly: true,
        providerTruth: false
      }
    ]
  })
  const providerResultRecord = 'records/provider-results/provider-generated-result.local.json'
  await mkdir(path.join(dir, 'records', 'provider-results'), { recursive: true })
  await writeFile(path.join(dir, providerResultRecord), `${JSON.stringify(providerResult, null, 2)}\n`)
  const generated = await writeProviderOutputAssets({
    projectDir: dir,
    card,
    generationRequest,
    providerResult,
    outputs: [
      {
        index: 0,
        bytes: Buffer.from(onePixelPngBase64, 'base64'),
        contentType: 'image/png',
        extension: 'png'
      }
    ],
    filenamePrefix: 'provider-generated',
    recordPrefix: 'provider-generated',
    sourceApiCalled: true
  })
  const promotion = await promoteCandidate({
    projectDir: dir,
    assetRecord: generated.assets[0].assetRecordRef,
    providerResultRecord,
    decision: 'accepted',
    operatorRef: 'operator-test'
  })
  const summary = await createMediaSummary({ projectDir: dir })

  assert.equal(promotion.assetDescriptor.localRef.path, 'media/accepted/provider-generated-0.png')
  assert.equal(promotion.assetDescriptor.source.apiCalled, true)
  assertLayeredAssetIdentity(promotion.assetDescriptor, {
    expectedPlacementClass: 'media-accepted',
    expectedPath: 'media/accepted/provider-generated-0.png',
    expectedRole: 'accepted'
  })
  assert.equal(promotion.assetDescriptor.metadataProbe.mediaKind, 'image')
  assert.equal(promotion.assetDescriptor.metadataProbe.image.width, 1)
  assert.deepEqual(promotion.assetDescriptor.derivativeReadiness.issueCodes, ['missing_thumbnail'])
  assert.equal(promotion.assetDescriptor.derivativeReadiness.materializationProof, false)
  assert.equal(promotion.review.operatorDecision.decisionType, 'accept')
  assert.equal(summary.generatedCandidates.total, 1)
  assert.equal(summary.generatedCandidates.promotedAccepted, 1)
  assert.equal(summary.generatedCandidates.promotedRejected, 0)
  assert.equal(summary.generatedCandidates.productionReview.ready, 0)
  assert.equal(summary.generatedCandidates.productionReview.needsReview, 1)
  assert.equal(summary.generatedCandidates.productionReview.proposed, 0)
  assert.equal(summary.generatedCandidates.productionReview.attentionRows[0].productionReady, false)
  assert.equal(summary.generatedCandidates.productionReview.attentionRows[0].issueCodes[0], 'missing_production_review_proposal')
  assert.equal(summary.approvalLane.proposals, 0)
  assert.equal(summary.approvalLane.pendingAuthority, 0)
  assert.equal(summary.derivativeReadiness.evaluatedAssets, 2)
  assert.equal(summary.derivativeReadiness.attentionAssets, 2)
  await writeApprovalProposal({
    projectDir: dir,
    decision: promotion.review.recordRefs.operatorDecision,
    asset: promotion.assetRecord,
    output: 'records/approvals/promoted-candidate-approval-proposal.local.json'
  })
  const proposedSummary = await createMediaSummary({ projectDir: dir })
  assert.equal(proposedSummary.generatedCandidates.productionReview.ready, 0)
  assert.equal(proposedSummary.generatedCandidates.productionReview.needsReview, 0)
  assert.equal(proposedSummary.generatedCandidates.productionReview.proposed, 1)
  assert.equal(proposedSummary.generatedCandidates.productionReview.attentionRows[0].issueCodes[0], 'production_review_proposal_pending')
  assert.equal(proposedSummary.approvalLane.proposals, 1)
  assert.equal(proposedSummary.approvalLane.pendingAuthority, 1)
  assert.equal(proposedSummary.approvalLane.approved, 0)
  assert.equal(proposedSummary.approvalLane.blocked, 1)
  assert.equal(proposedSummary.approvalLane.attentionRows[0].issueCodes[0], 'authority_required')
  assert.equal(proposedSummary.approvalLane.attentionRows[0].approvalAuthority, false)
  assert.equal(validateRequiredRecord(promotion.assetDescriptor), true)
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

test('committed operation candidate fixture catalog matches resolver behavior', async () => {
  const catalog = JSON.parse(await readFile('examples/operation-candidates/catalog.local.json', 'utf8'))

  assert.equal(catalog.localOnly, true)
  assert.equal(catalog.meshTruth, false)
  assert.ok(catalog.cases.length >= 8)

  for (const item of catalog.cases) {
    assert.equal(validateRequiredRecord(item.candidate), true)
    const trace = resolveMediaOperationCandidate(item.candidate, {
      createdAt: catalog.createdAt
    })

    assert.equal(trace.resolutionMode, item.expected.resolutionMode, item.caseId)
    assert.equal(trace.deliveryMode, item.expected.deliveryMode, item.caseId)
    assert.equal(trace.executionPerformed, false)
    assert.equal(trace.edgeCalled, false)
    assert.equal(trace.meshPublished, false)
    assert.equal(validateRequiredRecord(trace), true)
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
  assert.equal(written.generatedRecordRefs.length, 4)
  assert.equal(written.generatedRecordRefs[0].id, 'cards/card.json')
  assert.equal(written.generatedAssets[0].localRef.path, 'media/generated/provider-smoke/venice-live-smoke-0.png')
  assert.equal(written.generatedAssets[0].imageMetadataRef.schema, 'media.image_metadata.local.v1')
  assert.equal(written.reviewRecords.length, 1)
  assert.equal(written.reviewRecords[0].localDecisionOnly, true)
  assert.equal(written.manifestRef.id, 'records/manifests/venice-live-smoke-manifest.local.json')

  const cardRecord = JSON.parse(
    await readFile(path.join(dir, 'cards', 'card.json'), 'utf8')
  )
  const workPacket = JSON.parse(
    await readFile(path.join(dir, 'records', 'work-packets', 'venice-live-smoke-work-packet.local.json'), 'utf8')
  )
  const generationRequest = JSON.parse(
    await readFile(path.join(dir, 'records', 'work-packets', 'venice-live-smoke-generation-request.local.json'), 'utf8')
  )
  assert.equal(cardRecord.schema, 'media.card.v1')
  assert.equal(cardRecord.projectId, 'venice-smoke-project')
  assert.equal(validateRequiredRecord(cardRecord), true)
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
  assertLayeredAssetIdentity(assetRecord, {
    expectedPlacementClass: 'media-generated',
    expectedPath: 'media/generated/provider-smoke/venice-live-smoke-0.png',
    expectedRole: 'generated'
  })
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

test('Venice smoke inspection summarizes promoted assets derivatives and resource posture', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-venice-operational-'))

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
  await generateThumbnailDerivatives({ projectDir: dir })
  await promoteCandidate({
    projectDir: dir,
    assetRecord: 'records/assets/venice-live-smoke-asset-0.local.json',
    providerResultRecord: 'records/provider-results/venice-live-smoke-provider-result.local.json',
    decision: 'accepted',
    operatorRef: 'operator-test'
  })
  await generateThumbnailDerivatives({ projectDir: dir })
  await writeByteDescriptorProposals({ projectDir: dir, quiet: true })
  await writeLocalLayerResourceRefCandidates({ projectDir: dir, quiet: true })

  const repair = await repairLocalPosture({ projectDir: dir })
  const result = await inspectVeniceSmoke({ projectDir: dir })

  assert.equal(repair.remainingAttention, 0)
  assert.ok(repair.skippedIssues.some((entry) =>
    entry.issueCode === 'inspection_refresh_skipped' &&
    entry.nonBlocking === true &&
    entry.nextAction.includes('inspect:venice-smoke')
  ))
  assert.equal(result.packet.operationalSummary.generatedCandidates.total, 1)
  assert.equal(result.packet.operationalSummary.generatedCandidates.promotedAccepted, 1)
  assert.equal(result.packet.operationalSummary.derivativeReadiness.readyAssets, 2)
  assert.equal(result.packet.operationalSummary.identity.byteContent.coveredContentIds, 1)
  assert.equal(result.packet.operationalSummary.identity.resourceSituations.coveredSituationPlacements, 1)
  assert.equal(result.packet.operationalSummary.recordCounts.promotedAssets, 1)
  assert.equal(result.packet.operationalSummary.recordCounts.derivatives, 2)
  assert.equal(result.packet.operationalSummary.recordCounts.byteDescriptorProposals, 1)
  assert.equal(result.packet.operationalSummary.recordCounts.resourceRefCandidates, 1)
  assert.equal(result.packet.operationalSummary.recordRefs.promotedAssets.length, 1)
  assert.equal(result.packet.operationalSummary.recordRefs.derivatives.length, 2)
  assert.equal(result.packet.operationalSummary.recordRefs.byteDescriptorProposals.length, 1)
  assert.equal(result.packet.operationalSummary.recordRefs.resourceRefCandidates.length, 1)
  assert.ok(result.packet.generatedArtifactRefs.some((ref) => ref.kind === 'media-promoted-asset'))
  assert.ok(result.packet.generatedArtifactRefs.some((ref) => ref.kind === 'media-derivative'))
  assert.equal(result.packet.operationalSummary.materializationProof, false)
  assert.equal(validateRequiredRecord(result.packet), true)
})

test('Venice operational loop completes locally without live provider by default', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-venice-loop-'))

  const status = await runVeniceOperationalLoop({
    projectDir: dir,
    decision: 'accepted',
    operatorRef: 'operator-test'
  })

  assert.equal(status.state, 'complete_review_only')
  assert.equal(status.liveProviderCalled, false)
  assert.equal(status.provider.generatedAssets, 1)
  assert.equal(status.providerLedger.total, 1)
  assert.equal(status.selectedCandidate.selectionMode, 'latest-generated')
  assert.equal(status.selectedCandidate.assetRecord, 'records/assets/venice-live-smoke-asset-0.local.json')
  assert.equal(status.mediaSummary.generatedCandidates.total, 1)
  assert.equal(status.mediaSummary.generatedCandidates.reviewed, 1)
  assert.equal(status.mediaSummary.generatedCandidates.promotedAccepted, 1)
  assert.equal(status.mediaSummary.generatedCandidates.productionReview.needsReview, 1)
  assert.equal(status.mediaSummary.generatedCandidates.productionReview.ready, 0)
  assert.equal(status.mediaSummary.approvalLane.proposals, 0)
  assert.equal(status.productionBlockers[0], 'provider_loop_complete_review_only')
  assert.equal(status.mediaSummary.derivatives.readyAssets, 2)
  assert.equal(status.mediaSummary.derivatives.evaluatedAssets, 2)
  assert.equal(status.mediaSummary.identity.byteContent.coveredContentIds, 1)
  assert.equal(status.mediaSummary.identity.resourceSituations.coveredSituationPlacements, 1)
  assert.equal(status.mediaSummary.remainingAttention, 0)
  assert.equal(status.edgeCalled, false)
  assert.equal(status.meshPublished, false)
  assert.equal(status.materializationProof, false)
  assert.equal(status.schema, 'media.provider_loop_status.local.v1')
  assert.equal(status.statusRecordRef, 'records/provider-results/media-provider-loop-status.local.json')

  const providerResult = JSON.parse(
    await readFile(path.join(dir, 'records', 'provider-results', 'venice-live-smoke-provider-result.local.json'), 'utf8')
  )
  assert.equal(providerResult.providerResult.rawProviderRef.apiCalled, false)

  const statusRecord = JSON.parse(
    await readFile(path.join(dir, 'records', 'provider-results', 'media-provider-loop-status.local.json'), 'utf8')
  )
  assert.equal(validateRequiredRecord(statusRecord), true)
  assert.equal(statusRecord.adapterFixture, 'venice')
  assert.equal(statusRecord.providerTruth, false)

  const { result: inspection } = await captureConsole(() => inspectVeniceLoop({ projectDir: dir }))
  assert.equal(inspection.summary.state, 'complete_review_only')
  assert.equal(inspection.summary.completionScope, 'generated-candidate-local-loop')
  assert.equal(inspection.summary.productionReady, false)
  assert.equal(inspection.summary.retryPath.state, 'not-required')
  assert.equal(inspection.summary.selectedCandidate.path, 'media/generated/provider-smoke/venice-live-smoke-0.png')
  assert.equal(inspection.summary.providerRuns.total, 1)
  assert.equal(inspection.summary.providerTruth, false)

  const { result: requestResult } = await captureConsole(() => writeOperatorDecisionRequest({
    projectDir: dir,
    providerLoopStatus: 'records/provider-results/media-provider-loop-status.local.json',
    output: 'records/requests/media-provider-loop-operator-decision-request.local.json'
  }))
  assert.equal(requestResult.request.requestKind, 'review-provider-loop')
  assert.deepEqual(requestResult.request.requestedDecisionTypes, ['review_provider_loop', 'defer'])
  assert.equal(requestResult.request.providerTruth, false)
  assert.equal(validateRequiredRecord(requestResult.request), true)

  const mediaSummary = await createMediaSummary({ projectDir: dir })
  assert.equal(mediaSummary.providerLoops.total, 1)
  assert.equal(mediaSummary.providerLoops.completeReviewOnly, 1)
  assert.equal(mediaSummary.providerLoops.readyForProductionReview, 0)
  assert.equal(mediaSummary.providerLoops.latest.readinessState, 'loop-complete-local-review-only')
  assert.deepEqual(mediaSummary.providerLoops.latest.productionBlockers, [
    'provider_loop_complete_review_only',
    'production_review_or_authority_not_granted'
  ])
  assert.equal(mediaSummary.providerLoops.providerTruth, false)
})

test('Venice operational loop selects latest generated provider candidate', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-venice-select-'))

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
    }),
    externalApiCall: false
  })

  const originalPath = path.join(dir, 'records', 'assets', 'venice-live-smoke-asset-0.local.json')
  const original = JSON.parse(await readFile(originalPath, 'utf8'))
  const oldCandidate = {
    ...original,
    createdAt: '2000-01-01T00:00:00.000Z'
  }
  const newCandidate = {
    ...original,
    createdAt: '2100-01-01T00:00:00.000Z'
  }
  await writeFile(path.join(dir, 'records', 'assets', 'venice-live-smoke-old.local.json'), `${JSON.stringify(oldCandidate, null, 2)}\n`)
  await writeFile(path.join(dir, 'records', 'assets', 'venice-live-smoke-new.local.json'), `${JSON.stringify(newCandidate, null, 2)}\n`)

  const selected = await selectVenicePromotionCandidate({ projectDir: dir })

  assert.equal(selected.assetRecord, 'records/assets/venice-live-smoke-new.local.json')
  assert.equal(selected.providerResultRecord, 'records/provider-results/venice-live-smoke-provider-result.local.json')
})

test('Venice operational loop reports provider-stage failure without claiming truth', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-venice-loop-fail-'))

  const status = await runVeniceOperationalLoop({
    projectDir: dir,
    liveProvider: true,
    env: {
      VENICE_LIVE: '1',
      VENICE_INFERENCE_KEY: 'test-key'
    },
    envPath: path.join(dir, '.env-missing'),
    fetchImpl: async () => ({
      status: 429,
      async json() {
        return {
          id: 'venice-live-failure',
          error: { message: 'budget capped' }
        }
      }
    })
  })

  assert.equal(status.state, 'failed_review_only')
  assert.equal(status.failedStep, 'provider_smoke')
  assert.equal(status.liveProviderCalled, true)
  assert.match(status.nextAction, /VENICE_LIVE/)
  assert.equal(status.meshTruth, false)
  assert.equal(status.providerTruth, false)
  assert.equal(status.edgeCalled, false)
  assert.equal(status.meshPublished, false)

  const statusRecord = JSON.parse(
    await readFile(path.join(dir, 'records', 'provider-results', 'media-provider-loop-status.local.json'), 'utf8')
  )
  assert.equal(validateRequiredRecord(statusRecord), true)
  assert.equal(statusRecord.state, 'failed_review_only')
  assert.equal(statusRecord.providerTruth, false)

  const { result: inspection } = await captureConsole(() => inspectVeniceLoop({ projectDir: dir }))
  assert.equal(inspection.summary.state, 'failed_review_only')
  assert.equal(inspection.summary.failedStep, 'provider_smoke')
  assert.equal(inspection.summary.productionReady, false)
  assert.equal(inspection.summary.retryPath.state, 'needs-request')
  assert.equal(inspection.summary.retryPath.requestPresent, false)
  assert.equal(inspection.summary.retryPath.decisionPresent, false)
  assert.equal(inspection.summary.providerTruth, false)

  const { result: indexResult } = await captureConsole(() => writeOperatorPacketIndex({ projectDir: dir }))
  assert.equal(indexResult.index.providerLoopStatusRefs.length, 1)
  assert.equal(indexResult.index.providerLoopStatuses[0].state, 'failed_review_only')
  assert.equal(indexResult.index.providerLoopStatuses[0].needsOperatorAttention, true)
  assert.equal(indexResult.index.summary.providerLoopsWithAttention, 1)
  assert.equal(indexResult.index.summary.attentionRows, 1)
  assert.equal(validateRequiredRecord(indexResult.index), true)

  const { result: requestResult } = await captureConsole(() => writeOperatorDecisionRequest({
    projectDir: dir,
    providerLoopStatus: 'records/provider-results/media-provider-loop-status.local.json',
    output: 'records/requests/media-provider-loop-operator-decision-request.local.json'
  }))
  assert.equal(requestResult.request.requestKind, 'review-provider-loop')
  assert.deepEqual(requestResult.request.requestedDecisionTypes, ['retry_provider_loop', 'defer'])
  assert.match(requestResult.request.nextActions.join(' '), /does not execute retries/)
  assert.equal(requestResult.request.retryPreview.executionPerformed, false)
  assert.equal(requestResult.request.providerTruth, false)
  assert.equal(validateRequiredRecord(requestResult.request), true)

  const { result: requestInspection } = await captureConsole(() => inspectVeniceLoop({ projectDir: dir }))
  assert.equal(requestInspection.summary.retryPath.state, 'needs-decision')
  assert.equal(requestInspection.summary.retryPath.requestPresent, true)
  assert.equal(requestInspection.summary.retryPath.requestAllowsRetry, true)

  const failedMediaSummary = await createMediaSummary({ projectDir: dir })
  assert.equal(failedMediaSummary.providerLoops.needsRetryDecision, 1)
  assert.equal(failedMediaSummary.providerLoops.attentionRows[0].readinessState, 'needs-retry-decision')
  assert.match(failedMediaSummary.providerLoops.attentionRows[0].nextAction, /retry is not automatic/)

  const { result: decisionResult } = await captureConsole(() => writeOperatorDecisionRequest({
    projectDir: dir,
    providerLoopRequest: 'records/requests/media-provider-loop-operator-decision-request.local.json',
    decision: 'retry_provider_loop',
    output: 'records/decisions/media-provider-loop-operator-decision.local.json'
  }))
  assert.equal(decisionResult.decision.decisionType, 'retry_provider_loop')
  assert.equal(decisionResult.decision.allowsExplicitRetryAttempt, true)
  assert.equal(decisionResult.decision.executionPerformed, false)
  assert.equal(decisionResult.decision.providerTruth, false)
  assert.equal(validateRequiredRecord(decisionResult.decision), true)

  const { result: decisionInspection } = await captureConsole(() => inspectVeniceLoop({ projectDir: dir }))
  assert.equal(decisionInspection.summary.retryPath.state, 'ready-for-explicit-live-retry')
  assert.equal(decisionInspection.summary.retryPath.decisionType, 'retry_provider_loop')
  assert.equal(decisionInspection.summary.retryPath.retryDecision, true)

  const { result: decisionIndexResult } = await captureConsole(() => writeOperatorPacketIndex({ projectDir: dir }))
  assert.equal(decisionIndexResult.index.operatorDecisionRefs.length, 1)
  assert.equal(decisionIndexResult.index.providerLoopDecisions.length, 1)
  assert.equal(decisionIndexResult.index.providerLoopDecisions[0].decisionType, 'retry_provider_loop')
  assert.equal(decisionIndexResult.index.providerLoopDecisions[0].allowsExplicitRetryAttempt, true)
  assert.equal(decisionIndexResult.index.providerLoopDecisions[0].executionPerformed, false)
  assert.equal(decisionIndexResult.index.summary.providerLoopDecisions, 1)
  assert.equal(decisionIndexResult.index.summary.providerLoopRetryDecisions, 1)
  assert.equal(validateRequiredRecord(decisionIndexResult.index), true)

  const blockedRetry = await runVeniceOperationalLoop({
    projectDir: dir,
    liveProvider: true,
    env: {
      VENICE_LIVE: '1',
      VENICE_INFERENCE_KEY: 'test-key'
    },
    envPath: path.join(dir, '.env-missing'),
    fetchImpl: async () => {
      throw new Error('retry should be gated before provider fetch')
    }
  })
  assert.equal(blockedRetry.state, 'failed_review_only')
  assert.equal(blockedRetry.failedStep, 'retry_decision_gate')
  assert.equal(blockedRetry.liveProviderCalled, false)

  const retried = await runVeniceOperationalLoop({
    projectDir: dir,
    liveProvider: true,
    retryDecision: 'records/decisions/media-provider-loop-operator-decision.local.json',
    env: {
      VENICE_LIVE: '1',
      VENICE_INFERENCE_KEY: 'test-key'
    },
    envPath: path.join(dir, '.env-missing'),
    fetchImpl: async () => ({
      status: 200,
      async json() {
        return {
          id: 'venice-live-retry-success',
          images: [onePixelPngBase64],
          request: { format: 'png' }
        }
      }
    })
  })
  assert.equal(retried.retryGate.required, true)
  assert.equal(retried.retryGate.satisfied, true)
  assert.equal(retried.liveProviderCalled, true)
  assert.equal(retried.providerTruth, false)

  const mediaSummary = await createMediaSummary({ projectDir: dir })
  assert.equal(mediaSummary.providerLoops.completeReviewOnly, 1)
  assert.equal(mediaSummary.providerLoops.latest.readinessState, 'loop-complete-local-review-only')
})

test('committed Venice provider-loop failure fixture is inspectable without truth claims', async () => {
  const fixtureDir = 'examples/provider-loop-fixtures/venice-provider-failed'

  const { result: inspection } = await captureConsole(() => inspectVeniceLoop({
    projectDir: fixtureDir
  }))

  assert.equal(inspection.summary.state, 'failed_review_only')
  assert.equal(inspection.summary.failedStep, 'provider_smoke')
  assert.equal(inspection.summary.retryPath.state, 'needs-request')
  assert.deepEqual(inspection.summary.productionBlockers, [
    'provider_loop_failed_review_only',
    'retry_or_defer_decision_required'
  ])
  assert.equal(inspection.summary.productionReady, false)
  assert.equal(inspection.summary.providerTruth, false)
  assert.equal(inspection.summary.meshTruth, false)
})

test('cross-project operator index surfaces provider loop attention by ref', async () => {
  const baseDir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-cross-project-provider-loop-'))
  const projectDir = path.join(baseDir, 'failed-provider-loop')
  const approvalProjectDir = path.join(baseDir, 'approval-project')
  await mkdir(path.join(projectDir, 'records', 'provider-results'), { recursive: true })
  await mkdir(path.join(projectDir, 'records', 'decisions'), { recursive: true })
  await createFixtureProject(approvalProjectDir)
  await runFirstWedge({
    projectDir: approvalProjectDir,
    decision: 'accepted',
    operatorRef: 'operator-test'
  })
  await writeApprovalProposal({ projectDir: approvalProjectDir })

  const fixture = JSON.parse(
    await readFile('examples/provider-loop-fixtures/venice-provider-failed/records/provider-results/media-provider-loop-status.local.json', 'utf8')
  )
  await writeFile(path.join(projectDir, 'records', 'provider-results', 'media-provider-loop-status.local.json'), `${JSON.stringify(fixture, null, 2)}\n`)
  const decision = {
    schema: 'media.operator_decision.v1',
    decisionId: 'decision-provider-loop-fixture-retry',
    projectId: 'venice-provider-failed-fixture',
    subjectRef: {
      kind: 'media-provider-loop-status',
      id: 'provider-loop-status-venice-provider-failed-fixture',
      schema: 'media.provider_loop_status.local.v1'
    },
    decisionType: 'retry_provider_loop',
    operatorRef: 'operator-test',
    reason: 'Fixture retry decision for cross-project index visibility.',
    evidenceRefs: [],
    providerLoopDecision: 'retry_provider_loop',
    allowsExplicitRetryAttempt: true,
    executionPerformed: false,
    authorityGranted: false,
    localDecisionOnly: true,
    operatorGuidanceOnly: true,
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    providerTruth: false,
    edgeCalled: false,
    meshPublished: false,
    localTruthLabel: 'local decision',
    truthStatus: 'not mesh truth; not distributed proof; not ratified shared state',
    createdAt: '2026-05-20T00:00:00.000Z'
  }
  validateRequiredRecord(decision)
  await writeFile(path.join(projectDir, 'records', 'decisions', 'media-provider-loop-operator-decision.local.json'), `${JSON.stringify(decision, null, 2)}\n`)

  const inputList = {
    schema: 'media.cross_project_inspection_input_list.local.v1',
    inputListId: 'provider-loop-attention-fixture',
    createdAt: '2026-05-20T00:00:00.000Z',
    mode: 'standalone-local',
    projects: [
      {
        projectId: 'venice-provider-failed-fixture',
        label: 'Venice provider failed fixture',
        rootRef: {
          kind: 'local-directory',
          id: 'failed-provider-loop',
          schema: 'media.local_ref.v1',
          path: 'failed-provider-loop',
          localOnly: true
        },
        artifactRefs: {
          providerLoopStatus: {
            kind: 'media-provider-loop-status',
            id: 'provider-loop-status-venice-provider-failed-fixture',
            schema: 'media.provider_loop_status.local.v1',
            path: 'records/provider-results/media-provider-loop-status.local.json',
            localOnly: true
          },
          providerLoopDecision: {
            kind: 'media-operator-decision',
            id: 'decision-provider-loop-fixture-retry',
            schema: 'media.operator_decision.v1',
            path: 'records/decisions/media-provider-loop-operator-decision.local.json',
            localOnly: true
          }
        }
      },
      {
        projectId: 'approval-project',
        label: 'Approval proposal fixture',
        rootRef: {
          kind: 'local-directory',
          id: 'approval-project',
          schema: 'media.local_ref.v1',
          path: 'approval-project',
          localOnly: true
        },
        artifactRefs: {
          approvalProposal: {
            kind: 'media-approval-proposal',
            id: 'approval-proposal-project-test-asset-732d058fadd90c70',
            schema: 'media.approval_proposal.local.v1',
            path: 'records/approvals/media-approval-proposal.local.json',
            localOnly: true
          }
        }
      }
    ],
    warnings: [
      'Provider-loop fixture input list only.',
      'Provider-loop status is local operator guidance only.'
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
  await writeFile(path.join(baseDir, 'input-list.local.json'), `${JSON.stringify(inputList, null, 2)}\n`)

  const { result } = await captureConsole(() => writeCrossProjectOperatorIndex({
    baseDir,
    inputList: 'input-list.local.json',
    output: 'cross-project-provider-loop.local.json'
  }))

  assert.equal(result.index.summary.providerLoopStatuses, 1)
  assert.equal(result.index.summary.providerLoopsWithAttention, 1)
  assert.equal(result.index.summary.providerLoopsWithProductionAttention, 1)
  assert.equal(result.index.summary.providerLoopDecisions, 1)
  assert.equal(result.index.summary.providerLoopRetryDecisions, 1)
  assert.equal(result.index.summary.approvalProposals, 1)
  assert.equal(result.index.summary.approvalProposalsWithAttention, 1)
  assert.equal(result.index.summary.attentionRows, 2)
  assert.equal(result.index.projectSummaries[0].providerLoopStatus.state, 'failed_review_only')
  assert.deepEqual(result.index.projectSummaries[0].providerLoopStatus.productionBlockers, [
    'provider_loop_failed_review_only',
    'retry_or_defer_decision_required'
  ])
  assert.equal(result.index.projectSummaries[0].providerLoopDecision.decisionType, 'retry_provider_loop')
  assert.equal(result.index.projectSummaries[0].providerLoopDecision.executionPerformed, false)
  assert.equal(result.index.projectSummaries[0].providerLoopStatus.providerTruth, false)
  assert.equal(result.index.projectSummaries[1].approvalProposal.laneState, 'pending-authority-review')
  assert.equal(result.index.projectSummaries[1].approvalProposal.approvalAuthority, false)
  assert.equal(validateRequiredRecord(result.index), true)
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

test('local inspection surfaces rule-resolution traces as mediation pressure', async () => {
  const dir = await createFixtureProject()
  await runFirstWedge({ projectDir: dir })
  const rules = await writeRuleResolutionExample({ projectDir: dir, createdAt: '2026-05-19T00:00:00.000Z' })
  await inspectLocalRun({ projectDir: dir })

  const summary = await summarizeInspectionPacket({
    projectDir: dir,
    packet: 'records/exports/local-run-edge-inspection-packet.local.json'
  })

  assert.equal(rules.traces.length, 3)
  assert.ok(summary.schemaRows.some(([schema, count]) => schema === 'media.rule_resolution_trace.local.v1' && count === '3'))
  assert.ok(summary.familyRows.some(([family, count]) => family === 'mediation' && Number(count) === 6))
  assert.ok(summary.mediationRows.some((row) => row[1] === 'forbid' && row[2] === 'urgent'))
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
  assertLayeredAssetIdentity(result.assetDescriptor, {
    expectedPlacementClass: 'media-reference',
    expectedPath: 'media/references/reference.txt',
    expectedRole: 'reference-asset'
  })
  assert.equal(result.assetDescriptor.originRef.kind, 'local-file')
  assert.equal(result.assetDescriptor.originRef.path, 'media/generated/reference.txt')
  assert.equal(result.assetDescriptor.basisRef.refs[0].id, 'media/generated/reference.txt')
  assert.equal(result.assetDescriptor.source.apiCalled, false)
  assert.notEqual(result.assetRecordRef, `records/assets/reference-${result.assetDescriptor.assetId}.local.json`)
  assert.notEqual(result.ingestRecordRef, `records/assets/reference-ingest-${result.assetDescriptor.assetId}.local.json`)
  assert.equal(result.assetRecordRef.startsWith('records/assets/reference-'), true)
  assert.equal(result.ingestRecordRef.startsWith('records/assets/reference-ingest-reference-'), true)
  assert.equal(result.ingestRecord.schema, 'media.reference_ingest.local.v1')
  assert.equal(result.ingestRecord.ingestId.startsWith('reference-ingest-reference-'), true)
  assert.equal(result.ingestRecord.providerTruth, false)
  assert.equal(result.ingestRecord.materializationProof, false)
  assert.equal(validateRequiredRecord(result.assetDescriptor), true)
  assert.equal(validateRequiredRecord(result.ingestRecord), true)

  const written = JSON.parse(
    await readFile(path.join(dir, result.ingestRecordRef), 'utf8')
  )
  assert.equal(written.assetRecordRef.path, result.assetRecordRef)
})

test('reference ingest output filenames stay distinct for same-content references', async () => {
  const dir = await createFixtureProject()
  await writeFile(path.join(dir, 'media', 'generated', 'reference.txt'), 'same reference bytes')

  const first = await ingestReferenceAsset({
    projectDir: dir,
    source: 'media/generated/reference.txt',
    filename: 'reference-a.txt',
    operatorRef: 'operator-test'
  })
  const second = await ingestReferenceAsset({
    projectDir: dir,
    source: 'media/generated/reference.txt',
    filename: 'reference-b.txt',
    operatorRef: 'operator-test'
  })

  assert.equal(first.assetDescriptor.assetId, second.assetDescriptor.assetId)
  assert.equal(first.assetDescriptor.contentId, second.assetDescriptor.contentId)
  assert.notEqual(first.assetRecordRef, second.assetRecordRef)
  assert.notEqual(first.ingestRecordRef, second.ingestRecordRef)
  assert.notEqual(first.assetDescriptor.situationRef.id, second.assetDescriptor.situationRef.id)
  assert.notEqual(first.assetDescriptor.placementRef.id, second.assetDescriptor.placementRef.id)
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

test('media import writes source asset descriptor with metadata and derivative readiness', async () => {
  const dir = await createFixtureProject()
  await writeFile(
    path.join(dir, 'media', 'generated', 'pixel.png'),
    Buffer.from(onePixelPngBase64, 'base64')
  )

  const result = await importMediaAsset({
    projectDir: dir,
    source: 'media/generated/pixel.png',
    placement: 'source',
    filename: 'source-pixel.png',
    operatorRef: 'operator-test',
    ffprobe: false
  })
  const status = await writeProjectStatus({ projectDir: dir, quiet: true })
  const health = await writeProjectHealth({ projectDir: dir, summary: true })

  assert.equal(result.assetDescriptor.schema, 'media.asset.descriptor.v1')
  assert.equal(result.assetDescriptor.localRef.path, 'media/source/source-pixel.png')
  assert.equal(result.assetDescriptor.localRef.placementClass, 'media-source')
  assertLayeredAssetIdentity(result.assetDescriptor, {
    expectedPlacementClass: 'media-source',
    expectedPath: 'media/source/source-pixel.png',
    expectedRole: 'source-media'
  })
  assert.equal(result.assetDescriptor.metadataProbe.mediaKind, 'image')
  assert.equal(result.assetDescriptor.metadataProbe.image.width, 1)
  assert.equal(result.assetDescriptor.derivativeReadiness.evaluate, true)
  assert.deepEqual(result.assetDescriptor.derivativeReadiness.issueCodes, ['missing_thumbnail'])
  assert.equal(result.assetDescriptor.derivativeReadiness.materializationProof, false)
  assert.equal(result.imageMetadata.metadata.width, 1)
  assert.equal(validateRequiredRecord(result.assetDescriptor), true)
  assert.equal(validateRequiredRecord(result.imageMetadata.metadata), true)
  assert.equal(status.status.mediaDerivativeReadiness.evaluatedAssets, 1)
  assert.equal(status.status.mediaDerivativeReadiness.attentionAssets, 1)
  assert.equal(status.status.mediaDerivativeReadiness.assetExplanations[0].issueCodes.includes('missing_thumbnail'), true)
  assert.equal(status.status.mediaDerivativeReadiness.assetExplanations[0].nonClaims.materializationProof, false)
  assert.ok(health.health.operatorHealthExplanations.some((entry) =>
    entry.subjectKind === 'media-asset-derivative-readiness' &&
    entry.issueCodes.includes('missing_thumbnail')
  ))
})

test('media import records unsupported metadata posture without failing import', async () => {
  const dir = await createFixtureProject()

  const result = await importMediaAsset({
    projectDir: dir,
    source: 'media/generated/candidate.txt',
    placement: 'source',
    filename: 'source-notes.txt',
    operatorRef: 'operator-test',
    ffprobe: false
  })
  const status = await writeProjectStatus({ projectDir: dir, quiet: true })

  assert.equal(result.assetDescriptor.contentType, 'text/plain')
  assert.equal(result.assetDescriptor.metadataProbe.metadataProbeState, 'unsupported')
  assert.equal(result.assetDescriptor.metadataProbe.materializationProof, false)
  assert.deepEqual(result.assetDescriptor.derivativeReadiness.issueCodes, ['unsupported_media_type'])
  assert.equal(status.status.mediaDerivativeReadiness.assetExplanations[0].nextAction, 'No derivative preparation is defined for this content type.')
})

test('media derivative readiness maps image video audio and unsupported types', () => {
  assert.deepEqual(derivativeIssueCodesForContentType('image/png'), ['missing_thumbnail'])
  assert.deepEqual(derivativeIssueCodesForContentType('video/mp4'), ['missing_thumbnail', 'missing_proxy'])
  assert.deepEqual(derivativeIssueCodesForContentType('audio/wav'), ['missing_waveform'])
  assert.deepEqual(derivativeIssueCodesForContentType('text/plain'), ['unsupported_media_type'])
})

test('committed tiny PNG media import fixture stays deterministic', async () => {
  const projectDir = 'examples/media-import-fixtures/tiny-png'

  const result = await importMediaAsset({
    projectDir,
    source: 'media/generated/tiny.png',
    placement: 'source',
    filename: 'tiny-source.png',
    operatorRef: 'operator-test',
    ffprobe: false
  })
  const status = await writeProjectStatus({ projectDir, quiet: true })

  assert.equal(result.assetDescriptor.projectId, 'media-import-tiny-png')
  assert.equal(result.assetDescriptor.localRef.path, 'media/source/tiny-source.png')
  assert.equal(result.assetDescriptor.metadataProbe.image.width, 1)
  assert.equal(result.assetDescriptor.metadataProbe.image.height, 1)
  assert.deepEqual(result.assetDescriptor.derivativeReadiness.issueCodes, ['missing_thumbnail'])
  assert.equal(status.status.mediaDerivativeReadiness.evaluatedAssets, 1)
  assert.equal(status.status.mediaDerivativeReadiness.assetExplanations[0].path, 'media/source/tiny-source.png')
  assert.equal(status.status.mediaDerivativeReadiness.assetExplanations[0].nonClaims.byteAvailabilityProof, false)
  assert.equal(status.status.mediaDerivativeReadiness.assetExplanations[0].nonClaims.materializationProof, false)
})

test('thumbnail derivative generation clears image thumbnail readiness locally', async () => {
  const dir = await createFixtureProject()
  await writeFile(
    path.join(dir, 'media', 'generated', 'pixel.png'),
    Buffer.from(onePixelPngBase64, 'base64')
  )

  await importMediaAsset({
    projectDir: dir,
    source: 'media/generated/pixel.png',
    placement: 'source',
    filename: 'source-pixel.png',
    operatorRef: 'operator-test',
    ffprobe: false
  })
  const before = await writeProjectStatus({ projectDir: dir, quiet: true })
  const result = await generateThumbnailDerivatives({ projectDir: dir, maxSize: 64 })
  const after = await writeProjectStatus({ projectDir: dir, quiet: true })
  const derivative = result.generated[0]
  const thumbnailBytes = await readFile(path.join(dir, derivative.derivativeLocalRef.path))

  assert.equal(before.status.mediaDerivativeReadiness.attentionAssets, 1)
  assert.equal(result.generated.length, 1)
  assert.equal(derivative.schema, 'media.derivative.local.v1')
  assert.equal(derivative.derivativeKind, 'thumbnail')
  assert.equal(derivative.derivativeSubjectRef.kind, 'media-derivative-subject')
  assert.equal(derivative.derivativeIdentity.derivativeSubjectRef.id, derivative.derivativeSubjectRef.id)
  assert.equal(derivative.derivativeIdentity.keyKind, 'derivativeKind+contentId+assetDescriptorRef+situationRef+placementRef+localPath')
  assert.equal(derivative.sourceContentRef.id, derivative.derivativeIdentity.sourceContentId)
  assert.equal(derivative.sourceSituationRef.id, derivative.derivativeIdentity.sourceSituationId)
  assert.equal(derivative.sourcePlacementRef.id, derivative.derivativeIdentity.sourcePlacementId)
  assert.equal(derivative.toolRef.tool, 'sharp')
  assert.equal(derivative.output.width, 1)
  assert.equal(derivative.output.height, 1)
  assert.equal(derivative.derivativeLocalRef.path.startsWith('media/thumbnails/thumbnail-'), true)
  assert.equal(thumbnailBytes.length, derivative.output.bytes)
  assert.equal(derivative.byteAvailabilityProof, false)
  assert.equal(derivative.materializationProof, false)
  assert.equal(validateRequiredRecord(derivative), true)
  assert.equal(after.status.mediaDerivativeReadiness.readyAssets, 1)
  assert.equal(after.status.mediaDerivativeReadiness.attentionAssets, 0)
  assert.deepEqual(after.status.mediaDerivativeReadiness.assetExplanations[0].issueCodes, [])
  assert.equal(after.status.mediaDerivativeReadiness.assetExplanations[0].derivativeRefs.length, 1)
  assert.equal(after.status.mediaDerivativeReadiness.assetExplanations[0].satisfiedDerivativeKinds[0], 'thumbnail')
  assert.equal(after.status.mediaDerivativeReadiness.assetExplanations[0].derivativeSubjectRefs[0].id, derivative.derivativeSubjectRef.id)
  assert.match(after.status.mediaDerivativeReadiness.assetExplanations[0].summary, /thumbnail receipt/)
  assert.equal(after.status.mediaDerivativeReadiness.assetExplanations[0].nonClaims.materializationProof, false)
})

test('thumbnail derivative identity stays situation specific for same content', async () => {
  const dir = await createFixtureProject()
  await writeFile(
    path.join(dir, 'media', 'generated', 'pixel.png'),
    Buffer.from(onePixelPngBase64, 'base64')
  )

  const source = await importMediaAsset({
    projectDir: dir,
    source: 'media/generated/pixel.png',
    placement: 'source',
    filename: 'source-pixel.png',
    operatorRef: 'operator-test',
    ffprobe: false
  })
  const reference = await importMediaAsset({
    projectDir: dir,
    source: 'media/generated/pixel.png',
    placement: 'reference',
    filename: 'reference-pixel.png',
    operatorRef: 'operator-test',
    ffprobe: false
  })
  const result = await generateThumbnailDerivatives({ projectDir: dir, maxSize: 64 })
  const status = await writeProjectStatus({ projectDir: dir, quiet: true })

  assert.equal(source.assetDescriptor.contentId, reference.assetDescriptor.contentId)
  assert.notEqual(source.assetDescriptor.situationRef.id, reference.assetDescriptor.situationRef.id)
  assert.equal(result.generated.length, 2)
  assert.equal(new Set(result.generated.map((record) => record.sourceContentRef.id)).size, 1)
  assert.equal(new Set(result.generated.map((record) => record.derivativeSubjectRef.id)).size, 2)
  assert.equal(new Set(result.generated.map((record) => record.derivativeId)).size, 2)
  assert.equal(status.status.mediaDerivativeReadiness.readyAssets, 2)
  assert.equal(status.status.mediaDerivativeReadiness.attentionAssets, 0)
  assert.deepEqual(status.status.mediaDerivativeReadiness.assetExplanations.map((entry) => entry.satisfiedDerivativeKinds[0]), [
    'thumbnail',
    'thumbnail'
  ])
  assert.equal(status.status.mediaDerivativeReadiness.assetExplanations.every((entry) => entry.nonClaims.materializationProof === false), true)
})

test('media summary reports intake derivative and identity posture compactly', async () => {
  const dir = await createFixtureProject()
  await writeFile(
    path.join(dir, 'media', 'generated', 'pixel.png'),
    Buffer.from(onePixelPngBase64, 'base64')
  )

  await importMediaAsset({
    projectDir: dir,
    source: 'media/generated/pixel.png',
    placement: 'source',
    filename: 'source-pixel.png',
    operatorRef: 'operator-test',
    ffprobe: false
  })
  await importMediaAsset({
    projectDir: dir,
    source: 'media/generated/candidate.txt',
    placement: 'source',
    filename: 'source-notes.txt',
    operatorRef: 'operator-test',
    ffprobe: false
  })

  const before = await createMediaSummary({ projectDir: dir })
  const output = await captureConsole(() => writeMediaSummary({ projectDir: dir }))

  assert.equal(before.projectId, 'project-test')
  assert.equal(before.assets.total, 2)
  assert.equal(before.assets.byMediaKind.image, 1)
  assert.equal(before.assets.byMediaKind.unsupported, 1)
  assert.equal(before.metadataProbe.unsupported, 1)
  assert.equal(before.derivativeReadiness.evaluatedAssets, 2)
  assert.equal(before.derivativeReadiness.attentionAssets, 2)
  assert.equal(before.derivativeReadiness.attentionRows.some((row) => row.issueCodes.includes('missing_thumbnail')), true)
  assert.equal(before.derivativeReadiness.attentionRows.some((row) => row.issueCodes.includes('unsupported_media_type')), true)
  assert.equal(before.identity.byteContent.keyKind, 'contentId')
  assert.equal(before.identity.resourceSituations.keyKind, 'assetDescriptorRef+situationRef+placementRef')
  assert.equal(before.approvalLane.proposals, 0)
  assert.equal(before.localOnly, true)
  assert.equal(before.meshTruth, false)
  assert.equal(before.byteAvailabilityProof, false)
  assert.equal(before.materializationProof, false)
  assert.equal(before.resourceAdmission, false)
  assert.ok(output.lines.some((line) => line.startsWith('media summary: project=project-test')))
  assert.ok(output.lines.some((line) => line === 'approval lane: proposals=0 | pendingAuthority=0 | approved=0 | blocked=0'))
  assert.ok(output.lines.some((line) => line.includes('attention: media/source/source-pixel.png')))
  assert.ok(output.lines.some((line) => line.includes('unsupported_media_type')))

  await generateThumbnailDerivatives({ projectDir: dir, maxSize: 64 })
  const after = await createMediaSummary({ projectDir: dir })

  assert.equal(after.derivatives.byKind.thumbnail, 1)
  assert.equal(after.derivativeReadiness.readyAssets, 1)
  assert.equal(after.derivativeReadiness.attentionAssets, 1)
  assert.deepEqual(after.derivativeReadiness.attentionRows.map((row) => row.issueCodes[0]), ['unsupported_media_type'])
})

test('media summary print mode emits parseable local-only JSON', async () => {
  const dir = await createFixtureProject()
  await writeFile(
    path.join(dir, 'media', 'generated', 'pixel.png'),
    Buffer.from(onePixelPngBase64, 'base64')
  )
  await importMediaAsset({
    projectDir: dir,
    source: 'media/generated/pixel.png',
    placement: 'source',
    filename: 'source-pixel.png',
    operatorRef: 'operator-test',
    ffprobe: false
  })
  await generateThumbnailDerivatives({ projectDir: dir, maxSize: 64 })

  const output = await captureConsole(() => writeMediaSummary({ projectDir: dir, print: true }))
  const summary = JSON.parse(output.lines.join('\n'))

  assert.equal(summary.schema, 'media.summary.local.v1')
  assert.equal(summary.assets.byMediaKind.image, 1)
  assert.equal(summary.derivatives.byKind.thumbnail, 1)
  assert.equal(summary.derivativeReadiness.readyAssets, 1)
  assert.equal(summary.approvalLane.localOnly, true)
  assert.equal(summary.approvalLane.approvalAuthority, false)
  assert.equal(summary.localOnly, true)
  assert.equal(summary.providerTruth, false)
  assert.equal(summary.edgeApproval, false)
})

test('ffprobe posture normalizes unavailable failed and available results without real video', async () => {
  const dir = await createFixtureProject()
  const filePath = path.join(dir, 'media', 'generated', 'candidate.txt')
  const hash = {
    algorithm: 'sha256',
    value: sha256Hex('candidate bytes')
  }
  const localRef = {
    path: 'media/generated/candidate.txt',
    placementClass: 'media-generated',
    localOnly: true
  }
  const unavailable = await probeLocalMediaMetadata({
    filePath,
    localRef,
    contentType: 'video/mp4',
    hash,
    size: 15,
    ffprobe: false
  })
  const failed = normalizeFfprobeProbeResult({
    status: 'failed',
    reason: 'synthetic ffprobe failure'
  })
  const summary = summarizeFfprobe({
    format: {
      duration: '2.500000',
      format_name: 'mov,mp4,m4a,3gp,3g2,mj2'
    },
    streams: [
      {
        codec_type: 'video',
        codec_name: 'h264',
        width: 1920,
        height: 1080,
        avg_frame_rate: '30000/1001'
      },
      {
        codec_type: 'audio',
        codec_name: 'aac',
        sample_rate: '48000',
        channels: 2
      }
    ]
  })
  const available = await probeLocalMediaMetadata({
    filePath,
    localRef,
    contentType: 'video/mp4',
    hash,
    size: 15,
    ffprobe: async () => ({
      status: 'available',
      summary
    })
  })

  assert.equal(unavailable.metadataProbeState, 'unavailable')
  assert.equal(unavailable.toolRefs[0].status, 'unavailable')
  assert.equal(unavailable.materializationProof, false)
  assert.equal(failed.status, 'failed')
  assert.equal(failed.reason, 'synthetic ffprobe failure')
  assert.equal(summary.duration, 2.5)
  assert.equal(summary.video.codec, 'h264')
  assert.equal(Math.round(summary.video.fps), 30)
  assert.equal(summary.audio.sampleRate, 48000)
  assert.equal(available.metadataProbeState, 'available')
  assert.equal(available.ffprobe.video.width, 1920)
  assert.equal(available.ffprobe.materializationProof, false)
})

test('media import blocks unsafe refs and unsupported placements', async () => {
  const dir = await createFixtureProject()

  await assert.rejects(
    () => importMediaAsset({
      projectDir: dir,
      source: '../outside.mp4'
    }),
    /Local ref path/
  )
  await assert.rejects(
    () => importMediaAsset({
      projectDir: dir,
      source: 'media/generated/candidate.txt',
      filename: '../candidate.txt'
    }),
    /Filename must not include path separators/
  )
  await assert.rejects(
    () => importMediaAsset({
      projectDir: dir,
      source: 'media/generated/candidate.txt',
      placement: 'accepted'
    }),
    /Unsupported media import placement/
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
  assert.equal(result.review.selectedAssetDescriptorRef.id, reference.assetDescriptor.assetDescriptorRef.id)
  assert.equal(result.review.selectedSituationRef.id, reference.assetDescriptor.situationRef.id)
  assert.equal(result.review.selectedPlacementRef.id, reference.assetDescriptor.placementRef.id)
  assert.equal(result.review.meshTruth, false)
  assert.equal(validateRequiredRecord(result.review), true)

  const written = JSON.parse(await readFile(path.join(dir, result.output), 'utf8'))
  assert.equal(written.operatorRef, 'operator-test')
})

test('candidate review rejects ambiguous selectedAssetId and accepts situation selector', async () => {
  const dir = await createFixtureProject()
  const result = await runFirstWedge({
    projectDir: dir,
    decision: 'accepted',
    operatorRef: 'operator-test'
  })
  await mkdir(path.join(dir, 'media', 'references'), { recursive: true })
  await writeFile(path.join(dir, 'media', 'references', 'candidate.txt'), 'candidate bytes')
  const referenceAsset = structuredClone(result.outputs.assetDescriptor)
  referenceAsset.localRef = {
    ...referenceAsset.localRef,
    placementClass: 'media-reference',
    path: 'media/references/candidate.txt'
  }
  referenceAsset.placementRef = {
    ...referenceAsset.placementRef,
    id: `placement:${referenceAsset.projectId}:media/references/candidate.txt`,
    path: 'media/references/candidate.txt',
    placementClass: 'media-reference',
    lifecycleState: 'source'
  }
  referenceAsset.situationRef = {
    ...referenceAsset.situationRef,
    id: `situation:${referenceAsset.projectId}:reference-asset:${referenceAsset.placementRef.id}`,
    role: 'reference-asset',
    placementRef: {
      kind: referenceAsset.placementRef.kind,
      id: referenceAsset.placementRef.id
    }
  }
  await writeFile(
    path.join(dir, 'records', 'assets', 'reference-same-content.local.json'),
    `${JSON.stringify(referenceAsset, null, 2)}\n`
  )

  await assert.rejects(
    () => writeCandidateReview({
      projectDir: dir,
      selectedAssetId: result.outputs.assetDescriptor.assetId,
      operatorRef: 'operator-test'
    }),
    /Selected asset id is ambiguous/
  )
  await assert.rejects(
    () => writeCandidateReview({
      projectDir: dir,
      selectedAssetDescriptorRef: result.outputs.assetDescriptor.assetDescriptorRef.id,
      operatorRef: 'operator-test'
    }),
    /Selected asset descriptor ref is ambiguous/
  )

  const review = await writeCandidateReview({
    projectDir: dir,
    selectedSituationRef: referenceAsset.situationRef.id,
    operatorRef: 'operator-test'
  })

  assert.equal(review.review.selectedAssetRef.id, referenceAsset.assetId)
  assert.equal(review.review.selectedSituationRef.id, referenceAsset.situationRef.id)
  assert.equal(review.review.selectedPlacementRef.id, referenceAsset.placementRef.id)
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
  assert.equal(proposal.contentId, result.outputs.assetDescriptor.contentId)
  assert.equal(proposal.byteDescriptorProposalId, `byte-descriptor-proposal-sha256-${result.outputs.assetDescriptor.hash.value}`)
  assert.equal(proposal.sourceContentRef.id, result.outputs.assetDescriptor.contentId)
  assert.equal(proposal.sourceAssetRef.id, result.outputs.assetDescriptor.assetId)
  assert.equal(proposal.sourceAssetRefs.length, 1)
  assert.equal(proposal.sourceAssetRefs[0].id, result.outputs.assetDescriptor.assetId)
  assert.equal(proposal.sharedBySituationRefs[0].id, result.outputs.assetDescriptor.situationRef.id)
  assert.equal(proposal.proposedByteDescriptor.contentId, result.outputs.assetDescriptor.contentId)
  assert.equal(proposal.proposedByteDescriptor.sourceContentRef.id, result.outputs.assetDescriptor.contentId)
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

test('byte descriptor proposals dedupe same content across divergent asset descriptors', async () => {
  const dir = await createFixtureProject()
  const result = await runFirstWedge({
    projectDir: dir,
    decision: 'accepted',
    operatorRef: 'operator-test'
  })
  await mkdir(path.join(dir, 'media', 'references'), { recursive: true })
  await writeFile(path.join(dir, 'media', 'references', 'candidate.txt'), 'candidate bytes')
  const referenceAsset = structuredClone(result.outputs.assetDescriptor)
  referenceAsset.assetId = 'asset-reference-same-content'
  referenceAsset.assetDescriptorRef = {
    ...referenceAsset.assetDescriptorRef,
    id: referenceAsset.assetId
  }
  referenceAsset.artifactDescriptorRef = referenceAsset.assetDescriptorRef
  referenceAsset.localRef = {
    ...referenceAsset.localRef,
    placementClass: 'media-reference',
    path: 'media/references/candidate.txt'
  }
  referenceAsset.placementRef = {
    ...referenceAsset.placementRef,
    id: `placement:${referenceAsset.projectId}:media/references/candidate.txt`,
    path: 'media/references/candidate.txt',
    placementClass: 'media-reference',
    lifecycleState: 'source'
  }
  referenceAsset.situationRef = {
    ...referenceAsset.situationRef,
    id: `situation:${referenceAsset.projectId}:reference-asset:${referenceAsset.placementRef.id}`,
    role: 'reference-asset',
    placementRef: {
      kind: referenceAsset.placementRef.kind,
      id: referenceAsset.placementRef.id
    }
  }
  await writeFile(
    path.join(dir, 'records', 'assets', 'reference-same-content.local.json'),
    `${JSON.stringify(referenceAsset, null, 2)}\n`
  )

  const { proposals } = await writeByteDescriptorProposals({ projectDir: dir })

  assert.equal(proposals.length, 1)
  const proposal = proposals[0].proposal
  assert.equal(proposal.contentId, result.outputs.assetDescriptor.contentId)
  assert.equal(proposal.sourceContentRef.id, result.outputs.assetDescriptor.contentId)
  assert.deepEqual(
    proposal.sourceAssetRefs.map((ref) => ref.id).sort(),
    [result.outputs.assetDescriptor.assetId, referenceAsset.assetId].sort()
  )
  assert.deepEqual(
    proposal.sharedBySituationRefs.map((ref) => ref.id).sort(),
    [result.outputs.assetDescriptor.situationRef.id, referenceAsset.situationRef.id].sort()
  )
  assert.equal(proposal.sourceAssetRef.id, result.outputs.assetDescriptor.assetId)
  assert.equal(proposal.byteAvailabilityProof, false)
  assert.equal(proposal.materializationProof, false)
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
  assert.equal(candidate.contentId, result.outputs.assetDescriptor.contentId)
  assert.equal(candidate.sourceContentRef.id, result.outputs.assetDescriptor.contentId)
  assert.equal(candidate.sourceAssetDescriptorRef.id, result.outputs.assetDescriptor.assetDescriptorRef.id)
  assert.equal(candidate.sourceSituationRef.id, result.outputs.assetDescriptor.situationRef.id)
  assert.equal(candidate.sourcePlacementRef.id, result.outputs.assetDescriptor.placementRef.id)
  assert.equal(candidate.resourceKind, 'media-asset-by-situation')
  assert.equal(candidate.currentRefCategory, 'device_dependent_scaffold')
  assert.equal(candidate.targetRefCategory, 'local_layer_resource_ref')
  assert.equal(candidate.localLayerResourceRef, false)
  assert.equal(candidate.replicatedPointerRef, false)
  assert.equal(candidate.causalReviewableRef, false)
  assert.equal(candidate.proposedResourceRef.candidateOnly, true)
  assert.equal(candidate.proposedResourceRef.promotionStatus, 'candidate-only')
  assert.equal(candidate.proposedResourceRef.promotionAuthority, false)
  assert.equal(candidate.resourceAdmission, false)
  assert.equal(candidate.materializationProof, false)
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
  assert.equal(candidate.proposedResourceRef.byteDescriptorProposalRef.id, `byte-descriptor-proposal-sha256-${result.outputs.assetDescriptor.hash.value}`)
  assert.equal(candidate.proposedResourceRef.id.startsWith('media-resource:'), true)
  assert.equal(candidate.proposedResourceRef.contentId, result.outputs.assetDescriptor.contentId)
  assert.equal(candidate.proposedResourceRef.assetDescriptorRef.id, result.outputs.assetDescriptor.assetDescriptorRef.id)
  assert.equal(candidate.proposedResourceRef.situationRef.id, result.outputs.assetDescriptor.situationRef.id)
  assert.equal(candidate.proposedResourceRef.placementRef.id, result.outputs.assetDescriptor.placementRef.id)
  assert.equal(candidate.proposedResourceRef.identitySeed.includes(result.outputs.assetDescriptor.situationRef.id), true)
  assert.equal(candidate.proposedResourceRef.identitySeed.includes(result.outputs.assetDescriptor.placementRef.id), true)
  assert.equal(validateRequiredRecord(candidate), true)
})

test('resource candidates stay situation specific for same-content accepted and reference descriptors', async () => {
  const dir = await createFixtureProject()
  const result = await runFirstWedge({
    projectDir: dir,
    decision: 'accepted',
    operatorRef: 'operator-test'
  })
  await mkdir(path.join(dir, 'media', 'references'), { recursive: true })
  await writeFile(path.join(dir, 'media', 'references', 'candidate.txt'), 'candidate bytes')
  const referenceAsset = structuredClone(result.outputs.assetDescriptor)
  referenceAsset.localRef = {
    ...referenceAsset.localRef,
    placementClass: 'media-reference',
    path: 'media/references/candidate.txt'
  }
  referenceAsset.placementRef = {
    ...referenceAsset.placementRef,
    id: `placement:${referenceAsset.projectId}:media/references/candidate.txt`,
    path: 'media/references/candidate.txt',
    placementClass: 'media-reference',
    lifecycleState: 'source'
  }
  referenceAsset.situationRef = {
    ...referenceAsset.situationRef,
    id: `situation:${referenceAsset.projectId}:reference-asset:${referenceAsset.placementRef.id}`,
    role: 'reference-asset',
    placementRef: {
      kind: referenceAsset.placementRef.kind,
      id: referenceAsset.placementRef.id
    }
  }
  await writeFile(
    path.join(dir, 'records', 'assets', 'reference-same-content.local.json'),
    `${JSON.stringify(referenceAsset, null, 2)}\n`
  )

  const { proposals } = await writeByteDescriptorProposals({ projectDir: dir })
  const repair = await repairLocalPosture({ projectDir: dir, refreshOperator: false })
  const resourceFiles = (await readdir(path.join(dir, 'records', 'resources')))
    .filter((file) => file.endsWith('.json'))
    .sort()
  const resourceCandidates = await Promise.all(resourceFiles.map(async (file) =>
    JSON.parse(await readFile(path.join(dir, 'records', 'resources', file), 'utf8'))
  ))
  const status = await writeProjectStatus({ projectDir: dir, quiet: true })
  const readiness = await writeEdgeReadinessGuidance({ projectDir: dir, quiet: true })

  assert.equal(proposals.length, 1)
  assert.equal(repair.repairs.find((entry) => entry.repairKind === 'local_layer_resource_ref_candidates')?.recordsWritten, 2)
  assert.equal(resourceCandidates.length, 2)
  assert.notEqual(resourceCandidates[0].resourceRefCandidateId, resourceCandidates[1].resourceRefCandidateId)
  assert.notEqual(resourceCandidates[0].proposedResourceRef.id, resourceCandidates[1].proposedResourceRef.id)
  assert.deepEqual(
    resourceCandidates.map((candidate) => candidate.sourceRef.id),
    [result.outputs.assetDescriptor.assetId, result.outputs.assetDescriptor.assetId]
  )
  assert.deepEqual(
    resourceCandidates.map((candidate) => candidate.sourceContentRef.id),
    [result.outputs.assetDescriptor.contentId, result.outputs.assetDescriptor.contentId]
  )
  assert.deepEqual(
    resourceCandidates.map((candidate) => candidate.sourceSituationRef.id).sort(),
    [result.outputs.assetDescriptor.situationRef.id, referenceAsset.situationRef.id].sort()
  )
  assert.deepEqual(
    resourceCandidates.map((candidate) => candidate.sourcePlacementRef.id).sort(),
    [result.outputs.assetDescriptor.placementRef.id, referenceAsset.placementRef.id].sort()
  )
  assert.deepEqual(
    resourceCandidates.map((candidate) => candidate.proposedResourceRef.byteDescriptorProposalRef.id),
    [proposals[0].proposal.byteDescriptorProposalId, proposals[0].proposal.byteDescriptorProposalId]
  )
  for (const candidate of resourceCandidates) {
    assert.equal(candidate.proposedResourceRef.candidateOnly, true)
    assert.equal(candidate.proposedResourceRef.promotionAuthority, false)
    assert.equal(candidate.proposedResourceRef.resourceAdmission, false)
    assert.equal(candidate.proposedResourceRef.materializationProof, false)
    assert.equal(candidate.resourceAdmission, false)
    assert.equal(candidate.materializationProof, false)
    assert.equal(candidate.localLayerResourceRef, false)
    assert.equal(candidate.meshTruth, false)
    assert.equal(validateRequiredRecord(candidate), true)
  }
  assert.equal(status.status.assetResourceConsistency.readyForEdgeInspection, true)
  assert.equal(status.status.assetResourceConsistency.bytePosture.coveredContentIds, 1)
  assert.equal(status.status.assetResourceConsistency.bytePosture.expectedContentIds, 1)
  assert.equal(status.status.assetResourceConsistency.resourcePosture.coveredSituationPlacements, 2)
  assert.equal(status.status.assetResourceConsistency.resourcePosture.expectedSituationPlacements, 2)
  assert.equal(status.status.assetResourceConsistency.identityWarningCount, 1)
  assert.equal(status.status.assetResourceConsistency.duplicateAssetIdSituationWarnings[0].issueCode, 'duplicate_asset_id_distinct_situations')
  assert.equal(status.status.assetResourceConsistency.duplicateAssetIdSituationWarnings[0].assetId, result.outputs.assetDescriptor.assetId)
  assert.ok(status.status.warnings.some((warning) => warning.includes('appears in 2 distinct situations')))
  assert.equal(status.status.assetResourceConsistency.assetExplanations.every((entry) =>
    entry.identityWarnings.includes('duplicate_asset_id_distinct_situations')
  ), true)
  assert.equal(readiness.readiness.state, 'ready')
  assert.equal(readiness.readiness.resolvabilitySummary.bytePosture.coveredContentIds, 1)
  assert.equal(readiness.readiness.resolvabilitySummary.resourcePosture.coveredSituationPlacements, 2)
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
  assert.equal(result.readiness.resolvabilitySummary.missingByteDescriptorProposalContentIds.length, 1)
  assert.equal(result.readiness.resolvabilitySummary.bytePosture.keyKind, 'contentId')
  assert.equal(result.readiness.resolvabilitySummary.resourcePosture.keyKind, 'assetDescriptorRef+situationRef+placementRef')
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
  assert.equal(result.readiness.resolvabilitySummary.bytePosture.coveredContentIds, 1)
  assert.equal(result.readiness.resolvabilitySummary.resourcePosture.coveredSituationPlacements, 1)
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
  assert.equal(result.status.assetResourceConsistency.bytePosture.coveredContentIds, 1)
  assert.equal(result.status.assetResourceConsistency.resourcePosture.coveredSituationPlacements, 1)
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
  assert.equal(result.status.assetResourceConsistency.missingByteDescriptorProposalContentIds.length, 1)
  assert.equal(result.status.assetResourceConsistency.missingResourceRefCandidateAssetIds.length, 1)
  assert.equal(result.status.assetResourceConsistency.missingResourceRefCandidateSubjectRefs.length, 1)
  assert.equal(result.status.assetResourceConsistency.bytePosture.keyKind, 'contentId')
  assert.equal(result.status.assetResourceConsistency.resourcePosture.keyKind, 'assetDescriptorRef+situationRef+placementRef')
  assert.equal(result.status.assetResourceConsistency.assetExplanations.length, 1)
  assert.equal(result.status.assetResourceConsistency.assetExplanations[0].state, 'needs-local-attention')
  assert.equal(result.status.assetResourceConsistency.assetExplanations[0].bytePosture.contentId.startsWith('sha256:'), true)
  assert.equal(result.status.assetResourceConsistency.assetExplanations[0].resourcePosture.resourceSubjectRef.includes('placement:'), true)
  assert.ok(result.status.assetResourceConsistency.assetExplanations[0].reasons.includes('missing byte descriptor proposal'))
  assert.deepEqual(result.status.assetResourceConsistency.assetExplanations[0].issueCodes, [
    'missing_byte_descriptor_proposal',
    'missing_resource_ref_candidate',
    'accepted_asset_without_byte_resource_posture'
  ])
  assert.equal(result.status.assetResourceConsistency.assetExplanations[0].nextAction, 'Run npm run bytes:proposal, then npm run resource:refs.')
  assert.equal(result.status.assetResourceConsistency.assetExplanations[0].nonClaims.byteAvailabilityProof, false)
  assert.equal(result.status.assetResourceConsistency.assetExplanations[0].nonClaims.materializationProof, false)
  assert.equal(result.status.assetResourceConsistency.assetExplanations[0].nonClaims.resourceAdmission, false)
  assert.ok(result.status.warnings.some((warning) => warning.includes('content-keyed byte posture')))
  assert.equal(validateRequiredRecord(result.status), true)
})

test('project health and inspection summaries include per-asset attention rows', async () => {
  const dir = await createFixtureProject()
  await runFirstWedge({
    projectDir: dir,
    decision: 'accepted',
    operatorRef: 'operator-test'
  })

  const { result: healthResult, lines } = await captureConsole(() => writeProjectHealth({
    projectDir: dir,
    summary: true
  }))
  await inspectLocalRun({ projectDir: dir })
  const summary = await summarizeInspectionPacket({
    projectDir: dir,
    packet: 'records/exports/local-run-edge-inspection-packet.local.json'
  })

  assert.equal(healthResult.health.healthState, 'needs-local-attention')
  assert.equal(healthResult.health.assetHealthExplanations.length, 1)
  assert.deepEqual(healthResult.health.assetHealthExplanations[0].issueCodes, [
    'missing_byte_descriptor_proposal',
    'missing_resource_ref_candidate',
    'accepted_asset_without_byte_resource_posture'
  ])
  assert.equal(healthResult.health.assetHealthExplanations[0].nextAction, 'Run npm run bytes:proposal, then npm run resource:refs.')
  assert.equal(healthResult.health.assetHealthExplanations[0].nonClaims.byteAvailabilityProof, false)
  assert.equal(healthResult.health.assetHealthExplanations[0].nonClaims.resourceAdmission, false)
  assert.ok(lines.some((line) => line.includes('media-asset: media/accepted/candidate.txt') && line.includes('missing_byte_descriptor_proposal')))
  assert.ok(summary.healthAttentionRows.some((row) =>
    row[0] === 'media/accepted/candidate.txt' &&
    row[2].includes('missing_byte_descriptor_proposal') &&
    row[3].includes('bytes:proposal')
  ))
})

test('project status and readiness keep content byte proposals while flagging stale resource candidates', async () => {
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
  assert.equal(status.status.assetResourceConsistency.staleByteDescriptorProposalIds.length, 0)
  assert.equal(status.status.assetResourceConsistency.staleResourceCandidateIds.length, 1)
  assert.ok(status.status.assetResourceConsistency.assetExplanations[0].issueCodes.includes('stale_resource_ref_candidate'))
  assert.equal(status.status.assetResourceConsistency.assetExplanations[0].nextAction, 'Run npm run resource:refs after byte proposals are current.')
  assert.equal(readiness.readiness.state, 'caution')
  assert.equal(readiness.readiness.resolvabilitySummary.staleByteDescriptorProposalIds.length, 0)
  assert.equal(readiness.readiness.resolvabilitySummary.staleResourceCandidateIds.length, 1)
  assert.equal(readiness.readiness.resolvabilitySummary.bytePosture.staleProposalIds.length, 0)
  assert.equal(readiness.readiness.resolvabilitySummary.resourcePosture.staleCandidateIds.length, 1)
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
  assert.equal(result.health.assetResourceConsistency.assetExplanations[0].state, 'ready-for-local-inspection')
  assert.deepEqual(result.health.assetHealthExplanations, [])
  assert.deepEqual(result.health.productionHealthExplanations, [])
  assert.deepEqual(result.health.operatorHealthExplanations, [])
  assert.equal(result.health.productionValidation.valid, true)
  assert.equal(result.health.meshTruth, false)
  assert.equal(result.health.edgeRuntimeVerified, false)
  assert.equal(validateRequiredRecord(result.health), true)
})

test('local posture repair generates missing byte and resource records without new decisions', async () => {
  const dir = await createFixtureProject()
  await runFirstWedge({
    projectDir: dir,
    decision: 'accepted',
    operatorRef: 'operator-test'
  })
  const decisionCountBefore = await countJsonFiles(path.join(dir, 'records', 'decisions'))

  const summary = await repairLocalPosture({ projectDir: dir })
  const health = await writeProjectHealth({ projectDir: dir, summary: true })
  const decisionCountAfter = await countJsonFiles(path.join(dir, 'records', 'decisions'))

  assert.equal(summary.repairGroups, 2)
  assert.equal(summary.repaired, 2)
  assert.equal(summary.remainingAttention, 0)
  assert.deepEqual(summary.remainingIssueCodes, [])
  assert.equal(summary.nonClaims.meshTruth, false)
  assert.equal(summary.nonClaims.byteAvailabilityProof, false)
  assert.equal(summary.nonClaims.materializationProof, false)
  assert.equal(summary.nonClaims.resourceAdmission, false)
  assert.equal(decisionCountAfter, decisionCountBefore)
  assert.equal(health.health.assetResourceConsistency.readyForEdgeInspection, true)
  assert.equal(health.health.operatorHealthExplanations.length, 0)
})

test('local posture repair regenerates stale resource candidates', async () => {
  const dir = await createFixtureProject()
  await runFirstWedge({
    projectDir: dir,
    decision: 'accepted',
    operatorRef: 'operator-test'
  })
  await writeByteDescriptorProposals({ projectDir: dir, quiet: true })
  await writeLocalLayerResourceRefCandidates({ projectDir: dir, quiet: true })
  const resourceCandidatePath = await firstJsonFile(path.join(dir, 'records', 'resources'))
  const resourceCandidate = JSON.parse(await readFile(resourceCandidatePath, 'utf8'))
  resourceCandidate.proposedResourceRef.localRef.path = 'media/accepted/stale-candidate.txt'
  await writeFile(resourceCandidatePath, `${JSON.stringify(resourceCandidate, null, 2)}\n`)

  const before = await writeProjectHealth({ projectDir: dir, summary: true })
  const summary = await repairLocalPosture({ projectDir: dir })
  const after = await writeProjectHealth({ projectDir: dir, summary: true })

  assert.ok(before.health.operatorHealthExplanations[0].issueCodes.includes('stale_resource_ref_candidate'))
  assert.equal(summary.repairGroups, 1)
  assert.equal(summary.repairs[0].repairKind, 'local_layer_resource_ref_candidates')
  assert.equal(summary.nonClaims.resourceAdmission, false)
  assert.equal(after.health.assetResourceConsistency.staleResourceCandidateIds.length, 0)
  assert.equal(after.health.operatorHealthExplanations.length, 0)
})

test('local posture repair regenerates stale production descriptors', async () => {
  const dir = await createFixtureProject()
  await runFirstWedge({
    projectDir: dir,
    decision: 'accepted',
    operatorRef: 'operator-test'
  })
  await writeByteDescriptorProposals({ projectDir: dir, quiet: true })
  await writeLocalLayerResourceRefCandidates({ projectDir: dir, quiet: true })
  await writeProductionRecordsFromCard({ projectDir: dir, quiet: true })
  const sceneUnitPath = path.join(dir, 'records', 'production', 'sceneUnit.local.json')
  const sceneUnit = JSON.parse(await readFile(sceneUnitPath, 'utf8'))
  sceneUnit.createdAt = '2099-01-01T00:00:00.000Z'
  await writeFile(sceneUnitPath, `${JSON.stringify(sceneUnit, null, 2)}\n`)

  const before = await writeProjectHealth({ projectDir: dir, summary: true })
  const summary = await repairLocalPosture({ projectDir: dir })
  const after = await writeProjectHealth({ projectDir: dir, summary: true })

  assert.ok(before.health.operatorHealthExplanations.some((entry) => entry.issueCodes.includes('stale_production_descriptor')))
  assert.equal(summary.repairGroups, 1)
  assert.equal(summary.repairs[0].repairKind, 'production_descriptors')
  assert.equal(summary.repairs[0].causalTruth, false)
  assert.equal(summary.repairs[0].publicationAuthorization, false)
  assert.equal(after.health.productionValidation.freshness.staleDescriptorIds.length, 0)
  assert.equal(after.health.operatorHealthExplanations.length, 0)
})

test('identity fixture keeps shared basis while divergent situations get distinct resource identities', async () => {
  const root = path.resolve('examples/identity-fixtures/shared-basis-divergent-situations')
  const expectedHash = '20fe25a95cc615686e07012a808a3c3a74cfd35430f437de345f4e3b4b18ebfd'
  const contentId = `sha256:${expectedHash}`

  const generatedBytes = await readFile(path.join(root, 'media/generated/candidate.txt'))
  const acceptedBytes = await readFile(path.join(root, 'media/accepted/candidate.txt'))
  const referenceBytes = await readFile(path.join(root, 'media/references/candidate.txt'))
  assert.equal(sha256Hex(generatedBytes), expectedHash)
  assert.equal(sha256Hex(acceptedBytes), expectedHash)
  assert.equal(sha256Hex(referenceBytes), expectedHash)

  const accepted = JSON.parse(await readFile(path.join(root, 'records/assets/accepted-candidate.local.json'), 'utf8'))
  const reference = JSON.parse(await readFile(path.join(root, 'records/assets/reference-candidate.local.json'), 'utf8'))
  const byteProposal = JSON.parse(await readFile(
    path.join(root, `records/bytes/byte-descriptor-proposal-sha256-${expectedHash}.local.json`),
    'utf8'
  ))
  const acceptedResource = JSON.parse(await readFile(
    path.join(root, 'records/resources/resource-ref-candidate-accepted-candidate.local.json'),
    'utf8'
  ))
  const referenceResource = JSON.parse(await readFile(
    path.join(root, 'records/resources/resource-ref-candidate-reference-candidate.local.json'),
    'utf8'
  ))

  for (const record of [accepted, reference, byteProposal, acceptedResource, referenceResource]) {
    assert.equal(validateRequiredRecord(record), true)
    assert.equal(record.localOnly, true)
    assert.equal(record.meshTruth, false)
    assert.equal(record.distributedProof, false)
    assert.equal(record.ratifiedSharedState, false)
  }

  assert.equal(accepted.contentId, contentId)
  assert.equal(reference.contentId, contentId)
  assert.equal(byteProposal.contentId, contentId)
  assert.equal(accepted.basisRef.id, reference.basisRef.id)
  assert.equal(accepted.originRef.id, reference.originRef.id)
  assert.notEqual(accepted.assetDescriptorRef.id, reference.assetDescriptorRef.id)
  assert.notEqual(accepted.situationRef.id, reference.situationRef.id)
  assert.notEqual(accepted.placementRef.id, reference.placementRef.id)
  assert.notEqual(accepted.placementRef.path, reference.placementRef.path)

  assert.equal(byteProposal.sharedBySituationRefs.length, 2)
  assert.deepEqual(
    byteProposal.sharedBySituationRefs.map((entry) => entry.id).sort(),
    [accepted.situationRef.id, reference.situationRef.id].sort()
  )
  assert.equal(byteProposal.byteAvailabilityProof, false)
  assert.equal(byteProposal.materializationProof, false)

  assert.notEqual(acceptedResource.resourceRefCandidateId, referenceResource.resourceRefCandidateId)
  assert.equal(acceptedResource.contentId, contentId)
  assert.equal(referenceResource.contentId, contentId)
  assert.equal(acceptedResource.proposedResourceRef.situationRef.id, accepted.situationRef.id)
  assert.equal(referenceResource.proposedResourceRef.situationRef.id, reference.situationRef.id)
  assert.equal(acceptedResource.proposedResourceRef.placementRef.id, accepted.placementRef.id)
  assert.equal(referenceResource.proposedResourceRef.placementRef.id, reference.placementRef.id)
  assert.equal(acceptedResource.proposedResourceRef.byteDescriptorProposalRef.id, byteProposal.byteDescriptorProposalId)
  assert.equal(referenceResource.proposedResourceRef.byteDescriptorProposalRef.id, byteProposal.byteDescriptorProposalId)
  assert.notEqual(acceptedResource.proposedResourceRef.identitySeed, referenceResource.proposedResourceRef.identitySeed)
  assert.equal(acceptedResource.localLayerResourceRef, false)
  assert.equal(referenceResource.localLayerResourceRef, false)
  assert.equal(acceptedResource.promotionPosture.promotionAuthority, false)
  assert.equal(referenceResource.promotionPosture.promotionAuthority, false)

  assert.equal(accepted.causalRefs.deferred, true)
  assert.equal(reference.causalRefs.deferred, true)
  assert.equal(acceptedResource.causalRefs.deferred, true)
  assert.equal(referenceResource.causalRefs.deferred, true)
  assert.equal(accepted.observerSituationViewRef.deferred, true)
  assert.equal(reference.observerSituationViewRef.deferred, true)
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
  assert.deepEqual(summary.healthAttentionRows, [])

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
  await writeRuleResolutionExample({ projectDir: dir, createdAt: '2026-05-19T00:00:00.000Z' })
  await writeProjectHealth({ projectDir: dir, summary: true })
  await inspectLocalRun({ projectDir: dir })
  await writeControlSurfaceProjection({ projectDir: dir })
  const compatibility = await writeEdgeCompatibilityBundle({ projectDir: dir })

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
  assert.equal(firstIndex.index.summary.operatorHealthExplanations, 0)
  assert.deepEqual(firstIndex.index.operatorHealthExplanations, [])
  assert.equal(validateRequiredRecord(firstIndex.index), true)
  assert.ok(compatibility.bundle.studioSourceRefs.some((ref) => ref.schema === 'media.rule_resolution_trace.local.v1'))

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
  assert.equal(secondIndex.index.mediationRefs.length, 3)
  assert.equal(secondIndex.index.summary.operatorDecisionRequests, 1)
  assert.equal(secondIndex.index.summary.ruleResolutionTraces, 3)
  assert.equal(secondIndex.index.summary.operatorHealthExplanations, 0)
  assert.ok(summary.familyRows.some((row) => row[0] === 'handoff' && Number(row[1]) >= 2))
  assert.ok(summary.familyRows.some((row) => row[0] === 'requests' && Number(row[1]) === 1))
  assert.ok(summary.familyRows.some((row) => row[0] === 'mediation' && Number(row[1]) === 6))
})

test('local Edge seam artifacts correlate by project refs', async () => {
  const dir = await createFixtureProject()
  await runFirstWedge({
    projectDir: dir,
    decision: 'accepted',
    operatorRef: 'operator-test'
  })
  await writeByteDescriptorProposals({ projectDir: dir })
  await writeLocalLayerResourceRefCandidates({ projectDir: dir })
  await writeProductionRecordsFromCard({ projectDir: dir })
  await writeRuleResolutionExample({ projectDir: dir, createdAt: '2026-05-19T00:00:00.000Z' })
  const healthResult = await writeProjectHealth({ projectDir: dir, summary: true })
  const inspectionResult = await inspectLocalRun({ projectDir: dir })
  await writeControlSurfaceProjection({ projectDir: dir })
  const compatibilityResult = await writeEdgeCompatibilityBundle({ projectDir: dir })
  const indexResult = await writeOperatorPacketIndex({ projectDir: dir })
  const handoffResult = await writeEdgeHandoffCandidate({ projectDir: dir })
  const requestResult = await writeOperatorDecisionRequest({ projectDir: dir })

  assert.equal(compatibilityResult.bundle.projectId, healthResult.health.projectId)
  assert.equal(handoffResult.handoff.projectId, healthResult.health.projectId)
  assert.equal(requestResult.request.projectId, healthResult.health.projectId)
  assert.equal(indexResult.index.projectId, healthResult.health.projectId)
  assert.equal(handoffResult.handoff.inspectionPacketRef.id, inspectionResult.packet.packetId)
  assert.equal(handoffResult.handoff.compatibilityBundleRef.id, compatibilityResult.bundle.compatibilityBundleId)
  assert.equal(handoffResult.handoff.projectHealthRef.id, healthResult.health.healthId)
  assert.equal(handoffResult.handoff.operatorPacketIndexRef.id, indexResult.index.indexId)
  assert.equal(requestResult.request.subjectRef.id, handoffResult.handoff.handoffCandidateId)
  assert.ok(requestResult.request.sourceRefs.some((ref) => ref.id === compatibilityResult.bundle.compatibilityBundleId))
  assert.ok(compatibilityResult.bundle.studioSourceRefs.some((ref) => ref.id === inspectionResult.packet.packetId))
  assert.ok(indexResult.index.packetRefs.some((ref) => ref.id === inspectionResult.packet.packetId))
  assert.ok(indexResult.index.bundleRefs.some((ref) => ref.id === compatibilityResult.bundle.compatibilityBundleId))
  assert.ok(indexResult.index.healthRefs.some((ref) => ref.id === healthResult.health.healthId))
  assert.equal(handoffResult.handoff.edgeRuntimeVerified, false)
  assert.equal(requestResult.request.requestOnly, true)
  assert.equal(validateRequiredRecord(inspectionResult.packet), true)
  assert.equal(validateRequiredRecord(compatibilityResult.bundle), true)
  assert.equal(validateRequiredRecord(indexResult.index), true)
  assert.equal(validateRequiredRecord(handoffResult.handoff), true)
  assert.equal(validateRequiredRecord(requestResult.request), true)
})

test('inspection and compatibility bundles include optional operator source refs when regenerated', async () => {
  const dir = await createFixtureProject()
  await runFirstWedge({
    projectDir: dir,
    decision: 'accepted',
    operatorRef: 'operator-test'
  })
  await writeByteDescriptorProposals({ projectDir: dir })
  await writeLocalLayerResourceRefCandidates({ projectDir: dir })
  await writeProductionRecordsFromCard({ projectDir: dir })
  await writeRuleResolutionExample({ projectDir: dir, createdAt: '2026-05-19T00:00:00.000Z' })
  await writeProjectHealth({ projectDir: dir, summary: true })
  await inspectLocalRun({ projectDir: dir })
  await writeControlSurfaceProjection({ projectDir: dir })
  await writeEdgeCompatibilityBundle({ projectDir: dir })
  await writeOperatorPacketIndex({ projectDir: dir })
  await writeEdgeHandoffCandidate({ projectDir: dir })
  await writeOperatorDecisionRequest({ projectDir: dir })
  const compatibilityResult = await writeEdgeCompatibilityBundle({ projectDir: dir })
  const inspectionResult = await inspectLocalRun({ projectDir: dir })
  const exportResult = await exportInspectionBundle({
    projectDir: dir,
    packet: inspectionResult.output,
    outputDir: 'records/exports/bundles/full-local-edge-path'
  })

  const compatibilitySchemas = new Set(compatibilityResult.bundle.studioSourceRefs.map((ref) => ref.schema))
  for (const schema of [
    'media.project_health.local.v1',
    'media.operator_packet_index.local.v1',
    'media.edge_handoff_candidate.local.v1',
    'media.operator_decision_request.local.v1',
    'media.rule_resolution_trace.local.v1',
    'media.byte_descriptor_proposal.local.v1',
    'media.local_layer_resource_ref_candidate.local.v1',
    'media.production_descriptor.local.v1'
  ]) {
    assert.ok(compatibilitySchemas.has(schema), `compatibility bundle missing ${schema}`)
  }

  const exportedSchemas = new Set(exportResult.manifest.includedRecordRefs.map((ref) => ref.schema))
  for (const schema of [
    'media.edge_inspection_packet.local.v1',
    'media.project_health.local.v1',
    'media.operator_packet_index.local.v1',
    'media.edge_handoff_candidate.local.v1',
    'media.operator_decision_request.local.v1',
    'media.rule_resolution_trace.local.v1',
    'media.byte_descriptor_proposal.local.v1',
    'media.local_layer_resource_ref_candidate.local.v1',
    'media.production_descriptor.local.v1'
  ]) {
    assert.ok(exportedSchemas.has(schema), `export bundle missing ${schema}`)
  }

  assert.equal(exportResult.manifest.materializationProof, false)
  assert.equal(exportResult.manifest.meshTruth, false)
  assert.equal(validateRequiredRecord(compatibilityResult.bundle), true)
  assert.equal(validateRequiredRecord(inspectionResult.packet), true)
  assert.equal(validateRequiredRecord(exportResult.manifest), true)
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
  const indexResult = await writeOperatorPacketIndex({ projectDir: dir })
  const handoffResult = await writeEdgeHandoffCandidate({ projectDir: dir })
  const requestResult = await writeOperatorDecisionRequest({ projectDir: dir })

  assert.equal(healthResult.health.healthState, 'needs-local-attention')
  assert.ok(healthResult.health.blockingIssues.includes('production-freshness-stale'))
  assert.equal(healthResult.health.productionHealthExplanations.length, 2)
  assert.ok(healthResult.health.productionHealthExplanations.every((entry) => entry.issueCodes.includes('stale_production_descriptor')))
  assert.equal(healthResult.health.productionHealthExplanations[0].nonClaims.publicationAuthorization, false)
  assert.equal(healthResult.health.productionHealthExplanations[0].nonClaims.causalTruth, false)
  assert.equal(indexResult.index.operatorHealthExplanations.length, 2)
  assert.ok(indexResult.index.operatorHealthExplanations.every((entry) => entry.issueCodes.includes('stale_production_descriptor')))
  assert.equal(indexResult.index.summary.operatorHealthExplanations, 2)
  assert.equal(handoffResult.handoff.handoffState, 'needs-local-attention')
  assert.equal(handoffResult.handoff.readinessDiagnosis.readyForEdgeInspection, false)
  assert.equal(handoffResult.handoff.readinessDiagnosis.productionFreshness.fresh, false)
  assert.equal(handoffResult.handoff.readinessDiagnosis.operatorHealthExplanations.length, 2)
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
  assertLayeredAssetIdentity(result.assetDescriptor, {
    expectedPlacementClass: 'media-rejected',
    expectedPath: 'media/rejected/candidate.txt',
    expectedRole: 'rejected'
  })
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

  const { result, lines } = await captureConsole(() => writeCrossProjectOperatorIndex({
    baseDir,
    inputList: slash(path.relative(baseDir, inputListPath)),
    output: slash(path.relative(baseDir, outputPath))
  }))

  assert.equal(result.index.schema, 'media.cross_project_operator_index.local.v1')
  assert.equal(result.index.summary.projects, 2)
  assert.equal(result.index.summary.readyForEdgeInspection, 1)
  assert.equal(result.index.summary.needsLocalAttention, 1)
  assert.equal(result.index.projectSummaries[1].operatorHealthExplanations.length, 1)
  assert.ok(result.index.projectSummaries[1].operatorHealthExplanations[0].issueCodes.includes('missing_byte_descriptor_proposal'))
  assert.ok(lines.some((line) => line.includes('subject: media/accepted/candidate.txt') && line.includes('missing_resource_ref_candidate')))
  assert.equal(result.index.meshTruth, false)
  assert.equal(result.index.edgeRuntimeVerified, false)
  assert.equal(validateRequiredRecord(inputList), true)
  assert.equal(validateRequiredRecord(result.index), true)

  const { result: secondResult } = await captureConsole(() => writeCrossProjectOperatorIndex({
    baseDir,
    inputList: slash(path.relative(baseDir, inputListPath)),
    output: slash(path.relative(baseDir, outputPath))
  }))
  assert.equal(secondResult.index.createdAt, result.index.createdAt)
})

test('cross-project operator index reports missing artifact refs without failing scan', async () => {
  const dir = await createFixtureProject()
  await runFirstWedge({ projectDir: dir })
  await writeEdgeReadinessGuidance({ projectDir: dir })
  await inspectLocalRun({ projectDir: dir })
  await writeProjectStatus({ projectDir: dir })
  await writeProjectHealth({ projectDir: dir })
  await writeControlSurfaceProjection({ projectDir: dir })
  await writeEdgeCompatibilityBundle({ projectDir: dir })
  await writeOperatorPacketIndex({ projectDir: dir })
  await writeEdgeHandoffCandidate({ projectDir: dir })
  await writeOperatorDecisionRequest({ projectDir: dir })
  await rm(path.join(dir, 'records', 'requests', 'media-operator-decision-request.local.json'))

  const baseDir = '/'
  const indexRoot = await mkdtemp(path.join(os.tmpdir(), 'media-studio-cross-project-missing-'))
  const inputListPath = path.join(indexRoot, 'input-list.local.json')
  const outputPath = path.join(indexRoot, 'cross-project-index.local.json')
  const inputList = createCrossProjectInputList([
    { projectId: 'missing-request-project', rootPath: slash(path.relative(baseDir, dir)) }
  ])
  await writeFile(inputListPath, `${JSON.stringify(inputList, null, 2)}\n`)

  const { result, lines } = await captureConsole(() => writeCrossProjectOperatorIndex({
    baseDir,
    inputList: slash(path.relative(baseDir, inputListPath)),
    output: slash(path.relative(baseDir, outputPath))
  }))

  assert.equal(result.index.summary.projects, 1)
  assert.equal(result.index.summary.missingArtifacts, 1)
  assert.equal(result.index.projectSummaries[0].missingArtifactRefs.length, 1)
  assert.equal(result.index.projectSummaries[0].missingArtifactRefs[0].name, 'operatorDecisionRequest')
  assert.equal(result.index.projectSummaries[0].missingArtifactRefs[0].issueCode, 'missing_cross_project_artifact_ref')
  assert.equal(result.index.projectSummaries[0].missingArtifactRefs[0].nextAction, 'Run npm run operator:decision-request for the project.')
  assert.equal(result.index.projectSummaries[0].missingArtifactRefs[0].nonClaims.edgeRuntimeVerified, false)
  assert.ok(lines.some((line) => line.includes('missing: operatorDecisionRequest') && line.includes('operator:decision-request')))
  assert.match(result.index.projectSummaries[0].warnings[0], /media-operator-decision-request/)
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

test('committed cross-project missing-artifact fixture validates', async () => {
  const inputList = JSON.parse(
    await readFile('examples/inspection-fixtures/cross-project-missing-artifact/input-list.local.json', 'utf8')
  )
  const index = JSON.parse(
    await readFile('examples/inspection-fixtures/cross-project-missing-artifact/media-cross-project-operator-index.local.json', 'utf8')
  )

  assert.equal(validateRequiredRecord(inputList), true)
  assert.equal(validateRequiredRecord(index), true)
  assert.equal(index.summary.projects, 1)
  assert.equal(index.summary.missingArtifacts, 1)
  assert.equal(index.projectSummaries[0].missingArtifactRefs.length, 1)
  assert.equal(index.projectSummaries[0].requestKind, 'none')
  assert.equal(index.projectSummaries[0].missingArtifactRefs[0].issueCode, 'missing_cross_project_artifact_ref')
  assert.equal(index.projectSummaries[0].missingArtifactRefs[0].nextAction, 'Run npm run operator:decision-request for the project.')
  assert.equal(index.projectSummaries[0].missingArtifactRefs[0].nonClaims.edgeRuntimeVerified, false)
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
  assert.ok(bundle.edgeDoctrineRefs.some((ref) => ref.path === '../mesh-ecology-edge/docs/app-facing-seams.md'))
  assert.ok(bundle.edgeDoctrineRefs.every((ref) => !ref.path.includes('/phase-')))
  assert.ok(bundle.edgeDoctrineRefs
    .filter((ref) => ref.path.includes('../mesh-ecology-spine/'))
    .every((ref) => ref.owner === 'mesh-ecology-spine' && ref.kind === 'read-only-adjacent-spine-doctrine'))
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

test('valid operation candidate construction', () => {
  const candidate = createTestOperationCandidate()

  assert.equal(candidate.schema, 'media.operation_candidate.local.v1')
  assert.equal(candidate.localOnly, true)
  assert.equal(candidate.meshTruth, false)
  assert.equal(candidate.distributedProof, false)
  assert.equal(candidate.ratifiedSharedState, false)
  assert.equal(validateRequiredRecord(candidate), true)
})

test('missing operation id rejected', () => {
  const candidate = createTestOperationCandidate()
  delete candidate.operationId

  assert.throws(
    () => validateRequiredRecord(candidate),
    /missing required fields: operationId/
  )
})

test('invalid operation class rejected', () => {
  assert.throws(
    () => createTestOperationCandidate({ operationClass: 'magic_media' }),
    /Invalid media operation operationClass/
  )
})

test('invalid risk tier rejected', () => {
  assert.throws(
    () => createTestOperationCandidate({ riskTier: 'reckless' }),
    /Invalid media operation riskTier/
  )
})

test('submit_live_provider_job resolves ask_operator', () => {
  const candidate = createTestOperationCandidate({
    operationClass: 'submit_live_provider_job',
    scopeDelta: 'external_provider_call',
    riskTier: 'high',
    reversibility: 'irreversible_cost',
    authorityBoundary: 'external_provider',
    evidenceRequirement: 'operator_decision_required'
  })

  const trace = resolveMediaOperationCandidate(candidate)

  assert.equal(trace.schema, 'media.rule_resolution_trace.local.v1')
  assert.equal(trace.resolutionMode, 'ask_operator')
  assert.equal(trace.deliveryMode, 'urgent')
  assert.ok(trace.reasons.some((reason) => reason.includes('external provider boundary')))
  assert.equal(validateRequiredRecord(trace), true)
})

test('prepare_provider_job resolves auto_prepare', () => {
  const candidate = createTestOperationCandidate()
  const trace = resolveMediaOperationCandidate(candidate)

  assert.equal(trace.resolutionMode, 'auto_prepare')
  assert.equal(trace.deliveryMode, 'log_only')
  assert.equal(validateRequiredRecord(trace), true)
})

test('move_candidate_to_accepted with evidence resolves auto_prepare', () => {
  const candidate = createTestOperationCandidate({
    artifactClass: 'media.asset',
    operationClass: 'move_candidate_to_accepted',
    subjectRef: ref('media-asset', 'asset-test', 'media.asset.descriptor.v1'),
    scopeDelta: 'local_record_only',
    riskTier: 'medium',
    reversibility: 'partially_reversible',
    authorityBoundary: 'local_project',
    evidenceRequirement: 'review_evidence_required',
    sourceRefs: [ref('media-evidence', 'evidence-test', 'media.evidence.v1')]
  })

  const trace = resolveMediaOperationCandidate(candidate)

  assert.equal(trace.resolutionMode, 'auto_prepare')
  assert.equal(trace.deliveryMode, 'log_only')
  assert.equal(validateRequiredRecord(trace), true)
})

test('move_candidate_to_accepted without evidence resolves ask_operator', () => {
  const candidate = createTestOperationCandidate({
    artifactClass: 'media.asset',
    operationClass: 'move_candidate_to_accepted',
    subjectRef: ref('media-asset', 'asset-test', 'media.asset.descriptor.v1'),
    scopeDelta: 'local_record_only',
    riskTier: 'medium',
    reversibility: 'partially_reversible',
    authorityBoundary: 'local_project',
    evidenceRequirement: 'review_evidence_required',
    sourceRefs: []
  })

  const trace = resolveMediaOperationCandidate(candidate)

  assert.equal(trace.resolutionMode, 'ask_operator')
  assert.equal(trace.deliveryMode, 'inbox')
  assert.equal(validateRequiredRecord(trace), true)
})

test('delete_local_media resolves forbid', () => {
  const candidate = createTestOperationCandidate({
    artifactClass: 'media.local_file',
    operationClass: 'delete_local_media',
    subjectRef: ref('local-media-file', 'media/accepted/candidate.txt', 'media.local_ref.v1'),
    scopeDelta: 'local_file_change',
    riskTier: 'critical',
    reversibility: 'irreversible',
    authorityBoundary: 'local_project',
    evidenceRequirement: 'backup_or_materialization_required',
    sourceRefs: []
  })

  const trace = resolveMediaOperationCandidate(candidate)

  assert.equal(trace.resolutionMode, 'forbid')
  assert.equal(trace.deliveryMode, 'urgent')
  assert.ok(trace.reasons.some((reason) => reason.includes('destructive local media operation')))
  assert.equal(validateRequiredRecord(trace), true)
})

test('propose_byte_descriptor resolves auto_prepare but with non-claims', () => {
  const candidate = createTestOperationCandidate({
    artifactClass: 'media.byte_descriptor_proposal',
    operationClass: 'propose_byte_descriptor',
    subjectRef: ref('media-asset', 'asset-test', 'media.asset.descriptor.v1'),
    scopeDelta: 'byte_reference_candidate',
    riskTier: 'low',
    reversibility: 'reversible',
    authorityBoundary: 'bytes_boundary',
    evidenceRequirement: 'none'
  })

  const trace = resolveMediaOperationCandidate(candidate)

  assert.equal(trace.resolutionMode, 'auto_prepare')
  assert.equal(trace.byteAvailabilityProven, false)
  assert.equal(trace.materializationProven, false)
  assert.equal(trace.nonClaims.byteAvailabilityProven, false)
  assert.ok(trace.blockedClaims.includes('byte availability proof'))
  assert.equal(validateRequiredRecord(trace), true)
})

test('prepare_export resolves ask_operator', () => {
  const candidate = createTestOperationCandidate({
    artifactClass: 'media.export',
    operationClass: 'prepare_export',
    subjectRef: ref('media-export', 'export-test', 'media.production_descriptor.local.v1'),
    scopeDelta: 'export_artifact',
    riskTier: 'high',
    reversibility: 'partially_reversible',
    authorityBoundary: 'operator_boundary',
    evidenceRequirement: 'operator_decision_required'
  })

  const trace = resolveMediaOperationCandidate(candidate)

  assert.equal(trace.resolutionMode, 'ask_operator')
  assert.equal(trace.deliveryMode, 'inbox')
  assert.ok(trace.reasons.some((reason) => reason.includes('publication or downstream distribution')))
  assert.equal(validateRequiredRecord(trace), true)
})

test('generate_proxy resolves auto_prepare', () => {
  const candidate = createTestOperationCandidate({
    artifactClass: 'media.asset',
    operationClass: 'generate_proxy',
    subjectRef: ref('media-asset', 'asset-test', 'media.asset.descriptor.v1'),
    scopeDelta: 'local_file_change',
    riskTier: 'low',
    reversibility: 'reversible',
    authorityBoundary: 'local_project',
    evidenceRequirement: 'none'
  })

  const trace = resolveMediaOperationCandidate(candidate)

  assert.equal(trace.resolutionMode, 'auto_prepare')
  assert.equal(trace.deliveryMode, 'log_only')
  assert.equal(validateRequiredRecord(trace), true)
})

test('trace always has execution edge and mesh non-claims', () => {
  const candidates = [
    createTestOperationCandidate(),
    createTestOperationCandidate({
      operationClass: 'submit_live_provider_job',
      scopeDelta: 'external_provider_call',
      riskTier: 'high',
      reversibility: 'irreversible_cost',
      authorityBoundary: 'external_provider',
      evidenceRequirement: 'operator_decision_required'
    }),
    createTestOperationCandidate({
      artifactClass: 'media.local_file',
      operationClass: 'delete_local_media',
      subjectRef: ref('local-media-file', 'media/accepted/candidate.txt', 'media.local_ref.v1'),
      scopeDelta: 'local_file_change',
      riskTier: 'critical',
      reversibility: 'irreversible',
      authorityBoundary: 'local_project',
      evidenceRequirement: 'backup_or_materialization_required',
      sourceRefs: []
    })
  ]

  for (const candidate of candidates) {
    const trace = resolveMediaOperationCandidate(candidate)

    assert.equal(trace.executionPerformed, false)
    assert.equal(trace.edgeCalled, false)
    assert.equal(trace.meshPublished, false)
    assert.equal(trace.authorityGranted, false)
    assert.equal(trace.publicationAuthorized, false)
    assert.equal(trace.nonClaims.executionPerformed, false)
    assert.equal(trace.nonClaims.edgeCalled, false)
    assert.equal(trace.nonClaims.meshPublished, false)
    assert.equal(validateRequiredRecord(trace), true)
  }
})
