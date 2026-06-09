import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { copyFile, cp, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
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
  readJsonFile,
  readJsonFileTolerant,
  writeJsonAtomic
} from '../src/local/atomic-json.js'
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
import { runVeniceProductionRehearsal } from '../src/providers/venice-production-rehearsal.js'
import { inspectLocalRun } from '../src/seams/inspect-local-run.js'
import { exportInspectionBundle } from '../src/seams/export-inspection-bundle.js'
import { indexInspectionRecords } from '../src/seams/index-inspection-records.js'
import { indexProviderRuns } from '../src/seams/index-provider-runs.js'
import { inspectProviderFailure } from '../src/seams/inspect-provider-failure.js'
import { inspectVeniceSmoke } from '../src/seams/inspect-venice-smoke.js'
import { inspectVeniceLoop } from '../src/seams/inspect-venice-loop.js'
import { readProjectRecords, writeProjectStatus } from '../src/seams/project-status.js'
import { writeProjectHealth } from '../src/seams/project-health.js'
import { writeEdgeReadinessGuidance } from '../src/seams/edge-readiness-guidance.js'
import { writeControlSurfaceProjection } from '../src/seams/control-surface-projection.js'
import { writeEdgeCompatibilityBundle } from '../src/seams/edge-compatibility-bundle.js'
import { writeStudioPressureArtifacts } from '../src/seams/studio-pressure-artifacts.js'
import { runCurrentOperationalRunbook } from '../src/seams/current-operational-runbook.js'
import { createLocalProofDrillSummary, runLocalProofRehearsal } from '../src/seams/local-proof-rehearsal.js'
import { summarizeLocalProofRehearsal } from '../src/seams/local-proof-summary.js'
import { readAdjacentSeamReadiness, summarizeAdjacentSeamNeeds, writeAdjacentSeamNeedsPacket } from '../src/seams/adjacent-seam-needs.js'
import { inspectAdjacentSeamReadiness } from '../src/seams/adjacent-seam-readiness.js'
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
import { stressLocalJsonRecordIO } from '../src/local/stress-local-json-io.js'
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
import { writeProductionAssetCapsule } from '../src/production/asset-capsule.js'
import { writeProductionBundle } from '../src/production/bundle.js'
import { createProductionAuthorityPrerequisiteReport, writeProductionAuthorityPrerequisiteReport } from '../src/production/authority-prerequisites.js'
import { writeAuthorityHandoffCandidate } from '../src/production/authority-handoff-candidate.js'
import { writeRoughCutCapsule } from '../src/production/rough-cut-capsule.js'
import { writeRoughCutReviewDecision } from '../src/production/rough-cut-review-decision.js'
import { writeRoughCutRevision } from '../src/production/rough-cut-revision.js'
import { evaluateRenderExportCandidateFreshness, writeRenderExportCandidate } from '../src/production/render-export-candidate.js'
import { writeRenderAdapterContract } from '../src/production/render-adapter-contract.js'
import { writeRenderExportMediation } from '../src/production/render-export-mediation.js'
import { writeRenderPlanCandidate } from '../src/production/render-plan-candidate.js'
import { writeContactSheetRender } from '../src/production/render-contact-sheet.js'
import { writeFfmpegRender } from '../src/production/render-ffmpeg.js'
import { writeExportCandidate } from '../src/production/export-candidate.js'
import { writeExportPlanCandidate } from '../src/production/export-plan-candidate.js'
import { writeLocalExportPackage } from '../src/production/export-local-package.js'
import { writeFfmpegExport } from '../src/production/export-ffmpeg.js'
import { writeLocalPackageReviewDecision } from '../src/production/local-package-review-decision.js'
import { writePublicationAuthorityRequestCandidate } from '../src/production/publication-authority-request-candidate.js'
import {
  evaluateLocalPackageReviewFreshness,
  evaluatePublicationAuthorityRequestFreshness
} from '../src/production/package-authority-freshness.js'
import { runLocalProductionOutput } from '../src/production/local-output-runner.js'
import { runLocalPackageRework } from '../src/production/package-rework-runner.js'
import { createLocalPackagePostureSummary } from '../src/production/local-package-posture.js'
import { evaluateRenderReceiptFreshness, summarizeRenderReceipts } from '../src/production/render-receipts.js'
import { evaluateExportReceiptFreshness } from '../src/production/export-receipts.js'
import { evaluateLocalOutputIntegrity } from '../src/production/output-integrity.js'

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

async function addSecondAcceptedProductionAssetFixture(projectDir) {
  const firstAssetRecord = 'records/assets/promoted-candidate-accepted.local.json'
  const secondAssetRecord = 'records/assets/promoted-candidate-accepted-second.local.json'
  const firstAsset = JSON.parse(await readFile(path.join(projectDir, firstAssetRecord), 'utf8'))
  const secondPath = 'media/accepted/venice-live-smoke-1.png'
  await copyFile(
    path.join(projectDir, firstAsset.localRef.path),
    path.join(projectDir, secondPath)
  )

  const secondAsset = JSON.parse(JSON.stringify(firstAsset))
  secondAsset.assetId = `${firstAsset.assetId}-second`
  secondAsset.localRef.path = secondPath
  secondAsset.placementRef = {
    ...firstAsset.placementRef,
    id: `placement:${firstAsset.projectId}:${secondPath}`,
    path: secondPath
  }
  secondAsset.situationRef = {
    ...firstAsset.situationRef,
    id: `situation:${sha256Hex(`${firstAsset.situationRef.id}:${secondPath}`).slice(0, 16)}`,
    role: 'accepted-candidate',
    placementRef: secondAsset.placementRef
  }
  secondAsset.assetDescriptorRef = {
    ...firstAsset.assetDescriptorRef,
    id: secondAsset.assetId,
    path: secondAssetRecord
  }
  secondAsset.artifactDescriptorRef = secondAsset.assetDescriptorRef
  secondAsset.localRef.placementClass = 'media-accepted'
  secondAsset.provenance = {
    ...firstAsset.provenance,
    lifecycle: {
      ...(firstAsset.provenance?.lifecycle ?? {}),
      assetId: secondAsset.assetId
    }
  }
  secondAsset.createdAt = '2026-05-19T00:00:01.000Z'

  await writeFile(path.join(projectDir, secondAssetRecord), `${JSON.stringify(secondAsset, null, 2)}\n`)
  return secondAssetRecord
}

async function addSecondAcceptedProductionItemFixture(projectDir) {
  const secondAssetRecord = await addSecondAcceptedProductionAssetFixture(projectDir)
  const secondAsset = JSON.parse(await readFile(path.join(projectDir, secondAssetRecord), 'utf8'))
  const firstApproval = JSON.parse(await readFile(path.join(projectDir, 'records/approvals/promoted-candidate-accepted-approval-proposal.local.json'), 'utf8'))
  const firstDecision = JSON.parse(await readFile(path.join(projectDir, firstApproval.localDecisionRef.path), 'utf8'))
  const secondDecisionRecord = 'records/decisions/media-operator-decision-second.local.json'
  const secondDecision = {
    ...firstDecision,
    decisionId: `${firstDecision.decisionId}-second`,
    subjectRef: {
      ...(firstDecision.subjectRef ?? {}),
      id: secondAsset.assetId,
      path: secondAssetRecord
    },
    selectedAssetId: secondAsset.assetId,
    createdAt: '2026-05-19T00:00:02.000Z'
  }
  await writeFile(path.join(projectDir, secondDecisionRecord), `${JSON.stringify(secondDecision, null, 2)}\n`)
  await writeApprovalProposal({
    projectDir,
    decision: secondDecisionRecord,
    asset: secondAssetRecord,
    output: 'records/approvals/media-approval-proposal-second.local.json'
  })
  await writeByteDescriptorProposals({ projectDir })
  await writeLocalLayerResourceRefCandidates({ projectDir })
  await writeProductionAssetCapsule({
    projectDir,
    assetRecord: secondAssetRecord,
    output: 'records/production/media-production-asset-capsule-second.local.json',
    quiet: true
  })
  await writeProductionBundle({ projectDir, quiet: true })
  return {
    secondAsset,
    secondAssetRecord
  }
}

async function createLocalProofFixtureProject(projectDir) {
  const dir = await createFixtureProject(projectDir)
  await runFirstWedge({
    projectDir: dir,
    decision: 'accepted',
    operatorRef: 'operator-test'
  })
  await captureConsole(() => runVeniceProductionRehearsal({ projectDir: dir }))
  return dir
}

async function readProductionReceipt(projectDir, relativePath) {
  return JSON.parse(await readFile(path.join(projectDir, relativePath), 'utf8'))
}

async function removeExportDeliveryFiles(projectDir) {
  const receipts = await readExportDeliveryReceipts(projectDir)
  for (const receipt of receipts) {
    await rm(path.join(projectDir, receipt.deliveryLocalRef.path), { force: true })
  }
  return receipts
}

async function mutateExportDeliveryFilesSameSize(projectDir) {
  const receipts = await readExportDeliveryReceipts(projectDir)
  for (const receipt of receipts) {
    const deliveryPath = path.join(projectDir, receipt.deliveryLocalRef.path)
    const current = await readFile(deliveryPath)
    assert.ok(current.length > 0)
    await writeFile(deliveryPath, Buffer.alloc(current.length, 1))
  }
  return receipts
}

async function readExportDeliveryReceipts(projectDir) {
  return [
    await readProductionReceipt(projectDir, 'records/production/media-export-receipt.local.json'),
    await readProductionReceipt(projectDir, 'records/production/media-ffmpeg-export-receipt.local.json')
  ]
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

test('atomic JSON writer preserves last complete record until rename', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-atomic-json-'))
  await writeJsonAtomic(dir, 'records/test.local.json', {
    id: 'old',
    value: 'old'
  })

  await writeFile(
    path.join(dir, 'records', '.test.local.json.partial-writer.tmp'),
    '{"schema":"test.record.local.v1","id":"new"'
  )

  const beforeRename = await readJsonFile(dir, 'records/test.local.json')
  assert.equal(beforeRename.id, 'old')

  await writeJsonAtomic(dir, 'records/test.local.json', {
    id: 'new',
    value: 'new'
  })

  const afterRename = await readJsonFile(dir, 'records/test.local.json')
  assert.equal(afterRename.id, 'new')

  const scannedRecords = await readProjectRecords(dir)
  assert.equal(scannedRecords.some((entry) => entry.path.includes('.tmp')), false)
})

test('tolerant JSON reader surfaces malformed local records without crashing summaries', async () => {
  const dir = await createFixtureProject()
  await runFirstWedge({ projectDir: dir, decision: 'accepted', quiet: true })
  await writeFile(path.join(dir, 'records', 'assets', 'truncated.local.json'), '')

  const readResult = await readJsonFileTolerant(dir, 'records/assets/truncated.local.json')
  assert.equal(readResult.ok, false)
  assert.equal(readResult.diagnostic.issueCode, 'record_read_incomplete')
  assert.equal(readResult.diagnostic.retrySafe, true)

  const records = await readProjectRecords(dir)
  const diagnostic = records.find((entry) => entry.record.schema === 'media.local_record_read_diagnostic.local.v1')
  assert.equal(diagnostic.record.issueCode, 'record_read_incomplete')

  const summary = await createMediaSummary({ projectDir: dir })
  assert.equal(summary.recordIO.diagnostics, 1)
  assert.equal(summary.recordIO.byIssueCode.record_read_incomplete, 1)
  assert.equal(summary.localOnly, true)
})

test('status surfaces skip temporary JSON files and report malformed final records', async () => {
  const dir = await createFixtureProject()
  await runFirstWedge({ projectDir: dir, decision: 'accepted', quiet: true })
  await mkdir(path.join(dir, 'records', 'production'), { recursive: true })
  await writeFile(path.join(dir, 'records', 'production', '.writer-output.local.json.tmp'), '{"partial":')
  await writeFile(path.join(dir, 'records', 'production', 'malformed-output.local.json'), '{"schema":')

  const mediaSummary = await createMediaSummary({ projectDir: dir })
  assert.equal(mediaSummary.recordIO.diagnostics, 1)

  const authorityReport = await createProductionAuthorityPrerequisiteReport({ projectDir: dir })
  assert.equal(authorityReport.recordReadDiagnostics.diagnostics, 1)

  const operatorIndex = await writeOperatorPacketIndex({ projectDir: dir, quiet: true })
  assert.equal(operatorIndex.index.recordReadDiagnostics.diagnostics, 1)
  assert.equal(operatorIndex.index.summary.recordIODiagnostics, 1)
})

test('local JSON IO stress keeps production status readers from crashing during output overlap', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-json-io-stress-test-'))
  const result = await stressLocalJsonRecordIO({
    projectDir: dir,
    iterations: 2,
    readerRounds: 2,
    disableFfmpeg: true,
    quiet: true
  })

  assert.equal(result.writerRuns, 2)
  assert.equal(result.readerRuns, 2)
  assert.equal(result.nonClaims.localOnly, true)
  assert.equal(result.nonClaims.edgeCalled, false)
  assert.equal(result.nonClaims.meshPublished, false)
  assert.equal(result.nonClaims.productionReady, false)
  assert.equal(result.finalState.productionReady, 0)
  assert.equal(result.finalState.localDeliveryEvidenceIntact, 1)
  assert.equal(result.finalState.localProductionPackageComplete, 1)
})

test('required strict JSON input still fails clearly on malformed records', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-strict-json-'))
  await mkdir(path.join(dir, 'records'), { recursive: true })
  await writeFile(path.join(dir, 'records', 'required.local.json'), '{"schema":')

  await assert.rejects(
    () => readJsonFile(dir, 'records/required.local.json'),
    /Failed to parse JSON record records\/required\.local\.json/
  )
})

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

function createCrossProjectInputListWithArtifactRefs(projects, { inputListId = 'test-cross-project-input-list' } = {}) {
  return {
    schema: 'media.cross_project_inspection_input_list.local.v1',
    inputListId,
    createdAt: '2026-05-19T00:00:00.000Z',
    mode: 'standalone-local',
    projects: projects.map(({ projectId, label, rootPath, artifactRefs }) => ({
      projectId,
      label,
      rootRef: {
        kind: 'local-directory',
        id: projectId,
        schema: 'media.local_ref.v1',
        path: rootPath,
        localOnly: true
      },
      artifactRefs
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

function crossProjectArtifactRef(name) {
  return {
    projectHealth: {
      kind: 'media-project-health',
      id: 'project-health-venice-smoke-project',
      schema: 'media.project_health.local.v1',
      path: 'records/manifests/media-project-health.local.json',
      localOnly: true
    },
    operatorPacketIndex: {
      kind: 'media-operator-packet-index',
      id: 'operator-packet-index-venice-smoke-project',
      schema: 'media.operator_packet_index.local.v1',
      path: 'records/exports/media-operator-packet-index.local.json',
      localOnly: true
    }
  }[name]
}

function adjacentSeamNeedsArtifactRef(packet) {
  return {
    kind: 'media-studio-adjacent-seam-needs',
    id: packet.needsPacketId,
    schema: 'media.studio_adjacent_seam_needs_packet.local.v1',
    path: 'records/exports/media-studio-adjacent-seam-needs.local.json',
    localOnly: true
  }
}

function selectedNextActionFields(line) {
  return line.match(/(^| \| )nextAction=/g)?.length ?? 0
}

function createSyntheticDrillProof() {
  return {
    schema: 'media.studio_local_proof_rehearsal.local.v1',
    proofRehearsalId: 'studio-local-proof-rehearsal-drill-fixture',
    projectId: 'project-test',
    proofState: 'ready',
    refs: {
      adapterObservationRef: ref(
        'media-studio-source-pressure-observation-result',
        'observation-test',
        'media.studio_source_pressure_observation_result.local.v1'
      )
    },
    localPackagePosture: {
      packageState: 'complete_review_only_authority_missing'
    },
    swarmSeamPosture: {
      state: 'ready_for_review_only_swarm_pressure'
    },
    studioSourcePressureAdapterSummary: {
      latestDecisionStatus: 'approved_bounded_studio_source_pressure_observation',
      observationStatus: 'studio_source_pressure_routed_through_generic_layer_seam',
      targetGenericEnvelope: 'layer_source_pressure_review.v0'
    },
    safeNextAction: 'Carry Studio evidence to future family swarm-seam review only; do not activate swarm runtime locally.',
    nonClaims: {
      edgeDispatch: false,
      edgeQueueAction: false,
      layerAdmission: false,
      durableAppend: false,
      publicationAuthorization: false,
      productionReady: false,
      publicSwarmProof: false,
      swarmRuntimeActivated: false,
      meshTruth: false
    }
  }
}

function createSyntheticDrillOperatorSurface(proof) {
  return {
    index: {
      summary: {
        studioSourcePressureAdapterCandidates: 1,
        studioSourcePressureAdapterDecisions: 1,
        studioSourcePressureObservations: proof.refs.adapterObservationRef ? 1 : 0,
        swarmProof: false,
        swarmActivation: false
      },
      localProofRehearsalSummary: createSyntheticDrillProofSummary(proof),
      studioSourcePressureAdapterSummary: {
        candidates: 1,
        decisions: 1,
        observations: proof.refs.adapterObservationRef ? 1 : 0
      }
    }
  }
}

function createSyntheticDrillEdgeSurface(proof) {
  return {
    bundle: {
      localProofRehearsalSummary: createSyntheticDrillProofSummary(proof),
      studioSourcePressureAdapterSummary: {
        candidates: 1,
        decisions: 1,
        observations: proof.refs.adapterObservationRef ? 1 : 0
      }
    }
  }
}

function createSyntheticDrillProofSummary(proof) {
  return {
    latestProofState: proof.proofState,
    proofFreshness: 'fresh',
    localPackageState: proof.localPackagePosture.packageState,
    swarmSeamState: proof.swarmSeamPosture.state,
    adapterDecisionStatus: proof.studioSourcePressureAdapterSummary.latestDecisionStatus,
    observationStatus: proof.studioSourcePressureAdapterSummary.observationStatus,
    targetGenericEnvelope: proof.studioSourcePressureAdapterSummary.targetGenericEnvelope,
    safeNextAction: proof.safeNextAction,
    edgeDispatch: false,
    layerAdmission: false
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

  const { result, lines } = await captureConsole(() => inspectVeniceSmoke({ projectDir: dir }))

  assert.equal(result.packet.schema, 'media.edge_inspection_packet.local.v1')
  assert.equal(result.packet.seam, 'media-edge-operator-seam')
  assert.equal(result.packet.operatorGuidanceOnly, true)
  assert.equal(result.packet.meshTruth, false)
  assert.equal(result.packet.operationalSummary.providerExecution.liveProviderCalled, true)
  assert.equal(result.packet.operationalSummary.providerExecution.status, 'succeeded')
  assert.equal(result.packet.operationalSummary.providerExecution.storedRawBytes, false)
  assert.equal(result.packet.operationalSummary.providerExecution.providerTruth, false)
  assert.ok(lines.some((line) => line.includes('provider=live | providerStatus=succeeded | rawProviderBytesStored=false')))
  assert.ok(lines.some((line) => line === 'nonClaims: local-only; no Edge call; no mesh truth; no provider truth; no byte/materialization proof; no resource admission'))
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

  assert.equal(repair.remainingAttention, 1)
  assert.ok(repair.skippedIssues.some((entry) =>
    entry.issueCode === 'missing_production_asset_capsule' &&
    entry.nonBlocking === false
  ))
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
  assert.equal(inspection.summary.liveProviderCalled, false)
  assert.equal(inspection.summary.providerExecution.liveProviderCalled, false)
  assert.equal(inspection.summary.providerExecution.providerStatus, 'succeeded')
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
  assert.equal(inspection.summary.liveProviderCalled, true)
  assert.equal(inspection.summary.providerExecution.liveProviderCalled, true)
  assert.equal(inspection.summary.providerExecution.providerStatus, 'unknown')
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
  assert.equal(result.index.safeNextAction, 'Request retry or defer decision; do not treat the failed loop as production-ready.')
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
  assert.equal(result.index.projectSummaries[1].safeNextAction, 'Route this proposal through the proper authority lane; do not treat the local proposal as approval.')
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
  assert.equal(before.safeNextAction, 'Run npm run derivatives:thumbnail for image thumbnails.')
  assert.equal(before.identity.byteContent.keyKind, 'contentId')
  assert.equal(before.identity.resourceSituations.keyKind, 'assetDescriptorRef+situationRef+placementRef')
  assert.equal(before.approvalLane.proposals, 0)
  assert.equal(before.productionCapsules.total, 0)
  assert.equal(before.localOnly, true)
  assert.equal(before.meshTruth, false)
  assert.equal(before.byteAvailabilityProof, false)
  assert.equal(before.materializationProof, false)
  assert.equal(before.resourceAdmission, false)
  assert.ok(output.lines.some((line) => line.startsWith('media summary: project=project-test')))
  assert.ok(output.lines.some((line) => line === 'safeNextAction: Run npm run derivatives:thumbnail for image thumbnails.'))
  assert.ok(output.lines.some((line) => line === 'approval lane: proposals=0 | pendingAuthority=0 | approved=0 | blocked=0'))
  assert.ok(output.lines.some((line) => line.includes('attention: media/source/source-pixel.png')))
  assert.ok(output.lines.some((line) => line.includes('unsupported_media_type')))
  assert.ok(output.lines.some((line) => line === 'nonClaims: local-only; no mesh truth; no approval authority; no publication authorization; no byte/materialization proof; no resource admission'))

  await generateThumbnailDerivatives({ projectDir: dir, maxSize: 64 })
  const after = await createMediaSummary({ projectDir: dir })

  assert.equal(after.derivatives.byKind.thumbnail, 1)
  assert.equal(after.derivativeReadiness.readyAssets, 1)
  assert.equal(after.derivativeReadiness.attentionAssets, 1)
  assert.deepEqual(after.derivativeReadiness.attentionRows.map((row) => row.issueCodes[0]), ['unsupported_media_type'])
  assert.equal(after.safeNextAction, 'No derivative preparation is defined for this content type.')
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
  assert.equal(proposal.subjectRef.id, proposal.subjectAssetDescriptorRef.id)
  assert.ok(proposal.subjectAssetDescriptorRef.path)
  assert.ok(proposal.subjectContentRef.id.startsWith('sha256:'))
  assert.equal(proposal.subjectSituationRef.placementRef.id, proposal.subjectPlacementRef.id)
  assert.equal(proposal.subjectLocalRef.path, 'media/accepted/candidate.txt')
  assert.equal(proposal.identityPosture.assetId, 'compatibility descriptor id')
  assert.equal(proposal.identityPosture.situationRef, 'situated media role')
  assert.equal(proposal.authorityRequired, true)
  assert.equal(proposal.proposalOnly, true)
  assert.equal(proposal.approvalAuthority, false)
  assert.equal(proposal.ratifierAuthority, false)
  assert.equal(proposal.publicationAuthorization, false)
  assert.equal(validateRequiredRecord(proposal), true)

  const written = JSON.parse(await readFile(path.join(dir, output), 'utf8'))
  assert.equal(written.proposalId, proposal.proposalId)
  assert.equal(written.subjectSituationRef.id, proposal.subjectSituationRef.id)
  assert.equal(written.subjectPlacementRef.id, proposal.subjectPlacementRef.id)
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

test('production asset capsule packages accepted asset refs without authority', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-capsule-'))
  await runVeniceOperationalLoop({
    projectDir: dir,
    decision: 'accepted'
  })
  await writeApprovalProposal({
    projectDir: dir,
    decision: 'records/decisions/promoted-candidate-accepted-decision.local.json',
    asset: 'records/assets/promoted-candidate-accepted.local.json',
    output: 'records/approvals/promoted-candidate-accepted-approval-proposal.local.json'
  })

  const { capsule, output } = await writeProductionAssetCapsule({
    projectDir: dir,
    quiet: true
  })

  assert.equal(capsule.schema, 'media.production_asset_capsule.local.v1')
  assert.equal(capsule.productionPosture.state, 'approval-proposed-review-only')
  assert.equal(capsule.productionReady, false)
  assert.equal(capsule.approvalAuthority, false)
  assert.equal(capsule.ratifierAuthority, false)
  assert.equal(capsule.publicationAuthorization, false)
  assert.equal(capsule.providerTruth, false)
  assert.equal(capsule.byteAvailabilityProof, false)
  assert.equal(capsule.materializationProof, false)
  assert.equal(capsule.resourceAdmission, false)
  assert.ok(capsule.contentRef.id.startsWith('sha256:'))
  assert.ok(capsule.situationRef.id.includes(':accepted:'))
  assert.equal(capsule.placementRef.placementClass, 'media-accepted')
  assert.ok(capsule.derivativePosture.derivativeRefs.some((ref) => ref.derivativeKind === 'thumbnail'))
  assert.ok(capsule.bytePosture.byteDescriptorProposalRef)
  assert.ok(capsule.resourcePosture.resourceRefCandidateRef)
  assert.ok(capsule.reviewPosture.approvalProposalRef)
  assert.ok(capsule.sourcePosture.providerLoopStatusRef)
  assert.ok(capsule.bundleRefs.some((ref) => ref.schema === 'media.approval_proposal.local.v1'))
  assert.equal(validateRequiredRecord(capsule), true)

  const written = JSON.parse(await readFile(path.join(dir, output), 'utf8'))
  assert.equal(written.capsuleId, capsule.capsuleId)

  const printed = await captureConsole(() => writeProductionAssetCapsule({
    projectDir: dir,
    print: true
  }))
  const printedCapsule = JSON.parse(printed.lines.join('\n'))
  assert.equal(printedCapsule.capsuleId, capsule.capsuleId)

  const summaryOutput = await captureConsole(() => writeMediaSummary({ projectDir: dir }))
  const summary = await createMediaSummary({ projectDir: dir })
  assert.equal(summary.productionCapsules.total, 1)
  assert.equal(summary.productionCapsules.expected, 1)
  assert.equal(summary.productionCapsules.missing, 0)
  assert.equal(summary.productionCapsules.attentionRows.length, 0)
  assert.equal(summary.productionApprovalLane.candidates, 1)
  assert.equal(summary.productionApprovalLane.localDecisions, 1)
  assert.equal(summary.productionApprovalLane.approvalProposals, 1)
  assert.equal(summary.productionApprovalLane.capsules, 1)
  assert.equal(summary.productionApprovalLane.bundles, 0)
  assert.equal(summary.productionApprovalLane.pendingAuthority, 1)
  assert.equal(summary.productionApprovalLane.productionReady, 0)
  assert.equal(summary.productionApprovalLane.attentionRows[0].laneState, 'needs-production-bundle')
  assert.deepEqual(summary.productionApprovalLane.attentionRows[0].issueCodes, ['production_bundle_missing', 'authority_not_granted'])
  assert.ok(summaryOutput.lines.some((line) => line === 'production capsules: total=1 | expected=1 | missing=0 | attention=0'))
  assert.ok(summaryOutput.lines.some((line) => line === 'production approval: candidates=1 | decisions=1 | proposals=1 | capsules=1 | bundles=0 | pendingAuthority=1 | productionReady=0'))
  assert.ok(summaryOutput.lines.some((line) => line.includes('production-approval: media/accepted/venice-live-smoke-0.png | state=needs-production-bundle')))

  const indexOutput = await captureConsole(() => writeOperatorPacketIndex({ projectDir: dir }))
  const index = indexOutput.result.index
  assert.equal(index.productionCapsuleRefs.length, 1)
  assert.equal(index.approvalProposalRefs.length, 1)
  assert.equal(index.summary.productionCapsules, 1)
  assert.equal(index.summary.productionCapsulesNeedingAttention, 0)
  assert.equal(index.summary.productionApprovalCandidates, 1)
  assert.equal(index.summary.productionApprovalPendingAuthority, 1)
  assert.equal(index.productionApprovalLane.rows[0].laneState, 'needs-production-bundle')
  assert.ok(indexOutput.lines.some((line) => line.includes('productionCapsules=1')))
  assert.ok(indexOutput.lines.some((line) => line.includes('approvalProposals=1')))
  assert.ok(indexOutput.lines.some((line) => line.includes('productionApprovalPending=1')))
  assert.ok(indexOutput.lines.some((line) => line.includes('production capsule: media/accepted/venice-live-smoke-0.png')))
  assert.ok(indexOutput.lines.some((line) => line.includes('production approval: media/accepted/venice-live-smoke-0.png | state=needs-production-bundle')))

  const health = await writeProjectHealth({ projectDir: dir, summary: true })
  assert.equal(health.health.productionCapsuleHealthExplanations.length, 0)

  const inspection = await inspectLocalRun({
    projectDir: dir,
    manifest: 'records/manifests/venice-live-smoke-manifest.local.json'
  })
  assert.ok(Object.values(inspection.packet.recordRefs).some((ref) => ref.schema === 'media.production_asset_capsule.local.v1'))
  assert.ok(inspection.packet.artifactKinds.includes('media.production_asset_capsule.local.v1'))

  const bundleExport = await exportInspectionBundle({
    projectDir: dir,
    packet: inspection.output,
    outputDir: 'records/exports/bundles/production-capsule-test'
  })
  assert.ok(bundleExport.manifest.includedRecordRefs.some((ref) => ref.schema === 'media.production_asset_capsule.local.v1'))

  await writeProjectStatus({ projectDir: dir })
  await writeControlSurfaceProjection({ projectDir: dir })
  const compatibility = await writeEdgeCompatibilityBundle({ projectDir: dir })
  assert.ok(compatibility.bundle.studioSourceRefs.some((ref) => ref.schema === 'media.production_asset_capsule.local.v1'))
})

test('production bundle groups production capsules without authority', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-production-bundle-'))
  await runVeniceOperationalLoop({
    projectDir: dir,
    decision: 'accepted'
  })
  await writeApprovalProposal({
    projectDir: dir,
    decision: 'records/decisions/promoted-candidate-accepted-decision.local.json',
    asset: 'records/assets/promoted-candidate-accepted.local.json',
    output: 'records/approvals/promoted-candidate-accepted-approval-proposal.local.json'
  })
  await writeProductionAssetCapsule({ projectDir: dir, quiet: true })

  const { bundle, output } = await writeProductionBundle({ projectDir: dir, quiet: true })

  assert.equal(bundle.schema, 'media.production_bundle.local.v1')
  assert.equal(bundle.bundleKind, 'production-capsule-set')
  assert.equal(bundle.productionPosture.state, 'review-only-bundle')
  assert.equal(bundle.capsuleRefs.length, 1)
  assert.equal(bundle.assetRefs.length, 1)
  assert.equal(bundle.contentRefs.length, 1)
  assert.equal(bundle.productionReady, false)
  assert.equal(bundle.approvalAuthority, false)
  assert.equal(bundle.ratifierAuthority, false)
  assert.equal(bundle.publicationAuthorization, false)
  assert.equal(bundle.providerTruth, false)
  assert.equal(bundle.byteAvailabilityProof, false)
  assert.equal(bundle.materializationProof, false)
  assert.equal(bundle.resourceAdmission, false)
  assert.equal(validateRequiredRecord(bundle), true)

  const written = JSON.parse(await readFile(path.join(dir, output), 'utf8'))
  assert.equal(written.bundleId, bundle.bundleId)

  const printed = await captureConsole(() => writeProductionBundle({
    projectDir: dir,
    print: true
  }))
  const printedBundle = JSON.parse(printed.lines.join('\n'))
  assert.equal(printedBundle.bundleId, bundle.bundleId)

  const summaryOutput = await captureConsole(() => writeMediaSummary({ projectDir: dir }))
  const summary = await createMediaSummary({ projectDir: dir })
  assert.equal(summary.productionBundles.total, 1)
  assert.equal(summary.productionBundles.capsuleRefs, 1)
  assert.equal(summary.productionBundles.attentionRows.length, 0)
  assert.equal(summary.productionApprovalLane.candidates, 1)
  assert.equal(summary.productionApprovalLane.localDecisions, 1)
  assert.equal(summary.productionApprovalLane.approvalProposals, 1)
  assert.equal(summary.productionApprovalLane.capsules, 1)
  assert.equal(summary.productionApprovalLane.bundles, 1)
  assert.equal(summary.productionApprovalLane.pendingAuthority, 1)
  assert.equal(summary.productionApprovalLane.productionReady, 0)
  assert.equal(summary.productionApprovalLane.attentionRows[0].laneState, 'review-bundled-authority-missing')
  assert.deepEqual(summary.productionApprovalLane.attentionRows[0].issueCodes, ['authority_not_granted'])
  assert.ok(summaryOutput.lines.some((line) => line === 'production bundles: total=1 | capsules=1 | attention=0'))
  assert.ok(summaryOutput.lines.some((line) => line === 'production approval: candidates=1 | decisions=1 | proposals=1 | capsules=1 | bundles=1 | pendingAuthority=1 | productionReady=0'))
  assert.ok(summaryOutput.lines.some((line) => line.includes('production-approval: media/accepted/venice-live-smoke-0.png | state=review-bundled-authority-missing')))

  const indexOutput = await captureConsole(() => writeOperatorPacketIndex({ projectDir: dir }))
  const index = indexOutput.result.index
  assert.equal(index.productionBundleRefs.length, 1)
  assert.equal(index.approvalProposalRefs.length, 1)
  assert.equal(index.summary.productionBundles, 1)
  assert.equal(index.summary.productionBundlesNeedingAttention, 0)
  assert.equal(index.summary.productionApprovalCandidates, 1)
  assert.equal(index.summary.productionApprovalPendingAuthority, 1)
  assert.equal(index.productionApprovalLane.rows[0].laneState, 'review-bundled-authority-missing')
  assert.ok(indexOutput.lines.some((line) => line.includes('productionBundles=1')))
  assert.ok(indexOutput.lines.some((line) => line.includes('approvalProposals=1')))
  assert.ok(indexOutput.lines.some((line) => line.includes('productionApprovalPending=1')))
  assert.ok(indexOutput.lines.some((line) => line.includes('production bundle: production-bundle-')))
  assert.ok(indexOutput.lines.some((line) => line.includes('production approval: media/accepted/venice-live-smoke-0.png | state=review-bundled-authority-missing')))

  const inspection = await inspectLocalRun({
    projectDir: dir,
    manifest: 'records/manifests/venice-live-smoke-manifest.local.json'
  })
  assert.ok(Object.values(inspection.packet.recordRefs).some((ref) => ref.schema === 'media.production_bundle.local.v1'))
  assert.ok(inspection.packet.artifactKinds.includes('media.production_bundle.local.v1'))

  const bundleExport = await exportInspectionBundle({
    projectDir: dir,
    packet: inspection.output,
    outputDir: 'records/exports/bundles/production-bundle-test'
  })
  assert.ok(bundleExport.manifest.includedRecordRefs.some((ref) => ref.schema === 'media.production_bundle.local.v1'))

  const postExportIndex = await writeOperatorPacketIndex({ projectDir: dir })
  assert.equal(postExportIndex.index.productionCapsuleRefs.length, 1)
  assert.equal(postExportIndex.index.productionBundleRefs.length, 1)

  await writeProjectStatus({ projectDir: dir })
  await writeControlSurfaceProjection({ projectDir: dir })
  const compatibility = await writeEdgeCompatibilityBundle({ projectDir: dir })
  assert.ok(compatibility.bundle.studioSourceRefs.some((ref) => ref.schema === 'media.production_bundle.local.v1'))
})

test('Venice production rehearsal completes review bundle without authority', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-venice-rehearsal-'))
  const result = await runVeniceProductionRehearsal({ projectDir: dir })

  assert.equal(result.rehearsal.schema, 'media.venice_production_rehearsal.local.v1')
  assert.equal(result.rehearsal.state, 'complete_review_only_authority_missing')
  assert.equal(result.rehearsal.liveProviderCalled, false)
  assert.equal(result.rehearsal.providerLoopState, 'complete_review_only')
  assert.equal(result.rehearsal.productionApprovalLane.localDecisions, 1)
  assert.equal(result.rehearsal.productionApprovalLane.approvalProposals, 1)
  assert.equal(result.rehearsal.productionApprovalLane.capsules, 1)
  assert.equal(result.rehearsal.productionApprovalLane.bundles, 1)
  assert.equal(result.rehearsal.roughCutPosture.total, 0)
  assert.equal(result.rehearsal.roughCutPosture.reviewed, 0)
  assert.equal(result.rehearsal.productionApprovalLane.pendingAuthority, 1)
  assert.equal(result.rehearsal.productionApprovalLane.productionReady, 0)
  assert.equal(result.rehearsal.approvalAuthority, false)
  assert.equal(result.rehearsal.publicationAuthorization, false)
  assert.equal(result.rehearsal.edgeCalled, false)
  assert.equal(result.rehearsal.meshPublished, false)
  assert.equal(result.health.health.healthState, 'ready-for-local-inspection')
  assert.equal(result.operatorIndex.index.summary.productionApprovalPendingAuthority, 1)
  assert.equal(result.operatorIndex.index.operatorHealthExplanations.some((entry) =>
    entry.issueCodes?.includes('missing_production_asset_capsule')
  ), false)
  assert.ok(result.edgeCompatibility.bundle.studioSourceRefs.some((ref) =>
    ref.path === 'records/exports/venice-smoke-edge-inspection-packet.local.json'
  ))
  assert.ok(result.edgeCompatibility.bundle.studioSourceRefs.some((ref) =>
    ref.schema === 'media.approval_proposal.local.v1'
  ))
})

test('Venice production rehearsal recognizes locally reviewed rough cut posture', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-venice-reviewed-rough-cut-'))
  await runVeniceProductionRehearsal({ projectDir: dir })
  await writeAuthorityHandoffCandidate({ projectDir: dir, quiet: true })
  await writeRoughCutCapsule({ projectDir: dir, quiet: true })
  await writeRoughCutReviewDecision({ projectDir: dir })

  const result = await runVeniceProductionRehearsal({ projectDir: dir })

  assert.equal(result.rehearsal.state, 'complete_review_only_authority_missing')
  assert.equal(result.rehearsal.roughCutPosture.total, 1)
  assert.equal(result.rehearsal.roughCutPosture.reviewed, 1)
  assert.equal(result.rehearsal.roughCutPosture.changesRequested, 0)
  assert.equal(result.rehearsal.roughCutPosture.deferred, 0)
  assert.equal(result.rehearsal.roughCutPosture.productionReady, false)
  assert.equal(result.rehearsal.productionApprovalLane.pendingAuthority, 1)
  assert.equal(result.rehearsal.productionApprovalLane.productionReady, 0)
  assert.equal(result.rehearsal.approvalAuthority, false)
  assert.equal(result.rehearsal.publicationAuthorization, false)
  assert.equal(result.rehearsal.safeNextAction, 'Run npm run production:render-export-candidate to prepare a reviewed rough cut for a future render/export lane.')
})

test('production authority prerequisite report separates local package from authority', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-authority-prereqs-'))
  await runVeniceProductionRehearsal({ projectDir: dir })

  const report = await createProductionAuthorityPrerequisiteReport({ projectDir: dir })
  const output = await captureConsole(() => writeProductionAuthorityPrerequisiteReport({ projectDir: dir }))
  const row = report.rows[0]

  assert.equal(report.schema, 'media.production_authority_prerequisites.summary.local.v1')
  assert.equal(report.candidates, 1)
  assert.equal(report.localPackageComplete, 1)
  assert.equal(report.localProductionPackageComplete, 0)
  assert.equal(report.localProductionPackageState, 'local-production-package-incomplete')
  assert.equal(report.authorityMissing, true)
  assert.equal(report.missingLocalPrerequisites, 0)
  assert.equal(report.roughCutReviewed, 0)
  assert.equal(report.roughCutChangesRequested, 0)
  assert.equal(report.roughCutDeferred, 0)
  assert.equal(report.renderExportCandidates, 0)
  assert.equal(report.renderReceipts, 0)
  assert.equal(report.localDeliveryEvidenceIntact, 0)
  assert.equal(report.outputIntegrityBlockingIssues, 0)
  assert.equal(report.outputIntegrityAttentionIssues, 0)
  assert.equal(report.renderAuthorizationMissing, 1)
  assert.equal(report.exportAuthorizationMissing, 1)
  assert.equal(report.pendingAuthority, 1)
  assert.equal(report.productionReady, 0)
  assert.equal(report.approvalAuthority, false)
  assert.equal(report.publicationAuthorization, false)
  assert.equal(report.reportId, 'production-authority-prerequisites-venice-smoke-project')
  assert.equal(row.localPackageState, 'local-package-complete-authority-missing')
  assert.equal(row.localProductionPackageComplete, false)
  assert.equal(row.localProductionPackageState, 'local-production-package-incomplete')
  assert.equal(row.productionPackagePosture.localPackageComplete, true)
  assert.equal(row.productionPackagePosture.localProductionPackageComplete, false)
  assert.equal(row.productionPackagePosture.authorityMissing, true)
  assert.equal(row.productionPackagePosture.productionReady, false)
  assert.equal(row.authorityState, 'authority-missing')
  assert.deepEqual(row.missingLocalPrerequisites, [])
  assert.equal(row.approvalProposalIdentity.situatedRefsPresent, true)
  assert.ok(row.approvalProposalIdentity.subjectSituationRef.id)
  assert.ok(row.approvalProposalIdentity.subjectPlacementRef.id)
  assert.ok(row.productionCapsule.id)
  assert.ok(row.productionBundle.id)
  assert.ok(row.byteDescriptorProposal.id)
  assert.ok(row.resourceRefCandidate.id)
  assert.equal(row.roughCutReviewPosture.state, 'rough-cut-missing')
  assert.equal(row.roughCutReviewPosture.reviewed, false)
  assert.equal(row.renderExportCandidatePosture.state, 'render-export-candidate-missing')
  assert.equal(row.renderReceiptPosture.state, 'render-receipt-missing')
  assert.equal(row.renderExportCandidatePosture.renderAuthorization, false)
  assert.equal(row.renderExportCandidatePosture.exportAuthorization, false)
  assert.deepEqual(row.derivativeKinds, ['thumbnail'])
  assert.equal(row.productionReady, false)
  assert.equal(row.approvalAuthority, false)
  assert.equal(row.publicationAuthorization, false)
  assert.ok(output.lines.some((line) =>
    line.includes('production authority prerequisites: project=venice-smoke-project') &&
    line.includes('localPackageComplete=1') &&
    line.includes('localProductionPackageComplete=0') &&
    line.includes('renderReceipts=0') &&
    line.includes('exportReceipts=0') &&
    line.includes('localPackageReviews=0') &&
    line.includes('publicationAuthorityRequests=0') &&
    line.includes('pendingAuthority=1') &&
    line.includes('productionReady=0') &&
    line.includes('output=records/production/media-production-authority-prerequisites.local.json')
  ))
  assert.ok(output.lines.some((line) => line.includes('authority-prereq: media/accepted/venice-live-smoke-0.png | localPackage=local-package-complete-authority-missing | productionPackage=local-production-package-incomplete | authority=authority-missing')))
  const written = JSON.parse(
    await readFile(path.join(dir, 'records', 'production', 'media-production-authority-prerequisites.local.json'), 'utf8')
  )
  assert.equal(written.reportId, report.reportId)
  assert.equal(validateRequiredRecord(written), true)
})

test('authority handoff candidate packages local refs without authority', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-authority-handoff-'))
  await runVeniceProductionRehearsal({ projectDir: dir })

  const output = await captureConsole(() => writeAuthorityHandoffCandidate({ projectDir: dir }))
  const candidate = output.result.candidate

  assert.equal(candidate.schema, 'media.authority_handoff_candidate.local.v1')
  assert.equal(candidate.handoffKind, 'production-authority-review-candidate')
  assert.equal(candidate.targetAuthorityLane, 'future-authority-lane')
  assert.equal(candidate.prerequisiteSummary.candidates, 1)
  assert.equal(candidate.prerequisiteSummary.localPackageComplete, 1)
  assert.equal(candidate.prerequisiteSummary.localProductionPackageComplete, 0)
  assert.equal(candidate.prerequisiteSummary.localProductionPackageState, 'local-production-package-incomplete')
  assert.equal(candidate.prerequisiteSummary.authorityMissing, true)
  assert.equal(candidate.prerequisiteSummary.layerInteropState, 'layer-refs-not-attached')
  assert.equal(candidate.prerequisiteSummary.pendingAuthority, 1)
  assert.equal(candidate.prerequisiteSummary.renderExportCandidates, 0)
  assert.equal(candidate.prerequisiteSummary.renderAuthorizationMissing, 1)
  assert.equal(candidate.prerequisiteSummary.exportAuthorizationMissing, 1)
  assert.equal(candidate.prerequisiteSummary.productionReady, 0)
  assert.equal(candidate.acceptedCandidateRows.length, 1)
  assert.equal(candidate.acceptedCandidateRows[0].acceptedAssetPath, 'media/accepted/venice-live-smoke-0.png')
  assert.equal(candidate.acceptedCandidateRows[0].localProductionPackageComplete, false)
  assert.equal(candidate.acceptedCandidateRows[0].localProductionPackageState, 'local-production-package-incomplete')
  assert.equal(candidate.acceptedCandidateRows[0].productionPackagePosture.productionReady, false)
  assert.equal(candidate.acceptedCandidateRows[0].approvalProposalIdentity.situatedRefsPresent, true)
  assert.equal(candidate.acceptedCandidateRows[0].roughCutReviewPosture.state, 'rough-cut-missing')
  assert.ok(candidate.authorityReviewInputs.find((input) => input.inputKind === 'production-bundle').refs[0].path)
  assert.ok(candidate.authorityReviewInputs.find((input) => input.inputKind === 'approval-proposal').refs[0].path)
  assert.ok(candidate.authorityReviewInputs.find((input) => input.inputKind === 'production-asset-capsule').refs[0].path)
  assert.equal(candidate.authorityReviewInputs.find((input) => input.inputKind === 'rough-cut-capsule').present, false)
  assert.equal(candidate.authorityReviewInputs.find((input) => input.inputKind === 'rough-cut-review-decision').reviewed, 0)
  assert.equal(candidate.authorityReviewInputs.find((input) => input.inputKind === 'render-export-candidate').present, false)
  assert.equal(candidate.authorityReviewInputs.find((input) => input.inputKind === 'render-export-candidate').renderAuthorization, false)
  assert.equal(candidate.authorityReviewInputs.find((input) => input.inputKind === 'render-export-candidate').exportAuthorization, false)
  assert.equal(candidate.authorityReviewInputs.find((input) => input.inputKind === 'situated-identity').present, true)
  assert.equal(candidate.authorityReviewInputs.find((input) => input.inputKind === 'local-prerequisite-state').localProductionPackageComplete, 0)
  assert.equal(candidate.authorityReviewInputs.find((input) => input.inputKind === 'local-prerequisite-state').localProductionPackageState, 'local-production-package-incomplete')
  assert.equal(candidate.authorityReviewInputs.find((input) => input.inputKind === 'local-prerequisite-state').authorityMissing, true)
  assert.equal(candidate.authorityReviewInputs.find((input) => input.inputKind === 'layer-posture-ref').present, false)
  assert.equal(candidate.authorityReviewInputs.find((input) => input.inputKind === 'layer-posture-ref').durableAppendApproved, false)
  assert.equal(candidate.layerInteropPosture.interopState, 'layer-refs-not-attached')
  assert.equal(candidate.layerInteropPosture.substratePosture.durableAppendApproved, false)
  assert.equal(candidate.layerInteropPosture.nonClaims.layerProfileIsAuthority, false)
  assert.equal(candidate.layerInteropPosture.nonClaims.continuityClaimed, false)
  assert.ok(candidate.sourceRefs.some((ref) => ref.schema === 'media.production_bundle.local.v1'))
  assert.ok(candidate.sourceRefs.some((ref) => ref.schema === 'media.approval_proposal.local.v1'))
  assert.ok(candidate.sourceRefs.some((ref) => ref.schema === 'media.production_asset_capsule.local.v1'))
  assert.ok(candidate.authorityGaps.includes('approval_authority_missing'))
  assert.ok(candidate.authorityGaps.includes('render_authorization_missing'))
  assert.ok(candidate.authorityGaps.includes('export_authorization_missing'))
  assert.equal(candidate.productionReady, false)
  assert.equal(candidate.approvalAuthority, false)
  assert.equal(candidate.ratifierAuthority, false)
  assert.equal(candidate.publicationAuthorization, false)
  assert.equal(candidate.edgeCalled, false)
  assert.equal(candidate.meshPublished, false)
  assert.equal(validateRequiredRecord(candidate), true)
  assert.ok(output.lines.some((line) => line.startsWith('authority handoff candidate: project=venice-smoke-project')))
  assert.ok(output.lines.some((line) => line.includes('layerInterop=layer-refs-not-attached')))
  assert.ok(output.lines.some((line) => line.includes('productionReady=false')))

  const written = JSON.parse(
    await readFile(path.join(dir, 'records', 'production', 'media-authority-handoff-candidate.local.json'), 'utf8')
  )
  assert.equal(written.handoffCandidateId, candidate.handoffCandidateId)
  assert.equal(validateRequiredRecord(written), true)
})

test('authority handoff candidate can carry Layer refs without selecting substrate', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-authority-layer-interop-'))
  await runVeniceProductionRehearsal({ projectDir: dir })

  const output = await captureConsole(() => writeAuthorityHandoffCandidate({
    projectDir: dir,
    layerRef: 'layer:operator-local:operator-alpha',
    layerProfileRef: 'layer-profile:operator-local:v0:example',
    continuityRef: 'layer-continuity-ref:operator-local:decision-family:candidate',
    desyncPostureRef: 'layer-desync-posture:operator-local:example',
    rbcProfileRefs: ['rbc-profile:operator-local-default']
  }))
  const candidate = output.result.candidate
  const layerInput = candidate.authorityReviewInputs.find((input) => input.inputKind === 'layer-posture-ref')

  assert.equal(candidate.layerInteropPosture.repoRef, 'mesh-ecology-layer')
  assert.equal(candidate.layerInteropPosture.interopState, 'layer-refs-attached-review-only')
  assert.equal(candidate.layerInteropPosture.layerRef.id, 'layer:operator-local:operator-alpha')
  assert.equal(candidate.layerInteropPosture.layerProfileRef.id, 'layer-profile:operator-local:v0:example')
  assert.equal(candidate.layerInteropPosture.continuityRef.id, 'layer-continuity-ref:operator-local:decision-family:candidate')
  assert.equal(candidate.layerInteropPosture.desyncPostureRef.id, 'layer-desync-posture:operator-local:example')
  assert.equal(candidate.layerInteropPosture.rbcProfileRefs[0].id, 'rbc-profile:operator-local-default')
  assert.equal(candidate.layerInteropPosture.substratePosture.substrateSelected, false)
  assert.equal(candidate.layerInteropPosture.substratePosture.durableAppendApproved, false)
  assert.equal(candidate.layerInteropPosture.nonClaims.layerProfileIsRuntime, false)
  assert.equal(candidate.layerInteropPosture.nonClaims.layerProfileIsStorageBackend, false)
  assert.equal(candidate.layerInteropPosture.nonClaims.layerProfileIsAuthority, false)
  assert.equal(candidate.layerInteropPosture.nonClaims.layerRefsGrantAdmission, false)
  assert.equal(candidate.layerInteropPosture.nonClaims.continuityClaimed, false)
  assert.equal(candidate.layerInteropPosture.nonClaims.rendererOutputIsContinuity, false)
  assert.equal(layerInput.present, true)
  assert.equal(layerInput.interopState, 'layer-refs-attached-review-only')
  assert.equal(layerInput.durableAppendApproved, false)
  assert.equal(layerInput.continuityClaimed, false)
  assert.equal(layerInput.layerAuthority, false)
  assert.equal(candidate.prerequisiteSummary.layerInteropState, 'layer-refs-attached-review-only')
  assert.equal(candidate.productionReady, false)
  assert.equal(candidate.publicationAuthorization, false)
  assert.ok(output.lines.some((line) => line.includes('layerInterop=layer-refs-attached-review-only')))
  assert.equal(validateRequiredRecord(candidate), true)

  const mediaSummaryOutput = await captureConsole(() => writeMediaSummary({ projectDir: dir }))
  assert.equal(mediaSummaryOutput.result.layerInterop.state, 'layer-refs-attached-review-only')
  assert.equal(mediaSummaryOutput.result.layerInterop.authorityHandoffRecords, 1)
  assert.equal(mediaSummaryOutput.result.layerInterop.layerRefs.length, 1)
  assert.equal(mediaSummaryOutput.result.layerInterop.durableAppendApproved, false)
  assert.equal(mediaSummaryOutput.result.layerInterop.continuityClaimed, false)
  assert.equal(mediaSummaryOutput.result.layerInterop.layerAuthority, false)
  assert.equal(mediaSummaryOutput.result.layerInterop.attentionRows.length, 0)
  assert.ok(mediaSummaryOutput.lines.some((line) => line === 'layer interop: state=layer-refs-attached-review-only | handoffs=1 | layerRefs=1 | profileRefs=1 | attention=0 | durableAppendApproved=false | continuityClaimed=false | layerAuthority=false'))

  const operatorIndexOutput = await captureConsole(() => writeOperatorPacketIndex({ projectDir: dir }))
  assert.equal(operatorIndexOutput.result.index.layerInterop.state, 'layer-refs-attached-review-only')
  assert.equal(operatorIndexOutput.result.index.summary.layerInteropState, 'layer-refs-attached-review-only')
  assert.equal(operatorIndexOutput.result.index.summary.layerInteropAttention, 0)
  assert.equal(operatorIndexOutput.result.index.summary.layerDurableAppendApproved, false)
  assert.equal(operatorIndexOutput.result.index.summary.layerContinuityClaimed, false)
  assert.equal(operatorIndexOutput.result.index.summary.layerAuthority, false)
  assert.ok(operatorIndexOutput.lines.some((line) => line.includes('layerInterop=layer-refs-attached-review-only')))

  const inspection = await inspectVeniceSmoke({ projectDir: dir })
  assert.equal(inspection.packet.operationalSummary.layerInterop.state, 'layer-refs-attached-review-only')
  assert.equal(inspection.packet.operationalSummary.recordCounts.authorityHandoffCandidates, 1)
  assert.equal(inspection.packet.operationalSummary.layerInterop.durableAppendApproved, false)

  const compatibility = await writeEdgeCompatibilityBundle({ projectDir: dir })
  assert.equal(compatibility.bundle.layerInteropSummary.state, 'layer-refs-attached-review-only')
  assert.equal(compatibility.bundle.layerInteropSummary.layerAuthority, false)
  assert.equal(compatibility.bundle.studioReviewEvidence.layerInteropSummary.continuityClaimed, false)
  assert.ok(compatibility.bundle.studioSourceRefs.some((ref) => ref.schema === 'media.authority_handoff_candidate.local.v1'))
})

test('Layer interop summaries flag mismatched authority posture refs without authority', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-authority-layer-mismatch-'))
  await runVeniceProductionRehearsal({ projectDir: dir })
  await writeProductionAuthorityPrerequisiteReport({
    projectDir: dir,
    layerRef: 'layer:operator-local:operator-alpha',
    layerProfileRef: 'layer-profile:operator-local:v0:alpha',
    continuityRef: 'layer-continuity-ref:operator-local:alpha',
    desyncPostureRef: 'layer-desync-posture:operator-local:alpha',
    rbcProfileRefs: ['rbc-profile:operator-local-alpha']
  })
  await writeAuthorityHandoffCandidate({
    projectDir: dir,
    quiet: true,
    layerRef: 'layer:operator-local:operator-beta',
    layerProfileRef: 'layer-profile:operator-local:v0:beta',
    continuityRef: 'layer-continuity-ref:operator-local:beta',
    desyncPostureRef: 'layer-desync-posture:operator-local:beta',
    rbcProfileRefs: ['rbc-profile:operator-local-beta']
  })

  const mediaSummaryOutput = await captureConsole(() => writeMediaSummary({ projectDir: dir }))
  assert.equal(mediaSummaryOutput.result.layerInterop.state, 'layer-refs-attached-review-only')
  assert.deepEqual(mediaSummaryOutput.result.layerInterop.issueCodes, [
    'layer_ref_mismatch',
    'layer_profile_ref_mismatch',
    'layer_continuity_ref_mismatch',
    'layer_desync_posture_ref_mismatch',
    'layer_rbc_profile_ref_mismatch'
  ])
  assert.equal(mediaSummaryOutput.result.layerInterop.attentionRows.length, 1)
  assert.equal(mediaSummaryOutput.result.layerInterop.layerAuthority, false)
  assert.equal(mediaSummaryOutput.result.layerInterop.continuityClaimed, false)
  assert.equal(mediaSummaryOutput.result.layerInterop.durableAppendApproved, false)
  assert.ok(mediaSummaryOutput.lines.some((line) => line.includes('layer interop: state=layer-refs-attached-review-only')))
  assert.ok(mediaSummaryOutput.lines.some((line) => line.includes('attention=1')))
  assert.ok(mediaSummaryOutput.lines.some((line) => line.includes('layer-interop: state=needs-local-attention')))

  const operatorIndexOutput = await captureConsole(() => writeOperatorPacketIndex({ projectDir: dir }))
  assert.equal(operatorIndexOutput.result.index.summary.layerInteropAttention, 1)
  assert.equal(operatorIndexOutput.result.index.layerInterop.attentionRows[0].nonClaims.layerAuthority, false)
  assert.equal(operatorIndexOutput.result.index.layerInterop.attentionRows[0].nonClaims.continuityClaimed, false)
  assert.ok(operatorIndexOutput.lines.some((line) => line.includes('layerAttention=1')))
  assert.ok(operatorIndexOutput.lines.some((line) => line.includes('layer interop attention')))

  const inspection = await inspectVeniceSmoke({ projectDir: dir })
  assert.equal(inspection.packet.operationalSummary.layerInterop.attentionRows.length, 1)
  assert.equal(inspection.packet.operationalSummary.layerInterop.layerAuthority, false)

  const compatibility = await writeEdgeCompatibilityBundle({ projectDir: dir })
  assert.equal(compatibility.bundle.layerInteropSummary.attentionRows.length, 1)
  assert.equal(compatibility.bundle.studioReviewEvidence.layerInteropSummary.continuityClaimed, false)
})

test('rough cut capsule orders production items without rendering or authority', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-rough-cut-'))
  await runVeniceProductionRehearsal({ projectDir: dir })
  await writeAuthorityHandoffCandidate({ projectDir: dir, quiet: true })

  const output = await captureConsole(() => writeRoughCutCapsule({ projectDir: dir }))
  const roughCut = output.result.roughCut
  const item = roughCut.orderedItems[0]

  assert.equal(roughCut.schema, 'media.rough_cut_capsule.local.v1')
  assert.equal(roughCut.roughCutKind, 'ordered-production-review-cut')
  assert.equal(roughCut.mode, 'standalone-local')
  assert.equal(roughCut.orderedItems.length, 1)
  assert.equal(item.order, 1)
  assert.equal(item.trackKind, 'primary-review')
  assert.equal(item.timingPosture, 'order-only-no-render-timing')
  assert.equal(item.acceptedAssetRef.path, 'records/assets/promoted-candidate-accepted.local.json')
  assert.equal(item.localRef.path, 'media/accepted/venice-live-smoke-0.png')
  assert.equal(item.productionAssetCapsuleRef.schema, 'media.production_asset_capsule.local.v1')
  assert.equal(item.productionBundleRef.schema, 'media.production_bundle.local.v1')
  assert.equal(item.approvalProposalRef.schema, 'media.approval_proposal.local.v1')
  assert.equal(item.localDecisionRef.schema, 'media.operator_decision.v1')
  assert.equal(item.byteDescriptorProposalRef.schema, 'media.byte_descriptor_proposal.local.v1')
  assert.equal(item.resourceRefCandidateRef.schema, 'media.local_layer_resource_ref_candidate.local.v1')
  assert.ok(item.derivativeRefs.some((ref) => ref.derivativeKind === 'thumbnail'))
  assert.equal(item.prerequisitePosture.localPackageState, 'local-package-complete-authority-missing')
  assert.equal(item.prerequisitePosture.authorityState, 'authority-missing')
  assert.deepEqual(item.prerequisitePosture.missingLocalPrerequisites, [])
  assert.equal(item.prerequisitePosture.productionReady, false)
  assert.equal(item.nonClaims.rendered, false)
  assert.equal(item.nonClaims.productionReady, false)
  assert.equal(item.nonClaims.approvalAuthority, false)
  assert.equal(roughCut.assemblyPosture.state, 'review-only-rough-cut')
  assert.equal(roughCut.assemblyPosture.pendingAuthorityItems, 1)
  assert.equal(roughCut.renderPosture.rendered, false)
  assert.equal(roughCut.renderPosture.exportRef, null)
  assert.equal(roughCut.productionReady, false)
  assert.equal(roughCut.approvalAuthority, false)
  assert.equal(roughCut.ratifierAuthority, false)
  assert.equal(roughCut.publicationAuthorization, false)
  assert.equal(roughCut.edgeCalled, false)
  assert.equal(roughCut.meshPublished, false)
  assert.ok(roughCut.sourceRefs.some((ref) => ref.schema === 'media.production_bundle.local.v1'))
  assert.ok(roughCut.sourceRefs.some((ref) => ref.schema === 'media.production_asset_capsule.local.v1'))
  assert.ok(roughCut.sourceRefs.some((ref) => ref.schema === 'media.authority_handoff_candidate.local.v1'))
  assert.equal(validateRequiredRecord(roughCut), true)
  assert.ok(output.lines.some((line) => line.startsWith('rough cut capsule: project=venice-smoke-project')))
  assert.ok(output.lines.some((line) => line.includes('rendered=false')))
  assert.ok(output.lines.some((line) => line.includes('productionReady=false')))

  const written = JSON.parse(
    await readFile(path.join(dir, 'records', 'production', 'media-rough-cut-capsule.local.json'), 'utf8')
  )
  assert.equal(written.roughCutId, roughCut.roughCutId)
  assert.equal(validateRequiredRecord(written), true)

  const printed = await captureConsole(() => writeRoughCutCapsule({
    projectDir: dir,
    print: true
  }))
  const printedRoughCut = JSON.parse(printed.lines.join('\n'))
  assert.equal(printedRoughCut.roughCutId, roughCut.roughCutId)

  const summaryOutput = await captureConsole(() => writeMediaSummary({ projectDir: dir }))
  const summary = await createMediaSummary({ projectDir: dir })
  assert.equal(summary.productionRoughCuts.total, 1)
  assert.equal(summary.productionRoughCuts.itemRefs, 1)
  assert.equal(summary.productionRoughCuts.pendingAuthorityItems, 1)
  assert.equal(summary.productionRoughCuts.rendered, 0)
  assert.equal(summary.productionRoughCuts.reviewed, 0)
  assert.equal(summary.productionRoughCuts.attentionRows.length, 1)
  assert.deepEqual(summary.productionRoughCuts.attentionRows[0].issueCodes, ['rough_cut_review_missing'])
  assert.ok(summaryOutput.lines.some((line) => line === 'rough cuts: total=1 | items=1 | reviewed=0 | changesRequested=0 | deferred=0 | pendingAuthority=1 | rendered=0 | attention=1'))

  const decisionOutput = await captureConsole(() => writeRoughCutReviewDecision({ projectDir: dir }))
  const decision = decisionOutput.result.decision
  assert.equal(decision.schema, 'media.operator_decision.v1')
  assert.equal(decision.decisionType, 'review_rough_cut')
  assert.equal(decision.subjectRef.id, roughCut.roughCutId)
  assert.equal(decision.subjectRef.schema, 'media.rough_cut_capsule.local.v1')
  assert.equal(decision.roughCutReview.itemCount, 1)
  assert.equal(decision.roughCutReview.rendered, false)
  assert.equal(decision.roughCutReview.productionReady, false)
  assert.equal(decision.reviewAcknowledged, true)
  assert.equal(decision.localDecisionOnly, true)
  assert.equal(decision.executionPerformed, false)
  assert.equal(decision.authorityGranted, false)
  assert.equal(decision.approvalAuthority, false)
  assert.equal(decision.publicationAuthorization, false)
  assert.equal(decision.edgeCalled, false)
  assert.equal(decision.meshPublished, false)
  assert.ok(decision.evidenceRefs.some((ref) => ref.schema === 'media.rough_cut_capsule.local.v1'))
  assert.equal(validateRequiredRecord(decision), true)
  assert.ok(decisionOutput.lines.some((line) => line.startsWith('rough cut review decision: review_rough_cut')))
  assert.ok(decisionOutput.lines.some((line) => line.includes('productionReady=false')))

  const reviewedSummaryOutput = await captureConsole(() => writeMediaSummary({ projectDir: dir }))
  const reviewedSummary = await createMediaSummary({ projectDir: dir })
  assert.equal(reviewedSummary.productionRoughCuts.reviewed, 1)
  assert.equal(reviewedSummary.productionRoughCuts.attentionRows.length, 0)
  assert.ok(reviewedSummaryOutput.lines.some((line) => line === 'rough cuts: total=1 | items=1 | reviewed=1 | changesRequested=0 | deferred=0 | pendingAuthority=1 | rendered=0 | attention=0'))

  const reviewedPrereqs = await createProductionAuthorityPrerequisiteReport({ projectDir: dir })
  assert.equal(reviewedPrereqs.roughCutReviewed, 1)
  assert.equal(reviewedPrereqs.roughCutChangesRequested, 0)
  assert.equal(reviewedPrereqs.roughCutDeferred, 0)
  assert.equal(reviewedPrereqs.rows[0].roughCutReviewPosture.state, 'rough-cut-reviewed-local')
  assert.equal(reviewedPrereqs.rows[0].roughCutReviewPosture.reviewDecisionRef.id, decision.decisionId)

  const reviewedHandoffOutput = await captureConsole(() => writeAuthorityHandoffCandidate({ projectDir: dir }))
  const reviewedHandoff = reviewedHandoffOutput.result.candidate
  assert.equal(reviewedHandoff.prerequisiteSummary.roughCutReviewed, 1)
  assert.equal(reviewedHandoff.authorityReviewInputs.find((input) => input.inputKind === 'rough-cut-capsule').present, true)
  assert.equal(reviewedHandoff.authorityReviewInputs.find((input) => input.inputKind === 'rough-cut-review-decision').reviewed, 1)
  assert.ok(reviewedHandoff.sourceRefs.some((ref) => ref.schema === 'media.rough_cut_capsule.local.v1'))
  assert.ok(reviewedHandoff.sourceRefs.some((ref) => ref.id === decision.decisionId))
  assert.ok(reviewedHandoffOutput.lines.some((line) => line.includes('roughCutReviewed=1')))

  const healthOutput = await captureConsole(() => writeProjectHealth({ projectDir: dir, summary: true }))
  assert.equal(healthOutput.result.health.productionRoughCutHealthExplanations.length, 0)
  assert.ok(healthOutput.lines.some((line) => line === 'productionRoughCutAttention: 0'))

  const indexOutput = await captureConsole(() => writeOperatorPacketIndex({ projectDir: dir }))
  const index = indexOutput.result.index
  assert.equal(index.roughCutCapsuleRefs.length, 1)
  assert.equal(index.roughCutCapsules.length, 1)
  assert.equal(index.summary.roughCutCapsules, 1)
  assert.equal(index.summary.roughCutCapsulesNeedingAttention, 0)
  assert.equal(index.summary.roughCutReviewDecisions, 1)
  assert.ok(indexOutput.lines.some((line) => line.includes('roughCuts=1')))
  assert.ok(indexOutput.lines.some((line) => line.includes('roughCutDecisions=1')))
  assert.ok(indexOutput.lines.some((line) => line.includes('rough cut: rough-cut-capsule-')))
  assert.ok(indexOutput.lines.some((line) => line.includes('rough-cut decision: review_rough_cut')))

  const inspection = await inspectVeniceSmoke({ projectDir: dir })
  assert.ok(Object.values(inspection.packet.recordRefs).some((ref) => ref.schema === 'media.rough_cut_capsule.local.v1'))
  assert.ok(inspection.packet.artifactKinds.includes('media.rough_cut_capsule.local.v1'))
  assert.equal(inspection.packet.operationalSummary.recordCounts.roughCutCapsules, 1)
  assert.equal(inspection.packet.operationalSummary.recordCounts.roughCutReviewDecisions, 1)
  assert.equal(inspection.packet.operationalSummary.recordRefs.roughCutCapsules.length, 1)
  assert.equal(inspection.packet.operationalSummary.recordRefs.roughCutReviewDecisions.length, 1)

  const compatibility = await writeEdgeCompatibilityBundle({ projectDir: dir })
  assert.ok(compatibility.bundle.studioSourceRefs.some((ref) => ref.schema === 'media.rough_cut_capsule.local.v1'))
  assert.ok(compatibility.bundle.studioSourceRefs.some((ref) => ref.id === decision.decisionId))
  assert.ok(compatibility.bundle.studioSourceRefs.some((ref) => ref.schema === 'media.production_authority_prerequisites.summary.local.v1'))
})

test('rough cut request changes surfaces local revision posture', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-rough-cut-changes-'))
  await runVeniceProductionRehearsal({ projectDir: dir })
  await writeAuthorityHandoffCandidate({ projectDir: dir, quiet: true })
  await writeRoughCutCapsule({ projectDir: dir })

  const decisionOutput = await captureConsole(() => writeRoughCutReviewDecision({
    projectDir: dir,
    decision: 'request_changes',
    reason: 'Tighten the local order before authority review.',
    output: 'records/decisions/media-rough-cut-request-changes.local.json'
  }))
  const decision = decisionOutput.result.decision
  assert.equal(decision.decisionType, 'request_changes')
  assert.equal(decision.reviewAcknowledged, false)
  assert.equal(decision.requestChanges, true)
  assert.equal(decision.executionPerformed, false)
  assert.equal(decision.authorityGranted, false)

  const summary = await createMediaSummary({ projectDir: dir })
  assert.equal(summary.productionRoughCuts.reviewed, 0)
  assert.equal(summary.productionRoughCuts.changesRequested, 1)
  assert.equal(summary.productionRoughCuts.deferred, 0)
  assert.deepEqual(summary.productionRoughCuts.attentionRows[0].issueCodes, ['rough_cut_changes_requested'])
  assert.ok(summary.productionRoughCuts.attentionRows[0].nextAction.includes('Regenerate or revise'))

  const health = await writeProjectHealth({ projectDir: dir, summary: true })
  assert.equal(health.health.productionRoughCutHealthExplanations.length, 1)
  assert.deepEqual(health.health.productionRoughCutHealthExplanations[0].issueCodes, ['rough_cut_changes_requested'])

  const indexOutput = await captureConsole(() => writeOperatorPacketIndex({ projectDir: dir }))
  const index = indexOutput.result.index
  assert.equal(index.summary.roughCutCapsulesNeedingAttention, 1)
  assert.ok(index.roughCutCapsules[0].issueCodes.includes('rough_cut_changes_requested'))
  assert.ok(indexOutput.lines.some((line) => line.includes('requestChanges=true')))

  const prereqs = await createProductionAuthorityPrerequisiteReport({ projectDir: dir })
  assert.equal(prereqs.roughCutReviewed, 0)
  assert.equal(prereqs.roughCutChangesRequested, 1)
  assert.equal(prereqs.roughCutDeferred, 0)
  assert.equal(prereqs.rows[0].roughCutReviewPosture.state, 'rough-cut-changes-requested')
  assert.ok(prereqs.rows[0].safeNextAction.includes('Regenerate or revise'))
})

test('render export candidate requires reviewed rough cut without rendering or authority', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-render-export-candidate-'))
  await runVeniceProductionRehearsal({ projectDir: dir })
  await writeAuthorityHandoffCandidate({ projectDir: dir, quiet: true })
  await writeRoughCutCapsule({ projectDir: dir, quiet: true })

  await assert.rejects(
    () => writeRenderExportCandidate({ projectDir: dir, quiet: true }),
    /Reviewed rough-cut decision required/
  )

  const review = await writeRoughCutReviewDecision({ projectDir: dir })
  const output = await captureConsole(() => writeRenderExportCandidate({ projectDir: dir }))
  const candidate = output.result.candidate

  assert.equal(candidate.schema, 'media.render_export_candidate.local.v1')
  assert.equal(candidate.candidateKind, 'rough-cut-render-export-candidate')
  assert.equal(candidate.sourceRoughCutRef.schema, 'media.rough_cut_capsule.local.v1')
  assert.equal(candidate.reviewDecisionRef.id, review.decision.decisionId)
  assert.equal(candidate.freshnessPosture.state, 'fresh')
  assert.equal(candidate.freshnessPosture.renderFeasibilityClaimed, false)
  assert.equal(candidate.reviewPosture.reviewed, true)
  assert.equal(candidate.reviewPosture.decisionType, 'review_rough_cut')
  assert.equal(candidate.orderedItemRefs.length, 1)
  assert.equal(candidate.renderPosture.rendererRequired, true)
  assert.equal(candidate.renderPosture.rendererSelected, false)
  assert.equal(candidate.renderPosture.renderPerformed, false)
  assert.equal(candidate.renderPosture.renderedOutputRef, null)
  assert.equal(candidate.exportPosture.exportPerformed, false)
  assert.equal(candidate.exportPosture.exportOutputRef, null)
  assert.equal(candidate.candidateOnly, true)
  assert.equal(candidate.productionReady, false)
  assert.equal(candidate.approvalAuthority, false)
  assert.equal(candidate.ratifierAuthority, false)
  assert.equal(candidate.publicationAuthorization, false)
  assert.equal(candidate.edgeCalled, false)
  assert.equal(candidate.meshPublished, false)
  assert.ok(candidate.sourceRefs.some((ref) => ref.schema === 'media.rough_cut_capsule.local.v1'))
  assert.ok(candidate.sourceRefs.some((ref) => ref.id === review.decision.decisionId))
  assert.equal(validateRequiredRecord(candidate), true)
  assert.ok(output.lines.some((line) => line.startsWith('render/export candidate: project=venice-smoke-project')))
  assert.ok(output.lines.some((line) => line.includes('renderPerformed=false')))
  assert.ok(output.lines.some((line) => line.includes('exportPerformed=false')))

  const written = JSON.parse(
    await readFile(path.join(dir, 'records', 'production', 'media-render-export-candidate.local.json'), 'utf8')
  )
  assert.equal(written.candidateId, candidate.candidateId)
  assert.equal(validateRequiredRecord(written), true)

  const mediaSummaryOutput = await captureConsole(() => writeMediaSummary({ projectDir: dir }))
  const mediaSummary = await createMediaSummary({ projectDir: dir })
  assert.equal(mediaSummary.renderExportCandidates.total, 1)
  assert.equal(mediaSummary.renderExportCandidates.reviewed, 1)
  assert.equal(mediaSummary.renderExportCandidates.rendererSelected, 0)
  assert.equal(mediaSummary.renderExportCandidates.renderPerformed, 0)
  assert.equal(mediaSummary.renderExportCandidates.exportPerformed, 0)
  assert.equal(mediaSummary.renderExportCandidates.productionReady, 0)
  assert.equal(mediaSummary.renderExportCandidates.fresh, 1)
  assert.equal(mediaSummary.renderExportCandidates.stale, 0)
  assert.ok(mediaSummaryOutput.lines.some((line) => line === 'render/export candidates: total=1 | reviewed=1 | rendererSelected=0 | renderPerformed=0 | exportPerformed=0 | productionReady=0 | stale=0 | attention=0'))
  assert.ok(mediaSummaryOutput.lines.some((line) => line.includes(`render/export candidate: ${candidate.candidateId}`)))

  const healthOutput = await captureConsole(() => writeProjectHealth({ projectDir: dir, summary: true }))
  assert.equal(healthOutput.result.health.renderExportCandidateSummary.total, 1)
  assert.equal(healthOutput.result.health.renderExportCandidateSummary.renderPerformed, 0)
  assert.equal(healthOutput.result.health.renderExportCandidateSummary.stale, 0)
  assert.ok(healthOutput.lines.some((line) => line === 'renderExportCandidates: total=1 | reviewed=1 | rendererSelected=0 | renderPerformed=0 | exportPerformed=0 | productionReady=0 | stale=0'))

  const indexOutput = await captureConsole(() => writeOperatorPacketIndex({ projectDir: dir }))
  assert.equal(indexOutput.result.index.summary.renderExportCandidates, 1)
  assert.equal(indexOutput.result.index.renderExportCandidates[0].renderPerformed, false)
  assert.equal(indexOutput.result.index.renderExportCandidates[0].exportPerformed, false)
  assert.equal(indexOutput.result.index.renderExportCandidates[0].freshnessState, 'fresh')
  assert.ok(indexOutput.lines.some((line) => line.includes('renderExportCandidates=1')))
  assert.ok(indexOutput.lines.some((line) => line.includes(`render/export candidate: ${candidate.candidateId}`)))

  const inspection = await inspectVeniceSmoke({ projectDir: dir })
  assert.equal(inspection.packet.operationalSummary.recordCounts.renderExportCandidates, 1)
  assert.equal(inspection.packet.operationalSummary.renderExportCandidates.total, 1)
  assert.equal(inspection.packet.operationalSummary.renderExportCandidates.rendererSelected, 0)
  assert.equal(inspection.packet.operationalSummary.renderExportCandidates.renderPerformed, 0)
  assert.equal(inspection.packet.operationalSummary.renderExportCandidates.exportPerformed, 0)
  assert.equal(inspection.packet.operationalSummary.renderExportCandidates.productionReady, 0)
  assert.equal(inspection.packet.operationalSummary.renderExportCandidates.stale, 0)

  const gatedPrereqOutput = await captureConsole(() => writeProductionAuthorityPrerequisiteReport({ projectDir: dir }))
  const gatedPrereqs = gatedPrereqOutput.result
  assert.equal(gatedPrereqs.renderExportCandidates, 1)
  assert.equal(gatedPrereqs.localProductionPackageComplete, 0)
  assert.equal(gatedPrereqs.localProductionPackageState, 'local-production-package-incomplete')
  assert.equal(gatedPrereqs.renderExportCandidatesFresh, 1)
  assert.equal(gatedPrereqs.renderReceipts, 0)
  assert.equal(gatedPrereqs.renderAuthorizationMissing, 1)
  assert.equal(gatedPrereqs.exportAuthorizationMissing, 1)
  assert.equal(gatedPrereqs.productionReady, 0)
  assert.equal(gatedPrereqs.rows[0].renderExportCandidatePosture.state, 'render-export-candidate-present-review-only')
  assert.equal(gatedPrereqs.rows[0].renderExportCandidatePosture.renderAuthorization, false)
  assert.equal(gatedPrereqs.rows[0].renderExportCandidatePosture.exportAuthorization, false)
  assert.ok(gatedPrereqOutput.lines.some((line) => line.includes('renderExportCandidates=1')))
  assert.ok(gatedPrereqOutput.lines.some((line) => line.includes('renderAuthorizationMissing=1')))

  const gatedHandoff = await writeAuthorityHandoffCandidate({ projectDir: dir, quiet: true })
  assert.equal(gatedHandoff.candidate.prerequisiteSummary.renderExportCandidates, 1)
  assert.equal(gatedHandoff.candidate.prerequisiteSummary.localProductionPackageComplete, 0)
  assert.equal(gatedHandoff.candidate.prerequisiteSummary.localProductionPackageState, 'local-production-package-incomplete')
  assert.equal(gatedHandoff.candidate.prerequisiteSummary.renderReceipts, 0)
  assert.equal(gatedHandoff.candidate.prerequisiteSummary.renderAuthorizationMissing, 1)
  assert.equal(gatedHandoff.candidate.prerequisiteSummary.exportAuthorizationMissing, 1)
  const renderExportInput = gatedHandoff.candidate.authorityReviewInputs.find((input) => input.inputKind === 'render-export-candidate')
  assert.equal(renderExportInput.present, true)
  assert.equal(renderExportInput.renderPerformed, false)
  assert.equal(renderExportInput.exportPerformed, false)
  assert.equal(renderExportInput.renderAuthorization, false)
  assert.equal(renderExportInput.exportAuthorization, false)
  assert.ok(gatedHandoff.candidate.authorityGaps.includes('render_authorization_missing'))
  assert.ok(gatedHandoff.candidate.authorityGaps.includes('export_authorization_missing'))

  const mediationOutput = await captureConsole(() => writeRenderExportMediation({ projectDir: dir }))
  const operationCandidate = mediationOutput.result.operationCandidate
  const trace = mediationOutput.result.trace
  assert.equal(operationCandidate.schema, 'media.operation_candidate.local.v1')
  assert.equal(operationCandidate.operationClass, 'prepare_render_export')
  assert.equal(operationCandidate.artifactClass, 'media.export')
  assert.equal(operationCandidate.subjectRef.id, candidate.candidateId)
  assert.ok(operationCandidate.sourceRefs.some((ref) => ref.schema === 'media.render_export_candidate.local.v1'))
  assert.equal(trace.schema, 'media.rule_resolution_trace.local.v1')
  assert.equal(trace.resolutionMode, 'ask_operator')
  assert.equal(trace.deliveryMode, 'inbox')
  assert.equal(trace.executionPerformed, false)
  assert.equal(trace.edgeCalled, false)
  assert.equal(trace.meshPublished, false)
  assert.ok(trace.blockedClaims.includes('render authorization'))
  assert.ok(trace.blockedClaims.includes('export authorization'))
  assert.ok(mediationOutput.lines.some((line) => line.includes('render/export mediation:')))
  assert.ok(mediationOutput.lines.some((line) => line.includes('resolution=ask_operator')))

  const adapterContractOutput = await captureConsole(() => writeRenderAdapterContract({ projectDir: dir }))
  const adapterContract = adapterContractOutput.result.contract
  assert.equal(adapterContract.schema, 'media.render_adapter_contract.local.v1')
  assert.equal(adapterContract.contractKind, 'local-renderer-adapter-contract')
  assert.equal(adapterContract.sourceRenderExportCandidateRef.id, candidate.candidateId)
  assert.equal(adapterContract.orderedItems.length, 1)
  assert.equal(adapterContract.targetFormat.formatId, 'local-review-preview')
  assert.equal(adapterContract.targetFormat.formatSelected, false)
  assert.equal(adapterContract.outputPlacement.relativePath, 'media/exports/render-preview')
  assert.equal(adapterContract.outputPlacement.materializationPlanned, false)
  assert.equal(adapterContract.adapterSelection.adapterSelected, false)
  assert.equal(adapterContract.renderPerformed, false)
  assert.equal(adapterContract.exportPerformed, false)
  assert.equal(adapterContract.productionReady, false)
  assert.equal(adapterContract.publicationAuthorization, false)
  assert.equal(adapterContract.nonClaims.outputBytesCreated, false)
  assert.ok(adapterContract.capabilityRequirements.some((entry) => entry.includes('ordered rough-cut item refs')))
  assert.ok(adapterContractOutput.lines.some((line) => line.includes('render adapter contract:')))
  assert.ok(adapterContractOutput.lines.some((line) => line.includes('adapterSelected=false')))

  const renderPlanOutput = await captureConsole(() => writeRenderPlanCandidate({ projectDir: dir }))
  const renderPlan = renderPlanOutput.result.plan
  assert.equal(renderPlan.schema, 'media.render_plan_candidate.local.v1')
  assert.equal(renderPlan.planKind, 'dry-run-render-plan-candidate')
  assert.equal(renderPlan.sourceRenderExportCandidateRef.id, candidate.candidateId)
  assert.equal(renderPlan.renderAdapterContractRef.id, adapterContract.contractId)
  assert.equal(renderPlan.orderedItems.length, 1)
  assert.equal(renderPlan.planPosture.refsResolved, true)
  assert.equal(renderPlan.planPosture.targetOutputPathResolved, true)
  assert.equal(renderPlan.planPosture.mediaBytesRead, false)
  assert.equal(renderPlan.targetOutputRef.path, 'media/exports/render-preview')
  assert.equal(renderPlan.targetOutputRef.materialized, false)
  assert.equal(renderPlan.renderPerformed, false)
  assert.equal(renderPlan.exportPerformed, false)
  assert.equal(renderPlan.productionReady, false)
  assert.ok(renderPlan.sourceRefs.some((ref) => ref.schema === 'media.render_adapter_contract.local.v1'))
  assert.ok(renderPlanOutput.lines.some((line) => line.includes('render plan candidate:')))
  assert.ok(renderPlanOutput.lines.some((line) => line.includes('bytesRead=false')))

  const contactSheetOutput = await captureConsole(() => writeContactSheetRender({ projectDir: dir, tileSize: 64 }))
  const contactSheet = contactSheetOutput.result.receipt
  assert.equal(contactSheet.schema, 'media.render_receipt.local.v1')
  assert.equal(contactSheet.renderKind, 'local-contact-sheet')
  assert.equal(contactSheet.sourceRenderPlanRef.id, renderPlan.planId)
  assert.equal(contactSheet.sourceRenderExportCandidateRef.id, candidate.candidateId)
  assert.equal(contactSheet.renderAdapterContractRef.id, adapterContract.contractId)
  assert.equal(contactSheet.orderedItems.length, 1)
  assert.equal(contactSheet.orderedItems[0].bytesRead, true)
  assert.equal(contactSheet.orderedItems[0].rendered, true)
  assert.equal(contactSheet.outputLocalRef.path.startsWith('media/exports/render-preview/contact-sheet-'), true)
  assert.equal(contactSheet.outputLocalRef.contentType, 'image/png')
  assert.equal(contactSheet.executionPosture.rendererSelected, true)
  assert.equal(contactSheet.executionPosture.rendererEngine, 'sharp')
  assert.equal(contactSheet.executionPosture.mediaBytesRead, true)
  assert.equal(contactSheet.executionPosture.outputBytesCreated, true)
  assert.equal(contactSheet.renderPerformed, true)
  assert.equal(contactSheet.exportPerformed, false)
  assert.equal(contactSheet.productionReady, false)
  assert.equal(contactSheet.approvalAuthority, false)
  assert.equal(contactSheet.publicationAuthorization, false)
  assert.equal(contactSheet.materializationProof, false)
  assert.equal(validateRequiredRecord(contactSheet), true)
  const contactSheetBytes = await readFile(path.join(dir, contactSheet.outputLocalRef.path))
  assert.equal(contactSheetBytes.length, contactSheet.output.bytes)
  assert.ok(contactSheetOutput.lines.some((line) => line.includes('contact sheet render:')))
  assert.ok(contactSheetOutput.lines.some((line) => line.includes('renderPerformed=true')))
  assert.ok(contactSheetOutput.lines.some((line) => line.includes('exportPerformed=false')))

  const ffmpegDisabledOutput = await captureConsole(() => writeFfmpegRender({ projectDir: dir, disableFfmpeg: true }))
  assert.equal(ffmpegDisabledOutput.result.receipt, null)
  assert.equal(ffmpegDisabledOutput.result.skipped.reason, 'ffmpeg disabled')
  assert.equal(ffmpegDisabledOutput.result.skipped.renderPerformed, false)
  assert.ok(ffmpegDisabledOutput.lines.some((line) => line.includes('ffmpeg render: skipped')))

  const ffmpegOutput = await captureConsole(() => writeFfmpegRender({
    projectDir: dir,
    secondsPerItem: 1,
    width: 320,
    height: 180,
    fps: 12
  }))
  const ffmpegReceipt = ffmpegOutput.result.receipt
  assert.equal(ffmpegReceipt.schema, 'media.render_receipt.local.v1')
  assert.equal(ffmpegReceipt.renderKind, 'local-ffmpeg-review-mp4')
  assert.equal(ffmpegReceipt.sourceRenderPlanRef.id, renderPlan.planId)
  assert.equal(ffmpegReceipt.outputLocalRef.contentType, 'video/mp4')
  assert.equal(ffmpegReceipt.outputLocalRef.path.startsWith('media/exports/render-preview/ffmpeg-review-'), true)
  assert.equal(ffmpegReceipt.executionPosture.rendererSelected, true)
  assert.equal(ffmpegReceipt.executionPosture.rendererEngine, 'ffmpeg')
  assert.equal(ffmpegReceipt.executionPosture.ffmpegDefault, true)
  assert.equal(ffmpegReceipt.executionPosture.ffmpegDisableSupported, true)
  assert.equal(ffmpegReceipt.renderPerformed, true)
  assert.equal(ffmpegReceipt.exportPerformed, false)
  assert.equal(ffmpegReceipt.productionReady, false)
  assert.equal(ffmpegReceipt.publicationAuthorization, false)
  assert.equal(ffmpegReceipt.materializationProof, false)
  assert.equal(validateRequiredRecord(ffmpegReceipt), true)
  const ffmpegBytes = await readFile(path.join(dir, ffmpegReceipt.outputLocalRef.path))
  assert.equal(ffmpegBytes.length, ffmpegReceipt.output.bytes)
  assert.ok(ffmpegOutput.lines.some((line) => line.includes('ffmpeg render:')))
  assert.ok(ffmpegOutput.lines.some((line) => line.includes('renderPerformed=true')))
  assert.ok(ffmpegOutput.lines.some((line) => line.includes('exportPerformed=false')))

  const renderedRecords = await readProjectRecords(dir)
  const renderReceiptSummary = summarizeRenderReceipts(renderedRecords)
  assert.equal(renderReceiptSummary.total, 2)
  assert.equal(renderReceiptSummary.contactSheet, 1)
  assert.equal(renderReceiptSummary.ffmpegPreview, 1)
  assert.equal(renderReceiptSummary.renderPerformed, 2)
  assert.equal(renderReceiptSummary.exportPerformed, 0)
  assert.equal(renderReceiptSummary.productionReady, 0)
  assert.equal(renderReceiptSummary.fresh, 2)
  assert.equal(renderReceiptSummary.stale, 0)
  assert.equal(evaluateRenderReceiptFreshness({ receipt: ffmpegReceipt, records: renderedRecords }).state, 'fresh')

  const renderedMediaSummaryOutput = await captureConsole(() => writeMediaSummary({ projectDir: dir }))
  const renderedMediaSummary = renderedMediaSummaryOutput.result
  assert.equal(renderedMediaSummary.renderReceipts.total, 2)
  assert.equal(renderedMediaSummary.renderReceipts.renderPerformed, 2)
  assert.equal(renderedMediaSummary.renderReceipts.exportPerformed, 0)
  assert.equal(renderedMediaSummary.renderReceipts.productionReady, 0)
  assert.ok(renderedMediaSummaryOutput.lines.some((line) => line === 'render receipts: total=2 | contactSheet=1 | ffmpegPreview=1 | renderPerformed=2 | exportPerformed=0 | productionReady=0 | stale=0 | attention=0'))

  const renderedHealthOutput = await captureConsole(() => writeProjectHealth({ projectDir: dir, summary: true }))
  assert.equal(renderedHealthOutput.result.health.renderReceiptSummary.total, 2)
  assert.equal(renderedHealthOutput.result.health.renderReceiptSummary.stale, 0)
  assert.ok(renderedHealthOutput.lines.some((line) => line === 'renderReceipts: total=2 | contactSheet=1 | ffmpegPreview=1 | renderPerformed=2 | exportPerformed=0 | productionReady=0 | stale=0'))

  const renderedIndexOutput = await captureConsole(() => writeOperatorPacketIndex({ projectDir: dir }))
  assert.equal(renderedIndexOutput.result.index.summary.renderReceipts, 2)
  assert.equal(renderedIndexOutput.result.index.summary.renderReceiptsNeedingAttention, 0)
  assert.ok(renderedIndexOutput.lines.some((line) => line.includes('renderReceipts=2')))
  assert.ok(renderedIndexOutput.lines.some((line) => line.includes(`render receipt: ${ffmpegReceipt.renderReceiptId}`)))

  const renderedInspection = await inspectVeniceSmoke({ projectDir: dir })
  assert.equal(renderedInspection.packet.operationalSummary.recordCounts.renderReceipts, 2)
  assert.equal(renderedInspection.packet.operationalSummary.renderReceipts.total, 2)
  assert.equal(renderedInspection.packet.operationalSummary.renderReceipts.renderPerformed, 2)
  assert.equal(renderedInspection.packet.operationalSummary.renderReceipts.exportPerformed, 0)

  const renderedPrereqs = await writeProductionAuthorityPrerequisiteReport({ projectDir: dir, print: false })
  assert.equal(renderedPrereqs.localProductionPackageComplete, 0)
  assert.equal(renderedPrereqs.localProductionPackageState, 'local-production-package-incomplete')
  assert.equal(renderedPrereqs.renderReceipts, 1)
  assert.equal(renderedPrereqs.renderReceiptsFresh, 1)
  assert.equal(renderedPrereqs.rows[0].renderReceiptPosture.state, 'render-receipt-present-preview-only')
  assert.equal(renderedPrereqs.rows[0].renderReceiptPosture.renderPerformed, true)
  assert.equal(renderedPrereqs.rows[0].renderReceiptPosture.exportAuthorization, false)
  assert.equal(renderedPrereqs.rows[0].renderReceiptPosture.productionReady, false)

  const renderedHandoff = await writeAuthorityHandoffCandidate({ projectDir: dir, quiet: true })
  assert.equal(renderedHandoff.candidate.prerequisiteSummary.localProductionPackageComplete, 0)
  assert.equal(renderedHandoff.candidate.prerequisiteSummary.localProductionPackageState, 'local-production-package-incomplete')
  assert.equal(renderedHandoff.candidate.prerequisiteSummary.renderReceipts, 1)
  const renderReceiptInput = renderedHandoff.candidate.authorityReviewInputs.find((input) => input.inputKind === 'render-receipt')
  assert.equal(renderReceiptInput.present, true)
  assert.equal(renderReceiptInput.renderPerformed, true)
  assert.equal(renderReceiptInput.exportPerformed, false)
  assert.equal(renderReceiptInput.publicationAuthorization, false)
  assert.equal(renderReceiptInput.productionReady, false)

  const exportCandidateOutput = await captureConsole(() => writeExportCandidate({ projectDir: dir }))
  const exportCandidate = exportCandidateOutput.result.candidate
  assert.equal(exportCandidate.schema, 'media.export_candidate.local.v1')
  assert.equal(exportCandidate.candidateKind, 'reviewed-rough-cut-export-candidate')
  assert.equal(exportCandidate.sourceRoughCutRef.id, renderPlan.sourceRoughCutRef.id)
  assert.equal(exportCandidate.reviewDecisionRef.id, review.decision.decisionId)
  assert.equal(exportCandidate.sourceRenderReceiptRef.id, ffmpegReceipt.renderReceiptId)
  assert.equal(exportCandidate.renderReceiptPosture.present, true)
  assert.equal(exportCandidate.renderReceiptPosture.renderPerformed, true)
  assert.equal(exportCandidate.exportPosture.exportPerformed, false)
  assert.equal(exportCandidate.exportPosture.deliveryCreated, false)
  assert.equal(exportCandidate.exportPosture.publicationAuthorization, false)
  assert.equal(exportCandidate.targetExport.formatSelected, false)
  assert.equal(exportCandidate.targetExport.packageCreated, false)
  assert.equal(exportCandidate.exportPerformed, false)
  assert.equal(exportCandidate.productionReady, false)
  assert.equal(exportCandidate.approvalAuthority, false)
  assert.equal(exportCandidate.publicationAuthorization, false)
  assert.equal(exportCandidate.materializationProof, false)
  assert.equal(validateRequiredRecord(exportCandidate), true)
  assert.ok(exportCandidate.sourceRefs.some((ref) => ref.schema === 'media.render_receipt.local.v1'))
  assert.ok(exportCandidateOutput.lines.some((line) => line.includes('export candidate:')))
  assert.ok(exportCandidateOutput.lines.some((line) => line.includes('exportPerformed=false')))

  const exportPlanOutput = await captureConsole(() => writeExportPlanCandidate({ projectDir: dir }))
  const exportPlan = exportPlanOutput.result.plan
  assert.equal(exportPlan.schema, 'media.export_plan_candidate.local.v1')
  assert.equal(exportPlan.planKind, 'dry-run-export-plan-candidate')
  assert.equal(exportPlan.sourceExportCandidateRef.id, exportCandidate.exportCandidateId)
  assert.equal(exportPlan.sourceRenderReceiptRef.id, ffmpegReceipt.renderReceiptId)
  assert.equal(exportPlan.orderedItems.length, 1)
  assert.equal(exportPlan.planPosture.refsResolved, true)
  assert.equal(exportPlan.planPosture.targetOutputPathResolved, true)
  assert.equal(exportPlan.planPosture.mediaBytesRead, false)
  assert.equal(exportPlan.planPosture.outputBytesCreated, false)
  assert.equal(exportPlan.planPosture.exportPerformed, false)
  assert.equal(exportPlan.planPosture.deliveryCreated, false)
  assert.equal(exportPlan.targetOutputRef.materialized, false)
  assert.equal(exportPlan.exportPerformed, false)
  assert.equal(exportPlan.productionReady, false)
  assert.equal(exportPlan.publicationAuthorization, false)
  assert.equal(exportPlan.materializationProof, false)
  assert.equal(validateRequiredRecord(exportPlan), true)
  assert.ok(exportPlan.sourceRefs.some((ref) => ref.schema === 'media.export_candidate.local.v1'))
  assert.ok(exportPlanOutput.lines.some((line) => line.includes('export plan candidate:')))
  assert.ok(exportPlanOutput.lines.some((line) => line.includes('bytesRead=false')))
  await assert.rejects(
    () => readFile(path.join(dir, exportPlan.targetOutputRef.path)),
    /ENOENT/
  )

  const localExportOutput = await captureConsole(() => writeLocalExportPackage({ projectDir: dir }))
  const localExport = localExportOutput.result.receipt
  assert.equal(localExport.schema, 'media.export_receipt.local.v1')
  assert.equal(localExport.exportKind, 'local-review-package-copy')
  assert.equal(localExport.sourceExportPlanRef.id, exportPlan.planId)
  assert.equal(localExport.sourceExportCandidateRef.id, exportCandidate.exportCandidateId)
  assert.equal(localExport.sourceRoughCutRef.id, renderPlan.sourceRoughCutRef.id)
  assert.equal(localExport.sourceRenderReceiptRef.id, ffmpegReceipt.renderReceiptId)
  assert.equal(localExport.sourceOutputLocalRef.path, ffmpegReceipt.outputLocalRef.path)
  assert.equal(localExport.deliveryLocalRef.path.startsWith(`${exportPlan.targetOutputRef.path}/delivery-`), true)
  assert.equal(localExport.deliveryLocalRef.contentType, 'video/mp4')
  assert.equal(localExport.deliveryManifestRef.path, `${exportPlan.targetOutputRef.path}/export-manifest.local.json`)
  assert.equal(localExport.executionPosture.sourceBytesRead, true)
  assert.equal(localExport.executionPosture.deliveryBytesCreated, true)
  assert.equal(localExport.executionPosture.exportPerformed, true)
  assert.equal(localExport.executionPosture.publicationAuthorization, false)
  assert.equal(localExport.executionPosture.productionReady, false)
  assert.equal(localExport.exportPerformed, true)
  assert.equal(localExport.deliveryCreated, true)
  assert.equal(localExport.publicationAuthorization, false)
  assert.equal(localExport.productionReady, false)
  assert.equal(localExport.approvalAuthority, false)
  assert.equal(localExport.materializationProof, false)
  assert.equal(localExport.reviewDecisionRef.id, review.decision.decisionId)
  assert.equal(localExport.orderedItems.length, 1)
  assert.equal(validateRequiredRecord(localExport), true)
  const deliveryBytes = await readFile(path.join(dir, localExport.deliveryLocalRef.path))
  const sourcePreviewBytes = await readFile(path.join(dir, ffmpegReceipt.outputLocalRef.path))
  assert.deepEqual(deliveryBytes, sourcePreviewBytes)
  const localExportManifest = JSON.parse(await readFile(path.join(dir, localExport.deliveryManifestRef.path), 'utf8'))
  assert.equal(localExportManifest.exportReceiptRef.id, localExport.exportReceiptId)
  assert.equal(localExportManifest.publicationAuthorization, false)
  assert.equal(localExportManifest.productionReady, false)
  assert.ok(localExportOutput.lines.some((line) => line.includes('local export package:')))
  assert.ok(localExportOutput.lines.some((line) => line.includes('deliveryCreated=true')))
  assert.ok(localExportOutput.lines.some((line) => line.includes('publicationAuthorization=false')))

  const exportedMediaSummary = await createMediaSummary({ projectDir: dir })
  assert.equal(exportedMediaSummary.exportReceipts.total, 1)
  assert.equal(exportedMediaSummary.exportReceipts.localPackageCopyExportReceipts, 1)
  assert.equal(exportedMediaSummary.exportReceipts.ffmpegDeliveryReceipts, 0)
  assert.equal(exportedMediaSummary.exportReceipts.localDeliveryEvidencePresent, 1)
  assert.equal(exportedMediaSummary.exportReceipts.rows[0].localDeliveryEvidencePresent, true)
  assert.equal(exportedMediaSummary.exportReceipts.rows[0].sourceRoughCutId, renderPlan.sourceRoughCutRef.id)
  assert.equal(exportedMediaSummary.exportReceipts.rows[0].sourceRenderReceiptId, ffmpegReceipt.renderReceiptId)
  assert.equal(exportedMediaSummary.exportReceipts.exportPerformed, 1)
  assert.equal(exportedMediaSummary.exportReceipts.deliveryCreated, 1)
  assert.equal(exportedMediaSummary.exportReceipts.publicationAuthorization, 0)
  assert.equal(exportedMediaSummary.exportReceipts.productionReady, 0)

  const ffmpegExportDisabledOutput = await captureConsole(() => writeFfmpegExport({ projectDir: dir, disableFfmpeg: true }))
  assert.equal(ffmpegExportDisabledOutput.result.receipt, null)
  assert.equal(ffmpegExportDisabledOutput.result.skipped.reason, 'ffmpeg disabled')
  assert.equal(ffmpegExportDisabledOutput.result.skipped.exportPerformed, false)
  assert.ok(ffmpegExportDisabledOutput.lines.some((line) => line.includes('ffmpeg export: skipped')))

  const ffmpegExportOutput = await captureConsole(() => writeFfmpegExport({
    projectDir: dir,
    secondsPerItem: 1,
    width: 320,
    height: 180,
    fps: 12
  }))
  const ffmpegExport = ffmpegExportOutput.result.receipt
  assert.equal(ffmpegExport.schema, 'media.export_receipt.local.v1')
  assert.equal(ffmpegExport.exportKind, 'local-ffmpeg-review-delivery')
  assert.equal(ffmpegExport.sourceExportPlanRef.id, exportPlan.planId)
  assert.equal(ffmpegExport.sourceRenderReceiptRef.id, ffmpegReceipt.renderReceiptId)
  assert.equal(ffmpegExport.reviewDecisionRef.id, review.decision.decisionId)
  assert.equal(ffmpegExport.deliveryLocalRef.path.startsWith(`${exportPlan.targetOutputRef.path}/ffmpeg-delivery-`), true)
  assert.equal(ffmpegExport.deliveryLocalRef.contentType, 'video/mp4')
  assert.equal(ffmpegExport.orderedItems.length, 1)
  assert.equal(ffmpegExport.executionPosture.exportEngine, 'ffmpeg')
  assert.equal(ffmpegExport.executionPosture.ffmpegDefault, true)
  assert.equal(ffmpegExport.executionPosture.ffmpegDisableSupported, true)
  assert.equal(ffmpegExport.executionPosture.sourceBytesRead, true)
  assert.equal(ffmpegExport.executionPosture.deliveryBytesCreated, true)
  assert.equal(ffmpegExport.exportPerformed, true)
  assert.equal(ffmpegExport.deliveryCreated, true)
  assert.equal(ffmpegExport.publicationAuthorization, false)
  assert.equal(ffmpegExport.productionReady, false)
  assert.equal(ffmpegExport.materializationProof, false)
  assert.equal(validateRequiredRecord(ffmpegExport), true)
  const ffmpegDeliveryBytes = await readFile(path.join(dir, ffmpegExport.deliveryLocalRef.path))
  assert.equal(ffmpegDeliveryBytes.length, ffmpegExport.output.bytes)
  assert.ok(ffmpegExportOutput.lines.some((line) => line.includes('ffmpeg export:')))
  assert.ok(ffmpegExportOutput.lines.some((line) => line.includes('deliveryCreated=true')))
  assert.ok(ffmpegExportOutput.lines.some((line) => line.includes('publicationAuthorization=false')))

  const ffmpegExportedMediaSummary = await createMediaSummary({ projectDir: dir })
  assert.equal(ffmpegExportedMediaSummary.exportReceipts.total, 2)
  assert.equal(ffmpegExportedMediaSummary.exportReceipts.localPackageCopyExportReceipts, 1)
  assert.equal(ffmpegExportedMediaSummary.exportReceipts.ffmpegDeliveryReceipts, 1)
  assert.equal(ffmpegExportedMediaSummary.exportReceipts.localDeliveryEvidencePresent, 2)
  assert.equal(ffmpegExportedMediaSummary.exportReceipts.rows.filter((row) => row.localDeliveryEvidencePresent).length, 2)
  assert.ok(ffmpegExportedMediaSummary.exportReceipts.rows.some((row) =>
    row.exportKind === 'local-ffmpeg-review-delivery' &&
    row.sourceRoughCutId === renderPlan.sourceRoughCutRef.id &&
    row.sourceRenderReceiptId === ffmpegReceipt.renderReceiptId &&
    row.deliveryLocalRef.path === ffmpegExport.deliveryLocalRef.path
  ))
  assert.equal(ffmpegExportedMediaSummary.exportReceipts.exportPerformed, 2)
  assert.equal(ffmpegExportedMediaSummary.exportReceipts.deliveryCreated, 2)
  assert.equal(ffmpegExportedMediaSummary.exportReceipts.publicationAuthorization, 0)
  assert.equal(ffmpegExportedMediaSummary.exportReceipts.productionReady, 0)
  assert.equal(ffmpegExportedMediaSummary.exportReceipts.fresh, 2)
  assert.equal(ffmpegExportedMediaSummary.exportReceipts.stale, 0)

  const freshProjectRecords = await readProjectRecords(dir)
  const missingExportCandidateFreshness = evaluateExportReceiptFreshness({
    receipt: ffmpegExport,
    records: freshProjectRecords.filter((entry) =>
      !(entry.record.schema === 'media.export_candidate.local.v1' &&
        entry.record.exportCandidateId === exportCandidate.exportCandidateId)
    )
  })
  assert.equal(missingExportCandidateFreshness.state, 'stale')
  assert.ok(missingExportCandidateFreshness.issueCodes.includes('source_export_candidate_missing'))

  const changedExportCandidateFreshness = evaluateExportReceiptFreshness({
    receipt: ffmpegExport,
    records: freshProjectRecords.map((entry) => {
      if (entry.record.schema !== 'media.export_candidate.local.v1' ||
        entry.record.exportCandidateId !== exportCandidate.exportCandidateId) {
        return entry
      }
      return {
        ...entry,
        record: {
          ...entry.record,
          orderedItemRefs: [
            ...(entry.record.orderedItemRefs ?? []),
            {
              kind: 'media-rough-cut-item',
              id: 'changed-after-export',
              schema: 'media.rough_cut_item.local.v1',
              order: 99,
              localOnly: true
            }
          ]
        }
      }
    })
  })
  assert.equal(changedExportCandidateFreshness.state, 'stale')
  assert.ok(changedExportCandidateFreshness.issueCodes.includes('source_export_candidate_ordered_items_changed'))

  const changedExportPlanFreshness = evaluateExportReceiptFreshness({
    receipt: ffmpegExport,
    records: freshProjectRecords.map((entry) => {
      if (entry.record.schema !== 'media.export_plan_candidate.local.v1' ||
        entry.record.planId !== exportPlan.planId) {
        return entry
      }
      return {
        ...entry,
        record: {
          ...entry.record,
          targetOutputRef: {
            ...entry.record.targetOutputRef,
            path: 'media/exports/delivery-candidates/changed-after-export'
          }
        }
      }
    })
  })
  assert.equal(changedExportPlanFreshness.state, 'stale')
  assert.ok(changedExportPlanFreshness.issueCodes.includes('target_output_path_changed'))

  const exportedIndexOutput = await captureConsole(() => writeOperatorPacketIndex({ projectDir: dir }))
  assert.equal(exportedIndexOutput.result.index.summary.exportReceipts, 2)
  assert.equal(exportedIndexOutput.result.index.summary.localPackageCopyExportReceipts, 1)
  assert.equal(exportedIndexOutput.result.index.summary.ffmpegDeliveryReceipts, 1)
  assert.equal(exportedIndexOutput.result.index.summary.localDeliveryEvidencePresent, 2)
  assert.ok(exportedIndexOutput.lines.some((line) => line.includes('exportReceipts=2')))
  assert.ok(exportedIndexOutput.lines.some((line) => line.includes('ffmpegDeliveryReceipts=1')))
  assert.ok(exportedIndexOutput.lines.some((line) => line.includes('localDeliveryEvidencePresent=2')))
  assert.ok(exportedIndexOutput.lines.some((line) =>
    line.includes('export receipt:') &&
    line.includes('kind=local-ffmpeg-review-delivery') &&
    line.includes('localDeliveryEvidence=true') &&
    line.includes(`roughCut=${renderPlan.sourceRoughCutRef.id}`) &&
    line.includes(`renderReceipt=${ffmpegReceipt.renderReceiptId}`) &&
    line.includes(`delivery=${ffmpegExport.deliveryLocalRef.path}`)
  ))

  const exportedPrereqs = await createProductionAuthorityPrerequisiteReport({ projectDir: dir })
  assert.equal(exportedPrereqs.localProductionPackageComplete, 1)
  assert.equal(exportedPrereqs.localProductionPackageState, 'local-production-package-complete-authority-missing')
  assert.equal(exportedPrereqs.authorityMissing, true)
  assert.equal(exportedPrereqs.exportReceipts, 2)
  assert.equal(exportedPrereqs.exportReceiptsFresh, 2)
  assert.equal(exportedPrereqs.exportReceiptsStale, 0)
  assert.equal(exportedPrereqs.localPackageCopyExportReceipts, 1)
  assert.equal(exportedPrereqs.ffmpegDeliveryReceipts, 1)
  assert.equal(exportedPrereqs.localDeliveryEvidencePresent, 1)
  assert.equal(exportedPrereqs.deliveryCreated, 1)
  assert.equal(exportedPrereqs.exportPerformed, 1)
  assert.equal(exportedPrereqs.exportAuthorizationMissing, 1)
  assert.equal(exportedPrereqs.productionReady, 0)
  assert.equal(exportedPrereqs.rows[0].exportReceiptPosture.state, 'export-receipt-present-delivery-only')
  assert.equal(exportedPrereqs.rows[0].localProductionPackageComplete, true)
  assert.equal(exportedPrereqs.rows[0].localProductionPackageState, 'local-production-package-complete-authority-missing')
  assert.equal(exportedPrereqs.rows[0].productionPackagePosture.authorityMissing, true)
  assert.equal(exportedPrereqs.rows[0].productionPackagePosture.productionReady, false)
  assert.equal(exportedPrereqs.rows[0].exportReceiptPosture.exportReceipts, 2)
  assert.equal(exportedPrereqs.rows[0].exportReceiptPosture.localPackageCopyExportReceipts, 1)
  assert.equal(exportedPrereqs.rows[0].exportReceiptPosture.ffmpegDeliveryReceipts, 1)
  assert.equal(exportedPrereqs.rows[0].exportReceiptPosture.localDeliveryEvidencePresent, true)
  assert.equal(exportedPrereqs.rows[0].exportReceiptPosture.deliveryCreated, true)
  assert.equal(exportedPrereqs.rows[0].exportReceiptPosture.publicationAuthorization, false)
  const exportedPrereqOutput = await captureConsole(() => writeProductionAuthorityPrerequisiteReport({ projectDir: dir }))
  assert.ok(exportedPrereqOutput.lines.some((line) => line.includes('exportReceipts=2')))
  assert.ok(exportedPrereqOutput.lines.some((line) => line.includes('ffmpegDeliveryReceipts=1')))
  assert.ok(exportedPrereqOutput.lines.some((line) => line.includes('localDeliveryEvidencePresent=1')))
  assert.ok(exportedPrereqOutput.lines.some((line) => line.includes('localProductionPackageComplete=1')))
  assert.ok(exportedPrereqOutput.lines.some((line) => line.includes('productionPackage=local-production-package-complete-authority-missing')))
  assert.ok(exportedPrereqOutput.lines.some((line) => line.includes('deliveryCreated=1')))
  assert.ok(exportedPrereqOutput.lines.some((line) => line.includes('exportReceipt=export-receipt-present-delivery-only')))
  assert.ok(exportedPrereqOutput.lines.some((line) => line.includes('localDeliveryEvidence=true')))
  const exportedHandoff = await writeAuthorityHandoffCandidate({ projectDir: dir, quiet: true })
  assert.equal(exportedHandoff.candidate.prerequisiteSummary.localProductionPackageComplete, 1)
  assert.equal(exportedHandoff.candidate.prerequisiteSummary.localProductionPackageState, 'local-production-package-complete-authority-missing')
  assert.equal(exportedHandoff.candidate.prerequisiteSummary.authorityMissing, true)
  assert.equal(exportedHandoff.candidate.prerequisiteSummary.exportReceipts, 2)
  assert.equal(exportedHandoff.candidate.prerequisiteSummary.localPackageCopyExportReceipts, 1)
  assert.equal(exportedHandoff.candidate.prerequisiteSummary.ffmpegDeliveryReceipts, 1)
  assert.equal(exportedHandoff.candidate.prerequisiteSummary.localDeliveryEvidencePresent, 1)
  assert.equal(exportedHandoff.candidate.prerequisiteSummary.deliveryCreated, 1)
  assert.equal(exportedHandoff.candidate.prerequisiteSummary.exportPerformed, 1)
  const exportReceiptInput = exportedHandoff.candidate.authorityReviewInputs.find((input) => input.inputKind === 'export-receipt')
  assert.equal(exportReceiptInput.present, true)
  assert.equal(exportReceiptInput.fresh, 2)
  assert.equal(exportReceiptInput.localPackageCopyExportReceipts, 1)
  assert.equal(exportReceiptInput.ffmpegDeliveryReceipts, 1)
  assert.equal(exportReceiptInput.localDeliveryEvidencePresent, 1)
  assert.equal(exportReceiptInput.deliveryCreated, 1)
  assert.equal(exportReceiptInput.exportPerformed, 1)
  assert.equal(exportReceiptInput.rows.length, 2)
  assert.equal(exportReceiptInput.attentionRows.length, 0)
  assert.ok(exportReceiptInput.rows.some((row) =>
    row.exportKind === 'local-ffmpeg-review-delivery' &&
    row.localDeliveryEvidencePresent === true &&
    row.sourceRoughCutRef.id === renderPlan.sourceRoughCutRef.id &&
    row.sourceRenderReceiptRef.id === ffmpegReceipt.renderReceiptId &&
    row.deliveryLocalRef.path === ffmpegExport.deliveryLocalRef.path &&
    row.publicationAuthorization === false &&
    row.productionReady === false
  ))
  assert.equal(exportReceiptInput.publicationAuthorization, false)
  assert.equal(exportReceiptInput.productionReady, false)
  const localPrereqInput = exportedHandoff.candidate.authorityReviewInputs.find((input) => input.inputKind === 'local-prerequisite-state')
  assert.equal(localPrereqInput.localProductionPackageComplete, 1)
  assert.equal(localPrereqInput.localProductionPackageState, 'local-production-package-complete-authority-missing')
  assert.equal(localPrereqInput.authorityMissing, true)
  assert.equal(localPrereqInput.productionReady, false)
  assert.equal(exportReceiptInput.deliveryLocalRefs.length, 2)
  assert.ok(exportReceiptInput.deliveryLocalRefs.some((ref) => ref.path === ffmpegExport.deliveryLocalRef.path))
  assert.ok(exportReceiptInput.sourceRenderReceiptRefs.some((ref) => ref.id === ffmpegReceipt.renderReceiptId))
  assert.ok(exportReceiptInput.sourceRoughCutRefs.some((ref) => ref.id === candidate.sourceRoughCutRef.id))

  const packageReviewOutput = await captureConsole(() => writeLocalPackageReviewDecision({ projectDir: dir }))
  const packageReview = packageReviewOutput.result.decision
  assert.equal(packageReview.schema, 'media.operator_decision.v1')
  assert.equal(packageReview.decisionType, 'review_local_package')
  assert.equal(packageReview.localPackageReview.localPackageReviewed, true)
  assert.equal(packageReview.localPackageReview.localProductionPackageComplete, 1)
  assert.equal(packageReview.localPackageReview.localDeliveryEvidenceIntact, 1)
  assert.equal(packageReview.localPackageReview.outputIntegrityBlockingIssues, 0)
  assert.equal(packageReview.freshnessPosture.state, 'fresh')
  assert.deepEqual(packageReview.freshnessPosture.issueCodes, [])
  assert.equal(packageReview.publicationAuthorization, false)
  assert.equal(packageReview.authorityGranted, false)
  assert.equal(packageReview.productionReady ?? packageReview.localPackageReview.productionReady, false)
  assert.equal(validateRequiredRecord(packageReview), true)
  assert.ok(packageReviewOutput.lines.some((line) => line.includes('local package review decision: review_local_package')))

  const publicationRequestOutput = await captureConsole(() => writePublicationAuthorityRequestCandidate({ projectDir: dir }))
  const publicationRequest = publicationRequestOutput.result.candidate
  assert.equal(publicationRequest.schema, 'media.publication_authority_request_candidate.local.v1')
  assert.equal(publicationRequest.requestKind, 'publication-export-authority-review-candidate')
  assert.equal(publicationRequest.prerequisiteSummary.localProductionPackageComplete, 1)
  assert.equal(publicationRequest.prerequisiteSummary.localDeliveryEvidenceIntact, 1)
  assert.equal(publicationRequest.localPackageReviewDecisionRefs.length, 1)
  assert.equal(publicationRequest.freshnessPosture.state, 'fresh')
  assert.deepEqual(publicationRequest.freshnessPosture.issueCodes, [])
  assert.equal(publicationRequest.freshnessPosture.requestReviewBlocked, false)
  assert.equal(publicationRequest.freshnessPosture.integrityBlocking, false)
  assert.ok(publicationRequest.authorityReviewInputs.some((input) => input.inputKind === 'export-receipt' && input.present === true))
  assert.ok(publicationRequest.authorityGaps.includes('publication_authorization_missing'))
  assert.equal(publicationRequest.requestOnly, true)
  assert.equal(publicationRequest.publicationAuthorization, false)
  assert.equal(publicationRequest.productionReady, false)
  assert.equal(publicationRequest.meshPublished, false)
  assert.equal(validateRequiredRecord(publicationRequest), true)
  assert.ok(publicationRequestOutput.lines.some((line) => line.includes('publication authority request candidate:')))

  await writeRoughCutReviewDecision({
    projectDir: dir,
    decision: 'request_changes',
    output: 'records/decisions/media-rough-cut-review-request-changes.local.json',
    createdAt: '2999-01-01T00:00:00.000Z',
    print: false
  })
  const projectRecords = await readProjectRecords(dir)
  const freshness = evaluateRenderExportCandidateFreshness({ candidate, records: projectRecords })
  assert.equal(freshness.state, 'stale')
  assert.ok(freshness.issueCodes.includes('latest_rough_cut_review_changed'))
  assert.ok(freshness.issueCodes.includes('latest_rough_cut_review_not_approved_for_render_export'))
  const staleReceiptFreshness = evaluateRenderReceiptFreshness({ receipt: ffmpegReceipt, records: projectRecords })
  assert.equal(staleReceiptFreshness.state, 'stale')
  assert.ok(staleReceiptFreshness.issueCodes.includes('latest_rough_cut_review_changed'))
  const staleExportFreshness = evaluateExportReceiptFreshness({ receipt: ffmpegExport, records: projectRecords })
  assert.equal(staleExportFreshness.state, 'stale')
  assert.ok(staleExportFreshness.issueCodes.includes('latest_rough_cut_review_changed'))
  assert.ok(staleExportFreshness.issueCodes.includes('latest_rough_cut_review_not_approved_for_render_export'))

  const staleSummary = await createMediaSummary({ projectDir: dir })
  assert.equal(staleSummary.renderExportCandidates.stale, 1)
  assert.ok(staleSummary.renderExportCandidates.attentionRows[0].issueCodes.includes('latest_rough_cut_review_changed'))
  assert.equal(staleSummary.renderReceipts.stale, 2)
  assert.ok(staleSummary.renderReceipts.attentionRows[0].issueCodes.includes('latest_rough_cut_review_changed'))
  assert.equal(staleSummary.exportReceipts.stale, 2)
  assert.equal(staleSummary.exportReceipts.localPackageCopyExportReceipts, 1)
  assert.equal(staleSummary.exportReceipts.ffmpegDeliveryReceipts, 1)
  assert.equal(staleSummary.exportReceipts.localDeliveryEvidencePresent, 0)
  assert.equal(staleSummary.exportReceipts.rows.filter((row) => row.localDeliveryEvidencePresent).length, 0)
  assert.ok(staleSummary.exportReceipts.attentionRows[0].issueCodes.includes('latest_rough_cut_review_changed'))
  const stalePrereqs = await createProductionAuthorityPrerequisiteReport({ projectDir: dir })
  assert.equal(stalePrereqs.localProductionPackageComplete, 0)
  assert.equal(stalePrereqs.localProductionPackageState, 'local-production-package-incomplete')
  assert.equal(stalePrereqs.exportReceipts, 2)
  assert.equal(stalePrereqs.exportReceiptsFresh, 0)
  assert.equal(stalePrereqs.exportReceiptsStale, 2)
  assert.equal(stalePrereqs.ffmpegDeliveryReceipts, 1)
  assert.equal(stalePrereqs.localDeliveryEvidencePresent, 0)
  assert.equal(stalePrereqs.rows[0].exportReceiptPosture.state, 'export-receipt-stale')
  const staleProjectRecords = await readProjectRecords(dir)
  const stalePackageReviewFreshness = evaluateLocalPackageReviewFreshness({
    decision: packageReview,
    records: staleProjectRecords,
    prerequisiteReport: stalePrereqs
  })
  assert.equal(stalePackageReviewFreshness.state, 'stale')
  assert.ok(stalePackageReviewFreshness.issueCodes.includes('current_local_production_package_incomplete'))
  assert.ok(stalePackageReviewFreshness.issueCodes.includes('local_package_review_prerequisites_changed'))
  const stalePublicationRequestFreshness = evaluatePublicationAuthorityRequestFreshness({
    candidate: publicationRequest,
    records: staleProjectRecords,
    prerequisiteReport: stalePrereqs
  })
  assert.equal(stalePublicationRequestFreshness.state, 'stale')
  assert.ok(stalePublicationRequestFreshness.issueCodes.includes('current_local_production_package_incomplete'))
  assert.ok(stalePublicationRequestFreshness.issueCodes.includes('publication_authority_request_prerequisites_changed'))
  const staleHealthOutput = await captureConsole(() => writeProjectHealth({ projectDir: dir, summary: true }))
  assert.ok(staleHealthOutput.result.health.blockingIssues.includes('render-export-candidate-attention'))
  assert.ok(staleHealthOutput.result.health.blockingIssues.includes('render-receipt-attention'))
  assert.equal(staleHealthOutput.result.health.renderExportCandidateHealthExplanations.length, 1)
  assert.equal(staleHealthOutput.result.health.renderReceiptHealthExplanations.length, 2)
  const staleIndexOutput = await captureConsole(() => writeOperatorPacketIndex({ projectDir: dir }))
  assert.equal(staleIndexOutput.result.index.summary.renderExportCandidatesNeedingAttention, 1)
  assert.equal(staleIndexOutput.result.index.summary.renderReceiptsNeedingAttention, 2)
  assert.equal(staleIndexOutput.result.index.summary.ffmpegDeliveryReceipts, 1)
  assert.equal(staleIndexOutput.result.index.summary.localDeliveryEvidencePresent, 0)
  assert.ok(staleIndexOutput.lines.some((line) =>
    line.includes('export receipt:') &&
    line.includes('localDeliveryEvidence=false') &&
    line.includes('freshness=stale') &&
    line.includes('latest_rough_cut_review_changed') &&
    line.includes('Regenerate the local export package')
  ))

  const compatibility = await writeEdgeCompatibilityBundle({ projectDir: dir })
  assert.ok(compatibility.bundle.studioSourceRefs.some((ref) => ref.schema === 'media.render_export_candidate.local.v1'))
  assert.ok(compatibility.bundle.studioSourceRefs.some((ref) => ref.schema === 'media.render_receipt.local.v1'))
  assert.ok(compatibility.bundle.studioSourceRefs.some((ref) => ref.schema === 'media.export_candidate.local.v1'))
  assert.ok(compatibility.bundle.studioSourceRefs.some((ref) => ref.schema === 'media.export_plan_candidate.local.v1'))
  assert.ok(compatibility.bundle.studioSourceRefs.some((ref) => ref.schema === 'media.export_receipt.local.v1'))
  assert.ok(compatibility.bundle.studioSourceRefs.some((ref) => ref.schema === 'media.publication_authority_request_candidate.local.v1'))
  assert.equal(compatibility.bundle.exportDeliverySummary.exportReceipts, 2)
  assert.equal(compatibility.bundle.exportDeliverySummary.localPackageReviewDecisionRefs, 1)
  assert.equal(compatibility.bundle.exportDeliverySummary.publicationAuthorityRequestRefs, 1)
  assert.equal(compatibility.bundle.exportDeliverySummary.localPackageCopyExportReceipts, 1)
  assert.equal(compatibility.bundle.exportDeliverySummary.ffmpegDeliveryReceipts, 1)
  assert.equal(compatibility.bundle.exportDeliverySummary.localDeliveryEvidencePresent, 0)
  assert.equal(compatibility.bundle.exportDeliverySummary.fresh, 0)
  assert.equal(compatibility.bundle.exportDeliverySummary.stale, 2)
  assert.equal(compatibility.bundle.exportDeliverySummary.rows.length, 2)
  assert.equal(compatibility.bundle.exportDeliverySummary.attentionRows.length, 2)
  assert.ok(compatibility.bundle.exportDeliverySummary.rows.some((row) =>
    row.exportKind === 'local-ffmpeg-review-delivery' &&
    row.localDeliveryEvidencePresent === false &&
    row.freshnessState === 'stale' &&
    row.sourceRoughCutRef.id === renderPlan.sourceRoughCutRef.id &&
    row.sourceRenderReceiptRef.id === ffmpegReceipt.renderReceiptId &&
    row.deliveryLocalRef.path === ffmpegExport.deliveryLocalRef.path &&
    row.publicationAuthorization === false &&
    row.productionReady === false
  ))
  assert.equal(compatibility.bundle.exportDeliverySummary.deliveryCreated, 2)
  assert.equal(compatibility.bundle.exportDeliverySummary.exportPerformed, 2)
  assert.equal(compatibility.bundle.exportDeliverySummary.publicationAuthorization, false)
  assert.equal(compatibility.bundle.exportDeliverySummary.productionReady, false)
  assert.ok(compatibility.bundle.exportDeliverySummary.deliveryLocalRefs.some((ref) => ref.path === ffmpegExport.deliveryLocalRef.path))
  assert.ok(compatibility.bundle.exportDeliverySummary.sourceRenderReceiptRefs.some((ref) => ref.id === ffmpegReceipt.renderReceiptId))
  assert.ok(compatibility.bundle.exportDeliverySummary.sourceRoughCutRefs.some((ref) => ref.id === candidate.sourceRoughCutRef.id))
  assert.equal(compatibility.bundle.studioReviewEvidence.exportDeliverySummary.exportReceipts, 2)
  assert.equal(compatibility.bundle.studioReviewEvidence.exportDeliverySummary.ffmpegDeliveryReceipts, 1)
  assert.equal(compatibility.bundle.studioReviewEvidence.exportDeliverySummary.localDeliveryEvidencePresent, 0)
})

test('local production output runner creates reviewable delivery without authority', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-local-output-runner-'))
  await runVeniceProductionRehearsal({ projectDir: dir })

  const output = await captureConsole(() => runLocalProductionOutput({
    projectDir: dir,
    createdAt: '2026-05-19T00:00:00.000Z'
  }))
  const result = output.result

  assert.equal(result.mode, 'standalone-local')
  assert.equal(result.summary.roughCutItems, 1)
  assert.equal(result.summary.roughCutReviewed, 1)
  assert.equal(result.summary.renderReceipts, 2)
  assert.equal(result.summary.exportReceipts, 2)
  assert.equal(result.summary.ffmpegDeliveryReceipts, 1)
  assert.equal(result.summary.localDeliveryEvidencePresent, 2)
  assert.equal(result.summary.localPackageReviewed, 1)
  assert.equal(result.summary.publicationAuthorityRequests, 1)
  assert.equal(result.summary.localProductionPackageComplete, 1)
  assert.equal(result.summary.pendingAuthority, 1)
  assert.equal(result.summary.productionReady, 0)
  assert.equal(result.summary.localPackageState, 'complete_review_only_authority_missing')
  assert.equal(result.summary.latestLocalPackageReviewPosture, 'reviewed_fresh')
  assert.equal(result.summary.localPackageIntegrityPosture, 'clear')
  assert.equal(result.localPackagePosture.packageState, 'complete_review_only_authority_missing')
  assert.equal(result.localPackagePosture.latestReviewPosture, 'reviewed_fresh')
  assert.equal(result.localPackagePosture.integrityPosture, 'clear')
  assert.equal(result.localPackagePosture.publicationAuthorityRequests, 1)
  assert.equal(result.localPackagePosture.pendingAuthority, 1)
  assert.equal(result.localPackagePosture.productionReady, 0)
  assert.equal(result.nonClaims.localOnly, true)
  assert.equal(result.nonClaims.approvalAuthority, false)
  assert.equal(result.nonClaims.publicationAuthorization, false)
  assert.equal(result.nonClaims.productionReady, false)
  assert.equal(result.nonClaims.edgeCalled, false)
  assert.equal(result.nonClaims.meshPublished, false)
  assert.ok(result.refs.roughCutId)
  assert.ok(result.refs.roughCutReviewDecisionId)
  assert.ok(result.refs.renderExportCandidateId)
  assert.ok(result.refs.renderPlanId)
  assert.ok(result.refs.contactSheetRenderReceiptId)
  assert.ok(result.refs.ffmpegRenderReceiptId)
  assert.ok(result.refs.exportCandidateId)
  assert.ok(result.refs.exportPlanId)
  assert.ok(result.refs.localExportReceiptId)
  assert.ok(result.refs.ffmpegExportReceiptId)
  assert.ok(result.refs.localPackageReviewDecisionId)
  assert.ok(result.refs.authorityHandoffCandidateId)
  assert.ok(result.refs.publicationAuthorityRequestCandidateId)
  assert.ok(result.refs.operatorPacketIndexId)
  assert.ok(result.refs.edgeCompatibilityBundleId)
  assert.equal(result.steps.every((step) => step.authorityGranted === false), true)
  assert.equal(result.steps.every((step) => step.productionReady === false), true)
  assert.ok(output.lines.some((line) =>
    line.startsWith('production local output: project=venice-smoke-project | steps=17/17') &&
    line.includes('productionReady=0') &&
    line.includes('localPackage=complete_review_only_authority_missing') &&
    line.includes('review=reviewed_fresh') &&
    line.includes('integrity=clear') &&
    line.includes('nextAction=Route the reviewed local package')
  ))
  assert.ok(output.lines.some((line) => line.includes('no approval authority')))

  const summary = await createMediaSummary({ projectDir: dir })
  assert.equal(summary.exportReceipts.ffmpegDeliveryReceipts, 1)
  assert.equal(summary.exportReceipts.localDeliveryEvidencePresent, 2)
  assert.equal(summary.packageAuthority.localPackageReviews, 1)
  assert.equal(summary.packageAuthority.freshReviews, 1)
  assert.equal(summary.packageAuthority.publicationAuthorityRequests, 1)
  assert.equal(summary.packageAuthority.freshRequests, 1)
  assert.equal(summary.packageAuthority.publicationAuthorization, 0)
  assert.equal(summary.packageAuthority.productionReady, 0)
  assert.equal(summary.localPackagePosture.packageState, 'complete_review_only_authority_missing')
  assert.equal(summary.localPackagePosture.latestReviewPosture, 'reviewed_fresh')
  assert.equal(summary.localPackagePosture.integrityPosture, 'clear')
  assert.equal(summary.localPackagePosture.nonClaims.edgeCalled, false)
  const prereqs = await createProductionAuthorityPrerequisiteReport({ projectDir: dir })
  assert.equal(prereqs.localProductionPackageComplete, 1)
  assert.equal(prereqs.localDeliveryEvidenceIntact, 1)
  assert.equal(prereqs.outputIntegrityBlockingIssues, 0)
  assert.equal(prereqs.outputIntegrityAttentionIssues, 0)
  assert.equal(prereqs.localPackageReviews, 1)
  assert.equal(prereqs.localPackageReviewsFresh, 1)
  assert.equal(prereqs.publicationAuthorityRequests, 1)
  assert.equal(prereqs.publicationAuthorityRequestsFresh, 1)
  assert.equal(prereqs.packageAuthoritySummary.attentionRows.length, 0)
  assert.equal(prereqs.pendingAuthority, 1)
  assert.equal(prereqs.productionReady, 0)
  const mediaSummaryOutput = await captureConsole(() => writeMediaSummary({ projectDir: dir }))
  assert.equal(mediaSummaryOutput.result.localPackagePosture.packageState, 'complete_review_only_authority_missing')
  assert.equal(mediaSummaryOutput.result.localPackagePosture.latestReviewPosture, 'reviewed_fresh')
  assert.equal(mediaSummaryOutput.result.localPackagePosture.integrityPosture, 'clear')
  assert.ok(mediaSummaryOutput.lines.some((line) =>
    line.startsWith('local package posture:') &&
    line.includes('localPackage=complete_review_only_authority_missing') &&
    line.includes('review=reviewed_fresh') &&
    line.includes('integrity=clear')
  ))
  const healthSummaryOutput = await captureConsole(() => writeProjectHealth({ projectDir: dir, summary: true }))
  assert.equal(healthSummaryOutput.result.health.localPackagePosture.packageState, 'complete_review_only_authority_missing')
  assert.equal(healthSummaryOutput.result.health.localPackagePosture.latestReviewPosture, 'reviewed_fresh')
  assert.equal(healthSummaryOutput.result.health.localPackagePosture.integrityPosture, 'clear')
  assert.equal(healthSummaryOutput.result.health.localPackagePosture.nonClaims.edgeCalled, false)
  assert.equal(healthSummaryOutput.result.health.localPackagePosture.productionReady, 0)
  assert.ok(healthSummaryOutput.lines.some((line) =>
    line.startsWith('localPackagePosture:') &&
    line.includes('localPackage=complete_review_only_authority_missing') &&
    line.includes('review=reviewed_fresh') &&
    line.includes('integrity=clear')
  ))
  const operatorIndex = await captureConsole(() => writeOperatorPacketIndex({ projectDir: dir }))
  assert.equal(operatorIndex.result.index.localPackagePosture.packageState, 'complete_review_only_authority_missing')
  assert.equal(operatorIndex.result.index.localPackagePosture.latestReviewPosture, 'reviewed_fresh')
  assert.equal(operatorIndex.result.index.localPackagePosture.integrityPosture, 'clear')
  assert.equal(operatorIndex.result.index.localPackagePosture.nonClaims.edgeCalled, false)
  assert.equal(operatorIndex.result.index.summary.localPackageState, 'complete_review_only_authority_missing')
  assert.ok(operatorIndex.lines.some((line) =>
    line.includes('localPackage=complete_review_only_authority_missing') &&
    line.includes('review=reviewed_fresh') &&
    line.includes('integrity=clear')
  ))
  const edgeCompatibility = await captureConsole(() => writeEdgeCompatibilityBundle({ projectDir: dir }))
  assert.equal(edgeCompatibility.result.bundle.localPackagePosture.packageState, 'complete_review_only_authority_missing')
  assert.equal(edgeCompatibility.result.bundle.localPackagePosture.latestReviewPosture, 'reviewed_fresh')
  assert.equal(edgeCompatibility.result.bundle.localPackagePosture.integrityPosture, 'clear')
  assert.equal(edgeCompatibility.result.bundle.localPackagePosture.nonClaims.edgeCalled, false)
  assert.equal(edgeCompatibility.result.bundle.studioReviewEvidence.localPackagePosture.packageState, 'complete_review_only_authority_missing')
  assert.equal(edgeCompatibility.result.bundle.edgeRuntimeVerified, false)
  assert.ok(edgeCompatibility.lines.some((line) =>
    line.includes('localPackage=complete_review_only_authority_missing') &&
    line.includes('review=reviewed_fresh') &&
    line.includes('integrity=clear')
  ))
  const pressureOutput = await captureConsole(() => writeStudioPressureArtifacts({
    projectDir: dir,
    adapterChain: true,
    quiet: false,
    createdAt: '2026-05-19T00:01:00.000Z'
  }))
  assert.equal(pressureOutput.result.swarmSeamPosture.state, 'ready_for_review_only_swarm_pressure')
  assert.equal(pressureOutput.result.swarmSeamPosture.publicSwarmProof, false)
  assert.equal(pressureOutput.result.swarmSeamPosture.swarmRuntimeActivated, false)
  assert.equal(pressureOutput.result.swarmSeamPosture.edgeDispatch, false)
  assert.equal(pressureOutput.result.swarmSeamPosture.layerAdmission, false)
  assert.ok(pressureOutput.lines.some((line) =>
    line.startsWith('swarm seam posture:') &&
    line.includes('swarmSeam=ready_for_review_only_swarm_pressure') &&
    line.includes('swarmProof=false') &&
    line.includes('activation=false')
  ))
  const pressureMediaSummary = await captureConsole(() => writeMediaSummary({ projectDir: dir }))
  assert.equal(pressureMediaSummary.result.swarmSeamPosture.state, 'ready_for_review_only_swarm_pressure')
  assert.equal(pressureMediaSummary.result.swarmSeamPosture.publicSwarmProof, false)
  assert.equal(pressureMediaSummary.result.swarmSeamPosture.swarmRuntimeActivated, false)
  assert.equal(pressureMediaSummary.result.studioSourcePressureAdapterSummary.latestDecisionStatus, 'approved_bounded_studio_source_pressure_observation')
  assert.equal(pressureMediaSummary.result.studioSourcePressureAdapterSummary.observationStatus, 'studio_source_pressure_routed_through_generic_layer_seam')
  assert.ok(pressureMediaSummary.lines.some((line) =>
    line.startsWith('swarm seam posture:') &&
    line.includes('swarmSeam=ready_for_review_only_swarm_pressure') &&
    line.includes('swarmProof=false') &&
    line.includes('activation=false')
  ))
  const pressureHealthSummary = await captureConsole(() => writeProjectHealth({ projectDir: dir, summary: true }))
  assert.equal(pressureHealthSummary.result.health.swarmSeamPosture.state, 'ready_for_review_only_swarm_pressure')
  assert.equal(pressureHealthSummary.result.health.swarmSeamPosture.publicSwarmProof, false)
  assert.equal(pressureHealthSummary.result.health.swarmSeamPosture.swarmRuntimeActivated, false)
  assert.equal(pressureHealthSummary.result.health.studioSourcePressureAdapterSummary.latestDecisionStatus, 'approved_bounded_studio_source_pressure_observation')
  assert.equal(pressureHealthSummary.result.health.studioSourcePressureAdapterSummary.observationStatus, 'studio_source_pressure_routed_through_generic_layer_seam')
  assert.equal(pressureHealthSummary.result.health.blockingIssues.includes('source-pressure-attention'), false)
  assert.ok(pressureHealthSummary.lines.some((line) =>
    line.startsWith('swarmSeamPosture:') &&
    line.includes('swarmSeam=ready_for_review_only_swarm_pressure') &&
    line.includes('swarmProof=false') &&
    line.includes('activation=false')
  ))
  const pressureOperatorIndex = await captureConsole(() => writeOperatorPacketIndex({ projectDir: dir }))
  assert.equal(pressureOperatorIndex.result.index.swarmSeamPosture.state, 'ready_for_review_only_swarm_pressure')
  assert.equal(pressureOperatorIndex.result.index.summary.swarmSeamState, 'ready_for_review_only_swarm_pressure')
  assert.equal(pressureOperatorIndex.result.index.summary.swarmProof, false)
  assert.equal(pressureOperatorIndex.result.index.summary.swarmActivation, false)
  assert.ok(pressureOperatorIndex.lines.some((line) =>
    line.includes('swarmSeam=ready_for_review_only_swarm_pressure') &&
    line.includes('swarmProof=false') &&
    line.includes('activation=false')
  ))
  const pressureEdgeCompatibility = await captureConsole(() => writeEdgeCompatibilityBundle({ projectDir: dir }))
  assert.equal(pressureEdgeCompatibility.result.bundle.swarmSeamPosture.state, 'ready_for_review_only_swarm_pressure')
  assert.equal(pressureEdgeCompatibility.result.bundle.studioReviewEvidence.swarmSeamPosture.state, 'ready_for_review_only_swarm_pressure')
  assert.equal(pressureEdgeCompatibility.result.bundle.swarmSeamPosture.publicSwarmProof, false)
  assert.equal(pressureEdgeCompatibility.result.bundle.swarmSeamPosture.swarmRuntimeActivated, false)
  assert.ok(pressureEdgeCompatibility.lines.some((line) =>
    line.includes('swarmSeam=ready_for_review_only_swarm_pressure') &&
    line.includes('swarmProof=false') &&
    line.includes('activation=false')
  ))
  const prereqOutput = await captureConsole(() => writeProductionAuthorityPrerequisiteReport({ projectDir: dir }))
  assert.ok(prereqOutput.lines.some((line) =>
    line.includes('localPackageReviews=1') &&
    line.includes('publicationAuthorityRequests=1') &&
    line.includes('staleAuthorityRequests=0') &&
    line.includes('blockedAuthorityRequests=0') &&
    line.includes('productionReady=0')
  ))
})

test('local proof rehearsal runs safe proof order and writes ready review summary', async () => {
  const dir = await createLocalProofFixtureProject()

  const output = await captureConsole(() => runLocalProofRehearsal({
    projectDir: dir,
    createdAt: '2026-05-19T00:00:00.000Z'
  }))
  const proof = output.result.proof
  const written = JSON.parse(await readFile(path.join(dir, 'records/exports/media-studio-local-proof-rehearsal.local.json'), 'utf8'))
  const schema = JSON.parse(await readFile(path.join(process.cwd(), 'schemas/media-studio-local-proof-rehearsal-local.schema.json'), 'utf8'))

  assert.equal(proof.schema, 'media.studio_local_proof_rehearsal.local.v1')
  assert.equal(schema.title, 'media.studio_local_proof_rehearsal.local.v1')
  assert.equal(schema.properties.schema.const, 'media.studio_local_proof_rehearsal.local.v1')
  assert.equal(proof.proofState, 'ready')
  assert.equal(proof.summary.proofState, 'ready')
  assert.equal(proof.localPackagePosture.packageState, 'complete_review_only_authority_missing')
  assert.equal(proof.swarmSeamPosture.state, 'ready_for_review_only_swarm_pressure')
  assert.equal(proof.studioSourcePressureAdapterSummary.latestDecisionStatus, 'approved_bounded_studio_source_pressure_observation')
  assert.equal(proof.studioSourcePressureAdapterSummary.observationStatus, 'studio_source_pressure_routed_through_generic_layer_seam')
  assert.equal(proof.studioSourcePressureAdapterSummary.targetGenericEnvelope, 'layer_source_pressure_review.v0')
  assert.equal(proof.refs.inspectionPacketRef.schema, 'media.edge_inspection_packet.local.v1')
  assert.equal(proof.refs.operatorPacketIndexRef.schema, 'media.operator_packet_index.local.v1')
  assert.equal(proof.refs.edgeCompatibilityBundleRef.schema, 'media.edge_compatibility_bundle.local.v1')
  assert.equal(proof.surfaceRefs.inspectionPacketRef.schema, 'media.edge_inspection_packet.local.v1')
  assert.equal(proof.surfaceRefs.operatorPacketIndexRef.schema, 'media.operator_packet_index.local.v1')
  assert.equal(proof.surfaceRefs.edgeCompatibilityBundleRef.schema, 'media.edge_compatibility_bundle.local.v1')
  assert.equal(proof.summary.surfaced, true)
  assert.equal(proof.refs.adapterObservationRef.schema, 'media.studio_source_pressure_observation_result.local.v1')
  assert.equal(proof.nonClaims.edgeDispatch, false)
  assert.equal(proof.nonClaims.layerAdmission, false)
  assert.equal(proof.nonClaims.publicSwarmProof, false)
  assert.equal(proof.nonClaims.activation, false)
  assert.equal(proof.summary.productionReady, 0)
  assert.ok(output.result.inspection.packet.artifactKinds.includes('media.studio_local_proof_rehearsal.local.v1'))
  assert.ok(Object.values(output.result.inspection.packet.recordRefs).some((ref) =>
    ref.schema === 'media.studio_local_proof_rehearsal.local.v1'
  ))
  assert.equal(output.result.operatorIndex.index.localProofRehearsalSummary.proofs, 1)
  assert.equal(output.result.operatorIndex.index.localProofRehearsalSummary.latestProofState, 'ready')
  assert.equal(output.result.operatorIndex.index.localProofRehearsalSummary.proofFreshness, 'fresh')
  assert.equal(output.result.operatorIndex.index.summary.localProofState, 'ready')
  assert.equal(output.result.operatorIndex.index.summary.localProofFreshness, 'fresh')
  assert.equal(output.result.operatorIndex.index.summary.localProofTargetEnvelope, 'layer_source_pressure_review.v0')
  assert.equal(output.result.operatorIndex.index.summary.swarmProof, false)
  assert.equal(output.result.operatorIndex.index.summary.swarmActivation, false)
  assert.equal(output.result.edgeCompatibility.bundle.localProofRehearsalSummary.proofs, 1)
  assert.equal(output.result.edgeCompatibility.bundle.localProofRehearsalSummary.latestProofState, 'ready')
  assert.equal(output.result.edgeCompatibility.bundle.localProofRehearsalSummary.proofFreshness, 'fresh')
  assert.equal(output.result.edgeCompatibility.bundle.localProofRehearsalSummary.publicSwarmProof, false)
  assert.equal(output.result.edgeCompatibility.bundle.localProofRehearsalSummary.swarmRuntimeActivated, false)
  assert.ok(output.result.edgeCompatibility.bundle.studioSourceRefs.some((ref) =>
    ref.schema === 'media.studio_local_proof_rehearsal.local.v1'
  ))
  assert.equal(validateRequiredRecord(proof), true)
  assert.equal(validateRequiredRecord(written), true)
  assert.ok(output.lines.some((line) =>
    line.startsWith('studio local proof:') &&
    line.includes('proof=ready') &&
    line.includes('localPackage=complete_review_only_authority_missing') &&
    line.includes('swarmSeam=ready_for_review_only_swarm_pressure') &&
    line.includes('swarmProof=false') &&
    line.includes('activation=false') &&
    line.includes('surfaced=true')
  ))
})

test('local proof rehearsal preserves rejected adapter hold as attention posture', async () => {
  const dir = await createLocalProofFixtureProject()

  const output = await captureConsole(() => runLocalProofRehearsal({
    projectDir: dir,
    adapterDecision: 'rejected',
    createdAt: '2026-05-19T00:00:00.000Z'
  }))
  const proof = output.result.proof

  assert.equal(proof.proofState, 'attention')
  assert.equal(proof.localPackagePosture.packageState, 'complete_review_only_authority_missing')
  assert.equal(proof.swarmSeamPosture.state, 'adapter_hold')
  assert.equal(proof.studioSourcePressureAdapterSummary.latestDecisionStatus, 'rejected_bounded_studio_source_pressure_observation')
  assert.equal(proof.studioSourcePressureAdapterSummary.observationStatus, 'skipped')
  assert.equal(proof.refs.adapterCandidateRef.schema, 'media.studio_source_pressure_adapter_candidate.local.v1')
  assert.equal(proof.refs.adapterDecisionRef.schema, 'media.studio_source_pressure_adapter_operator_decision.local.v1')
  assert.equal(proof.refs.adapterObservationRef, null)
  assert.equal(proof.safeNextAction, 'Hold Studio source-pressure observation; keep candidate and decision as review-only local evidence.')
  assert.equal(proof.summary.surfaced, true)
  assert.equal(proof.nonClaims.edgeDispatch, false)
  assert.equal(proof.nonClaims.activation, false)
  assert.equal(output.result.operatorIndex.index.localProofRehearsalSummary.latestProofState, 'attention')
  assert.equal(output.result.operatorIndex.index.localProofRehearsalSummary.proofFreshness, 'fresh')
  assert.equal(output.result.operatorIndex.index.localProofRehearsalSummary.observationStatus, 'skipped')
  assert.equal(output.result.operatorIndex.index.summary.localProofState, 'attention')
  assert.equal(output.result.edgeCompatibility.bundle.localProofRehearsalSummary.latestProofState, 'attention')
  assert.equal(output.result.edgeCompatibility.bundle.localProofRehearsalSummary.observationStatus, 'skipped')
  assert.equal(output.result.edgeCompatibility.bundle.localProofRehearsalSummary.edgeDispatch, false)
  assert.ok(output.lines.some((line) =>
    line.includes('proof=attention') &&
    line.includes('swarmSeam=adapter_hold') &&
    line.includes('observation=skipped') &&
    line.includes('activation=false')
  ))
  assert.equal(validateRequiredRecord(proof), true)
})

test('local proof rehearsal can disable ffmpeg without production readiness claims', async () => {
  const dir = await createLocalProofFixtureProject()

  const output = await captureConsole(() => runLocalProofRehearsal({
    projectDir: dir,
    disableFfmpeg: true,
    createdAt: '2026-05-19T00:00:00.000Z'
  }))
  const proof = output.result.proof

  assert.equal(proof.proofState, 'ready')
  assert.equal(proof.refs.localOutput.summary.ffmpegDeliveryReceipts, 0)
  assert.equal(proof.refs.localOutput.summary.localProductionPackageComplete, 1)
  assert.equal(proof.localPackagePosture.packageState, 'complete_review_only_authority_missing')
  assert.equal(proof.summary.productionReady, 0)
  assert.equal(proof.summary.surfaced, true)
  assert.equal(output.result.operatorIndex.index.localProofRehearsalSummary.latestProofState, 'ready')
  assert.equal(proof.nonClaims.productionReady, false)
  assert.equal(proof.nonClaims.publicSwarmProof, false)
  assert.equal(proof.nonClaims.swarmRuntimeActivated, false)
  assert.equal(validateRequiredRecord(proof), true)
})

test('local proof rehearsal print mode emits parseable JSON with non-claims', async () => {
  const dir = await createLocalProofFixtureProject()

  const output = await captureConsole(() => runLocalProofRehearsal({
    projectDir: dir,
    print: true,
    createdAt: '2026-05-19T00:00:00.000Z'
  }))
  const proof = JSON.parse(output.lines.join('\n'))

  assert.equal(proof.schema, 'media.studio_local_proof_rehearsal.local.v1')
  assert.equal(proof.proofState, 'ready')
  assert.equal(proof.summary.surfaced, true)
  assert.equal(proof.surfaceRefs.operatorPacketIndexRef.schema, 'media.operator_packet_index.local.v1')
  assert.equal(proof.surfaceRefs.edgeCompatibilityBundleRef.schema, 'media.edge_compatibility_bundle.local.v1')
  assert.equal(proof.nonClaims.edgeQueueAction, false)
  assert.equal(proof.nonClaims.edgeDispatch, false)
  assert.equal(proof.nonClaims.layerAdmission, false)
  assert.equal(proof.nonClaims.publicSwarmProof, false)
  assert.equal(proof.nonClaims.activation, false)
  assert.equal(proof.nonClaims.publicationAuthorization, false)
  assert.equal(validateRequiredRecord(proof), true)
})

test('local proof drill passes ready proof and surfaces drill posture', async () => {
  const dir = await createLocalProofFixtureProject()

  const output = await captureConsole(() => runLocalProofRehearsal({
    projectDir: dir,
    drill: true,
    createdAt: '2026-05-19T00:00:00.000Z'
  }))
  const proof = output.result.proof
  const line = output.lines.find((entry) => entry.startsWith('studio local proof:'))

  assert.equal(proof.proofState, 'ready')
  assert.equal(proof.drillSummary.drillStatus, 'passed')
  assert.equal(proof.summary.drillStatus, 'passed')
  assert.equal(proof.summary.drillAttention, 0)
  assert.equal(proof.drillSummary.attentionRows.length, 0)
  assert.ok(proof.drillSummary.checks > 20)
  assert.ok(line.includes('drill=passed'))
  assert.ok(line.includes('drillAttention=0'))
  assert.equal(output.result.operatorIndex.index.localProofRehearsalSummary.drillStatus, 'passed')
  assert.equal(output.result.operatorIndex.index.summary.localProofDrillStatus, 'passed')
  assert.equal(output.result.operatorIndex.index.summary.localProofDrillAttention, 0)
  assert.equal(output.result.edgeCompatibility.bundle.localProofRehearsalSummary.drillStatus, 'passed')
  assert.equal(output.result.edgeCompatibility.bundle.localProofRehearsalSummary.drillAttention, 0)
  assert.equal(output.result.operatorIndex.index.localProofRehearsalSummary.edgeDispatch, false)
  assert.equal(output.result.edgeCompatibility.bundle.localProofRehearsalSummary.layerAdmission, false)
  assert.equal(validateRequiredRecord(proof), true)
})

test('local proof drill treats rejected adapter hold as passed surface coherence', async () => {
  const dir = await createLocalProofFixtureProject()

  const output = await captureConsole(() => runLocalProofRehearsal({
    projectDir: dir,
    adapterDecision: 'rejected',
    drill: true,
    createdAt: '2026-05-19T00:00:00.000Z'
  }))
  const proof = output.result.proof

  assert.equal(proof.proofState, 'attention')
  assert.equal(proof.swarmSeamPosture.state, 'adapter_hold')
  assert.equal(proof.studioSourcePressureAdapterSummary.observationStatus, 'skipped')
  assert.equal(proof.drillSummary.drillStatus, 'passed')
  assert.equal(proof.summary.drillStatus, 'passed')
  assert.equal(proof.summary.drillAttention, 0)
  assert.equal(output.result.operatorIndex.index.localProofRehearsalSummary.latestProofState, 'attention')
  assert.equal(output.result.operatorIndex.index.localProofRehearsalSummary.drillStatus, 'passed')
  assert.equal(output.result.edgeCompatibility.bundle.localProofRehearsalSummary.drillStatus, 'passed')
  assert.equal(output.result.edgeCompatibility.bundle.localProofRehearsalSummary.observationStatus, 'skipped')
  assert.equal(validateRequiredRecord(proof), true)
})

test('local proof drill reports mismatched surfaces and non-claim overclaims as attention', () => {
  const proof = createSyntheticDrillProof()
  const inspection = {
    packet: {
      artifactKinds: ['media.studio_local_proof_rehearsal.local.v1'],
      recordRefs: {
        proof: { schema: 'media.studio_local_proof_rehearsal.local.v1' }
      }
    }
  }
  const operatorIndex = createSyntheticDrillOperatorSurface(proof)
  const edgeCompatibility = createSyntheticDrillEdgeSurface(proof)

  const passed = createLocalProofDrillSummary({ proof, inspection, operatorIndex, edgeCompatibility })
  assert.equal(passed.drillStatus, 'passed')
  assert.equal(passed.attentionChecks, 0)

  const mismatchedOperatorIndex = createSyntheticDrillOperatorSurface(proof)
  mismatchedOperatorIndex.index.localProofRehearsalSummary.adapterDecisionStatus = 'rejected_bounded_studio_source_pressure_observation'
  const overclaimProof = {
    ...proof,
    nonClaims: {
      ...proof.nonClaims,
      edgeDispatch: true
    }
  }
  const attention = createLocalProofDrillSummary({
    proof: overclaimProof,
    inspection,
    operatorIndex: mismatchedOperatorIndex,
    edgeCompatibility
  })

  assert.equal(attention.drillStatus, 'attention')
  assert.ok(attention.attentionRows.some((row) => row.issueCode === 'operator_adapter_decision_mismatch'))
  assert.ok(attention.attentionRows.some((row) => row.issueCode === 'proof_edge_dispatch_overclaim'))
  const attentionSummary = summarizeLocalProofRehearsal([{
    record: {
      ...proof,
      drillSummary: attention
    },
    relativePath: 'records/exports/media-studio-local-proof-rehearsal.local.json'
  }])
  assert.deepEqual(attentionSummary.drillAttentionReasons, [
    'operator_adapter_decision_mismatch',
    'proof_edge_dispatch_overclaim'
  ])
  assert.match(attention.safeNextAction, /proof:local -- --drill/)
  assert.equal(attention.edgeDispatch, false)
  assert.equal(attention.layerAdmission, false)
})

test('current operational command completes local proof through review surfaces', async () => {
  const dir = await createFixtureProject()

  const output = await captureConsole(() => runCurrentOperationalRunbook({
    projectDir: dir,
    prepareLocalFixture: true,
    crossProjectIndex: true,
    createdAt: '2026-05-19T00:00:00.000Z'
  }))
  const line = output.lines.find((entry) => entry.startsWith('studio current operation:'))

  assert.equal(output.result.operation.operationState, 'ready_for_spine_discussion')
  assert.equal(output.result.operation.preparedLocalFixture, true)
  assert.equal(output.result.operation.proofState, 'ready')
  assert.equal(output.result.operation.proofFreshness, 'fresh')
  assert.equal(output.result.operation.proofDrill, 'passed')
  assert.equal(output.result.operation.localPackageState, 'complete_review_only_authority_missing')
  assert.equal(output.result.operation.swarmSeamState, 'ready_for_review_only_swarm_pressure')
  assert.equal(output.result.operation.adjacentDeclaration, 'ready_for_spine_discussion')
  assert.equal(output.result.operation.spineDiscussion, 'required')
  assert.equal(output.result.operation.adjacentReadiness, 'ready_for_spine_discussion')
  assert.equal(output.result.operation.adjacentFreshness, 'fresh')
  assert.equal(output.result.operation.adjacentReady, 5)
  assert.equal(output.result.operation.adjacentAttention, 0)
  assert.equal(output.result.operation.crossProjectIndexed, true)
  assert.equal(output.result.operation.inspectionRefreshed, true)
  assert.equal(output.result.operation.crossProjectSummary.projects, 1)
  assert.equal(output.result.operation.crossProjectSummary.localProofReady, 1)
  assert.equal(output.result.operation.crossProjectSummary.adjacentReady, 5)
  assert.equal(output.result.operation.crossProjectSummary.spineReady, 1)
  assert.equal(output.result.operation.crossProjectSummary.swarmReady, 1)
  assert.equal(output.result.operation.crossProjectSummary.currentOperations, 1)
  assert.equal(output.result.operation.crossProjectSummary.currentOperationReady, 1)
  assert.equal(output.result.operation.crossProjectSummary.currentOperationCrossProjectIndexed, 1)
  assert.equal(output.result.operation.crossProjectSummary.swarmProof, false)
  assert.equal(output.result.operation.crossProjectSummary.activation, false)
  assert.equal(output.result.operation.adjacentRepoWrite, false)
  assert.equal(output.result.operation.layerAdmission, false)
  assert.equal(output.result.operation.edgeDispatch, false)
  assert.equal(output.result.preparation.inspection.packet.recordRefs.currentOperationSummary.path, 'records/exports/media-current-operational-runbook.local.json')
  assert.equal(output.result.preparation.inspection.packet.recordRefs.currentOperationSummary.schema, 'studio-current-operational-runbook')
  assert.ok(output.result.preparation.inspection.packet.artifactKinds.includes('studio-current-operational-runbook'))
  assert.equal(output.result.inspection.output, 'records/exports/local-run-edge-inspection-packet.local.json')
  assert.equal(output.result.inspection.packet.recordRefs.currentOperationSummary.path, 'records/exports/media-current-operational-runbook.local.json')
  assert.equal(output.result.operation.outputs.inspectionPacket, 'records/exports/local-run-edge-inspection-packet.local.json')
  const inspectionSummary = await captureConsole(() => summarizeInspectionPacket({
    projectDir: dir,
    packet: 'records/exports/local-run-edge-inspection-packet.local.json'
  }))
  assert.ok(inspectionSummary.result.familyRows.some(([family, count]) => family === 'operation' && count === '1'))
  assert.ok(inspectionSummary.result.currentOperationRows.some((row) =>
    row[0] === 'project-test' &&
    row[1] === 'ready_for_spine_discussion' &&
    row[2] === 'ready' &&
    row[3] === 'passed' &&
    row[5] === 'true' &&
    row[6] === 'records/exports/media-current-operational-runbook.local.json'
  ))
  assert.equal(output.result.operatorIndex.index.localProofRehearsalSummary.latestProofState, 'ready')
  assert.equal(output.result.operatorIndex.index.currentOperationSummary.summaries, 1)
  assert.equal(output.result.operatorIndex.index.currentOperationSummary.operationState, 'ready_for_spine_discussion')
  assert.equal(output.result.operatorIndex.index.summary.currentOperationSummaries, 1)
  assert.equal(output.result.operatorIndex.index.summary.currentOperationState, 'ready_for_spine_discussion')
  assert.equal(output.result.operatorIndex.index.summary.currentOperationCrossProjectIndexed, true)
  assert.equal(output.result.operatorIndex.index.currentOperationSummaryRefs[0].path, 'records/exports/media-current-operational-runbook.local.json')
  assert.equal(output.result.edgeCompatibility.bundle.localProofRehearsalSummary.latestProofState, 'ready')
  assert.equal(output.result.edgeCompatibility.bundle.currentOperationSummary.summaries, 1)
  assert.equal(output.result.edgeCompatibility.bundle.currentOperationSummary.operationState, 'ready_for_spine_discussion')
  assert.ok(output.result.edgeCompatibility.bundle.studioSourceRefs.some((ref) =>
    ref.kind === 'media-current-operational-runbook' &&
    ref.path === 'records/exports/media-current-operational-runbook.local.json'
  ))
  assert.equal(output.result.edgeCompatibility.bundle.studioReviewEvidence.currentOperationSummary.summaries, 1)
  assert.equal(output.result.crossProject.index.summary.localProofReady, 1)
  assert.equal(output.result.crossProject.index.summary.spineReadinessReady, 1)
  assert.equal(output.result.crossProject.index.summary.swarmReady, 1)
  assert.equal(output.result.crossProject.index.summary.currentOperations, 1)
  assert.equal(output.result.crossProject.index.summary.currentOperationReady, 1)
  assert.equal(output.result.crossProject.index.summary.currentOperationCrossProjectIndexed, 1)
  assert.equal(output.result.crossProject.index.projectSummaries[0].currentOperationSummary.operationState, 'ready_for_spine_discussion')
  assert.equal(output.result.crossProject.output, 'records/exports/media-current-operation-cross-project-index.local.json')
  assert.equal(output.result.crossProject.inputListOutput, 'records/exports/media-current-operation-cross-project-input-list.local.json')
  assert.equal(output.result.output, 'records/exports/media-current-operational-runbook.local.json')
  assert.equal(output.result.operation.outputs.currentOperationSummary, 'records/exports/media-current-operational-runbook.local.json')
  assert.deepEqual(
    await readJsonFile(dir, 'records/exports/media-current-operational-runbook.local.json'),
    output.result.operation
  )
  assert.ok(line.includes('operation=ready_for_spine_discussion'))
  assert.ok(line.includes('preparedLocalFixture=true'))
  assert.ok(line.includes('proof=ready'))
  assert.ok(line.includes('proofDrill=passed'))
  assert.ok(line.includes('localPackage=complete_review_only_authority_missing'))
  assert.ok(line.includes('spineReadiness=ready_for_spine_discussion'))
  assert.ok(line.includes('adjacentFreshness=fresh'))
  assert.ok(line.includes('crossProjectIndexed=true'))
  assert.ok(line.includes('crossProjectLocalProofReady=1'))
  assert.ok(line.includes('crossProjectSpineReady=1'))
  assert.ok(line.includes('crossProjectCurrentOperations=1'))
  assert.ok(line.includes('inspectionRefreshed=true'))
  assert.ok(line.includes('inspectionPacket=records/exports/local-run-edge-inspection-packet.local.json'))
  assert.ok(line.includes('output=records/exports/media-current-operational-runbook.local.json'))
  assert.ok(line.includes('swarmRuntimeActivated=false'))
})

test('current operational command exposes refreshed inspection without fixture preparation', async () => {
  const dir = await createLocalProofFixtureProject()

  const output = await captureConsole(() => runCurrentOperationalRunbook({
    projectDir: dir,
    createdAt: '2026-05-19T00:00:00.000Z'
  }))
  const line = output.lines.find((entry) => entry.startsWith('studio current operation:'))

  assert.equal(output.result.preparation, null)
  assert.equal(output.result.operation.preparedLocalFixture, false)
  assert.equal(output.result.operation.inspectionRefreshed, true)
  assert.equal(output.result.inspection.output, 'records/exports/local-run-edge-inspection-packet.local.json')
  assert.equal(output.result.inspection.packet.recordRefs.currentOperationSummary.path, 'records/exports/media-current-operational-runbook.local.json')
  assert.equal(output.result.inspection.packet.recordRefs.currentOperationSummary.schema, 'studio-current-operational-runbook')
  assert.equal(output.result.operation.outputs.inspectionPacket, 'records/exports/local-run-edge-inspection-packet.local.json')
  assert.deepEqual(
    await readJsonFile(dir, 'records/exports/media-current-operational-runbook.local.json'),
    output.result.operation
  )
  assert.ok(line.includes('preparedLocalFixture=false'))
  assert.ok(line.includes('inspectionRefreshed=true'))
  assert.ok(line.includes('inspectionPacket=records/exports/local-run-edge-inspection-packet.local.json'))
  assert.ok(line.includes('swarmRuntimeActivated=false'))
})

test('adjacent seam needs packet declares ready proof for Spine discussion', async () => {
  const dir = await createLocalProofFixtureProject()
  await captureConsole(() => runLocalProofRehearsal({
    projectDir: dir,
    drill: true,
    createdAt: '2026-05-19T00:00:00.000Z'
  }))

  const output = await captureConsole(() => writeAdjacentSeamNeedsPacket({
    projectDir: dir,
    createdAt: '2026-05-19T00:00:00.000Z'
  }))
  const packet = output.result.packet
  const line = output.lines.find((entry) => entry.startsWith('studio adjacent seam needs:'))
  const schema = JSON.parse(await readFile(path.join(process.cwd(), 'schemas/media-studio-adjacent-seam-needs-packet-local.schema.json'), 'utf8'))

  assert.equal(packet.schema, 'media.studio_adjacent_seam_needs_packet.local.v1')
  assert.equal(schema.title, 'media.studio_adjacent_seam_needs_packet.local.v1')
  assert.equal(schema.properties.schema.const, 'media.studio_adjacent_seam_needs_packet.local.v1')
  assert.equal(packet.declarationStatus, 'ready_for_spine_discussion')
  assert.equal(packet.spineDiscussion, 'required')
  assert.equal(packet.summary.adjacentNeeds, 5)
  assert.equal(packet.summary.adjacentReady, 5)
  assert.equal(packet.summary.adjacentAttention, 0)
  assert.deepEqual(packet.summary.ownerRepos, [
    'mesh-ecology-spine',
    'mesh-ecology-layer',
    'mesh-ecology-edge',
    'mesh-ecology-bytes',
    'causal-substrate'
  ])
  assert.equal(packet.nonClaims.adjacentRepoWrite, false)
  assert.equal(packet.nonClaims.layerAdmission, false)
  assert.equal(packet.nonClaims.edgeDispatch, false)
  assert.equal(packet.nonClaims.bytesMaterialization, false)
  assert.equal(packet.nonClaims.causalTruth, false)
  assert.ok(line.includes('adjacentNeeds=5'))
  assert.ok(line.includes('spineDiscussion=required'))
  assert.ok(line.includes('proof=ready'))
  assert.ok(line.includes('proofFreshness=fresh'))
  assert.ok(line.includes('proofDrill=passed'))
  assert.equal(validateRequiredRecord(packet), true)
})

test('adjacent seam needs packet blocks missing proof without adjacent authority claims', async () => {
  const dir = await createFixtureProject()

  const { result, lines } = await captureConsole(() => writeAdjacentSeamNeedsPacket({
    projectDir: dir,
    createdAt: '2026-05-19T00:00:00.000Z'
  }))
  const packet = result.packet
  const line = lines.find((entry) => entry.startsWith('studio adjacent seam needs:'))

  assert.equal(packet.declarationStatus, 'blocked_missing_proof')
  assert.equal(packet.spineDiscussion, 'absent')
  assert.equal(packet.summary.adjacentAttention, 5)
  assert.equal(packet.adjacentDiscussionRows.every((row) => row.discussionStatus === 'blocked_missing_proof'), true)
  assert.match(packet.safeNextAction, /proof:local -- --drill/)
  assert.ok(line.includes('proof=absent'))
  assert.ok(line.includes('proofFreshness=absent'))
  assert.ok(line.includes('proofDrill=absent'))
  assert.equal(packet.nonClaims.adjacentRepoWrite, false)
  assert.equal(packet.nonClaims.resultAcceptance, false)
  assert.equal(validateRequiredRecord(packet), true)
})

test('adjacent seam needs packet treats stale proof as local attention', async () => {
  const dir = await createLocalProofFixtureProject()
  await captureConsole(() => runLocalProofRehearsal({
    projectDir: dir,
    drill: true,
    createdAt: '2026-05-19T00:00:00.000Z'
  }))
  const operatorPath = path.join(dir, 'records/exports/media-operator-packet-index.local.json')
  const operatorIndex = JSON.parse(await readFile(operatorPath, 'utf8'))
  operatorIndex.localProofRehearsalSummary.proofFreshness = 'stale'
  operatorIndex.localProofRehearsalSummary.staleReasons = ['test_stale_local_proof']
  operatorIndex.localProofRehearsalSummary.safeNextAction = 'Run npm run proof:local to refresh local proof rehearsal evidence after local posture changes.'
  await writeFile(operatorPath, `${JSON.stringify(operatorIndex, null, 2)}\n`)

  const { result, lines } = await captureConsole(() => writeAdjacentSeamNeedsPacket({
    projectDir: dir,
    createdAt: '2026-05-19T00:00:00.000Z'
  }))
  const packet = result.packet
  const line = lines.find((entry) => entry.startsWith('studio adjacent seam needs:'))

  assert.equal(packet.declarationStatus, 'local_attention')
  assert.equal(packet.spineDiscussion, 'not-ready')
  assert.equal(packet.summary.adjacentAttention, 5)
  assert.equal(packet.summary.proofFreshness, 'stale')
  assert.ok(line.includes('proof=ready'))
  assert.ok(line.includes('proofFreshness=stale'))
  assert.ok(line.includes('proofDrill=passed'))
  assert.match(packet.safeNextAction, /proof:local/)
  assert.equal(validateRequiredRecord(packet), true)
})

test('adjacent seam needs packet names proof drill attention reasons', async () => {
  const dir = await createLocalProofFixtureProject()
  await captureConsole(() => runLocalProofRehearsal({
    projectDir: dir,
    drill: true,
    createdAt: '2026-05-19T00:00:00.000Z'
  }))
  const proofPath = path.join(dir, 'records/exports/media-studio-local-proof-rehearsal.local.json')
  const proof = JSON.parse(await readFile(proofPath, 'utf8'))
  proof.drillSummary = {
    ...proof.drillSummary,
    drillStatus: 'attention',
    checks: proof.drillSummary?.checks ?? 1,
    passedChecks: Math.max((proof.drillSummary?.checks ?? 1) - 1, 0),
    attentionChecks: 1,
    attentionRows: [
      {
        check: 'operator-adapter-decision',
        status: 'attention',
        issueCode: 'operator_adapter_decision_mismatch',
        expected: 'approved_bounded_studio_source_pressure_observation',
        actual: 'rejected_bounded_studio_source_pressure_observation',
        localOnly: true,
        operatorGuidanceOnly: true
      }
    ],
    safeNextAction: 'Run npm run proof:local -- --drill to refresh local proof rehearsal evidence and drill surfaces.'
  }
  proof.summary = {
    ...proof.summary,
    drillStatus: 'attention',
    drillChecks: proof.drillSummary.checks,
    drillAttention: 1
  }
  await writeFile(proofPath, `${JSON.stringify(proof, null, 2)}\n`)
  await writeOperatorPacketIndex({ projectDir: dir, quiet: true })

  const { result, lines } = await captureConsole(() => writeAdjacentSeamNeedsPacket({
    projectDir: dir,
    createdAt: '2026-05-19T00:00:00.000Z'
  }))
  const packet = result.packet
  const line = lines.find((entry) => entry.startsWith('studio adjacent seam needs:'))

  assert.equal(packet.declarationStatus, 'local_attention')
  assert.equal(packet.spineDiscussion, 'not-ready')
  assert.equal(packet.summary.proofDrill, 'attention')
  assert.deepEqual(packet.summary.proofDrillAttentionReasons, [
    'operator_adapter_decision_mismatch'
  ])
  assert.ok(line.includes('proofDrill=attention'))
  assert.ok(line.includes('drillAttentionReasons=operator_adapter_decision_mismatch'))
  assert.match(packet.safeNextAction, /proof:local -- --drill/)
  assert.equal(validateRequiredRecord(packet), true)
})

test('adjacent seam needs freshness detects changed proof drill attention reasons', () => {
  const packet = {
    schema: 'media.studio_adjacent_seam_needs_packet.local.v1',
    needsPacketId: 'studio-adjacent-seam-needs-drill-reasons',
    projectId: 'project-test',
    createdAt: '2026-05-19T00:00:00.000Z',
    mode: 'standalone-local',
    declarationStatus: 'local_attention',
    spineDiscussion: 'not-ready',
    sourceRefs: [],
    adjacentDiscussionRows: [],
    summary: {
      adjacentNeeds: 5,
      adjacentReady: 0,
      adjacentAttention: 5,
      proofState: 'ready',
      proofFreshness: 'fresh',
      proofDrill: 'attention',
      proofDrillAttentionReasons: ['operator_adapter_decision_mismatch'],
      adapterDecisionStatus: 'approved_bounded_studio_source_pressure_observation',
      observationStatus: 'emitted',
      localPackageState: 'complete_review_only_authority_missing',
      swarmSeamState: 'ready_for_review_only_swarm_pressure'
    },
    safeNextAction: 'Run npm run proof:local -- --drill to refresh local proof rehearsal evidence and drill surfaces.',
    warnings: [],
    nonClaims: {},
    operatorGuidanceOnly: true,
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    providerTruth: false,
    edgeRuntimeBuilt: false,
    edgeRuntimeVerified: false,
    localTruthLabel: 'local adjacent seam needs declaration',
    truthStatus: 'not mesh truth; not distributed proof; not ratified shared state'
  }
  const summary = summarizeAdjacentSeamNeeds([{ record: packet }], {
    proofSummary: {
      proofs: 1,
      latestProofState: 'ready',
      proofFreshness: 'fresh',
      drillStatus: 'attention',
      drillAttentionReasons: ['surface_non_claim_mismatch'],
      adapterDecisionStatus: 'approved_bounded_studio_source_pressure_observation',
      observationStatus: 'emitted',
      localPackageState: 'complete_review_only_authority_missing',
      swarmSeamState: 'ready_for_review_only_swarm_pressure'
    }
  })

  assert.equal(summary.needsFreshness, 'stale')
  assert.ok(summary.staleReasons.includes('proof_drill_attention_reasons_changed'))
  assert.equal(summary.declarationStatus, 'local_attention')
  assert.match(summary.safeNextAction, /seam:needs/)
})

test('adjacent seam needs packet preserves rejected adapter hold as discussion-only attention', async () => {
  const dir = await createLocalProofFixtureProject()
  await captureConsole(() => runLocalProofRehearsal({
    projectDir: dir,
    adapterDecision: 'rejected',
    drill: true,
    createdAt: '2026-05-19T00:00:00.000Z'
  }))

  const { result } = await captureConsole(() => writeAdjacentSeamNeedsPacket({
    projectDir: dir,
    createdAt: '2026-05-19T00:00:00.000Z'
  }))
  const packet = result.packet

  assert.equal(packet.declarationStatus, 'local_attention')
  assert.equal(packet.spineDiscussion, 'not-ready')
  assert.equal(packet.summary.proofState, 'attention')
  assert.equal(packet.summary.swarmSeamState, 'adapter_hold')
  assert.equal(packet.summary.observationStatus, 'skipped')
  assert.equal(packet.summary.adjacentAttention, 5)
  assert.equal(packet.nonClaims.edgeQueueAction, false)
  assert.equal(packet.nonClaims.layerAdmission, false)
  assert.equal(validateRequiredRecord(packet), true)
})

test('adjacent seam needs surface through operator Edge and cross-project views', async () => {
  const dir = await createLocalProofFixtureProject()
  await captureConsole(() => runLocalProofRehearsal({
    projectDir: dir,
    drill: true,
    createdAt: '2026-05-19T00:00:00.000Z'
  }))
  const { result: needsResult } = await captureConsole(() => writeAdjacentSeamNeedsPacket({
    projectDir: dir,
    createdAt: '2026-05-19T00:00:00.000Z'
  }))

  const { result: operatorResult, lines: operatorLines } = await captureConsole(() =>
    writeOperatorPacketIndex({ projectDir: dir })
  )
  const { result: edgeResult, lines: edgeLines } = await captureConsole(() =>
    writeEdgeCompatibilityBundle({ projectDir: dir })
  )

  assert.equal(operatorResult.index.adjacentSeamNeedsRefs.length, 1)
  assert.equal(operatorResult.index.adjacentSeamNeedsSummary.declarationStatus, 'ready_for_spine_discussion')
  assert.equal(operatorResult.index.adjacentSeamNeedsSummary.needsFreshness, 'fresh')
  assert.equal(operatorResult.index.adjacentSeamReadiness.readiness, 'ready_for_spine_discussion')
  assert.equal(operatorResult.index.summary.adjacentSeamNeeds, 5)
  assert.equal(operatorResult.index.summary.adjacentSeamReadiness, 'ready_for_spine_discussion')
  assert.ok(operatorLines.find((entry) => entry.startsWith('operator packet index:')).includes('adjacentNeeds=5'))
  assert.ok(operatorLines.find((entry) => entry.startsWith('operator packet index:')).includes('adjacentFreshness=fresh'))
  assert.ok(operatorLines.find((entry) => entry.startsWith('operator packet index:')).includes('spineReadiness=ready_for_spine_discussion'))
  assert.ok(operatorLines.find((entry) => entry.startsWith('operator packet index:')).includes('spineNextAction=Discuss these adjacent seam needs with the operator and Spine repo agent'))
  assert.ok(operatorLines.find((entry) => entry.startsWith('operator packet index:')).includes('spineDurableAppend=false'))
  assert.ok(operatorLines.find((entry) => entry.startsWith('operator packet index:')).includes('spineEdgeQueueAction=false'))
  assert.ok(operatorLines.find((entry) => entry.startsWith('operator packet index:')).includes('spineEdgeRuntimeVerified=false'))
  assert.ok(operatorLines.find((entry) => entry.startsWith('operator packet index:')).includes('spinePublicationAuthorization=false'))
  assert.ok(operatorLines.find((entry) => entry.startsWith('operator packet index:')).includes('spineProductionReady=false'))
  assert.equal(edgeResult.bundle.adjacentSeamNeedsSummary.adjacentNeeds, 5)
  assert.equal(edgeResult.bundle.adjacentSeamNeedsSummary.spineDiscussion, 'required')
  assert.equal(edgeResult.bundle.adjacentSeamNeedsSummary.needsFreshness, 'fresh')
  assert.equal(edgeResult.bundle.adjacentSeamReadiness.readiness, 'ready_for_spine_discussion')
  assert.equal(edgeResult.bundle.studioSourceRefs.some((ref) => ref.schema === 'media.studio_adjacent_seam_needs_packet.local.v1'), true)
  assert.ok(edgeLines.find((entry) => entry.startsWith('edge source refs:')).includes('adjacentNeeds=5'))
  assert.ok(edgeLines.find((entry) => entry.startsWith('edge source refs:')).includes('adjacentFreshness=fresh'))
  assert.ok(edgeLines.find((entry) => entry.startsWith('edge source refs:')).includes('spineReadiness=ready_for_spine_discussion'))
  assert.ok(edgeLines.find((entry) => entry.startsWith('edge source refs:')).includes('spineNextAction=Discuss these adjacent seam needs with the operator and Spine repo agent'))
  assert.ok(edgeLines.find((entry) => entry.startsWith('edge source refs:')).includes('spineDurableAppend=false'))
  assert.ok(edgeLines.find((entry) => entry.startsWith('edge source refs:')).includes('spineEdgeQueueAction=false'))
  assert.ok(edgeLines.find((entry) => entry.startsWith('edge source refs:')).includes('spineEdgeRuntimeVerified=false'))
  assert.ok(edgeLines.find((entry) => entry.startsWith('edge source refs:')).includes('spinePublicationAuthorization=false'))
  assert.ok(edgeLines.find((entry) => entry.startsWith('edge source refs:')).includes('spineProductionReady=false'))

  const baseDir = path.dirname(dir)
  const inputList = createCrossProjectInputListWithArtifactRefs([
    {
      projectId: 'project-test',
      label: 'Adjacent seam project',
      rootPath: path.basename(dir),
      artifactRefs: {
        operatorPacketIndex: crossProjectArtifactRef('operatorPacketIndex'),
        adjacentSeamNeeds: adjacentSeamNeedsArtifactRef(needsResult.packet)
      }
    }
  ], { inputListId: 'adjacent-seam-cross-project-fixture' })
  await writeFile(path.join(baseDir, 'input-list.local.json'), `${JSON.stringify(inputList, null, 2)}\n`)
  const { result: crossProjectResult, lines: crossProjectLines } = await captureConsole(() =>
    writeCrossProjectOperatorIndex({
      baseDir,
      inputList: 'input-list.local.json',
      output: 'cross-project-adjacent.local.json'
    })
  )

  assert.equal(crossProjectResult.index.summary.adjacentNeeds, 5)
  assert.equal(crossProjectResult.index.summary.adjacentReady, 5)
  assert.equal(crossProjectResult.index.summary.adjacentAttention, 0)
  assert.equal(crossProjectResult.index.summary.adjacentFresh, 1)
  assert.equal(crossProjectResult.index.summary.adjacentStale, 0)
  assert.equal(crossProjectResult.index.summary.spineDiscussionRequired, 1)
  assert.equal(crossProjectResult.index.summary.spineReadinessReady, 1)
  assert.equal(crossProjectResult.index.summary.spineReadinessAttention, 0)
  assert.equal(crossProjectResult.index.summary.spineReadinessFresh, 1)
  assert.equal(crossProjectResult.index.summary.spineReadinessStale, 0)
  assert.equal(crossProjectResult.index.summary.spineReadinessInherited, 0)
  assert.equal(crossProjectResult.index.projectSummaries[0].adjacentSeamNeedsSummary.declarationStatus, 'ready_for_spine_discussion')
  assert.equal(crossProjectResult.index.projectSummaries[0].adjacentSeamReadiness.readiness, 'ready_for_spine_discussion')
  assert.equal(crossProjectResult.index.projectSummaries[0].adjacentSeamReadiness.readinessFreshness, 'fresh')
  assert.equal(crossProjectResult.index.projectSummaries[0].adjacentSeamReadiness.readinessSource, 'operator-index-checked-against-adjacent-seam-needs')
  assert.ok(crossProjectLines[0].includes('adjacentNeeds=5'))
  assert.ok(crossProjectLines[0].includes('adjacentFresh=1'))
  assert.ok(crossProjectLines[0].includes('spineReady=1'))
  assert.ok(crossProjectLines[0].includes('spineAttention=0'))
  assert.ok(crossProjectLines[0].includes('spineFresh=1'))
  assert.ok(crossProjectLines[0].includes('spineStale=0'))
  assert.ok(crossProjectLines[0].includes('spineInherited=0'))
  assert.equal(validateRequiredRecord(crossProjectResult.index), true)
})

test('adjacent seam readiness command reports ready missing and stale local states', async () => {
  const readyDir = await createLocalProofFixtureProject()
  await captureConsole(() => runLocalProofRehearsal({
    projectDir: readyDir,
    drill: true,
    createdAt: '2026-05-19T00:00:00.000Z'
  }))

  const missingReadiness = await readAdjacentSeamReadiness({ projectDir: readyDir })
  assert.equal(missingReadiness.readiness, 'missing_adjacent_seam_needs')
  assert.equal(missingReadiness.proofState, 'ready')
  assert.equal(missingReadiness.adjacentPackets, 0)
  assert.equal(missingReadiness.adjacentRepoWrite, false)

  await captureConsole(() => writeAdjacentSeamNeedsPacket({
    projectDir: readyDir,
    createdAt: '2026-05-19T00:00:00.000Z'
  }))
  const { result: readyResult, lines } = await captureConsole(() =>
    inspectAdjacentSeamReadiness({ projectDir: readyDir })
  )
  const compact = lines.find((entry) => entry.startsWith('studio adjacent seam readiness:'))
  assert.equal(readyResult.readiness.readiness, 'ready_for_spine_discussion')
  assert.equal(readyResult.readiness.adjacentFreshness, 'fresh')
  assert.equal(readyResult.readiness.spineDiscussion, 'required')
  assert.equal(readyResult.readiness.durableAppend, false)
  assert.equal(readyResult.readiness.edgeQueueAction, false)
  assert.equal(readyResult.readiness.edgeRuntimeVerified, false)
  assert.equal(readyResult.readiness.storageSelection, false)
  assert.equal(readyResult.readiness.publicationAuthorization, false)
  assert.equal(readyResult.readiness.productionReady, false)
  assert.equal(readyResult.readiness.swarmRuntimeActivated, false)
  assert.ok(compact.includes('readiness=ready_for_spine_discussion'))
  assert.ok(compact.includes('adjacentPackets=1'))
  assert.ok(compact.includes('staleReasons=none'))
  assert.ok(compact.includes('durableAppend=false'))
  assert.ok(compact.includes('edgeQueueAction=false'))
  assert.ok(compact.includes('edgeRuntimeVerified=false'))
  assert.ok(compact.includes('storageSelection=false'))
  assert.ok(compact.includes('publicationAuthorization=false'))
  assert.ok(compact.includes('productionReady=false'))
  assert.ok(compact.includes('swarmRuntimeActivated=false'))

  const packetPath = path.join(readyDir, 'records/exports/media-studio-adjacent-seam-needs.local.json')
  const packet = JSON.parse(await readFile(packetPath, 'utf8'))
  packet.summary.localPackageState = 'stale-test-package-state'
  await writeFile(packetPath, `${JSON.stringify(packet, null, 2)}\n`)

  const staleReadiness = await readAdjacentSeamReadiness({ projectDir: readyDir })
  assert.equal(staleReadiness.readiness, 'stale_adjacent_seam_needs')
  assert.equal(staleReadiness.adjacentFreshness, 'stale')
  assert.ok(staleReadiness.staleReasons.includes('local_package_changed'))
  assert.match(staleReadiness.safeNextAction, /seam:needs/)
  const { lines: staleLines } = await captureConsole(() =>
    inspectAdjacentSeamReadiness({ projectDir: readyDir })
  )
  const staleCompact = staleLines.find((entry) => entry.startsWith('studio adjacent seam readiness:'))
  assert.ok(staleCompact.includes('readiness=stale_adjacent_seam_needs'))
  assert.ok(staleCompact.includes('adjacentPackets=1'))
  assert.ok(staleCompact.includes('staleReasons=local_package_changed'))

  const drillDir = await createLocalProofFixtureProject()
  await captureConsole(() => runLocalProofRehearsal({
    projectDir: drillDir,
    drill: true,
    createdAt: '2026-05-19T00:00:00.000Z'
  }))
  const proofPath = path.join(drillDir, 'records/exports/media-studio-local-proof-rehearsal.local.json')
  const proof = JSON.parse(await readFile(proofPath, 'utf8'))
  proof.drillSummary = {
    ...proof.drillSummary,
    drillStatus: 'attention',
    checks: proof.drillSummary?.checks ?? 1,
    passedChecks: Math.max((proof.drillSummary?.checks ?? 1) - 1, 0),
    attentionChecks: 1,
    attentionRows: [
      {
        check: 'operator-adapter-decision',
        status: 'attention',
        issueCode: 'operator_adapter_decision_mismatch',
        expected: 'approved_bounded_studio_source_pressure_observation',
        actual: 'rejected_bounded_studio_source_pressure_observation',
        localOnly: true,
        operatorGuidanceOnly: true
      }
    ],
    safeNextAction: 'Run npm run proof:local -- --drill to refresh local proof rehearsal evidence and drill surfaces.'
  }
  proof.summary = {
    ...proof.summary,
    drillStatus: 'attention',
    drillChecks: proof.drillSummary.checks,
    drillAttention: 1
  }
  await writeFile(proofPath, `${JSON.stringify(proof, null, 2)}\n`)
  await writeOperatorPacketIndex({ projectDir: drillDir, quiet: true })

  const { result: drillResult, lines: drillLines } = await captureConsole(() =>
    inspectAdjacentSeamReadiness({ projectDir: drillDir })
  )
  const drillCompact = drillLines.find((entry) => entry.startsWith('studio adjacent seam readiness:'))
  assert.equal(drillResult.readiness.readiness, 'local_proof_attention')
  assert.deepEqual(drillResult.readiness.proofDrillAttentionReasons, [
    'operator_adapter_decision_mismatch'
  ])
  assert.ok(drillCompact.includes('proofDrill=attention'))
  assert.ok(drillCompact.includes('drillAttentionReasons=operator_adapter_decision_mismatch'))
})

test('adjacent seam needs surfaces stale after local proof posture changes', async () => {
  const dir = await createLocalProofFixtureProject()
  await captureConsole(() => runLocalProofRehearsal({
    projectDir: dir,
    drill: true,
    createdAt: '2026-05-19T00:00:00.000Z'
  }))
  const { result: needsResult } = await captureConsole(() => writeAdjacentSeamNeedsPacket({
    projectDir: dir,
    createdAt: '2026-05-19T00:00:00.000Z'
  }))

  await captureConsole(() => runLocalProofRehearsal({
    projectDir: dir,
    adapterDecision: 'rejected',
    drill: true,
    createdAt: '2026-05-19T00:00:01.000Z'
  }))
  const proofPath = path.join(dir, 'records/exports/media-studio-local-proof-rehearsal.local.json')
  const proof = JSON.parse(await readFile(proofPath, 'utf8'))
  proof.drillSummary = {
    ...proof.drillSummary,
    drillStatus: 'attention',
    checks: proof.drillSummary?.checks ?? 1,
    passedChecks: Math.max((proof.drillSummary?.checks ?? 1) - 1, 0),
    attentionChecks: 1,
    attentionRows: [
      {
        check: 'operator-adapter-decision',
        status: 'attention',
        issueCode: 'operator_adapter_decision_mismatch',
        expected: 'approved_bounded_studio_source_pressure_observation',
        actual: 'rejected_bounded_studio_source_pressure_observation',
        localOnly: true,
        operatorGuidanceOnly: true
      }
    ],
    safeNextAction: 'Run npm run proof:local -- --drill to refresh local proof rehearsal evidence and drill surfaces.'
  }
  proof.summary = {
    ...proof.summary,
    drillStatus: 'attention',
    drillChecks: proof.drillSummary.checks,
    drillAttention: 1
  }
  await writeFile(proofPath, `${JSON.stringify(proof, null, 2)}\n`)

  const { result: operatorResult, lines: operatorLines } = await captureConsole(() =>
    writeOperatorPacketIndex({ projectDir: dir })
  )
  const { result: edgeResult, lines: edgeLines } = await captureConsole(() =>
    writeEdgeCompatibilityBundle({ projectDir: dir })
  )
  const operatorAdjacent = operatorResult.index.adjacentSeamNeedsSummary
  const operatorCompact = operatorLines.find((entry) => entry.startsWith('operator packet index:'))
  const edgeCompact = edgeLines.find((entry) => entry.startsWith('edge source refs:'))

  assert.equal(operatorAdjacent.originalDeclarationStatus, 'ready_for_spine_discussion')
  assert.equal(operatorAdjacent.declarationStatus, 'local_attention')
  assert.equal(operatorAdjacent.needsFreshness, 'stale')
  assert.equal(operatorAdjacent.spineDiscussion, 'not-ready')
  assert.equal(operatorAdjacent.adjacentReady, 0)
  assert.equal(operatorAdjacent.adjacentAttention, 5)
  assert.ok(operatorAdjacent.staleReasons.includes('proof_state_changed'))
  assert.ok(operatorAdjacent.staleReasons.includes('adapter_decision_changed'))
  assert.match(operatorAdjacent.safeNextAction, /seam:needs/)
  assert.equal(operatorResult.index.adjacentSeamReadiness.readiness, 'local_proof_attention')
  assert.equal(operatorResult.index.summary.adjacentSeamReadiness, 'local_proof_attention')
  assert.ok(operatorCompact.includes('adjacentReady=0'))
  assert.ok(operatorCompact.includes('adjacentAttention=5'))
  assert.ok(operatorCompact.includes('adjacentFreshness=stale'))
  assert.ok(operatorCompact.includes('adjacentStaleReasons=proof_state_changed'))
  assert.ok(operatorCompact.includes('adapter_decision_changed'))
  assert.ok(operatorCompact.includes('spineReadiness=local_proof_attention'))
  assert.ok(operatorCompact.includes('spineNextAction=Run npm run proof:local -- --drill'))
  assert.equal(edgeResult.bundle.adjacentSeamNeedsSummary.needsFreshness, 'stale')
  assert.equal(edgeResult.bundle.adjacentSeamNeedsSummary.spineDiscussion, 'not-ready')
  assert.equal(edgeResult.bundle.adjacentSeamReadiness.readiness, 'local_proof_attention')
  assert.ok(edgeCompact.includes('adjacentFreshness=stale'))
  assert.ok(edgeCompact.includes('adjacentStaleReasons=proof_state_changed'))
  assert.ok(edgeCompact.includes('adapter_decision_changed'))
  assert.ok(edgeCompact.includes('spineReadiness=local_proof_attention'))
  assert.ok(edgeCompact.includes('spineNextAction=Run npm run proof:local -- --drill'))

  const baseDir = path.dirname(dir)
  const inputList = createCrossProjectInputListWithArtifactRefs([
    {
      projectId: 'project-test',
      label: 'Adjacent seam stale project',
      rootPath: path.basename(dir),
      artifactRefs: {
        operatorPacketIndex: crossProjectArtifactRef('operatorPacketIndex'),
        adjacentSeamNeeds: adjacentSeamNeedsArtifactRef(needsResult.packet)
      }
    }
  ], { inputListId: 'adjacent-seam-stale-cross-project-fixture' })
  await writeFile(path.join(baseDir, 'input-list.local.json'), `${JSON.stringify(inputList, null, 2)}\n`)
  const { result: crossProjectResult, lines: crossProjectLines } = await captureConsole(() =>
    writeCrossProjectOperatorIndex({
      baseDir,
      inputList: 'input-list.local.json',
      output: 'cross-project-adjacent-stale.local.json'
    })
  )

  assert.equal(crossProjectResult.index.summary.adjacentReady, 0)
  assert.equal(crossProjectResult.index.summary.adjacentAttention, 5)
  assert.equal(crossProjectResult.index.summary.adjacentFresh, 0)
  assert.equal(crossProjectResult.index.summary.adjacentStale, 1)
  assert.equal(crossProjectResult.index.summary.spineDiscussionRequired, 0)
  assert.equal(crossProjectResult.index.summary.spineReadinessReady, 0)
  assert.equal(crossProjectResult.index.summary.spineReadinessAttention, 1)
  assert.equal(crossProjectResult.index.summary.spineReadinessFresh, 0)
  assert.equal(crossProjectResult.index.summary.spineReadinessStale, 1)
  assert.equal(crossProjectResult.index.summary.spineReadinessInherited, 0)
  assert.equal(crossProjectResult.index.projectSummaries[0].adjacentSeamNeedsSummary.needsFreshness, 'stale')
  assert.equal(crossProjectResult.index.projectSummaries[0].adjacentSeamReadiness.readiness, 'local_proof_attention')
  assert.equal(crossProjectResult.index.projectSummaries[0].adjacentSeamReadiness.readinessFreshness, 'stale')
  assert.ok(crossProjectResult.index.projectSummaries[0].adjacentSeamReadiness.staleReasons.includes('adjacent_seam_needs_stale'))
  assert.deepEqual(crossProjectResult.index.projectSummaries[0].adjacentSeamReadiness.proofDrillAttentionReasons, [
    'operator_adapter_decision_mismatch'
  ])
  assert.ok(crossProjectLines[0].includes('adjacentStale=1'))
  assert.ok(crossProjectLines[0].includes('spineReady=0'))
  assert.ok(crossProjectLines[0].includes('spineAttention=1'))
  assert.ok(crossProjectLines[0].includes('spineFresh=0'))
  assert.ok(crossProjectLines[0].includes('spineStale=1'))
  const crossProjectAdjacentLine = crossProjectLines.find((line) => line.startsWith('  adjacent seams:'))
  assert.ok(crossProjectAdjacentLine)
  assert.ok(crossProjectAdjacentLine.includes('adjacentFreshness=stale'))
  assert.ok(crossProjectAdjacentLine.includes('readinessFreshness=stale'))
  assert.ok(crossProjectAdjacentLine.includes('staleReasons=proof_state_changed'))
  assert.ok(crossProjectAdjacentLine.includes('adjacent_seam_needs_stale'))
  assert.ok(crossProjectAdjacentLine.includes('drillAttentionReasons=operator_adapter_decision_mismatch'))
  assert.equal(validateRequiredRecord(crossProjectResult.index), true)
})

test('local proof summary reports freshness against current posture', () => {
  const proofRecord = {
    schema: 'media.studio_local_proof_rehearsal.local.v1',
    proofRehearsalId: 'studio-local-proof-rehearsal-freshness-fixture',
    createdAt: '2026-06-08T00:00:00.000Z',
    proofState: 'ready',
    localPackagePosture: {
      packageState: 'complete_review_only_authority_missing'
    },
    swarmSeamPosture: {
      state: 'ready_for_review_only_swarm_pressure'
    },
    studioSourcePressureAdapterSummary: {
      latestDecisionStatus: 'approved_bounded_studio_source_pressure_observation',
      observationStatus: 'studio_source_pressure_routed_through_generic_layer_seam',
      targetGenericEnvelope: 'layer_source_pressure_review.v0'
    },
    safeNextAction: 'Carry Studio evidence to future family swarm-seam review only; do not activate swarm runtime locally.'
  }

  const fresh = summarizeLocalProofRehearsal([{ record: proofRecord, relativePath: 'records/exports/proof.local.json' }], {
    localPackagePosture: { packageState: 'complete_review_only_authority_missing' },
    swarmSeamPosture: { state: 'ready_for_review_only_swarm_pressure' },
    adapterSummary: {
      latestDecisionStatus: 'approved_bounded_studio_source_pressure_observation',
      observationStatus: 'studio_source_pressure_routed_through_generic_layer_seam',
      targetGenericEnvelope: 'layer_source_pressure_review.v0'
    }
  })
  assert.equal(fresh.proofFreshness, 'fresh')
  assert.equal(fresh.attentionRows, 0)
  assert.deepEqual(fresh.staleReasons, [])

  const stale = summarizeLocalProofRehearsal([{ record: proofRecord, relativePath: 'records/exports/proof.local.json' }], {
    localPackagePosture: { packageState: 'output_integrity_blocked' },
    swarmSeamPosture: { state: 'adapter_hold' },
    adapterSummary: {
      latestDecisionStatus: 'rejected_bounded_studio_source_pressure_observation',
      observationStatus: 'skipped',
      targetGenericEnvelope: 'layer_source_pressure_review.v0'
    }
  })
  assert.equal(stale.latestProofState, 'ready')
  assert.equal(stale.proofFreshness, 'stale')
  assert.equal(stale.attentionRows, 1)
  assert.deepEqual(stale.staleReasons, [
    'local_package_changed',
    'swarm_seam_changed',
    'adapter_decision_changed',
    'observation_status_changed'
  ])
  assert.match(stale.safeNextAction, /proof:local/)

  const absent = summarizeLocalProofRehearsal([], {
    localPackagePosture: { packageState: 'complete_review_only_authority_missing' }
  })
  assert.equal(absent.latestProofState, 'absent')
  assert.equal(absent.proofFreshness, 'absent')
  assert.equal(absent.attentionRows, 0)
})

test('operator and Edge compact proof posture expose one selected next action', async () => {
  const dir = await createLocalProofFixtureProject()
  await runLocalProofRehearsal({ projectDir: dir, quiet: true })

  const operatorOutput = await captureConsole(() => writeOperatorPacketIndex({ projectDir: dir }))
  const operatorLine = operatorOutput.lines.find((line) => line.startsWith('operator packet index:'))
  assert.ok(operatorLine)
  assert.equal(selectedNextActionFields(operatorLine), 1)
  assert.match(operatorLine, /packageNextAction=/)
  assert.match(operatorLine, /proofNextAction=/)
  assert.match(operatorLine, /swarmNextAction=/)
  assert.match(operatorLine, /localProof=ready/)
  assert.match(operatorLine, /proofFreshness=fresh/)
  assert.match(operatorLine, /proofStaleReasons=none/)
  assert.match(operatorLine, /swarmProof=false/)
  assert.match(operatorLine, /activation=false/)

  const edgeOutput = await captureConsole(() => writeEdgeCompatibilityBundle({ projectDir: dir }))
  const edgeLine = edgeOutput.lines.find((line) => line.startsWith('edge source refs:'))
  assert.ok(edgeLine)
  assert.equal(selectedNextActionFields(edgeLine), 1)
  assert.match(edgeLine, /packageNextAction=/)
  assert.match(edgeLine, /proofNextAction=/)
  assert.match(edgeLine, /swarmNextAction=/)
  assert.match(edgeLine, /localProof=ready/)
  assert.match(edgeLine, /proofFreshness=fresh/)
  assert.match(edgeLine, /proofStaleReasons=none/)
  assert.match(edgeLine, /swarmProof=false/)
  assert.match(edgeLine, /activation=false/)
})

test('operator and Edge compact proof posture mark stale proof as local attention', async () => {
  const dir = await createLocalProofFixtureProject()
  await runLocalProofRehearsal({ projectDir: dir, quiet: true })
  await writeStudioPressureArtifacts({
    projectDir: dir,
    adapterChain: true,
    adapterDecision: 'rejected',
    quiet: true
  })

  const operatorOutput = await captureConsole(() => writeOperatorPacketIndex({ projectDir: dir }))
  const operatorLine = operatorOutput.lines.find((line) => line.startsWith('operator packet index:'))
  assert.ok(operatorLine)
  assert.equal(selectedNextActionFields(operatorLine), 1)
  assert.match(operatorLine, /localProof=ready/)
  assert.match(operatorLine, /proofFreshness=stale/)
  assert.match(operatorLine, /proofStaleReasons=.*adapter_decision_changed/)
  assert.match(operatorLine, /proofNextAction=Run npm run proof:local/)
  assert.match(operatorLine, /nextAction=Run npm run proof:local/)
  const operatorProofLine = operatorOutput.lines.find((line) => line.startsWith('studio local proof:'))
  assert.ok(operatorProofLine)
  assert.match(operatorProofLine, /proofStaleReasons=.*adapter_decision_changed/)
  assert.equal(operatorOutput.result.index.localProofRehearsalSummary.proofFreshness, 'stale')
  assert.ok(operatorOutput.result.index.localProofRehearsalSummary.staleReasons.includes('adapter_decision_changed'))
  assert.equal(operatorOutput.result.index.localProofRehearsalSummary.publicSwarmProof, false)
  assert.equal(operatorOutput.result.index.localProofRehearsalSummary.swarmRuntimeActivated, false)

  const edgeOutput = await captureConsole(() => writeEdgeCompatibilityBundle({ projectDir: dir }))
  const edgeLine = edgeOutput.lines.find((line) => line.startsWith('edge source refs:'))
  assert.ok(edgeLine)
  assert.equal(selectedNextActionFields(edgeLine), 1)
  assert.match(edgeLine, /localProof=ready/)
  assert.match(edgeLine, /proofFreshness=stale/)
  assert.match(edgeLine, /proofStaleReasons=.*adapter_decision_changed/)
  assert.match(edgeLine, /nextAction=Run npm run proof:local/)
  assert.equal(edgeOutput.result.bundle.localProofRehearsalSummary.proofFreshness, 'stale')
  assert.equal(edgeOutput.result.bundle.localProofRehearsalSummary.edgeDispatch, false)
})

test('operator and Edge compact proof posture names drill attention reasons', async () => {
  const dir = await createLocalProofFixtureProject()
  await runLocalProofRehearsal({ projectDir: dir, drill: true, quiet: true })

  const proofPath = path.join(dir, 'records/exports/media-studio-local-proof-rehearsal.local.json')
  const proof = JSON.parse(await readFile(proofPath, 'utf8'))
  proof.drillSummary = {
    ...proof.drillSummary,
    drillStatus: 'attention',
    checks: proof.drillSummary?.checks ?? 1,
    passedChecks: Math.max((proof.drillSummary?.checks ?? 1) - 1, 0),
    attentionChecks: 1,
    attentionRows: [
      {
        check: 'operator-adapter-decision',
        status: 'attention',
        issueCode: 'operator_adapter_decision_mismatch',
        expected: 'approved_bounded_studio_source_pressure_observation',
        actual: 'rejected_bounded_studio_source_pressure_observation',
        localOnly: true,
        operatorGuidanceOnly: true
      }
    ],
    safeNextAction: 'Run npm run proof:local -- --drill to refresh local proof rehearsal evidence and drill surfaces.'
  }
  proof.summary = {
    ...proof.summary,
    drillStatus: 'attention',
    drillChecks: proof.drillSummary.checks,
    drillAttention: 1
  }
  await writeFile(proofPath, `${JSON.stringify(proof, null, 2)}\n`)

  const operatorOutput = await captureConsole(() => writeOperatorPacketIndex({ projectDir: dir }))
  const operatorLine = operatorOutput.lines.find((line) => line.startsWith('operator packet index:'))
  const operatorProofLine = operatorOutput.lines.find((line) => line.startsWith('studio local proof:'))
  assert.ok(operatorLine)
  assert.match(operatorLine, /proofDrill=attention/)
  assert.match(operatorLine, /drillAttention=1/)
  assert.match(operatorLine, /drillAttentionReasons=operator_adapter_decision_mismatch/)
  assert.ok(operatorProofLine)
  assert.match(operatorProofLine, /drillAttentionReasons=operator_adapter_decision_mismatch/)
  assert.deepEqual(operatorOutput.result.index.localProofRehearsalSummary.drillAttentionReasons, [
    'operator_adapter_decision_mismatch'
  ])

  const edgeOutput = await captureConsole(() => writeEdgeCompatibilityBundle({ projectDir: dir }))
  const edgeLine = edgeOutput.lines.find((line) => line.startsWith('edge source refs:'))
  assert.ok(edgeLine)
  assert.match(edgeLine, /proofDrill=attention/)
  assert.match(edgeLine, /drillAttention=1/)
  assert.match(edgeLine, /drillAttentionReasons=operator_adapter_decision_mismatch/)
  assert.deepEqual(edgeOutput.result.bundle.localProofRehearsalSummary.drillAttentionReasons, [
    'operator_adapter_decision_mismatch'
  ])
})

test('local production output runner can keep ffmpeg disabled without blocking local delivery posture', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-local-output-no-ffmpeg-'))
  await runVeniceProductionRehearsal({ projectDir: dir })

  const output = await captureConsole(() => runLocalProductionOutput({
    projectDir: dir,
    disableFfmpeg: true,
    createdAt: '2026-05-19T00:00:00.000Z'
  }))
  const result = output.result

  assert.equal(result.mode, 'standalone-local')
  assert.equal(result.summary.roughCutItems, 1)
  assert.equal(result.summary.roughCutReviewed, 1)
  assert.equal(result.summary.renderReceipts, 1)
  assert.equal(result.summary.exportReceipts, 1)
  assert.equal(result.summary.ffmpegDeliveryReceipts, 0)
  assert.equal(result.summary.localDeliveryEvidencePresent, 1)
  assert.equal(result.summary.localPackageReviewed, 1)
  assert.equal(result.summary.publicationAuthorityRequests, 1)
  assert.equal(result.summary.localProductionPackageComplete, 1)
  assert.equal(result.summary.pendingAuthority, 1)
  assert.equal(result.summary.productionReady, 0)
  assert.equal(result.localPackagePosture.packageState, 'complete_review_only_authority_missing')
  assert.equal(result.localPackagePosture.latestReviewPosture, 'reviewed_fresh')
  assert.equal(result.localPackagePosture.integrityPosture, 'clear')
  assert.equal(result.localPackagePosture.productionReady, 0)
  assert.ok(result.refs.contactSheetRenderReceiptId)
  assert.equal(result.refs.ffmpegRenderReceiptId, null)
  assert.ok(result.refs.localExportReceiptId)
  assert.equal(result.refs.ffmpegExportReceiptId, null)
  assert.ok(result.refs.localPackageReviewDecisionId)
  assert.ok(result.refs.publicationAuthorityRequestCandidateId)
  assert.ok(result.steps.some((step) =>
    step.step === 'render-ffmpeg' &&
    step.state === 'skipped' &&
    step.reason === 'ffmpeg disabled' &&
    step.authorityGranted === false &&
    step.productionReady === false
  ))
  assert.ok(result.steps.some((step) =>
    step.step === 'export-ffmpeg' &&
    step.state === 'skipped' &&
    step.reason === 'ffmpeg disabled' &&
    step.authorityGranted === false &&
    step.productionReady === false
  ))
  assert.ok(output.lines.some((line) =>
    line.startsWith('production local output: project=venice-smoke-project | steps=15/17') &&
    line.includes('ffmpegDeliveryReceipts=0') &&
    line.includes('productionReady=0') &&
    line.includes('localPackage=complete_review_only_authority_missing') &&
    line.includes('review=reviewed_fresh') &&
    line.includes('integrity=clear')
  ))

  const summary = await createMediaSummary({ projectDir: dir })
  assert.equal(summary.renderReceipts.ffmpegPreview, 0)
  assert.equal(summary.exportReceipts.ffmpegDeliveryReceipts, 0)
  assert.equal(summary.exportReceipts.localDeliveryEvidencePresent, 1)
  const prereqs = await createProductionAuthorityPrerequisiteReport({ projectDir: dir })
  assert.equal(prereqs.localProductionPackageComplete, 1)
  assert.equal(prereqs.localDeliveryEvidenceIntact, 1)
  assert.equal(prereqs.outputIntegrityBlockingIssues, 0)
  assert.equal(prereqs.pendingAuthority, 1)
  assert.equal(prereqs.productionReady, 0)
})

test('local package posture marks absent delivery evidence as incomplete', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-local-package-posture-incomplete-'))
  await runVeniceProductionRehearsal({ projectDir: dir })
  const output = await runLocalProductionOutput({
    projectDir: dir,
    disableFfmpeg: true,
    skipLocalPackage: true,
    quiet: true,
    createdAt: '2026-05-19T00:00:00.000Z'
  })

  assert.equal(output.summary.localPackageReviewed, 0)
  assert.equal(output.refs.localPackageReviewDecisionId, null)
  assert.equal(output.refs.publicationAuthorityRequestCandidateId, null)
  assert.equal(output.localPackagePosture.packageState, 'incomplete_local_package')
  assert.equal(output.localPackagePosture.latestReviewPosture, 'missing')
  assert.equal(output.localPackagePosture.integrityPosture, 'incomplete')
  assert.equal(output.localPackagePosture.productionReady, 0)

  const posture = await createLocalPackagePostureSummary({ projectDir: dir })
  assert.equal(posture.packageState, 'incomplete_local_package')
  assert.equal(posture.localProductionPackageComplete, 0)
  assert.equal(posture.localDeliveryEvidenceIntact, 0)
  assert.equal(posture.safeNextAction, 'Run npm run production:local-output to create or refresh complete local package evidence.')
  const mediaSummary = await captureConsole(() => writeMediaSummary({ projectDir: dir }))
  assert.equal(mediaSummary.result.localPackagePosture.packageState, 'incomplete_local_package')
  assert.equal(mediaSummary.result.localPackagePosture.latestReviewPosture, 'missing')
  assert.equal(mediaSummary.result.localPackagePosture.integrityPosture, 'incomplete')
  assert.ok(mediaSummary.lines.some((line) =>
    line.startsWith('local package posture:') &&
    line.includes('localPackage=incomplete_local_package') &&
    line.includes('review=missing') &&
    line.includes('integrity=incomplete')
  ))
  const healthSummary = await captureConsole(() => writeProjectHealth({ projectDir: dir, summary: true }))
  assert.equal(healthSummary.result.health.localPackagePosture.packageState, 'incomplete_local_package')
  assert.equal(healthSummary.result.health.localPackagePosture.latestReviewPosture, 'missing')
  assert.equal(healthSummary.result.health.localPackagePosture.integrityPosture, 'incomplete')
  assert.equal(healthSummary.result.health.blockingIssues.includes('incomplete_local_package'), false)
  assert.ok(healthSummary.lines.some((line) =>
    line.startsWith('localPackagePosture:') &&
    line.includes('localPackage=incomplete_local_package') &&
    line.includes('review=missing') &&
    line.includes('integrity=incomplete')
  ))
})

test('media summary safe next action ignores stale inactive export receipts when local delivery is intact', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-local-output-active-delivery-'))
  await runVeniceProductionRehearsal({ projectDir: dir })
  await runLocalProductionOutput({
    projectDir: dir,
    createdAt: '2026-05-19T00:00:00.000Z',
    quiet: true
  })
  await runLocalProductionOutput({
    projectDir: dir,
    disableFfmpeg: true,
    createdAt: '2026-05-19T00:10:00.000Z',
    quiet: true
  })

  const summary = await createMediaSummary({ projectDir: dir })
  assert.equal(summary.exportReceipts.total, 2)
  assert.equal(summary.exportReceipts.ffmpegDeliveryReceipts, 1)
  assert.equal(summary.exportReceipts.localDeliveryEvidencePresent, 1)
  assert.equal(summary.exportReceipts.attentionRows.length, 1)
  assert.equal(summary.exportReceipts.currentAttentionRows.length, 0)
  assert.equal(summary.exportReceipts.historicalAttentionRows.length, 1)
  assert.equal(summary.exportReceipts.activeDeliveryReceipts, 1)
  assert.equal(summary.exportReceipts.historicalExportReceipts, 1)
  assert.equal(summary.exportReceipts.activeDeliveryRows.length, 1)
  assert.equal(summary.exportReceipts.historicalRows.length, 1)
  assert.ok(summary.exportReceipts.attentionRows[0].issueCodes.includes('target_output_path_changed'))
  assert.equal(summary.exportReceipts.attentionRows[0].deliveryAttentionState, 'historical-stale-receipt')
  assert.equal(summary.exportReceipts.attentionRows[0].visibilityPosture, 'historical-export-receipt')
  assert.equal(summary.exportReceipts.attentionRows[0].historicalAuditOnly, true)
  assert.equal(summary.outputIntegrity.activeDeliveryEvidenceIntact, 1)
  assert.equal(summary.packageAuthority.localProductionPackageComplete, 1)
  assert.equal(summary.packageAuthority.localDeliveryEvidenceIntact, 1)
  assert.equal(summary.safeNextAction, 'Route pending approval proposals through the proper authority lane; local proposals and bundles are not approval.')

  const prereqOutput = await captureConsole(() => writeProductionAuthorityPrerequisiteReport({ projectDir: dir }))
  assert.equal(prereqOutput.result.activeDeliveryReceipts, 1)
  assert.equal(prereqOutput.result.historicalExportReceipts, 1)
  assert.equal(prereqOutput.result.currentExportReceiptAttention, 0)
  assert.equal(prereqOutput.result.historicalExportReceiptAttention, 1)
  assert.equal(prereqOutput.result.rows[0].exportReceiptPosture.activeDeliveryReceipts, 1)
  assert.equal(prereqOutput.result.rows[0].exportReceiptPosture.historicalExportReceipts, 1)
  assert.equal(prereqOutput.result.rows[0].exportReceiptPosture.currentExportReceiptAttention, 0)
  assert.equal(prereqOutput.result.rows[0].exportReceiptPosture.historicalExportReceiptAttention, 1)
  assert.ok(prereqOutput.lines.some((line) => line.includes('activeDeliveryReceipts=1') &&
    line.includes('historicalExportReceipts=1') &&
    line.includes('currentExportReceiptAttention=0') &&
    line.includes('historicalExportReceiptAttention=1')))

  const operatorIndex = await writeOperatorPacketIndex({ projectDir: dir, quiet: true })
  assert.equal(operatorIndex.index.summary.exportReceiptsNeedingAttention, 0)
  assert.equal(operatorIndex.index.summary.historicalExportReceiptAttention, 1)
  assert.equal(operatorIndex.index.summary.activeDeliveryReceipts, 1)
  assert.equal(operatorIndex.index.summary.historicalExportReceipts, 1)
  assert.equal(operatorIndex.index.summary.activeDeliveryEvidenceIntact, 1)

  const handoffOutput = await captureConsole(() => writeAuthorityHandoffCandidate({ projectDir: dir }))
  assert.equal(handoffOutput.result.candidate.prerequisiteSummary.activeDeliveryReceipts, 1)
  assert.equal(handoffOutput.result.candidate.prerequisiteSummary.historicalExportReceipts, 1)
  assert.equal(handoffOutput.result.candidate.prerequisiteSummary.currentExportReceiptAttention, 0)
  assert.equal(handoffOutput.result.candidate.prerequisiteSummary.historicalExportReceiptAttention, 1)
  const exportInput = handoffOutput.result.candidate.authorityReviewInputs.find((input) => input.inputKind === 'export-receipt')
  assert.equal(exportInput.activeDeliveryReceipts, 1)
  assert.equal(exportInput.historicalExportReceipts, 1)
  assert.equal(exportInput.currentAttentionRows.length, 0)
  assert.equal(exportInput.historicalAttentionRows.length, 1)
  assert.equal(exportInput.historicalAttentionRows[0].historicalAuditOnly, true)
  assert.equal(exportInput.historicalAttentionRows[0].visibilityPosture, 'historical-export-receipt')

  const publicationRequestOutput = await captureConsole(() => writePublicationAuthorityRequestCandidate({ projectDir: dir }))
  assert.equal(publicationRequestOutput.result.candidate.prerequisiteSummary.activeDeliveryReceipts, 1)
  assert.equal(publicationRequestOutput.result.candidate.prerequisiteSummary.historicalExportReceipts, 1)
  assert.equal(publicationRequestOutput.result.candidate.prerequisiteSummary.currentExportReceiptAttention, 0)
  assert.equal(publicationRequestOutput.result.candidate.prerequisiteSummary.historicalExportReceiptAttention, 1)

  const healthOutput = await captureConsole(() => writeProjectHealth({ projectDir: dir, summary: true }))
  assert.equal(healthOutput.result.health.exportReceiptSummary.currentAttentionRows.length, 0)
  assert.equal(healthOutput.result.health.exportReceiptSummary.historicalAttentionRows.length, 1)
  assert.equal(healthOutput.result.health.exportReceiptSummary.activeDeliveryReceipts, 1)
  assert.equal(healthOutput.result.health.exportReceiptSummary.historicalExportReceipts, 1)
  assert.equal(healthOutput.result.health.outputIntegritySummary.activeDeliveryEvidenceIntact, 1)
  assert.ok(healthOutput.lines.some((line) => line.includes('exportReceipts: total=2') &&
    line.includes('activeDelivery=1') &&
    line.includes('historicalExportReceipts=1') &&
    line.includes('currentAttention=0') &&
    line.includes('historicalAttention=1')))

  const compatibility = await writeEdgeCompatibilityBundle({ projectDir: dir, quiet: true })
  assert.equal(compatibility.bundle.exportDeliverySummary.currentAttentionRows.length, 0)
  assert.equal(compatibility.bundle.exportDeliverySummary.historicalAttentionRows.length, 1)
  assert.equal(compatibility.bundle.exportDeliverySummary.activeDeliveryReceipts, 1)
  assert.equal(compatibility.bundle.exportDeliverySummary.historicalExportReceipts, 1)
  assert.equal(compatibility.bundle.exportDeliverySummary.historicalAttentionRows[0].historicalAuditOnly, true)

  await rm(path.join(dir, summary.exportReceipts.activeDeliveryRows[0].deliveryLocalRef.path), { force: true })
  const missingActivePrereqs = await createProductionAuthorityPrerequisiteReport({ projectDir: dir })
  assert.equal(missingActivePrereqs.localDeliveryEvidencePresent, 1)
  assert.equal(missingActivePrereqs.localDeliveryEvidenceIntact, 0)
  assert.equal(missingActivePrereqs.localProductionPackageComplete, 0)
  assert.equal(missingActivePrereqs.outputIntegrityBlockingIssues > 0, true)
  assert.equal(missingActivePrereqs.rows[0].exportReceiptPosture.activeDeliveryReceipts, 1)
  assert.equal(missingActivePrereqs.rows[0].exportReceiptPosture.historicalExportReceipts, 1)
  assert.equal(missingActivePrereqs.rows[0].exportReceiptPosture.localDeliveryEvidenceIntact, false)
  assert.ok(missingActivePrereqs.rows[0].outputIntegrityBlockingIssueCodes.includes('missing_export_delivery_bytes'))
  assert.equal(missingActivePrereqs.productionReady, 0)
})

test('local package review can request changes without publication authority', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-local-package-request-changes-'))
  await runVeniceProductionRehearsal({ projectDir: dir })
  await runLocalProductionOutput({ projectDir: dir, quiet: true })

  const output = await captureConsole(() => writeLocalPackageReviewDecision({
    projectDir: dir,
    decision: 'request_changes',
    reason: 'Delivery package needs local rework before authority review.'
  }))
  const decision = output.result.decision

  assert.equal(decision.schema, 'media.operator_decision.v1')
  assert.equal(decision.decisionType, 'request_changes')
  assert.equal(decision.localPackageReview.packageReviewState, 'needs_rework')
  assert.equal(decision.localPackageReview.localPackageReviewed, false)
  assert.equal(decision.localPackageReview.needsRework, true)
  assert.ok(decision.localPackageReview.issueCodes.includes('local_package_needs_rework'))
  assert.equal(decision.publicationAuthorization, false)
  assert.equal(decision.productionReady ?? decision.localPackageReview.productionReady, false)
  assert.equal(decision.freshnessPosture.state, 'fresh')
  assert.ok(output.lines.some((line) =>
    line.includes('local package review decision: request_changes') &&
    line.includes('state=needs_rework') &&
    line.includes('needsRework=true') &&
    line.includes('productionReady=false')
  ))

  await assert.rejects(
    () => writePublicationAuthorityRequestCandidate({ projectDir: dir, quiet: true }),
    /requires local package review decision/
  )

  const prereqs = await createProductionAuthorityPrerequisiteReport({ projectDir: dir })
  assert.equal(prereqs.localPackageReviews, 0)
  assert.equal(prereqs.localPackageReworkRequests, 1)
  assert.equal(prereqs.publicationAuthorityRequests, 1)
  assert.equal(prereqs.publicationAuthorityRequestsStale, 1)
  assert.equal(prereqs.productionReady, 0)
  const mediaSummary = await captureConsole(() => writeMediaSummary({ projectDir: dir }))
  assert.equal(mediaSummary.result.packageAuthority.localPackageReviews, 0)
  assert.equal(mediaSummary.result.packageAuthority.packageReworkRequests, 1)
  assert.equal(mediaSummary.result.packageAuthority.staleRequests, 1)
  assert.equal(mediaSummary.result.localPackagePosture.packageState, 'review_requested_changes')
  assert.equal(mediaSummary.result.localPackagePosture.latestReviewPosture, 'request_changes')
  assert.equal(mediaSummary.result.localPackagePosture.integrityPosture, 'clear')
  assert.ok(mediaSummary.lines.some((line) =>
    line.startsWith('package authority: localPackageReviews=0 | needsRework=1') &&
    line.includes('publicationAuthorityRequests=1') &&
    line.includes('productionReady=0')
  ))
  assert.ok(mediaSummary.lines.some((line) =>
    line.startsWith('local package posture:') &&
    line.includes('localPackage=review_requested_changes') &&
    line.includes('review=request_changes') &&
    line.includes('integrity=clear')
  ))
  assert.ok(mediaSummary.lines.some((line) =>
    line.includes('package-authority:') &&
    line.includes('local_package_needs_rework')
  ))
  const healthSummary = await captureConsole(() => writeProjectHealth({ projectDir: dir, summary: true }))
  assert.equal(healthSummary.result.health.localPackagePosture.packageState, 'review_requested_changes')
  assert.equal(healthSummary.result.health.localPackagePosture.latestReviewPosture, 'request_changes')
  assert.equal(healthSummary.result.health.localPackagePosture.integrityPosture, 'clear')
  assert.equal(healthSummary.result.health.blockingIssues.includes('review_requested_changes'), false)
  assert.ok(healthSummary.lines.some((line) =>
    line.startsWith('localPackagePosture:') &&
    line.includes('localPackage=review_requested_changes') &&
    line.includes('review=request_changes') &&
    line.includes('integrity=clear')
  ))
})

test('latest local package review decision controls publication request posture', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-local-package-latest-review-'))
  await runVeniceProductionRehearsal({ projectDir: dir })
  await runLocalProductionOutput({ projectDir: dir, quiet: true })

  await writeLocalPackageReviewDecision({
    projectDir: dir,
    decision: 'request_changes',
    output: 'records/decisions/media-local-package-review-request-changes.local.json',
    quiet: true
  })

  await assert.rejects(
    () => writePublicationAuthorityRequestCandidate({ projectDir: dir, quiet: true }),
    /requires local package review decision/
  )

  const prereqs = await createProductionAuthorityPrerequisiteReport({ projectDir: dir })
  assert.equal(prereqs.localPackageReviews, 0)
  assert.equal(prereqs.localPackageReworkRequests, 1)
  assert.equal(prereqs.localPackageReviewsFresh, 0)
  assert.equal(prereqs.publicationAuthorityRequests, 1)
  assert.equal(prereqs.publicationAuthorityRequestsStale, 1)
  assert.equal(prereqs.productionReady, 0)

  const mediaSummary = await createMediaSummary({ projectDir: dir })
  assert.equal(mediaSummary.packageAuthority.localPackageReviews, 0)
  assert.equal(mediaSummary.packageAuthority.packageReworkRequests, 1)
  assert.equal(mediaSummary.packageAuthority.freshReviews, 0)
  assert.equal(mediaSummary.packageAuthority.publicationAuthorityRequests, 1)
  assert.equal(mediaSummary.packageAuthority.staleRequests, 1)
  assert.ok(mediaSummary.packageAuthority.rows.some((row) =>
    row.kind === 'local-package-review' &&
    row.needsRework === true &&
    row.ref.path === 'records/decisions/media-local-package-review-request-changes.local.json'
  ))
  assert.equal(mediaSummary.packageAuthority.rows.filter((row) => row.kind === 'local-package-review').length, 1)

  const edgeCompatibility = await captureConsole(() => writeEdgeCompatibilityBundle({ projectDir: dir }))
  assert.equal(edgeCompatibility.result.bundle.exportDeliverySummary.localPackageReviewDecisionRefs, 0)
  assert.equal(edgeCompatibility.result.bundle.exportDeliverySummary.localPackageReworkRequests, 1)
  assert.equal(edgeCompatibility.result.bundle.exportDeliverySummary.localPackageReviewState, 'needs_rework')
  assert.ok(edgeCompatibility.lines.some((line) =>
    line.includes('localPackageReviews=0') &&
    line.includes('localPackageReworkRequests=1')
  ))
})

test('local package rework runner regenerates output after needs rework', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-local-package-rework-'))
  await runVeniceProductionRehearsal({ projectDir: dir })
  await runLocalProductionOutput({ projectDir: dir, quiet: true })

  await writeLocalPackageReviewDecision({
    projectDir: dir,
    decision: 'request_changes',
    output: 'records/decisions/media-local-package-review-request-changes.local.json',
    quiet: true
  })
  await assert.rejects(
    () => writePublicationAuthorityRequestCandidate({ projectDir: dir, quiet: true }),
    /requires local package review decision/
  )
  const requestedChangesPosture = await createLocalPackagePostureSummary({ projectDir: dir })
  assert.equal(requestedChangesPosture.packageState, 'review_requested_changes')
  assert.equal(requestedChangesPosture.latestReviewPosture, 'request_changes')
  assert.equal(requestedChangesPosture.safeNextAction, 'Run npm run production:package-rework to regenerate local output from the request-changes review.')

  const output = await captureConsole(() => runLocalPackageRework({
    projectDir: dir,
    createdAt: '3000-01-01T00:00:00.000Z'
  }))
  const result = output.result

  assert.equal(result.reworkKind, 'local-package-rework-runner')
  assert.equal(result.sourcePackageReviewDecisionRef.id, 'decision-local-package-venice-smoke-project-request_changes')
  assert.equal(result.reworkTrigger, 'local-package-review-request-changes')
  assert.equal(result.reworkEligibility.allowed, true)
  assert.equal(result.reworkEligibility.trigger, 'local-package-review-request-changes')
  assert.equal(result.summary.localPackageReviewed, 1)
  assert.equal(result.summary.publicationAuthorityRequests, 1)
  assert.equal(result.summary.localProductionPackageComplete, 1)
  assert.equal(result.summary.productionReady, 0)
  assert.equal(result.summary.localPackageState, 'complete_review_only_authority_missing')
  assert.equal(result.localPackagePosture.packageState, 'complete_review_only_authority_missing')
  assert.equal(result.localPackagePosture.latestReviewPosture, 'reviewed_fresh')
  assert.equal(result.localPackagePosture.integrityPosture, 'clear')
  assert.equal(result.nonClaims.publicationAuthorization, false)
  assert.equal(result.nonClaims.meshTruth, false)
  assert.equal(result.nonClaims.resourceAdmission, false)
  assert.equal(result.nonClaims.edgeCalled, false)
  assert.equal(result.nonClaims.meshPublished, false)
  assert.ok(output.lines.some((line) =>
    line.startsWith('local package rework: project=venice-smoke-project') &&
    line.includes('trigger=local-package-review-request-changes') &&
    line.includes('localPackageReviewed=1') &&
    line.includes('publicationAuthorityRequests=1') &&
    line.includes('productionReady=0') &&
    line.includes('localPackage=complete_review_only_authority_missing') &&
    line.includes('review=reviewed_fresh') &&
    line.includes('integrity=clear')
  ))

  const mediaSummary = await createMediaSummary({ projectDir: dir })
  assert.equal(mediaSummary.packageAuthority.localPackageReviews, 1)
  assert.equal(mediaSummary.packageAuthority.packageReworkRequests, 0)
  assert.equal(mediaSummary.packageAuthority.freshRequests, 1)
  assert.equal(mediaSummary.packageAuthority.staleRequests, 0)
  assert.equal(mediaSummary.packageAuthority.productionReady, 0)

  const prereqs = await createProductionAuthorityPrerequisiteReport({ projectDir: dir })
  assert.equal(prereqs.localPackageReviews, 1)
  assert.equal(prereqs.localPackageReworkRequests, 0)
  assert.equal(prereqs.publicationAuthorityRequestsFresh, 1)
  assert.equal(prereqs.productionReady, 0)
})

test('local package rework runner preserves two-item output posture', async () => {
  for (const mode of [
    { name: 'ffmpeg', disableFfmpeg: false, completedSteps: '17/17', renderReceipts: 2, exportReceipts: 2, ffmpegDeliveryReceipts: 1, localDeliveryEvidencePresent: 2 },
    { name: 'no-ffmpeg', disableFfmpeg: true, completedSteps: '15/17', renderReceipts: 1, exportReceipts: 1, ffmpegDeliveryReceipts: 0, localDeliveryEvidencePresent: 1 }
  ]) {
    const dir = await mkdtemp(path.join(os.tmpdir(), `media-studio-local-package-rework-two-items-${mode.name}-`))
    await runVeniceProductionRehearsal({ projectDir: dir })
    await addSecondAcceptedProductionItemFixture(dir)
    await runLocalProductionOutput({
      projectDir: dir,
      disableFfmpeg: mode.disableFfmpeg,
      quiet: true,
      createdAt: '2026-05-19T00:00:00.000Z'
    })

    await writeLocalPackageReviewDecision({
      projectDir: dir,
      decision: 'request_changes',
      output: 'records/decisions/media-local-package-review-request-changes.local.json',
      quiet: true
    })

    const output = await captureConsole(() => runLocalPackageRework({
      projectDir: dir,
      disableFfmpeg: mode.disableFfmpeg,
      createdAt: '3000-01-01T00:00:00.000Z'
    }))
    const result = output.result

    assert.equal(result.summary.steps, Number(mode.completedSteps.split('/')[0]))
    assert.equal(result.summary.totalSteps, 17)
    assert.equal(result.output.summary.roughCutItems, 2)
    assert.equal(result.reworkTrigger, 'local-package-review-request-changes')
    assert.equal(result.output.summary.renderReceipts, mode.renderReceipts)
    assert.equal(result.output.summary.exportReceipts, mode.exportReceipts)
    assert.equal(result.output.summary.ffmpegDeliveryReceipts, mode.ffmpegDeliveryReceipts)
    assert.equal(result.output.summary.localDeliveryEvidencePresent, mode.localDeliveryEvidencePresent)
    assert.equal(result.summary.localPackageReviewed, 1)
    assert.equal(result.summary.publicationAuthorityRequests, 1)
    assert.equal(result.summary.localProductionPackageComplete, 2)
    assert.equal(result.summary.pendingAuthority, 2)
    assert.equal(result.summary.productionReady, 0)
    assert.equal(result.summary.localPackageState, 'complete_review_only_authority_missing')
    assert.equal(result.localPackagePosture.packageState, 'complete_review_only_authority_missing')
    assert.equal(result.localPackagePosture.latestReviewPosture, 'reviewed_fresh')
    assert.equal(result.localPackagePosture.integrityPosture, 'clear')
    assert.equal(result.nonClaims.publicationAuthorization, false)
    assert.equal(result.nonClaims.productionReady, false)
    assert.equal(result.nonClaims.edgeCalled, false)
    assert.equal(result.nonClaims.meshPublished, false)
    assert.ok(output.lines.some((line) =>
      line.startsWith('local package rework: project=venice-smoke-project') &&
      line.includes('sourceReview=decision-local-package-venice-smoke-project-request_changes') &&
      line.includes('trigger=local-package-review-request-changes') &&
      line.includes(`steps=${mode.completedSteps}`) &&
      line.includes('localPackageReviewed=1') &&
      line.includes('publicationAuthorityRequests=1') &&
      line.includes('localProductionPackageComplete=2') &&
      line.includes('pendingAuthority=2') &&
      line.includes('productionReady=0') &&
      line.includes('localPackage=complete_review_only_authority_missing') &&
      line.includes('review=reviewed_fresh') &&
      line.includes('integrity=clear')
    ))

    const roughCut = JSON.parse(await readFile(path.join(dir, 'records/production/media-rough-cut-capsule.local.json'), 'utf8'))
    assert.equal(roughCut.orderedItems.length, 2)
    assert.deepEqual(roughCut.orderedItems.map((item) => item.order), [1, 2])

    const prereqs = await createProductionAuthorityPrerequisiteReport({ projectDir: dir })
    assert.equal(prereqs.candidates, 2)
    assert.equal(prereqs.localProductionPackageComplete, 2)
    assert.equal(prereqs.localDeliveryEvidenceIntact, 2)
    assert.equal(prereqs.localPackageReviews, 1)
    assert.equal(prereqs.localPackageReworkRequests, 0)
    assert.equal(prereqs.publicationAuthorityRequestsFresh, 1)
    assert.equal(prereqs.outputIntegrityBlockingIssues, 0)
    assert.equal(prereqs.pendingAuthority, 2)
    assert.equal(prereqs.productionReady, 0)

    const mediaSummary = await createMediaSummary({ projectDir: dir })
    assert.equal(mediaSummary.productionRoughCuts.itemRefs, 2)
    assert.equal(mediaSummary.packageAuthority.localPackageReviews, 1)
    assert.equal(mediaSummary.packageAuthority.packageReworkRequests, 0)
    assert.equal(mediaSummary.packageAuthority.freshRequests, 1)
    assert.equal(mediaSummary.packageAuthority.productionReady, 0)
  }
})

test('local package rework runner regenerates stale package after rough cut revision', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-local-package-rework-stale-'))
  await runVeniceProductionRehearsal({ projectDir: dir })
  await runLocalProductionOutput({
    projectDir: dir,
    quiet: true,
    createdAt: '2026-05-19T00:00:00.000Z'
  })
  await writeRoughCutReviewDecision({
    projectDir: dir,
    decision: 'request_changes',
    output: 'records/decisions/media-rough-cut-request-changes.local.json',
    quiet: true,
    createdAt: '2026-05-20T00:00:00.000Z'
  })
  await writeRoughCutRevision({
    projectDir: dir,
    quiet: true,
    createdAt: '2026-05-20T00:00:01.000Z'
  })

  const stalePrereqs = await createProductionAuthorityPrerequisiteReport({ projectDir: dir })
  assert.equal(stalePrereqs.roughCutReviewed, 0)
  assert.equal(stalePrereqs.localProductionPackageComplete, 0)
  assert.equal(stalePrereqs.localPackageReviews, 1)
  assert.equal(stalePrereqs.localPackageReviewsStale, 1)
  assert.equal(stalePrereqs.publicationAuthorityRequestsFresh, 0)
  assert.equal(stalePrereqs.publicationAuthorityRequestsStale, 1)
  assert.equal(stalePrereqs.productionReady, 0)
  const stalePosture = await createLocalPackagePostureSummary({ projectDir: dir })
  assert.equal(stalePosture.packageState, 'stale_review')
  assert.equal(stalePosture.latestReviewPosture, 'reviewed_stale')
  assert.ok(stalePosture.issueCodes.includes('local_package_review_source_refs_changed'))
  const staleMediaSummary = await captureConsole(() => writeMediaSummary({ projectDir: dir }))
  assert.equal(staleMediaSummary.result.localPackagePosture.packageState, 'stale_review')
  assert.equal(staleMediaSummary.result.localPackagePosture.latestReviewPosture, 'reviewed_stale')
  assert.ok(staleMediaSummary.lines.some((line) =>
    line.startsWith('local package posture:') &&
    line.includes('localPackage=stale_review') &&
    line.includes('review=reviewed_stale')
  ))
  const staleHealthSummary = await captureConsole(() => writeProjectHealth({ projectDir: dir, summary: true }))
  assert.equal(staleHealthSummary.result.health.localPackagePosture.packageState, 'stale_review')
  assert.equal(staleHealthSummary.result.health.localPackagePosture.latestReviewPosture, 'reviewed_stale')
  assert.equal(staleHealthSummary.result.health.blockingIssues.includes('stale_review'), false)
  assert.ok(staleHealthSummary.lines.some((line) =>
    line.startsWith('localPackagePosture:') &&
    line.includes('localPackage=stale_review') &&
    line.includes('review=reviewed_stale')
  ))

  await assert.rejects(
    () => writePublicationAuthorityRequestCandidate({ projectDir: dir, quiet: true }),
    /requires complete local production package posture/
  )

  const output = await captureConsole(() => runLocalPackageRework({
    projectDir: dir,
    createdAt: '3000-01-01T00:00:00.000Z'
  }))
  const result = output.result

  assert.equal(result.reworkTrigger, 'stale-local-package-review')
  assert.equal(result.reworkEligibility.allowed, true)
  assert.equal(result.reworkEligibility.trigger, 'stale-local-package-review')
  assert.ok(result.reworkIssueCodes.includes('local_package_review_source_refs_changed'))
  assert.ok(result.reworkIssueCodes.includes('current_local_production_package_incomplete'))
  assert.equal(result.output.summary.roughCutItems, 1)
  assert.equal(result.output.summary.roughCutReviewed, 1)
  assert.equal(result.summary.localPackageReviewed, 1)
  assert.equal(result.summary.publicationAuthorityRequests, 1)
  assert.equal(result.summary.localProductionPackageComplete, 1)
  assert.equal(result.summary.productionReady, 0)
  assert.equal(result.summary.localPackageState, 'complete_review_only_authority_missing')
  assert.equal(result.localPackagePosture.packageState, 'complete_review_only_authority_missing')
  assert.equal(result.localPackagePosture.latestReviewPosture, 'reviewed_fresh')
  assert.ok(output.lines.some((line) =>
    line.startsWith('local package rework: project=venice-smoke-project') &&
    line.includes('trigger=stale-local-package-review') &&
    line.includes('localPackageReviewed=1') &&
    line.includes('productionReady=0') &&
    line.includes('localPackage=complete_review_only_authority_missing') &&
    line.includes('review=reviewed_fresh') &&
    line.includes('integrity=clear')
  ))

  const freshPrereqs = await createProductionAuthorityPrerequisiteReport({ projectDir: dir })
  assert.equal(freshPrereqs.roughCutReviewed, 1)
  assert.equal(freshPrereqs.localProductionPackageComplete, 1)
  assert.equal(freshPrereqs.localPackageReviews, 1)
  assert.equal(freshPrereqs.localPackageReviewsStale, 0)
  assert.equal(freshPrereqs.publicationAuthorityRequestsFresh, 1)
  assert.equal(freshPrereqs.pendingAuthority, 1)
  assert.equal(freshPrereqs.productionReady, 0)
})

test('local production output runner carries two accepted production items through reviewable delivery', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-local-output-two-items-'))
  await runVeniceProductionRehearsal({ projectDir: dir })
  await addSecondAcceptedProductionItemFixture(dir)

  const output = await captureConsole(() => runLocalProductionOutput({
    projectDir: dir,
    createdAt: '2026-05-19T00:00:00.000Z'
  }))
  const result = output.result

  assert.equal(result.summary.roughCutItems, 2)
  assert.equal(result.summary.roughCutReviewed, 1)
  assert.equal(result.summary.renderReceipts, 2)
  assert.equal(result.summary.exportReceipts, 2)
  assert.equal(result.summary.ffmpegDeliveryReceipts, 1)
  assert.equal(result.summary.localDeliveryEvidencePresent, 2)
  assert.equal(result.summary.localPackageReviewed, 1)
  assert.equal(result.summary.publicationAuthorityRequests, 1)
  assert.equal(result.summary.localProductionPackageComplete, 2)
  assert.equal(result.summary.pendingAuthority, 2)
  assert.equal(result.summary.productionReady, 0)
  assert.equal(result.localPackagePosture.packageState, 'complete_review_only_authority_missing')
  assert.equal(result.localPackagePosture.latestReviewPosture, 'reviewed_fresh')
  assert.equal(result.localPackagePosture.integrityPosture, 'clear')
  assert.equal(result.nonClaims.publicationAuthorization, false)
  assert.equal(result.nonClaims.productionReady, false)
  assert.ok(output.lines.some((line) =>
    line.startsWith('production local output: project=venice-smoke-project | steps=17/17') &&
    line.includes('roughCutItems=2') &&
    line.includes('localProductionPackageComplete=2') &&
    line.includes('pendingAuthority=2') &&
    line.includes('productionReady=0') &&
    line.includes('localPackage=complete_review_only_authority_missing') &&
    line.includes('review=reviewed_fresh') &&
    line.includes('integrity=clear')
  ))

  const roughCut = JSON.parse(await readFile(path.join(dir, 'records/production/media-rough-cut-capsule.local.json'), 'utf8'))
  assert.equal(roughCut.orderedItems.length, 2)
  assert.deepEqual(roughCut.orderedItems.map((item) => item.order), [1, 2])
  assert.deepEqual(roughCut.orderedItems.map((item) => item.localRef.path), [
    'media/accepted/venice-live-smoke-0.png',
    'media/accepted/venice-live-smoke-1.png'
  ])

  const ffmpegRender = JSON.parse(await readFile(path.join(dir, 'records/production/media-ffmpeg-render-receipt.local.json'), 'utf8'))
  assert.equal(ffmpegRender.orderedItems.length, 2)
  assert.equal(ffmpegRender.output.durationSeconds, 4)
  assert.equal(ffmpegRender.renderPerformed, true)
  assert.equal(ffmpegRender.exportPerformed, false)
  assert.equal(ffmpegRender.productionReady, false)

  const ffmpegExport = JSON.parse(await readFile(path.join(dir, 'records/production/media-ffmpeg-export-receipt.local.json'), 'utf8'))
  assert.equal(ffmpegExport.orderedItems.length, 2)
  assert.equal(ffmpegExport.output.durationSeconds, 4)
  assert.equal(ffmpegExport.deliveryCreated, true)
  assert.equal(ffmpegExport.exportPerformed, true)
  assert.equal(ffmpegExport.publicationAuthorization, false)
  assert.equal(ffmpegExport.productionReady, false)

  const handoff = JSON.parse(await readFile(path.join(dir, 'records/production/media-authority-handoff-candidate.local.json'), 'utf8'))
  const packageReviewInput = handoff.authorityReviewInputs.find((input) => input.inputKind === 'local-package-review-decision')
  const publicationRequestInput = handoff.authorityReviewInputs.find((input) => input.inputKind === 'publication-authority-request-candidate')
  assert.equal(packageReviewInput.present, true)
  assert.equal(packageReviewInput.reviewed, 1)
  assert.equal(packageReviewInput.publicationAuthorization, false)
  assert.equal(publicationRequestInput.present, true)
  assert.equal(publicationRequestInput.requestOnly, true)
  assert.equal(publicationRequestInput.publicationAuthorization, false)
  assert.equal(publicationRequestInput.productionReady, false)
  assert.ok(handoff.sourceRefs.some((ref) => ref.schema === 'media.publication_authority_request_candidate.local.v1'))
  assert.equal(handoff.prerequisiteSummary.publicationAuthorityRequests, 1)
  assert.equal(handoff.publicationAuthorization, false)
  assert.equal(handoff.productionReady, false)

  const prereqs = await createProductionAuthorityPrerequisiteReport({ projectDir: dir })
  assert.equal(prereqs.candidates, 2)
  assert.equal(prereqs.localProductionPackageComplete, 2)
  assert.equal(prereqs.localDeliveryEvidenceIntact, 2)
  assert.equal(prereqs.outputIntegrityBlockingIssues, 0)
  assert.equal(prereqs.pendingAuthority, 2)
  assert.equal(prereqs.productionReady, 0)
  const prereqOutput = await captureConsole(() => writeProductionAuthorityPrerequisiteReport({ projectDir: dir }))
  assert.equal(prereqOutput.result.candidates, 2)
  assert.equal(prereqOutput.result.localProductionPackageComplete, 2)
  assert.equal(prereqOutput.result.ffmpegDeliveryReceipts, 1)
  assert.equal(prereqOutput.result.localPackageReviews, 1)
  assert.equal(prereqOutput.result.publicationAuthorityRequests, 1)
  assert.equal(prereqOutput.result.productionReady, 0)
  assert.ok(prereqOutput.lines.some((line) => line.includes('candidates=2') && line.includes('productionReady=0')))
  const mediaSummary = await captureConsole(() => writeMediaSummary({ projectDir: dir }))
  assert.equal(mediaSummary.result.productionRoughCuts.itemRefs, 2)
  assert.equal(mediaSummary.result.outputIntegrity.localDeliveryEvidenceIntact, 2)
  assert.equal(mediaSummary.result.packageAuthority.publicationAuthorityRequests, 1)
  assert.ok(mediaSummary.lines.some((line) => line.startsWith('rough cuts: total=1 | items=2')))
  assert.ok(mediaSummary.lines.some((line) => line.startsWith('package authority: localPackageReviews=1')))
  const operatorIndex = await captureConsole(() => writeOperatorPacketIndex({ projectDir: dir }))
  assert.equal(operatorIndex.result.index.summary.roughCutCapsules, 1)
  assert.equal(operatorIndex.result.index.roughCutCapsules[0].items, 2)
  assert.equal(operatorIndex.result.index.summary.ffmpegDeliveryReceipts, 1)
  assert.equal(operatorIndex.result.index.summary.publicationAuthorityRequests, 1)
  assert.equal(operatorIndex.result.index.summary.localPackageState, 'complete_review_only_authority_missing')
  assert.equal(operatorIndex.result.index.localPackagePosture.packageState, 'complete_review_only_authority_missing')
  assert.equal(operatorIndex.result.index.localPackagePosture.latestReviewPosture, 'reviewed_fresh')
  assert.equal(operatorIndex.result.index.localPackagePosture.integrityPosture, 'clear')
  assert.ok(operatorIndex.lines.some((line) =>
    line.includes('roughCuts=1') &&
    line.includes('ffmpegDeliveryReceipts=1') &&
    line.includes('publicationAuthorityRequests=1') &&
    line.includes('localPackage=complete_review_only_authority_missing') &&
    line.includes('review=reviewed_fresh') &&
    line.includes('integrity=clear')
  ))
})

test('local production output runner carries two accepted production items without ffmpeg', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-local-output-two-items-no-ffmpeg-'))
  await runVeniceProductionRehearsal({ projectDir: dir })
  await addSecondAcceptedProductionItemFixture(dir)

  const output = await captureConsole(() => runLocalProductionOutput({
    projectDir: dir,
    disableFfmpeg: true,
    createdAt: '2026-05-19T00:00:00.000Z'
  }))
  const result = output.result

  assert.equal(result.summary.roughCutItems, 2)
  assert.equal(result.summary.roughCutReviewed, 1)
  assert.equal(result.summary.renderReceipts, 1)
  assert.equal(result.summary.exportReceipts, 1)
  assert.equal(result.summary.ffmpegDeliveryReceipts, 0)
  assert.equal(result.summary.localDeliveryEvidencePresent, 1)
  assert.equal(result.summary.localPackageReviewed, 1)
  assert.equal(result.summary.publicationAuthorityRequests, 1)
  assert.equal(result.summary.localProductionPackageComplete, 2)
  assert.equal(result.summary.pendingAuthority, 2)
  assert.equal(result.summary.productionReady, 0)
  assert.equal(result.localPackagePosture.packageState, 'complete_review_only_authority_missing')
  assert.equal(result.localPackagePosture.latestReviewPosture, 'reviewed_fresh')
  assert.equal(result.localPackagePosture.integrityPosture, 'clear')
  assert.equal(result.refs.ffmpegRenderReceiptId, null)
  assert.equal(result.refs.ffmpegExportReceiptId, null)
  assert.ok(result.refs.localPackageReviewDecisionId)
  assert.ok(result.refs.publicationAuthorityRequestCandidateId)
  assert.ok(output.lines.some((line) =>
    line.startsWith('production local output: project=venice-smoke-project | steps=15/17') &&
    line.includes('roughCutItems=2') &&
    line.includes('ffmpegDeliveryReceipts=0') &&
    line.includes('localProductionPackageComplete=2') &&
    line.includes('pendingAuthority=2') &&
    line.includes('productionReady=0') &&
    line.includes('localPackage=complete_review_only_authority_missing') &&
    line.includes('review=reviewed_fresh') &&
    line.includes('integrity=clear')
  ))

  const localExport = JSON.parse(await readFile(path.join(dir, 'records/production/media-export-receipt.local.json'), 'utf8'))
  assert.equal(localExport.orderedItems.length, 2)
  assert.equal(localExport.deliveryCreated, true)
  assert.equal(localExport.exportPerformed, true)
  assert.equal(localExport.publicationAuthorization, false)

  const packageReview = JSON.parse(await readFile(path.join(dir, 'records/decisions/media-local-package-review-decision.local.json'), 'utf8'))
  assert.equal(packageReview.decisionType, 'review_local_package')
  assert.equal(packageReview.localPackageReview.localProductionPackageComplete, 2)
  assert.equal(packageReview.localPackageReview.localDeliveryEvidenceIntact, 2)
  assert.equal(packageReview.publicationAuthorization, false)

  const publicationRequest = JSON.parse(await readFile(path.join(dir, 'records/production/media-publication-authority-request-candidate.local.json'), 'utf8'))
  assert.equal(publicationRequest.requestKind, 'publication-export-authority-review-candidate')
  assert.equal(publicationRequest.prerequisiteSummary.localProductionPackageComplete, 2)
  assert.equal(publicationRequest.prerequisiteSummary.localDeliveryEvidenceIntact, 2)
  assert.equal(publicationRequest.publicationAuthorization, false)
  assert.equal(publicationRequest.productionReady, false)
  assert.equal(validateRequiredRecord(publicationRequest), true)

  const records = await readProjectRecords(dir)
  const integrity = await evaluateLocalOutputIntegrity({ projectDir: dir, records })
  assert.equal(integrity.outputIntegrityBlockingIssues, 0)
  assert.equal(integrity.localDeliveryEvidenceIntact, 1)
  const mediaSummary = await captureConsole(() => writeMediaSummary({ projectDir: dir }))
  assert.equal(mediaSummary.result.productionRoughCuts.itemRefs, 2)
  assert.equal(mediaSummary.result.outputIntegrity.localDeliveryEvidenceIntact, 1)
  assert.equal(mediaSummary.result.packageAuthority.publicationAuthorityRequests, 1)
  assert.ok(mediaSummary.lines.some((line) => line.startsWith('rough cuts: total=1 | items=2')))
  assert.ok(mediaSummary.lines.some((line) => line.startsWith('export receipts: total=1 | localPackageCopy=1 | ffmpegDelivery=0')))
  const operatorIndex = await captureConsole(() => writeOperatorPacketIndex({ projectDir: dir }))
  assert.equal(operatorIndex.result.index.summary.roughCutCapsules, 1)
  assert.equal(operatorIndex.result.index.roughCutCapsules[0].items, 2)
  assert.equal(operatorIndex.result.index.summary.ffmpegDeliveryReceipts, 0)
  assert.equal(operatorIndex.result.index.summary.publicationAuthorityRequests, 1)
})

test('local output integrity blocks production package when export delivery bytes are missing', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-missing-export-delivery-'))
  await runVeniceProductionRehearsal({ projectDir: dir })
  await runLocalProductionOutput({ projectDir: dir, quiet: true })
  const packageReview = JSON.parse(await readFile(path.join(dir, 'records/decisions/media-local-package-review-decision.local.json'), 'utf8'))
  const publicationRequest = JSON.parse(await readFile(path.join(dir, 'records/production/media-publication-authority-request-candidate.local.json'), 'utf8'))
  await removeExportDeliveryFiles(dir)

  const prereqs = await createProductionAuthorityPrerequisiteReport({ projectDir: dir })
  assert.equal(prereqs.localDeliveryEvidencePresent, 1)
  assert.equal(prereqs.localDeliveryEvidenceIntact, 0)
  assert.equal(prereqs.localProductionPackageComplete, 0)
  assert.equal(prereqs.outputIntegrityBlockingIssues > 0, true)
  assert.equal(prereqs.localPackageReviews, 1)
  assert.equal(prereqs.localPackageReviewsStale, 1)
  assert.equal(prereqs.publicationAuthorityRequests, 1)
  assert.equal(prereqs.publicationAuthorityRequestsStale, 1)
  assert.equal(prereqs.publicationAuthorityRequestsBlocked, 1)
  assert.equal(prereqs.publicationAuthorityRequestsIntegrityBlocked, 1)
  assert.equal(prereqs.pendingAuthority, 1)
  assert.equal(prereqs.productionReady, 0)
  assert.ok(prereqs.rows[0].outputIntegrityBlockingIssueCodes.includes('missing_export_delivery_bytes'))
  assert.equal(prereqs.rows[0].exportReceiptPosture.state, 'export-receipt-output-integrity-blocked')
  const prereqOutput = await captureConsole(() => writeProductionAuthorityPrerequisiteReport({ projectDir: dir }))
  assert.ok(prereqOutput.lines.some((line) =>
    line.includes('staleAuthorityRequests=1') &&
    line.includes('blockedAuthorityRequests=1') &&
    line.includes('productionReady=0')
  ))
  const recordsAfterRemoval = await readProjectRecords(dir)
  const packageFreshness = evaluateLocalPackageReviewFreshness({
    decision: packageReview,
    records: recordsAfterRemoval,
    prerequisiteReport: prereqs
  })
  assert.equal(packageFreshness.state, 'stale')
  assert.ok(packageFreshness.issueCodes.includes('current_local_delivery_evidence_not_intact'))
  assert.ok(packageFreshness.issueCodes.includes('current_output_integrity_blocking'))
  const requestFreshness = evaluatePublicationAuthorityRequestFreshness({
    candidate: publicationRequest,
    records: recordsAfterRemoval,
    prerequisiteReport: prereqs
  })
  assert.equal(requestFreshness.state, 'stale')
  assert.ok(requestFreshness.issueCodes.includes('current_local_delivery_evidence_not_intact'))
  assert.ok(requestFreshness.issueCodes.includes('current_output_integrity_blocking'))
  assert.equal(requestFreshness.requestReviewBlocked, true)
  assert.equal(requestFreshness.integrityBlocking, true)
  assert.ok(requestFreshness.blockingIssueCodes.includes('current_output_integrity_blocking'))
  await assert.rejects(
    () => writeLocalPackageReviewDecision({ projectDir: dir, quiet: true }),
    /complete local production package|output integrity/
  )
  const blockedPosture = await createLocalPackagePostureSummary({ projectDir: dir })
  assert.equal(blockedPosture.packageState, 'output_integrity_blocked')
  assert.equal(blockedPosture.latestReviewPosture, 'reviewed_stale')
  assert.equal(blockedPosture.integrityPosture, 'blocked')
  assert.ok(blockedPosture.issueCodes.includes('output_integrity_blocked'))

  const mediaSummary = await captureConsole(() => writeMediaSummary({ projectDir: dir }))
  assert.equal(mediaSummary.result.outputIntegrity.localDeliveryEvidenceIntact, 0)
  assert.equal(mediaSummary.result.outputIntegrity.outputIntegrityBlockingIssues > 0, true)
  assert.equal(mediaSummary.result.packageAuthority.localPackageReviews, 1)
  assert.equal(mediaSummary.result.packageAuthority.staleReviews, 1)
  assert.equal(mediaSummary.result.packageAuthority.publicationAuthorityRequests, 1)
  assert.equal(mediaSummary.result.packageAuthority.staleRequests, 1)
  assert.equal(mediaSummary.result.packageAuthority.blockingRequests, 1)
  assert.equal(mediaSummary.result.packageAuthority.integrityBlockingRequests, 1)
  assert.equal(mediaSummary.result.localPackagePosture.packageState, 'output_integrity_blocked')
  assert.equal(mediaSummary.result.localPackagePosture.latestReviewPosture, 'reviewed_stale')
  assert.equal(mediaSummary.result.localPackagePosture.integrityPosture, 'blocked')
  assert.equal(mediaSummary.result.swarmSeamPosture.state, 'integrity_blocked')
  assert.equal(mediaSummary.result.swarmSeamPosture.publicSwarmProof, false)
  assert.equal(mediaSummary.result.swarmSeamPosture.swarmRuntimeActivated, false)
  assert.ok(mediaSummary.lines.some((line) =>
    line.includes('output integrity: deliveryIntact=0') &&
    line.includes('activeDeliveryIntact=0') &&
    line.includes('blocking=')
  ))
  assert.ok(mediaSummary.lines.some((line) =>
    line.startsWith('local package posture:') &&
    line.includes('localPackage=output_integrity_blocked') &&
    line.includes('review=reviewed_stale') &&
    line.includes('integrity=blocked')
  ))
  assert.ok(mediaSummary.lines.some((line) =>
    line.startsWith('swarm seam posture:') &&
    line.includes('swarmSeam=integrity_blocked') &&
    line.includes('swarmProof=false') &&
    line.includes('activation=false')
  ))
  assert.ok(mediaSummary.lines.some((line) => line.startsWith('package authority: localPackageReviews=1 | needsRework=0 | staleReviews=1 | publicationAuthorityRequests=1 | staleRequests=1 | blockingRequests=1')))
  assert.ok(mediaSummary.lines.some((line) => line.includes('package-authority:') && line.includes('current_output_integrity_blocking')))
  assert.ok(mediaSummary.lines.some((line) => line.includes('output-integrity blocking:') && line.includes('missing_export_delivery_bytes')))

  const healthSummary = await captureConsole(() => writeProjectHealth({ projectDir: dir, summary: true }))
  assert.equal(healthSummary.result.health.outputIntegritySummary.localDeliveryEvidenceIntact, 0)
  assert.equal(healthSummary.result.health.outputIntegritySummary.outputIntegrityBlockingIssues > 0, true)
  assert.equal(healthSummary.result.health.localPackagePosture.packageState, 'output_integrity_blocked')
  assert.equal(healthSummary.result.health.localPackagePosture.latestReviewPosture, 'reviewed_stale')
  assert.equal(healthSummary.result.health.localPackagePosture.integrityPosture, 'blocked')
  assert.equal(healthSummary.result.health.swarmSeamPosture.state, 'integrity_blocked')
  assert.equal(healthSummary.result.health.swarmSeamPosture.publicSwarmProof, false)
  assert.equal(healthSummary.result.health.swarmSeamPosture.swarmRuntimeActivated, false)
  assert.ok(healthSummary.result.health.blockingIssues.includes('output-integrity-blocking'))
  assert.ok(healthSummary.lines.some((line) =>
    line.includes('outputIntegrity: deliveryIntact=0') &&
    line.includes('activeDeliveryIntact=0') &&
    line.includes('blocking=')
  ))
  assert.ok(healthSummary.lines.some((line) =>
    line.startsWith('localPackagePosture:') &&
    line.includes('localPackage=output_integrity_blocked') &&
    line.includes('review=reviewed_stale') &&
    line.includes('integrity=blocked')
  ))
  assert.ok(healthSummary.lines.some((line) =>
    line.startsWith('swarmSeamPosture:') &&
    line.includes('swarmSeam=integrity_blocked') &&
    line.includes('swarmProof=false') &&
    line.includes('activation=false')
  ))
  assert.ok(healthSummary.lines.some((line) => line.includes('media-export-receipt:') && line.includes('missing_export_delivery_bytes')))

  await writeProductionAuthorityPrerequisiteReport({ projectDir: dir, quiet: true })
  await writeAuthorityHandoffCandidate({ projectDir: dir, quiet: true })
  const operatorIndex = await captureConsole(() => writeOperatorPacketIndex({ projectDir: dir }))
  assert.equal(operatorIndex.result.index.summary.localDeliveryEvidenceIntact, 0)
  assert.equal(operatorIndex.result.index.summary.outputIntegrityBlockingIssues > 0, true)
  assert.equal(operatorIndex.result.index.localPackagePosture.packageState, 'output_integrity_blocked')
  assert.equal(operatorIndex.result.index.localPackagePosture.integrityPosture, 'blocked')
  assert.equal(operatorIndex.result.index.swarmSeamPosture.state, 'integrity_blocked')
  assert.equal(operatorIndex.result.index.summary.localPackageState, 'output_integrity_blocked')
  assert.ok(operatorIndex.lines.some((line) =>
    line.includes('localDeliveryEvidenceIntact=0') &&
    line.includes('outputIntegrityBlocking=') &&
    line.includes('localPackage=output_integrity_blocked') &&
    line.includes('integrity=blocked')
  ))
  assert.ok(operatorIndex.lines.some((line) => line.includes('output-integrity blocking:') && line.includes('missing_export_delivery_bytes')))

  const edgeBundle = await captureConsole(() => writeEdgeCompatibilityBundle({ projectDir: dir }))
  assert.equal(edgeBundle.result.bundle.exportDeliverySummary.authorityPrerequisiteRefs >= 1, true)
  assert.equal(edgeBundle.result.bundle.exportDeliverySummary.authorityHandoffRefs >= 1, true)
  assert.equal(edgeBundle.result.bundle.exportDeliverySummary.localDeliveryEvidenceIntact, 0)
  assert.equal(edgeBundle.result.bundle.exportDeliverySummary.outputIntegrityBlockingIssues > 0, true)
  assert.equal(edgeBundle.result.bundle.localPackagePosture.packageState, 'output_integrity_blocked')
  assert.equal(edgeBundle.result.bundle.localPackagePosture.integrityPosture, 'blocked')
  assert.equal(edgeBundle.result.bundle.swarmSeamPosture.state, 'integrity_blocked')
  assert.equal(edgeBundle.result.bundle.studioReviewEvidence.localPackagePosture.packageState, 'output_integrity_blocked')
  assert.equal(edgeBundle.result.bundle.studioReviewEvidence.swarmSeamPosture.state, 'integrity_blocked')
  assert.ok(edgeBundle.lines.some((line) =>
    line.includes('edge source refs: authorityPrereqs=') &&
    line.includes('outputIntegrityBlocking=') &&
    line.includes('localPackage=output_integrity_blocked') &&
    line.includes('integrity=blocked')
  ))
})

test('local output integrity blocks production package when export delivery bytes drift', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-drifted-export-delivery-'))
  await runVeniceProductionRehearsal({ projectDir: dir })
  await runLocalProductionOutput({ projectDir: dir, quiet: true })
  const packageReview = JSON.parse(await readFile(path.join(dir, 'records/decisions/media-local-package-review-decision.local.json'), 'utf8'))
  const publicationRequest = JSON.parse(await readFile(path.join(dir, 'records/production/media-publication-authority-request-candidate.local.json'), 'utf8'))
  await mutateExportDeliveryFilesSameSize(dir)

  const prereqs = await createProductionAuthorityPrerequisiteReport({ projectDir: dir })
  assert.equal(prereqs.localDeliveryEvidencePresent, 1)
  assert.equal(prereqs.localDeliveryEvidenceIntact, 0)
  assert.equal(prereqs.localProductionPackageComplete, 0)
  assert.equal(prereqs.outputIntegrityBlockingIssues > 0, true)
  assert.ok(prereqs.rows[0].outputIntegrityBlockingIssueCodes.includes('export_delivery_hash_mismatch'))
  assert.equal(prereqs.productionReady, 0)
  const recordsAfterDrift = await readProjectRecords(dir)
  assert.equal(evaluateLocalPackageReviewFreshness({
    decision: packageReview,
    records: recordsAfterDrift,
    prerequisiteReport: prereqs
  }).state, 'stale')
  assert.equal(evaluatePublicationAuthorityRequestFreshness({
    candidate: publicationRequest,
    records: recordsAfterDrift,
    prerequisiteReport: prereqs
  }).state, 'stale')
})

test('render preview integrity is attention only until an export depends on it', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-render-preview-attention-'))
  await runVeniceProductionRehearsal({ projectDir: dir })
  await writeRoughCutCapsule({ projectDir: dir, quiet: true })
  await writeRoughCutReviewDecision({ projectDir: dir, quiet: true })
  await writeRenderExportCandidate({ projectDir: dir, quiet: true })
  await writeRenderAdapterContract({ projectDir: dir, quiet: true })
  await writeRenderPlanCandidate({ projectDir: dir, quiet: true })
  const render = await writeContactSheetRender({ projectDir: dir, quiet: true })
  await rm(path.join(dir, render.receipt.outputLocalRef.path), { force: true })

  const records = await readProjectRecords(dir)
  const integrity = await evaluateLocalOutputIntegrity({ projectDir: dir, records })
  assert.equal(integrity.outputIntegrityAttentionIssues, 1)
  assert.equal(integrity.outputIntegrityBlockingIssues, 0)
  assert.equal(integrity.attentionRows[0].attentionIssueCodes.includes('missing_render_preview_bytes'), true)
})

test('export depending on invalid render receipt blocks local production package completeness', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-export-invalid-render-'))
  await runVeniceProductionRehearsal({ projectDir: dir })
  await runLocalProductionOutput({ projectDir: dir, quiet: true })
  const localExport = await readProductionReceipt(dir, 'records/production/media-export-receipt.local.json')
  const renderReceipt = await readProductionReceipt(dir, localExport.sourceRenderReceiptRef.path)
  await rm(path.join(dir, renderReceipt.outputLocalRef.path), { force: true })

  const prereqs = await createProductionAuthorityPrerequisiteReport({ projectDir: dir })
  assert.equal(prereqs.localDeliveryEvidencePresent, 1)
  assert.equal(prereqs.localDeliveryEvidenceIntact, 0)
  assert.equal(prereqs.localProductionPackageComplete, 0)
  assert.ok(prereqs.rows[0].outputIntegrityBlockingIssueCodes.includes('export_depends_on_invalid_render_receipt'))
  assert.ok(prereqs.rows[0].outputIntegrityAttentionIssueCodes.includes('missing_render_preview_bytes'))
  assert.equal(prereqs.productionReady, 0)
})

test('rough cut revision regenerates local capsule from request changes', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-rough-cut-revision-'))
  await runVeniceProductionRehearsal({ projectDir: dir })
  await writeAuthorityHandoffCandidate({ projectDir: dir, quiet: true })
  const original = await writeRoughCutCapsule({ projectDir: dir, quiet: true })
  const requestChanges = await writeRoughCutReviewDecision({
    projectDir: dir,
    decision: 'request_changes',
    output: 'records/decisions/media-rough-cut-request-changes.local.json',
    quiet: true
  })

  const output = await captureConsole(() => writeRoughCutRevision({ projectDir: dir }))
  const revised = output.result.roughCut

  assert.equal(revised.schema, 'media.rough_cut_capsule.local.v1')
  assert.notEqual(revised.roughCutId, original.roughCut.roughCutId)
  assert.equal(revised.revisionPosture.revisionOfRef.id, original.roughCut.roughCutId)
  assert.equal(revised.revisionPosture.sourceChangeRequestRef.id, requestChanges.decision.decisionId)
  assert.equal(revised.revisionPosture.changesAddressedLocally, true)
  assert.equal(revised.revisionPosture.rendered, false)
  assert.equal(revised.revisionPosture.productionReady, false)
  assert.equal(revised.productionReady, false)
  assert.equal(revised.approvalAuthority, false)
  assert.equal(revised.publicationAuthorization, false)
  assert.ok(revised.sourceRefs.some((ref) => ref.id === original.roughCut.roughCutId))
  assert.ok(revised.sourceRefs.some((ref) => ref.id === requestChanges.decision.decisionId))
  assert.ok(output.lines.some((line) => line.startsWith('rough cut revision: project=venice-smoke-project')))
  assert.ok(output.lines.some((line) => line.includes('productionReady=false')))
  assert.equal(validateRequiredRecord(revised), true)

  const summary = await createMediaSummary({ projectDir: dir })
  assert.equal(summary.productionRoughCuts.reviewed, 0)
  assert.equal(summary.productionRoughCuts.changesRequested, 0)
  assert.deepEqual(summary.productionRoughCuts.attentionRows[0].issueCodes, ['rough_cut_review_missing'])

  const prereqs = await createProductionAuthorityPrerequisiteReport({ projectDir: dir })
  assert.equal(prereqs.roughCutChangesRequested, 0)
  assert.equal(prereqs.rows[0].roughCutReviewPosture.state, 'rough-cut-review-missing')
})

test('rough cut capsule orders two accepted production items', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-rough-cut-two-items-'))
  await runVeniceProductionRehearsal({ projectDir: dir })
  const secondAssetRecord = await addSecondAcceptedProductionAssetFixture(dir)
  const secondAsset = JSON.parse(await readFile(path.join(dir, secondAssetRecord), 'utf8'))
  const firstApproval = JSON.parse(await readFile(path.join(dir, 'records/approvals/promoted-candidate-accepted-approval-proposal.local.json'), 'utf8'))
  const firstDecision = JSON.parse(await readFile(path.join(dir, firstApproval.localDecisionRef.path), 'utf8'))
  const secondDecisionRecord = 'records/decisions/media-operator-decision-second.local.json'
  const secondDecision = {
    ...firstDecision,
    decisionId: `${firstDecision.decisionId}-second`,
    subjectRef: {
      ...(firstDecision.subjectRef ?? {}),
      id: secondAsset.assetId,
      path: secondAssetRecord
    },
    selectedAssetId: secondAsset.assetId,
    createdAt: '2026-05-19T00:00:02.000Z'
  }
  await writeFile(path.join(dir, secondDecisionRecord), `${JSON.stringify(secondDecision, null, 2)}\n`)
  await writeApprovalProposal({
    projectDir: dir,
    decision: secondDecisionRecord,
    asset: secondAssetRecord,
    output: 'records/approvals/media-approval-proposal-second.local.json'
  })
  await writeByteDescriptorProposals({ projectDir: dir })
  await writeLocalLayerResourceRefCandidates({ projectDir: dir })

  await writeProductionAssetCapsule({
    projectDir: dir,
    assetRecord: 'records/assets/promoted-candidate-accepted.local.json',
    output: 'records/production/media-production-asset-capsule-first.local.json',
    quiet: true
  })
  await writeProductionAssetCapsule({
    projectDir: dir,
    assetRecord: secondAssetRecord,
    output: 'records/production/media-production-asset-capsule-second.local.json',
    quiet: true
  })
  await writeProductionBundle({ projectDir: dir, quiet: true })
  await writeAuthorityHandoffCandidate({ projectDir: dir, quiet: true })

  const output = await writeRoughCutCapsule({ projectDir: dir, quiet: true })
  const roughCut = output.roughCut

  assert.equal(roughCut.orderedItems.length, 2)
  assert.deepEqual(roughCut.orderedItems.map((item) => item.order), [1, 2])
  assert.deepEqual(roughCut.orderedItems.map((item) => item.localRef.path), [
    'media/accepted/venice-live-smoke-0.png',
    'media/accepted/venice-live-smoke-1.png'
  ])
  assert.equal(new Set(roughCut.orderedItems.map((item) => item.itemId)).size, 2)
  assert.equal(new Set(roughCut.orderedItems.map((item) => item.productionAssetCapsuleRef.id)).size, 2)
  assert.equal(roughCut.assemblyPosture.itemCount, 2)
  assert.equal(roughCut.renderPosture.rendered, false)
  assert.equal(roughCut.productionReady, false)
  assert.equal(roughCut.approvalAuthority, false)
  assert.equal(validateRequiredRecord(roughCut), true)

  const review = await writeRoughCutReviewDecision({ projectDir: dir, quiet: true })
  assert.equal(review.decision.roughCutReview.itemCount, 2)

  const renderExport = await writeRenderExportCandidate({ projectDir: dir, quiet: true })
  assert.equal(renderExport.candidate.orderedItemRefs.length, 2)
  assert.deepEqual(renderExport.candidate.orderedItemRefs.map((item) => item.order), [1, 2])
  assert.equal(renderExport.candidate.renderPosture.renderPerformed, false)
  assert.equal(renderExport.candidate.exportPosture.exportPerformed, false)
  assert.equal(renderExport.candidate.productionReady, false)

  const adapter = await writeRenderAdapterContract({ projectDir: dir, quiet: true })
  assert.equal(adapter.contract.orderedItems.length, 2)
  const renderPlan = await writeRenderPlanCandidate({ projectDir: dir, quiet: true })
  assert.equal(renderPlan.plan.orderedItems.length, 2)
  assert.deepEqual(renderPlan.plan.orderedItems.map((item) => item.itemRef.order), [1, 2])

  const contactSheet = await writeContactSheetRender({ projectDir: dir, tileSize: 64, quiet: true })
  assert.equal(contactSheet.receipt.orderedItems.length, 2)
  assert.equal(contactSheet.receipt.renderPerformed, true)
  assert.equal(contactSheet.receipt.exportPerformed, false)
  assert.equal(contactSheet.receipt.productionReady, false)

  const ffmpegRender = await writeFfmpegRender({
    projectDir: dir,
    secondsPerItem: 1,
    width: 320,
    height: 180,
    fps: 12,
    quiet: true
  })
  assert.equal(ffmpegRender.receipt.orderedItems.length, 2)
  assert.equal(ffmpegRender.receipt.output.durationSeconds, 2)
  assert.equal(ffmpegRender.receipt.renderPerformed, true)
  assert.equal(ffmpegRender.receipt.exportPerformed, false)

  const exportCandidate = await writeExportCandidate({ projectDir: dir, quiet: true })
  assert.equal(exportCandidate.candidate.orderedItemRefs.length, 2)
  assert.equal(exportCandidate.candidate.sourceRenderReceiptRef.id, ffmpegRender.receipt.renderReceiptId)
  assert.equal(exportCandidate.candidate.exportPosture.exportPerformed, false)
  assert.equal(exportCandidate.candidate.productionReady, false)

  const exportPlan = await writeExportPlanCandidate({ projectDir: dir, quiet: true })
  assert.equal(exportPlan.plan.orderedItems.length, 2)
  assert.deepEqual(exportPlan.plan.orderedItems.map((item) => item.order), [1, 2])

  const localExport = await writeLocalExportPackage({ projectDir: dir, quiet: true })
  assert.equal(localExport.receipt.orderedItems.length, 2)
  assert.equal(localExport.receipt.deliveryCreated, true)
  assert.equal(localExport.receipt.exportPerformed, true)
  assert.equal(localExport.receipt.publicationAuthorization, false)
  assert.equal(localExport.receipt.productionReady, false)

  const ffmpegExport = await writeFfmpegExport({
    projectDir: dir,
    secondsPerItem: 1,
    width: 320,
    height: 180,
    fps: 12,
    quiet: true
  })
  assert.equal(ffmpegExport.receipt.orderedItems.length, 2)
  assert.equal(ffmpegExport.receipt.output.durationSeconds, 2)
  assert.equal(ffmpegExport.receipt.deliveryCreated, true)
  assert.equal(ffmpegExport.receipt.exportPerformed, true)
  assert.equal(ffmpegExport.receipt.publicationAuthorization, false)
  assert.equal(ffmpegExport.receipt.productionReady, false)

  const summary = await createMediaSummary({ projectDir: dir })
  assert.equal(summary.productionRoughCuts.itemRefs, 2)
  assert.equal(summary.renderReceipts.total, 2)
  assert.equal(summary.renderReceipts.renderPerformed, 2)
  assert.equal(summary.exportReceipts.total, 2)
  assert.equal(summary.exportReceipts.localPackageCopyExportReceipts, 1)
  assert.equal(summary.exportReceipts.ffmpegDeliveryReceipts, 1)
  assert.equal(summary.exportReceipts.localDeliveryEvidencePresent, 2)
  assert.equal(summary.exportReceipts.rows.filter((row) => row.localDeliveryEvidencePresent).length, 2)
  assert.ok(summary.exportReceipts.rows.every((row) => row.sourceRoughCutId === roughCut.roughCutId))
  assert.ok(summary.exportReceipts.rows.every((row) => row.sourceRenderReceiptId === ffmpegRender.receipt.renderReceiptId))

  const prereqs = await createProductionAuthorityPrerequisiteReport({ projectDir: dir })
  assert.equal(prereqs.candidates, 2)
  assert.equal(prereqs.localProductionPackageComplete, 2)
  assert.equal(prereqs.exportReceipts, 2)
  assert.equal(prereqs.ffmpegDeliveryReceipts, 1)
  assert.equal(prereqs.localDeliveryEvidencePresent, 2)
  assert.equal(prereqs.pendingAuthority, 2)
  assert.equal(prereqs.productionReady, 0)

  const indexOutput = await captureConsole(() => writeOperatorPacketIndex({ projectDir: dir }))
  assert.equal(indexOutput.result.index.summary.roughCutCapsules, 1)
  assert.equal(indexOutput.result.index.summary.renderReceipts, 2)
  assert.equal(indexOutput.result.index.summary.exportReceipts, 2)
  assert.equal(indexOutput.result.index.summary.ffmpegDeliveryReceipts, 1)
  assert.equal(indexOutput.result.index.summary.localDeliveryEvidencePresent, 2)
  assert.ok(indexOutput.lines.some((line) => line.includes('roughCuts=1')))
  assert.ok(indexOutput.lines.some((line) => line.includes('exportReceipts=2')))
  assert.ok(indexOutput.lines.some((line) =>
    line.includes('export receipt:') &&
    line.includes('kind=local-ffmpeg-review-delivery') &&
    line.includes('localDeliveryEvidence=true') &&
    line.includes(`roughCut=${roughCut.roughCutId}`) &&
    line.includes(`renderReceipt=${ffmpegRender.receipt.renderReceiptId}`)
  ))

  const compatibility = await writeEdgeCompatibilityBundle({ projectDir: dir })
  assert.equal(compatibility.bundle.exportDeliverySummary.exportReceipts, 2)
  assert.equal(compatibility.bundle.exportDeliverySummary.ffmpegDeliveryReceipts, 1)
  assert.equal(compatibility.bundle.exportDeliverySummary.localDeliveryEvidencePresent, 2)
  assert.equal(compatibility.bundle.exportDeliverySummary.rows.length, 2)
  assert.equal(compatibility.bundle.exportDeliverySummary.productionReady, false)
  assert.equal(compatibility.bundle.exportDeliverySummary.publicationAuthorization, false)
})

test('rough cut summaries detect stale production bundle changes', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-rough-cut-stale-bundle-'))
  await runVeniceProductionRehearsal({ projectDir: dir })
  await writeAuthorityHandoffCandidate({ projectDir: dir, quiet: true })
  const roughCutResult = await writeRoughCutCapsule({ projectDir: dir, quiet: true })
  const originalRoughCut = roughCutResult.roughCut

  const secondAssetRecord = await addSecondAcceptedProductionAssetFixture(dir)
  await writeProductionAssetCapsule({
    projectDir: dir,
    assetRecord: secondAssetRecord,
    output: 'records/production/media-production-asset-capsule-second.local.json',
    quiet: true
  })
  const newBundle = await writeProductionBundle({ projectDir: dir, quiet: true })
  assert.ok(!originalRoughCut.sourceRefs.some((ref) => ref.id === newBundle.bundle.bundleId))

  const summary = await createMediaSummary({ projectDir: dir })
  assert.equal(summary.productionRoughCuts.attentionRows.length, 1)
  assert.deepEqual(summary.productionRoughCuts.attentionRows[0].issueCodes, ['rough_cut_stale_production_bundle'])
  assert.ok(summary.productionRoughCuts.attentionRows[0].nextAction.includes('Regenerate the rough-cut capsule'))

  const health = await writeProjectHealth({ projectDir: dir, summary: true })
  assert.deepEqual(health.health.productionRoughCutHealthExplanations[0].issueCodes, ['rough_cut_stale_production_bundle'])

  const index = await writeOperatorPacketIndex({ projectDir: dir })
  assert.equal(index.index.summary.roughCutCapsulesNeedingAttention, 1)
  assert.ok(index.index.roughCutCapsules[0].issueCodes.includes('rough_cut_stale_production_bundle'))
})

test('rough cut defer surfaces local deferred review posture', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-rough-cut-defer-'))
  await runVeniceProductionRehearsal({ projectDir: dir })
  await writeAuthorityHandoffCandidate({ projectDir: dir, quiet: true })
  await writeRoughCutCapsule({ projectDir: dir })

  const decisionOutput = await captureConsole(() => writeRoughCutReviewDecision({
    projectDir: dir,
    decision: 'defer',
    output: 'records/decisions/media-rough-cut-defer.local.json'
  }))
  const decision = decisionOutput.result.decision
  assert.equal(decision.decisionType, 'defer')
  assert.equal(decision.reviewAcknowledged, false)
  assert.equal(decision.requestChanges, false)
  assert.equal(decision.deferred, true)
  assert.equal(decision.executionPerformed, false)
  assert.equal(decision.authorityGranted, false)

  const summary = await createMediaSummary({ projectDir: dir })
  assert.equal(summary.productionRoughCuts.reviewed, 0)
  assert.equal(summary.productionRoughCuts.changesRequested, 0)
  assert.equal(summary.productionRoughCuts.deferred, 1)
  assert.deepEqual(summary.productionRoughCuts.attentionRows[0].issueCodes, ['rough_cut_review_deferred'])
  assert.ok(summary.productionRoughCuts.attentionRows[0].nextAction.includes('Resolve deferred'))

  const health = await writeProjectHealth({ projectDir: dir, summary: true })
  assert.deepEqual(health.health.productionRoughCutHealthExplanations[0].issueCodes, ['rough_cut_review_deferred'])

  const index = await writeOperatorPacketIndex({ projectDir: dir })
  assert.equal(index.index.summary.roughCutCapsulesNeedingAttention, 1)
  assert.ok(index.index.roughCutCapsules[0].issueCodes.includes('rough_cut_review_deferred'))

  const prereqs = await createProductionAuthorityPrerequisiteReport({ projectDir: dir })
  assert.equal(prereqs.roughCutReviewed, 0)
  assert.equal(prereqs.roughCutChangesRequested, 0)
  assert.equal(prereqs.roughCutDeferred, 1)
  assert.equal(prereqs.rows[0].roughCutReviewPosture.state, 'rough-cut-review-deferred')
  assert.ok(prereqs.rows[0].safeNextAction.includes('deferred rough-cut review'))
})

test('project health reports missing production asset capsules for accepted provider assets', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-capsule-health-'))
  await runVeniceOperationalLoop({
    projectDir: dir,
    decision: 'accepted'
  })

  const before = await writeProjectHealth({ projectDir: dir, summary: true })
  const missing = before.health.productionCapsuleHealthExplanations
    .find((entry) => entry.issueCodes.includes('missing_production_asset_capsule'))

  assert.ok(missing)
  assert.equal(missing.subjectKind, 'media-production-asset-capsule')
  assert.equal(missing.localOnly, true)
  assert.equal(missing.meshTruth, false)
  assert.equal(missing.byteAvailabilityProof, false)
  assert.equal(missing.resourceAdmission, false)
  assert.ok(before.health.operatorHealthExplanations.some((entry) => entry.issueCodes.includes('missing_production_asset_capsule')))
  assert.ok(before.health.blockingIssues.includes('production-capsule-attention'))

  await writeApprovalProposal({
    projectDir: dir,
    decision: 'records/decisions/promoted-candidate-accepted-decision.local.json',
    asset: 'records/assets/promoted-candidate-accepted.local.json',
    output: 'records/approvals/promoted-candidate-accepted-approval-proposal.local.json'
  })
  await writeProductionAssetCapsule({ projectDir: dir, quiet: true })

  const after = await writeProjectHealth({ projectDir: dir, summary: true })
  assert.equal(
    after.health.productionCapsuleHealthExplanations.some((entry) => entry.issueCodes.includes('missing_production_asset_capsule')),
    false
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
  assert.equal(result.index.safeNextAction, 'Run npm run bytes:proposal, then npm run resource:refs.')
  assert.equal(result.index.projectSummaries[1].safeNextAction, 'Run npm run bytes:proposal, then npm run resource:refs.')
  assert.ok(lines.some((line) => line === 'safeNextAction: Run npm run bytes:proposal, then npm run resource:refs.'))
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

test('cross-project operator index surfaces output delivery posture from project health', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-cross-project-output-delivery-'))
  await runVeniceProductionRehearsal({ projectDir: dir })
  await runLocalProductionOutput({
    projectDir: dir,
    createdAt: '2026-05-19T00:00:00.000Z',
    quiet: true
  })
  await runLocalProductionOutput({
    projectDir: dir,
    disableFfmpeg: true,
    createdAt: '2026-05-19T00:10:00.000Z',
    quiet: true
  })
  await writeProjectHealth({ projectDir: dir, summary: true })

  const baseDir = '/'
  const indexRoot = await mkdtemp(path.join(os.tmpdir(), 'media-studio-cross-project-output-index-'))
  const inputListPath = path.join(indexRoot, 'input-list.local.json')
  const outputPath = path.join(indexRoot, 'cross-project-index.local.json')
  const inputList = createCrossProjectInputList([
    { projectId: 'output-delivery-project', rootPath: slash(path.relative(baseDir, dir)) }
  ])
  await writeFile(inputListPath, `${JSON.stringify(inputList, null, 2)}\n`)

  const { result, lines } = await captureConsole(() => writeCrossProjectOperatorIndex({
    baseDir,
    inputList: slash(path.relative(baseDir, inputListPath)),
    output: slash(path.relative(baseDir, outputPath))
  }))

  assert.equal(result.index.summary.activeDeliveryReceipts, 1)
  assert.equal(result.index.summary.historicalExportReceipts, 1)
  assert.equal(result.index.summary.currentExportReceiptAttention, 0)
  assert.equal(result.index.summary.historicalExportReceiptAttention, 1)
  assert.equal(result.index.projectSummaries[0].outputDeliverySummary.activeDeliveryReceipts, 1)
  assert.equal(result.index.projectSummaries[0].outputDeliverySummary.historicalExportReceipts, 1)
  assert.equal(result.index.projectSummaries[0].outputDeliverySummary.activeDeliveryEvidenceIntact, 1)
  assert.equal(result.index.projectSummaries[0].outputDeliverySummary.historicalExportReceiptAttention, 1)
  assert.ok(lines.some((line) => line.includes('activeDeliveries=1') &&
    line.includes('historicalExportReceipts=1') &&
    line.includes('currentExportReceiptAttention=0') &&
    line.includes('historicalExportReceiptAttention=1')))
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

test('cross-project operator index surfaces Layer interop attention from operator index refs', async () => {
  const baseDir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-cross-project-layer-'))
  const projectDir = path.join(baseDir, 'layer-mismatch-project')
  await runVeniceProductionRehearsal({ projectDir })
  await writeProductionAuthorityPrerequisiteReport({
    projectDir,
    layerRef: 'layer:operator-local:operator-alpha',
    layerProfileRef: 'layer-profile:operator-local:v0:alpha',
    continuityRef: 'layer-continuity-ref:operator-local:alpha',
    desyncPostureRef: 'layer-desync-posture:operator-local:alpha',
    rbcProfileRefs: ['rbc-profile:operator-local-alpha']
  })
  await writeAuthorityHandoffCandidate({
    projectDir,
    quiet: true,
    layerRef: 'layer:operator-local:operator-beta',
    layerProfileRef: 'layer-profile:operator-local:v0:beta',
    continuityRef: 'layer-continuity-ref:operator-local:beta',
    desyncPostureRef: 'layer-desync-posture:operator-local:beta',
    rbcProfileRefs: ['rbc-profile:operator-local-beta']
  })
  await captureConsole(() => writeOperatorPacketIndex({ projectDir }))

  const inputList = {
    schema: 'media.cross_project_inspection_input_list.local.v1',
    inputListId: 'layer-interop-cross-project-fixture',
    createdAt: '2026-05-20T00:00:00.000Z',
    mode: 'standalone-local',
    projects: [{
      projectId: 'layer-mismatch-project',
      label: 'Layer mismatch project',
      rootRef: {
        kind: 'local-directory',
        id: 'layer-mismatch-project',
        schema: 'media.local_ref.v1',
        path: 'layer-mismatch-project',
        localOnly: true
      },
      artifactRefs: {
        operatorPacketIndex: {
          kind: 'media-operator-packet-index',
          id: 'operator-packet-index-venice-smoke-project',
          schema: 'media.operator_packet_index.local.v1',
          path: 'records/exports/media-operator-packet-index.local.json',
          localOnly: true
        }
      }
    }],
    warnings: [
      'Layer interop cross-project fixture only.'
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

  const { result, lines } = await captureConsole(() => writeCrossProjectOperatorIndex({
    baseDir,
    inputList: 'input-list.local.json',
    output: 'cross-project-layer.local.json'
  }))

  assert.equal(result.index.summary.layerInteropProjects, 1)
  assert.equal(result.index.summary.layerInteropAttention, 1)
  assert.equal(result.index.summary.attentionRows, 1)
  assert.equal(result.index.projectSummaries[0].layerInterop.state, 'layer-refs-attached-review-only')
  assert.deepEqual(result.index.projectSummaries[0].layerInterop.issueCodes, [
    'layer_ref_mismatch',
    'layer_profile_ref_mismatch',
    'layer_continuity_ref_mismatch',
    'layer_desync_posture_ref_mismatch',
    'layer_rbc_profile_ref_mismatch'
  ])
  assert.equal(result.index.projectSummaries[0].layerInterop.layerAuthority, false)
  assert.equal(result.index.projectSummaries[0].layerInterop.continuityClaimed, false)
  assert.equal(result.index.projectSummaries[0].safeNextAction, 'Regenerate authority prerequisite and handoff records with the same intended Layer refs, or remove stale authority posture records.')
  assert.ok(lines.some((line) => line.includes('layerInterop=1') && line.includes('layerAttention=1')))
  assert.ok(lines.some((line) => line.includes('layer interop: state=layer-refs-attached-review-only')))
  assert.equal(validateRequiredRecord(inputList), true)
  assert.equal(validateRequiredRecord(result.index), true)
})

test('cross-project operator index carries local package and swarm posture from operator index refs', async () => {
  const baseDir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-cross-project-swarm-operator-'))
  const readyDir = path.join(baseDir, 'ready-project')
  const holdDir = path.join(baseDir, 'hold-project')

  await runVeniceProductionRehearsal({ projectDir: readyDir })
  await runLocalProductionOutput({ projectDir: readyDir, quiet: true })
  await writeStudioPressureArtifacts({ projectDir: readyDir, adapterChain: true, quiet: true })
  await writeProjectHealth({ projectDir: readyDir, summary: true })
  await writeOperatorPacketIndex({ projectDir: readyDir, quiet: true })

  await runVeniceProductionRehearsal({ projectDir: holdDir })
  await runLocalProductionOutput({ projectDir: holdDir, quiet: true })
  await writeStudioPressureArtifacts({
    projectDir: holdDir,
    adapterChain: true,
    adapterDecision: 'rejected',
    quiet: true
  })
  await writeProjectHealth({ projectDir: holdDir, summary: true })
  await writeOperatorPacketIndex({ projectDir: holdDir, quiet: true })

  const inputList = createCrossProjectInputListWithArtifactRefs([
    {
      projectId: 'ready-project',
      rootPath: 'ready-project',
      artifactRefs: {
        projectHealth: crossProjectArtifactRef('projectHealth'),
        operatorPacketIndex: crossProjectArtifactRef('operatorPacketIndex')
      }
    },
    {
      projectId: 'hold-project',
      rootPath: 'hold-project',
      artifactRefs: {
        projectHealth: crossProjectArtifactRef('projectHealth'),
        operatorPacketIndex: crossProjectArtifactRef('operatorPacketIndex')
      }
    }
  ], { inputListId: 'swarm-operator-index-fixture' })
  await writeFile(path.join(baseDir, 'input-list.local.json'), `${JSON.stringify(inputList, null, 2)}\n`)

  const { result, lines } = await captureConsole(() => writeCrossProjectOperatorIndex({
    baseDir,
    inputList: 'input-list.local.json',
    output: 'cross-project-swarm.local.json'
  }))

  assert.equal(result.index.summary.localPackageComplete, 2)
  assert.equal(result.index.summary.localPackageAttention, 0)
  assert.equal(result.index.summary.swarmReady, 1)
  assert.equal(result.index.summary.swarmAttention, 1)
  assert.equal(result.index.summary.adapterHold, 1)
  assert.equal(result.index.summary.integrityBlocked, 0)
  assert.equal(result.index.summary.attentionRows, 1)
  assert.equal(result.index.projectSummaries[0].localPackagePosture.sourceRef.path, 'ready-project/records/exports/media-operator-packet-index.local.json')
  assert.equal(result.index.projectSummaries[0].swarmSeamPosture.state, 'ready_for_review_only_swarm_pressure')
  assert.equal(result.index.projectSummaries[0].swarmSeamPosture.publicSwarmProof, false)
  assert.equal(result.index.projectSummaries[0].swarmSeamPosture.swarmRuntimeActivated, false)
  assert.equal(result.index.projectSummaries[0].swarmSeamPosture.edgeDispatch, false)
  assert.equal(result.index.projectSummaries[0].swarmSeamPosture.layerAdmission, false)
  assert.equal(result.index.projectSummaries[0].studioSourcePressureAdapterSummary.latestDecisionStatus, 'approved_bounded_studio_source_pressure_observation')
  assert.equal(result.index.projectSummaries[1].swarmSeamPosture.state, 'adapter_hold')
  assert.equal(result.index.projectSummaries[1].studioSourcePressureAdapterSummary.latestDecisionStatus, 'rejected_bounded_studio_source_pressure_observation')
  assert.equal(result.index.projectSummaries[1].studioSourcePressureAdapterSummary.observationStatus, 'skipped')
  assert.equal(result.index.projectSummaries[1].safeNextAction, 'Hold Studio source-pressure observation; keep candidate and decision as review-only local evidence.')
  assert.ok(lines.some((line) => line.includes('localPackageComplete=2') &&
    line.includes('localPackageAttention=0') &&
    line.includes('swarmReady=1') &&
    line.includes('swarmAttention=1') &&
    line.includes('swarmProof=false') &&
    line.includes('activation=false')))
  assert.ok(lines.some((line) => line.includes('swarm seam: state=adapter_hold') &&
    line.includes('adapter=rejected_bounded_studio_source_pressure_observation') &&
    line.includes('observation=skipped') &&
    line.includes('activation=false')))
  assert.equal(validateRequiredRecord(result.index), true)
})

test('cross-project operator index carries local proof posture from operator index refs', async () => {
  const baseDir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-cross-project-proof-'))
  const readyDir = path.join(baseDir, 'ready-proof-project')
  const attentionDir = path.join(baseDir, 'attention-proof-project')

  await createLocalProofFixtureProject(readyDir)
  await runLocalProofRehearsal({ projectDir: readyDir, quiet: true })

  await createLocalProofFixtureProject(attentionDir)
  await runLocalProofRehearsal({
    projectDir: attentionDir,
    adapterDecision: 'rejected',
    quiet: true
  })

  const inputList = createCrossProjectInputListWithArtifactRefs([
    {
      projectId: 'ready-proof-project',
      rootPath: 'ready-proof-project',
      artifactRefs: {
        operatorPacketIndex: crossProjectArtifactRef('operatorPacketIndex')
      }
    },
    {
      projectId: 'attention-proof-project',
      rootPath: 'attention-proof-project',
      artifactRefs: {
        operatorPacketIndex: crossProjectArtifactRef('operatorPacketIndex')
      }
    }
  ], { inputListId: 'local-proof-cross-project-fixture' })
  await writeFile(path.join(baseDir, 'input-list.local.json'), `${JSON.stringify(inputList, null, 2)}\n`)

  const { result, lines } = await captureConsole(() => writeCrossProjectOperatorIndex({
    baseDir,
    inputList: 'input-list.local.json',
    output: 'cross-project-proof.local.json'
  }))

  assert.equal(result.index.summary.localProofReady, 1)
  assert.equal(result.index.summary.localProofAttention, 1)
  assert.equal(result.index.summary.localProofFresh, 2)
  assert.equal(result.index.summary.localProofStale, 0)
  assert.equal(result.index.summary.spineReadinessFresh, 0)
  assert.equal(result.index.summary.spineReadinessStale, 0)
  assert.equal(result.index.summary.spineReadinessInherited, 2)
  assert.equal(result.index.projectSummaries[0].localProofRehearsalSummary.latestProofState, 'ready')
  assert.equal(result.index.projectSummaries[0].localProofRehearsalSummary.proofFreshness, 'fresh')
  assert.equal(result.index.projectSummaries[0].localProofRehearsalSummary.publicSwarmProof, false)
  assert.equal(result.index.projectSummaries[0].localProofRehearsalSummary.swarmRuntimeActivated, false)
  assert.equal(result.index.projectSummaries[0].adjacentSeamReadiness.readinessFreshness, 'inherited')
  assert.equal(result.index.projectSummaries[1].localProofRehearsalSummary.latestProofState, 'attention')
  assert.equal(result.index.projectSummaries[1].localProofRehearsalSummary.proofFreshness, 'fresh')
  assert.equal(result.index.projectSummaries[1].localProofRehearsalSummary.observationStatus, 'skipped')
  assert.equal(result.index.projectSummaries[1].localProofRehearsalSummary.edgeDispatch, false)
  assert.equal(result.index.projectSummaries[1].adjacentSeamReadiness.readinessFreshness, 'inherited')
  assert.equal(result.index.projectSummaries[1].safeNextAction, 'Hold Studio source-pressure observation; keep candidate and decision as review-only local evidence.')
  assert.ok(lines.some((line) => line.includes('localProofReady=1') &&
    line.includes('localProofAttention=1') &&
    line.includes('localProofFresh=2') &&
    line.includes('localProofStale=0') &&
    line.includes('spineInherited=2') &&
    line.includes('swarmProof=false') &&
    line.includes('activation=false')))
  assert.ok(lines.some((line) => line.includes('local proof: proof=attention') &&
    line.includes('proofFreshness=fresh') &&
    line.includes('observation=skipped') &&
    line.includes('activation=false')))
  assert.equal(validateRequiredRecord(result.index), true)
})

test('cross-project operator index carries proof drill attention reasons from operator refs', async () => {
  const baseDir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-cross-project-proof-drill-'))
  const projectDir = path.join(baseDir, 'drill-attention-project')
  await createLocalProofFixtureProject(projectDir)
  await runLocalProofRehearsal({ projectDir, drill: true, quiet: true })

  const proofPath = path.join(projectDir, 'records/exports/media-studio-local-proof-rehearsal.local.json')
  const proof = JSON.parse(await readFile(proofPath, 'utf8'))
  proof.drillSummary = {
    ...proof.drillSummary,
    drillStatus: 'attention',
    checks: proof.drillSummary?.checks ?? 1,
    passedChecks: Math.max((proof.drillSummary?.checks ?? 1) - 1, 0),
    attentionChecks: 1,
    attentionRows: [
      {
        check: 'operator-adapter-decision',
        status: 'attention',
        issueCode: 'operator_adapter_decision_mismatch',
        expected: 'approved_bounded_studio_source_pressure_observation',
        actual: 'rejected_bounded_studio_source_pressure_observation',
        localOnly: true,
        operatorGuidanceOnly: true
      }
    ],
    safeNextAction: 'Run npm run proof:local -- --drill to refresh local proof rehearsal evidence and drill surfaces.'
  }
  proof.summary = {
    ...proof.summary,
    drillStatus: 'attention',
    drillChecks: proof.drillSummary.checks,
    drillAttention: 1
  }
  await writeFile(proofPath, `${JSON.stringify(proof, null, 2)}\n`)
  await writeOperatorPacketIndex({ projectDir, quiet: true })

  const inputList = createCrossProjectInputListWithArtifactRefs([
    {
      projectId: 'drill-attention-project',
      rootPath: 'drill-attention-project',
      artifactRefs: {
        operatorPacketIndex: crossProjectArtifactRef('operatorPacketIndex')
      }
    }
  ], { inputListId: 'local-proof-drill-cross-project-fixture' })
  await writeFile(path.join(baseDir, 'input-list.local.json'), `${JSON.stringify(inputList, null, 2)}\n`)

  const { result, lines } = await captureConsole(() => writeCrossProjectOperatorIndex({
    baseDir,
    inputList: 'input-list.local.json',
    output: 'cross-project-proof-drill.local.json'
  }))

  assert.equal(result.index.summary.localProofAttention, 1)
  assert.equal(result.index.summary.localProofDrillAttention, 1)
  assert.deepEqual(result.index.projectSummaries[0].localProofRehearsalSummary.drillAttentionReasons, [
    'operator_adapter_decision_mismatch'
  ])
  assert.ok(lines.some((line) => line.includes('local proof: proof=ready') &&
    line.includes('proofDrill=attention') &&
    line.includes('drillAttention=1') &&
    line.includes('drillAttentionReasons=operator_adapter_decision_mismatch') &&
    line.includes('activation=false')))
  assert.equal(validateRequiredRecord(result.index), true)
})

test('cross-project operator index falls back to project health for local package and swarm posture', async () => {
  const baseDir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-cross-project-swarm-health-'))
  const projectDir = path.join(baseDir, 'health-only-project')
  await runVeniceProductionRehearsal({ projectDir })
  await runLocalProductionOutput({ projectDir, quiet: true })
  await writeStudioPressureArtifacts({ projectDir, adapterChain: true, quiet: true })
  await writeProjectHealth({ projectDir, summary: true })

  const inputList = createCrossProjectInputListWithArtifactRefs([
    {
      projectId: 'health-only-project',
      rootPath: 'health-only-project',
      artifactRefs: {
        projectHealth: crossProjectArtifactRef('projectHealth')
      }
    }
  ], { inputListId: 'swarm-health-fallback-fixture' })
  await writeFile(path.join(baseDir, 'input-list.local.json'), `${JSON.stringify(inputList, null, 2)}\n`)

  const { result } = await captureConsole(() => writeCrossProjectOperatorIndex({
    baseDir,
    inputList: 'input-list.local.json',
    output: 'cross-project-health-fallback.local.json'
  }))

  assert.equal(result.index.summary.localPackageComplete, 1)
  assert.equal(result.index.summary.localPackageAttention, 0)
  assert.equal(result.index.summary.swarmReady, 1)
  assert.equal(result.index.summary.swarmAttention, 0)
  assert.equal(result.index.summary.adapterHold, 0)
  assert.equal(result.index.projectSummaries[0].localPackagePosture.sourceRef.path, 'health-only-project/records/manifests/media-project-health.local.json')
  assert.equal(result.index.projectSummaries[0].swarmSeamPosture.sourceRef.path, 'health-only-project/records/manifests/media-project-health.local.json')
  assert.equal(result.index.projectSummaries[0].studioSourcePressureAdapterSummary.sourceRef.path, 'health-only-project/records/manifests/media-project-health.local.json')
  assert.equal(result.index.projectSummaries[0].swarmSeamPosture.state, 'ready_for_review_only_swarm_pressure')
  assert.equal(result.index.projectSummaries[0].safeNextAction, 'No local cross-project attention row is blocking inspection.')
  assert.equal(validateRequiredRecord(result.index), true)
})

test('cross-project operator index reports integrity-blocked posture as local attention', async () => {
  const baseDir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-cross-project-integrity-blocked-'))
  const projectDir = path.join(baseDir, 'integrity-project')
  await runVeniceProductionRehearsal({ projectDir })
  await runLocalProductionOutput({ projectDir, quiet: true })
  await writeStudioPressureArtifacts({ projectDir, adapterChain: true, quiet: true })
  await removeExportDeliveryFiles(projectDir)
  await writeProjectHealth({ projectDir, summary: true })
  await writeProductionAuthorityPrerequisiteReport({ projectDir, quiet: true })
  await writeAuthorityHandoffCandidate({ projectDir, quiet: true })
  await writeOperatorPacketIndex({ projectDir, quiet: true })

  const inputList = createCrossProjectInputListWithArtifactRefs([
    {
      projectId: 'integrity-project',
      rootPath: 'integrity-project',
      artifactRefs: {
        projectHealth: crossProjectArtifactRef('projectHealth'),
        operatorPacketIndex: crossProjectArtifactRef('operatorPacketIndex')
      }
    }
  ], { inputListId: 'swarm-integrity-blocked-fixture' })
  await writeFile(path.join(baseDir, 'input-list.local.json'), `${JSON.stringify(inputList, null, 2)}\n`)

  const { result, lines } = await captureConsole(() => writeCrossProjectOperatorIndex({
    baseDir,
    inputList: 'input-list.local.json',
    output: 'cross-project-integrity-blocked.local.json'
  }))

  assert.equal(result.index.summary.localPackageComplete, 0)
  assert.equal(result.index.summary.localPackageAttention, 1)
  assert.equal(result.index.summary.swarmReady, 0)
  assert.equal(result.index.summary.swarmAttention, 1)
  assert.equal(result.index.summary.adapterHold, 0)
  assert.equal(result.index.summary.integrityBlocked, 1)
  assert.equal(result.index.summary.attentionRows, 1)
  assert.equal(result.index.projectSummaries[0].localPackagePosture.packageState, 'output_integrity_blocked')
  assert.equal(result.index.projectSummaries[0].localPackagePosture.integrityPosture, 'blocked')
  assert.equal(result.index.projectSummaries[0].swarmSeamPosture.state, 'integrity_blocked')
  assert.equal(result.index.projectSummaries[0].swarmSeamPosture.publicSwarmProof, false)
  assert.equal(result.index.projectSummaries[0].swarmSeamPosture.swarmRuntimeActivated, false)
  assert.ok(result.index.projectSummaries[0].blockingIssues.includes('output-integrity-blocking'))
  assert.notEqual(result.index.projectSummaries[0].safeNextAction, result.index.projectSummaries[0].swarmSeamPosture.safeNextAction)
  assert.ok(lines.some((line) => line.includes('localPackageAttention=1') &&
    line.includes('swarmAttention=1') &&
    line.includes('activation=false')))
  assert.ok(lines.some((line) => line.includes('swarm seam: state=integrity_blocked') &&
    line.includes('swarmProof=false') &&
    line.includes('activation=false')))
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

test('committed cross-project local proof fixture validates and runs', async () => {
  const fixtureRoot = 'examples/inspection-fixtures'
  const inputList = JSON.parse(
    await readFile(`${fixtureRoot}/cross-project-local-proof/input-list.local.json`, 'utf8')
  )
  const index = JSON.parse(
    await readFile(`${fixtureRoot}/cross-project-local-proof/media-cross-project-operator-index.local.json`, 'utf8')
  )
  const readyOperatorIndex = JSON.parse(
    await readFile(`${fixtureRoot}/local-proof-ready/records/exports/media-operator-packet-index.local.json`, 'utf8')
  )
  const attentionOperatorIndex = JSON.parse(
    await readFile(`${fixtureRoot}/local-proof-attention/records/exports/media-operator-packet-index.local.json`, 'utf8')
  )

  assert.equal(validateRequiredRecord(inputList), true)
  assert.equal(validateRequiredRecord(index), true)
  assert.equal(validateRequiredRecord(readyOperatorIndex), true)
  assert.equal(validateRequiredRecord(attentionOperatorIndex), true)
  assert.equal(index.summary.localProofReady, 1)
  assert.equal(index.summary.localProofAttention, 1)
  assert.equal(index.summary.localProofFresh, 1)
  assert.equal(index.summary.localProofStale, 1)
  assert.equal(index.summary.adapterHold, 1)
  assert.equal(index.projectSummaries[0].localProofRehearsalSummary.proofFreshness, 'fresh')
  assert.equal(index.projectSummaries[1].localProofRehearsalSummary.latestProofState, 'ready')
  assert.equal(index.projectSummaries[1].localProofRehearsalSummary.proofFreshness, 'stale')
  assert.ok(index.projectSummaries[1].localProofRehearsalSummary.staleReasons.includes('adapter_decision_changed'))
  assert.equal(index.projectSummaries[1].localProofRehearsalSummary.observationStatus, 'studio_source_pressure_routed_through_generic_layer_seam')
  assert.equal(index.projectSummaries[1].localProofRehearsalSummary.edgeDispatch, false)

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'media-studio-local-proof-fixture-'))
  await mkdir(path.join(tempRoot, 'examples'), { recursive: true })
  await cp(fixtureRoot, path.join(tempRoot, fixtureRoot), { recursive: true })

  const { result, lines } = await captureConsole(() => writeCrossProjectOperatorIndex({
    baseDir: tempRoot,
    inputList: `${fixtureRoot}/cross-project-local-proof/input-list.local.json`,
    output: `${fixtureRoot}/cross-project-local-proof/media-cross-project-operator-index.local.json`
  }))

  assert.equal(result.index.summary.localProofReady, 1)
  assert.equal(result.index.summary.localProofAttention, 1)
  assert.equal(result.index.summary.localProofFresh, 1)
  assert.equal(result.index.summary.localProofStale, 1)
  assert.equal(result.index.summary.swarmReady, 1)
  assert.equal(result.index.summary.swarmAttention, 1)
  assert.equal(result.index.safeNextAction, 'Run npm run proof:local to refresh local proof rehearsal evidence after local posture changes.')
  assert.ok(lines.some((line) => line.includes('localProofReady=1') &&
    line.includes('localProofAttention=1') &&
    line.includes('localProofFresh=1') &&
    line.includes('localProofStale=1') &&
    line.includes('swarmProof=false') &&
    line.includes('activation=false')))
  assert.ok(lines.some((line) => line.includes('local proof: proof=ready') &&
    line.includes('proofFreshness=stale') &&
    line.includes('staleReasons=swarm_seam_changed,adapter_decision_changed,observation_status_changed') &&
    line.includes('activation=false')))
  assert.equal(validateRequiredRecord(result.index), true)
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

test('Studio pressure artifacts carry Edge and Layer refs with non-claims', async () => {
  const dir = await createFixtureProject()
  const layerRefs = {
    layerRef: 'layer:operator-local:operator-alpha',
    layerProfileRef: 'layer-profile:operator-local:v0:example',
    continuityRef: 'layer-continuity-ref:operator-local:decision-family:candidate',
    desyncPostureRef: 'layer-desync-posture:operator-local:example',
    rbcProfileRefs: ['rbc-profile:operator-local-default']
  }

  await runFirstWedge({
    projectDir: dir,
    decision: 'accepted',
    operatorRef: 'operator-test'
  })
  await writeByteDescriptorProposals({ projectDir: dir })
  await writeLocalLayerResourceRefCandidates({ projectDir: dir })
  await writeProductionRecordsFromCard({ projectDir: dir })
  await writeProductionAssetCapsule({ projectDir: dir })
  await writeProductionBundle({ projectDir: dir })
  await writeProductionAuthorityPrerequisiteReport({
    projectDir: dir,
    ...layerRefs
  })
  await writeAuthorityHandoffCandidate({
    projectDir: dir,
    ...layerRefs
  })
  await inspectLocalRun({ projectDir: dir })
  await writeProjectStatus({ projectDir: dir })
  await writeProjectHealth({ projectDir: dir })
  await writeControlSurfaceProjection({ projectDir: dir })
  await writeEdgeCompatibilityBundle({ projectDir: dir })
  await writeOperatorPacketIndex({ projectDir: dir })
  await writeEdgeHandoffCandidate({ projectDir: dir })
  await writeOperatorDecisionRequest({ projectDir: dir })

  const { edgePressureArtifact, layerPressureArtifact, outputs } = await writeStudioPressureArtifacts({
    projectDir: dir,
    quiet: true
  })

  assert.equal(edgePressureArtifact.schema, 'media.edge_pressure_artifact.local.v1')
  assert.equal(edgePressureArtifact.targetRepo, 'mesh-ecology-edge')
  assert.equal(edgePressureArtifact.targetSurface, 'media-edge-operator-seam')
  assert.ok(edgePressureArtifact.sourceRefs.some((ref) => ref.schema === 'media.edge_inspection_packet.local.v1'))
  assert.ok(edgePressureArtifact.sourceRefs.some((ref) => ref.schema === 'media.edge_compatibility_bundle.local.v1'))
  assert.ok(edgePressureArtifact.sourceRefs.some((ref) => ref.schema === 'media.operator_packet_index.local.v1'))
  assert.ok(edgePressureArtifact.sourceRefs.some((ref) => ref.schema === 'media.operator_decision_request.local.v1'))
  assert.equal(edgePressureArtifact.nonClaims.edgeApproval, false)
  assert.equal(edgePressureArtifact.nonClaims.edgeRuntimeVerified, false)
  assert.equal(edgePressureArtifact.nonClaims.productionReady, false)
  assert.equal(edgePressureArtifact.nonClaims.localScaffoldAuthority, false)
  assert.equal(edgePressureArtifact.edgeRuntimeBuilt, false)
  assert.equal(edgePressureArtifact.edgeRuntimeVerified, false)
  assert.equal(validateRequiredRecord(edgePressureArtifact), true)

  assert.equal(layerPressureArtifact.schema, 'media.layer_pressure_artifact.local.v1')
  assert.equal(layerPressureArtifact.targetRepo, 'mesh-ecology-layer')
  assert.equal(layerPressureArtifact.targetSurface, 'local-layer-projection-candidate-review')
  assert.ok(layerPressureArtifact.sourceRefs.some((ref) => ref.schema === 'media.local_layer_resource_ref_candidate.local.v1'))
  assert.ok(layerPressureArtifact.sourceRefs.some((ref) => ref.schema === 'media.authority_handoff_candidate.local.v1'))
  assert.ok(layerPressureArtifact.sourceRefs.some((ref) => ref.schema === 'media.production_authority_prerequisites.summary.local.v1'))
  assert.ok(layerPressureArtifact.layerFacingRefs.layerRefs.some((ref) => ref.id === layerRefs.layerRef))
  assert.ok(layerPressureArtifact.layerFacingRefs.layerProfileRefs.some((ref) => ref.id === layerRefs.layerProfileRef))
  assert.ok(layerPressureArtifact.layerFacingRefs.continuityRefs.some((ref) => ref.id === layerRefs.continuityRef))
  assert.equal(layerPressureArtifact.nonClaims.layerAdmission, false)
  assert.equal(layerPressureArtifact.nonClaims.durableAppendApproved, false)
  assert.equal(layerPressureArtifact.nonClaims.continuityClaimed, false)
  assert.equal(layerPressureArtifact.nonClaims.resourceAdmission, false)
  assert.equal(layerPressureArtifact.nonClaims.localScaffoldAuthority, false)
  assert.equal(validateRequiredRecord(layerPressureArtifact), true)

  const writtenEdge = JSON.parse(await readFile(path.join(dir, outputs.edgeOutput), 'utf8'))
  const writtenLayer = JSON.parse(await readFile(path.join(dir, outputs.layerOutput), 'utf8'))
  assert.equal(writtenEdge.pressureArtifactId, edgePressureArtifact.pressureArtifactId)
  assert.equal(writtenLayer.pressureArtifactId, layerPressureArtifact.pressureArtifactId)

  const inspection = await inspectLocalRun({ projectDir: dir })
  assert.ok(inspection.packet.artifactKinds.includes('media.edge_pressure_artifact.local.v1'))
  assert.ok(inspection.packet.artifactKinds.includes('media.layer_pressure_artifact.local.v1'))

  const nextBundle = await writeEdgeCompatibilityBundle({ projectDir: dir })
  assert.ok(nextBundle.bundle.studioSourceRefs.some((ref) => ref.schema === 'media.edge_pressure_artifact.local.v1'))
  assert.ok(nextBundle.bundle.studioSourceRefs.some((ref) => ref.schema === 'media.layer_pressure_artifact.local.v1'))
})

test('Studio pressure artifacts fail closed on authority overclaims', async () => {
  const dir = await createFixtureProject()
  await runFirstWedge({
    projectDir: dir,
    decision: 'accepted',
    operatorRef: 'operator-test'
  })
  await writeByteDescriptorProposals({ projectDir: dir })
  await writeLocalLayerResourceRefCandidates({ projectDir: dir })
  await inspectLocalRun({ projectDir: dir })
  await writeProjectStatus({ projectDir: dir })
  await writeControlSurfaceProjection({ projectDir: dir })
  await writeEdgeCompatibilityBundle({ projectDir: dir })

  const { edgePressureArtifact, layerPressureArtifact } = await writeStudioPressureArtifacts({
    projectDir: dir,
    quiet: true
  })

  assert.throws(
    () => validateRequiredRecord({
      ...edgePressureArtifact,
      nonClaims: {
        ...edgePressureArtifact.nonClaims,
        edgeApproval: true
      }
    }),
    /edgeApproval=false/
  )

  assert.throws(
    () => validateRequiredRecord({
      ...layerPressureArtifact,
      nonClaims: {
        ...layerPressureArtifact.nonClaims,
        layerAdmission: true
      }
    }),
    /layerAdmission=false/
  )
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
