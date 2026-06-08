import test from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

import { artifactKinds } from '../src/contracts/artifact-kinds.js'
import { readSchema, validateRequiredRecord } from '../src/contracts/schemas.js'
import { writeByteDescriptorProposals } from '../src/assets/byte-descriptor-proposal.js'
import { writeApprovalProposal } from '../src/review/approval-proposal.js'
import { writeOperatorDecisionRequest } from '../src/review/operator-decision-request.js'
import { runFirstWedge } from '../src/local/run-first-wedge.js'
import { writeLocalLayerResourceRefCandidates } from '../src/local/resource-ref-candidates.js'
import { writeProductionAssetCapsule } from '../src/production/asset-capsule.js'
import { writeProductionBundle } from '../src/production/bundle.js'
import { writeProductionAuthorityPrerequisiteReport } from '../src/production/authority-prerequisites.js'
import { writeAuthorityHandoffCandidate } from '../src/production/authority-handoff-candidate.js'
import { inspectLocalRun } from '../src/seams/inspect-local-run.js'
import { writeProjectStatus } from '../src/seams/project-status.js'
import { writeProjectHealth } from '../src/seams/project-health.js'
import { writeControlSurfaceProjection } from '../src/seams/control-surface-projection.js'
import { writeEdgeCompatibilityBundle } from '../src/seams/edge-compatibility-bundle.js'
import { writeEdgeHandoffCandidate } from '../src/seams/edge-handoff-candidate.js'
import { writeOperatorPacketIndex } from '../src/seams/operator-packet-index.js'
import {
  buildStudioSourcePressureAdapterFixture,
  createStudioSourcePressureObservationResult,
  writeStudioPressureArtifacts
} from '../src/seams/studio-pressure-artifacts.js'
import { summarizeSwarmSeamPosture } from '../src/seams/swarm-seam-posture.js'

const pressureOutputSchemas = new Set([
  artifactKinds.mediaEdgePressureArtifactLocal,
  artifactKinds.mediaLayerPressureArtifactLocal,
  artifactKinds.mediaStudioSourcePressureAdapterCandidateLocal,
  artifactKinds.mediaStudioSourcePressureAdapterOperatorDecisionLocal,
  artifactKinds.mediaStudioSourcePressureObservationResultLocal
])
const execFileAsync = promisify(execFile)

async function createFixtureProject() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-source-pressure-'))
  await mkdir(path.join(dir, 'cards'), { recursive: true })
  await mkdir(path.join(dir, 'media', 'generated'), { recursive: true })
  await mkdir(path.join(dir, 'records'), { recursive: true })
  await writeFile(path.join(dir, 'cards', 'card.json'), JSON.stringify({
    schema: 'media.card.v1',
    cardId: 'card-test',
    projectId: 'project-test',
    kind: 'generation-card',
    prompt: 'Make a local test candidate.',
    referenceAssetRefs: [],
    target: {
      type: 'image',
      format: 'text-fixture'
    },
    providerHints: {
      provider: 'local-fixture'
    },
    acceptanceCriteria: [
      'candidate exists'
    ],
    createdAt: '2026-05-26T00:00:00.000Z'
  }, null, 2))
  await writeFile(path.join(dir, 'media', 'generated', 'candidate.txt'), 'candidate bytes')
  return dir
}

async function preparePressureProject() {
  const dir = await createFixtureProject()
  const layerRefs = {
    layerRef: 'layer:operator-local:operator-alpha',
    layerProfileRef: 'layer-profile:operator-local:v0:example',
    continuityRef: 'continuity:operator-local:v0:test',
    desyncPostureRef: 'desync-posture:operator-local:v0:test'
  }

  await runFirstWedge({
    projectDir: dir,
    decision: 'accepted',
    operatorRef: 'operator-test'
  })
  await writeByteDescriptorProposals({ projectDir: dir })
  await writeLocalLayerResourceRefCandidates({ projectDir: dir })
  await writeApprovalProposal({ projectDir: dir })
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

  return dir
}

async function runStudioCli(script, args) {
  const { stdout } = await execFileAsync('npm', ['--silent', 'run', script, '--', ...args], {
    cwd: path.resolve('.'),
    maxBuffer: 10 * 1024 * 1024
  })
  return JSON.parse(stdout.trim())
}

function completeLocalPackagePosture(overrides = {}) {
  return {
    packageState: 'complete_review_only_authority_missing',
    latestReviewPosture: 'reviewed_fresh',
    integrityPosture: 'clear',
    safeNextAction: 'Route the reviewed local package and request candidate to a future authority lane; no publication authorization is granted locally.',
    ...overrides
  }
}

function approvedAdapterSummary(overrides = {}) {
  return {
    latestDecisionStatus: 'approved_bounded_studio_source_pressure_observation',
    observationStatus: 'studio_source_pressure_routed_through_generic_layer_seam',
    targetGenericEnvelope: 'layer_source_pressure_review.v0',
    emittedEnvelopeSchemaVersion: 'layer-source-pressure-review.v0',
    ...overrides
  }
}

function pressureRefs() {
  return {
    edgeSourceRefs: [{ kind: 'media-edge-inspection-packet', id: 'edge-ref', schema: artifactKinds.mediaEdgeInspectionPacketLocal }],
    layerSourceRefs: [{ kind: 'media-layer-resource-ref', id: 'layer-ref', schema: artifactKinds.mediaLocalLayerResourceRefCandidateLocal }]
  }
}

test('Studio swarm seam posture classifies review-only readiness states', () => {
  const ready = summarizeSwarmSeamPosture({
    localPackagePosture: completeLocalPackagePosture(),
    adapterSummary: approvedAdapterSummary(),
    ...pressureRefs()
  })
  assert.equal(ready.state, 'ready_for_review_only_swarm_pressure')
  assert.equal(ready.publicSwarmProof, false)
  assert.equal(ready.swarmRuntimeActivated, false)
  assert.equal(ready.edgeDispatch, false)
  assert.equal(ready.layerAdmission, false)

  const rejected = summarizeSwarmSeamPosture({
    localPackagePosture: completeLocalPackagePosture(),
    adapterSummary: approvedAdapterSummary({
      latestDecisionStatus: 'rejected_bounded_studio_source_pressure_observation',
      observationStatus: 'skipped'
    }),
    ...pressureRefs()
  })
  assert.equal(rejected.state, 'adapter_hold')
  assert.ok(rejected.attentionCodes.includes('adapter_hold'))

  const missingObservation = summarizeSwarmSeamPosture({
    localPackagePosture: completeLocalPackagePosture(),
    adapterSummary: approvedAdapterSummary({ observationStatus: 'absent' }),
    ...pressureRefs()
  })
  assert.equal(missingObservation.state, 'source_pressure_attention')

  const incompletePackage = summarizeSwarmSeamPosture({
    localPackagePosture: completeLocalPackagePosture({ packageState: 'incomplete_local_package', integrityPosture: 'incomplete' }),
    adapterSummary: approvedAdapterSummary(),
    ...pressureRefs()
  })
  assert.equal(incompletePackage.state, 'local_package_attention')

  const integrityBlocked = summarizeSwarmSeamPosture({
    localPackagePosture: completeLocalPackagePosture({ packageState: 'output_integrity_blocked', integrityPosture: 'blocked' }),
    adapterSummary: approvedAdapterSummary(),
    ...pressureRefs()
  })
  assert.equal(integrityBlocked.state, 'integrity_blocked')
})

test('Studio source-pressure adapter candidate targets the generic Layer envelope only', () => {
  const { candidate, layerPressureArtifact } = buildStudioSourcePressureAdapterFixture()

  assert.equal(candidate.schema, artifactKinds.mediaStudioSourcePressureAdapterCandidateLocal)
  assert.equal(candidate.targetRepo, 'mesh-ecology-layer')
  assert.equal(candidate.targetGenericEnvelope, 'layer_source_pressure_review.v0')
  assert.equal(candidate.requestedOutput.schemaVersion, 'layer-source-pressure-review.v0')
  assert.equal(candidate.sourceLayerPressureArtifactRef.id, layerPressureArtifact.pressureArtifactId)
  assert.equal(candidate.studioSpecificLayerApiCreated, false)
  assert.equal(candidate.nonClaims.studioSpecificLayerApiCreated, false)
  assert.equal(candidate.nonClaims.layerAdmission, false)
  assert.equal(candidate.nonClaims.durableAppendApproved, false)
  assert.equal(candidate.nonClaims.acceptedContinuityCreated, false)
  assert.equal(candidate.nonClaims.productionStorageSelected, false)

  validateRequiredRecord(candidate)
})

test('Studio source-pressure adapter operator decision approves only the observation lane', () => {
  const { candidate, operatorDecision } = buildStudioSourcePressureAdapterFixture()

  assert.equal(operatorDecision.schema, artifactKinds.mediaStudioSourcePressureAdapterOperatorDecisionLocal)
  assert.equal(operatorDecision.decisionStatus, 'approved_bounded_studio_source_pressure_observation')
  assert.deepEqual(operatorDecision.approvedOnly, ['future_bounded_studio_source_pressure_observation'])
  assert.equal(operatorDecision.sourceAdapterCandidateRef.id, candidate.adapterCandidateId)
  assert.equal(operatorDecision.studioSourcePressureEmitted, false)
  assert.equal(operatorDecision.layerAdmissionApproved, false)
  assert.equal(operatorDecision.durableAppendApproved, false)
  assert.equal(operatorDecision.acceptedContinuityCreated, false)

  validateRequiredRecord(operatorDecision)
})

test('Studio source-pressure observation routes one bounded artifact through generic Layer seam', () => {
  const {
    candidate,
    operatorDecision,
    observationResult,
    layerPressureArtifact
  } = buildStudioSourcePressureAdapterFixture()

  assert.equal(observationResult.schema, artifactKinds.mediaStudioSourcePressureObservationResultLocal)
  assert.equal(observationResult.observationStatus, 'studio_source_pressure_routed_through_generic_layer_seam')
  assert.equal(observationResult.sourceAdapterCandidateRef.id, candidate.adapterCandidateId)
  assert.equal(observationResult.sourceOperatorDecisionRef.id, operatorDecision.decisionId)
  assert.equal(observationResult.studioSourcePressureRef, layerPressureArtifact.pressureArtifactId)
  assert.equal(observationResult.emittedEnvelopeKind, 'layer_source_pressure_review')
  assert.equal(observationResult.emittedEnvelopeSchemaVersion, 'layer-source-pressure-review.v0')
  assert.equal(observationResult.routedThroughGenericLayerSeam, true)
  assert.equal(observationResult.studioSpecificLayerApiCreated, false)
  assert.equal(observationResult.layerTruthClaimed, false)
  assert.equal(observationResult.edgeActionQueued, false)

  validateRequiredRecord(observationResult)
})

test('Studio source-pressure adapter validation blocks Studio-specific Layer API overclaims', () => {
  const { candidate } = buildStudioSourcePressureAdapterFixture()

  const unsafe = {
    ...candidate,
    nonClaims: {
      ...candidate.nonClaims,
      studioSpecificLayerApiCreated: true
    }
  }

  assert.throws(
    () => validateRequiredRecord(unsafe),
    /studioSpecificLayerApiCreated=false/
  )
})

test('Studio source-pressure observation validation blocks authority overclaims', () => {
  const { candidate, operatorDecision, layerPressureArtifact } = buildStudioSourcePressureAdapterFixture()
  const observation = createStudioSourcePressureObservationResult({
    projectId: candidate.projectId,
    sourceAdapterCandidate: candidate,
    sourceOperatorDecision: operatorDecision,
    sourceLayerPressureArtifact: layerPressureArtifact
  })

  assert.throws(
    () => validateRequiredRecord({
      ...observation,
      routedThroughGenericLayerSeam: false
    }),
    /routedThroughGenericLayerSeam=true/
  )

  assert.throws(
    () => validateRequiredRecord({
      ...observation,
      studioSpecificLayerApiCreated: true
    }),
    /non-authority false posture/
  )
})

test('Studio source-pressure adapter schema files are present and aligned', async () => {
  const schemas = [
    [artifactKinds.mediaStudioSourcePressureAdapterCandidateLocal, 'media.studio_source_pressure_adapter_candidate.local.v1'],
    [artifactKinds.mediaStudioSourcePressureAdapterOperatorDecisionLocal, 'media.studio_source_pressure_adapter_operator_decision.local.v1'],
    [artifactKinds.mediaStudioSourcePressureObservationResultLocal, 'media.studio_source_pressure_observation_result.local.v1']
  ]

  for (const [schemaId, title] of schemas) {
    const schema = await readSchema(schemaId)
    assert.equal(schema.title, title)
    assert.equal(schema.properties.schema.const, schemaId)
  }
})

test('Studio pressure command emission writes approved adapter chain artifacts', async () => {
  const dir = await preparePressureProject()
  const result = await writeStudioPressureArtifacts({
    projectDir: dir,
    adapterChain: true,
    quiet: true,
    createdAt: '2026-05-26T00:00:00.000Z'
  })

  assert.equal(result.adapter.enabled, true)
  assert.equal(result.adapter.decision, 'approved')
  assert.equal(result.adapter.targetGenericEnvelope, 'layer_source_pressure_review.v0')
  assert.equal(result.adapter.emittedEnvelopeSchemaVersion, 'layer-source-pressure-review.v0')
  assert.equal(result.adapter.observationWritten, true)
  assert.equal(result.adapter.candidate.sourceLayerPressureArtifactRef.path, result.outputs.layerOutput)
  assert.equal(result.adapter.operatorDecision.nextSafeMove, 'studio_source_pressure_observation_result_or_hold')
  assert.equal(result.adapter.observationResult.routedThroughGenericLayerSeam, true)
  assert.equal(result.adapter.nonClaims.layerAdmission, false)
  assert.equal(result.adapter.nonClaims.durableAppendApproved, false)
  assert.equal(result.adapter.nonClaims.autoExecute, false)
  assert.equal(result.swarmSeamPosture.state, 'local_package_attention')
  assert.equal(result.swarmSeamPosture.adapterDecision, 'approved_bounded_studio_source_pressure_observation')
  assert.equal(result.swarmSeamPosture.adapterObservation, 'studio_source_pressure_routed_through_generic_layer_seam')
  assert.equal(result.swarmSeamPosture.publicSwarmProof, false)
  assert.equal(result.swarmSeamPosture.swarmRuntimeActivated, false)
  assert.equal(result.edgePressureArtifact.swarmSeamPosture.state, result.swarmSeamPosture.state)
  assert.equal(result.layerPressureArtifact.swarmSeamPosture.state, result.swarmSeamPosture.state)
  assert.equal(result.adapter.swarmSeamPosture.state, result.swarmSeamPosture.state)

  const writtenCandidate = JSON.parse(await readFile(path.join(dir, result.outputs.adapterCandidateOutput), 'utf8'))
  const writtenDecision = JSON.parse(await readFile(path.join(dir, result.outputs.adapterDecisionOutput), 'utf8'))
  const writtenObservation = JSON.parse(await readFile(path.join(dir, result.outputs.adapterObservationOutput), 'utf8'))
  const writtenEdgePressure = JSON.parse(await readFile(path.join(dir, result.outputs.edgeOutput), 'utf8'))
  const writtenLayerPressure = JSON.parse(await readFile(path.join(dir, result.outputs.layerOutput), 'utf8'))

  assert.equal(writtenCandidate.adapterCandidateId, result.adapter.candidate.adapterCandidateId)
  assert.equal(writtenDecision.decisionId, result.adapter.operatorDecision.decisionId)
  assert.equal(writtenObservation.observationId, result.adapter.observationResult.observationId)
  assert.equal(writtenEdgePressure.swarmSeamPosture.state, 'local_package_attention')
  assert.equal(writtenLayerPressure.swarmSeamPosture.state, 'local_package_attention')
  assert.equal(validateRequiredRecord(writtenCandidate), true)
  assert.equal(validateRequiredRecord(writtenDecision), true)
  assert.equal(validateRequiredRecord(writtenObservation), true)
})

test('Studio pressure adapter chain surfaces through inspection operator and Edge-compatible views', async () => {
  const dir = await preparePressureProject()
  await writeStudioPressureArtifacts({
    projectDir: dir,
    adapterChain: true,
    quiet: true,
    createdAt: '2026-05-26T00:00:00.000Z'
  })

  const inspection = await inspectLocalRun({ projectDir: dir })
  assert.ok(inspection.packet.artifactKinds.includes(artifactKinds.mediaStudioSourcePressureAdapterCandidateLocal))
  assert.ok(inspection.packet.artifactKinds.includes(artifactKinds.mediaStudioSourcePressureAdapterOperatorDecisionLocal))
  assert.ok(inspection.packet.artifactKinds.includes(artifactKinds.mediaStudioSourcePressureObservationResultLocal))
  assert.ok(Object.values(inspection.packet.recordRefs).some((ref) => ref.schema === artifactKinds.mediaStudioSourcePressureObservationResultLocal))

  const indexResult = await writeOperatorPacketIndex({ projectDir: dir, quiet: true })
  assert.equal(indexResult.index.studioSourcePressureAdapterCandidateRefs.length, 1)
  assert.equal(indexResult.index.studioSourcePressureAdapterDecisionRefs.length, 1)
  assert.equal(indexResult.index.studioSourcePressureObservationRefs.length, 1)
  assert.equal(indexResult.index.studioSourcePressureAdapterSummary.latestDecisionStatus, 'approved_bounded_studio_source_pressure_observation')
  assert.equal(indexResult.index.studioSourcePressureAdapterSummary.observationStatus, 'studio_source_pressure_routed_through_generic_layer_seam')
  assert.equal(indexResult.index.studioSourcePressureAdapterSummary.targetGenericEnvelope, 'layer_source_pressure_review.v0')
  assert.equal(indexResult.index.studioSourcePressureAdapterSummary.layerAdmissionApproved, false)
  assert.equal(indexResult.index.studioSourcePressureAdapterSummary.edgeActionQueued, false)
  assert.equal(indexResult.index.swarmSeamPosture.state, 'local_package_attention')
  assert.equal(indexResult.index.swarmSeamPosture.publicSwarmProof, false)
  assert.equal(indexResult.index.swarmSeamPosture.swarmRuntimeActivated, false)
  assert.equal(indexResult.index.summary.swarmSeamState, 'local_package_attention')
  assert.equal(indexResult.index.summary.swarmProof, false)
  assert.equal(indexResult.index.summary.swarmActivation, false)
  assert.equal(validateRequiredRecord(indexResult.index), true)

  const compatibilityResult = await writeEdgeCompatibilityBundle({ projectDir: dir, quiet: true })
  assert.ok(compatibilityResult.bundle.studioSourceRefs.some((ref) => ref.schema === artifactKinds.mediaStudioSourcePressureAdapterCandidateLocal))
  assert.ok(compatibilityResult.bundle.studioSourceRefs.some((ref) => ref.schema === artifactKinds.mediaStudioSourcePressureAdapterOperatorDecisionLocal))
  assert.ok(compatibilityResult.bundle.studioSourceRefs.some((ref) => ref.schema === artifactKinds.mediaStudioSourcePressureObservationResultLocal))
  assert.equal(compatibilityResult.bundle.studioSourcePressureAdapterSummary.latestDecisionStatus, 'approved_bounded_studio_source_pressure_observation')
  assert.equal(compatibilityResult.bundle.studioSourcePressureAdapterSummary.observationStatus, 'studio_source_pressure_routed_through_generic_layer_seam')
  assert.equal(compatibilityResult.bundle.studioSourcePressureAdapterSummary.layerAdmissionApproved, false)
  assert.equal(compatibilityResult.bundle.studioSourcePressureAdapterSummary.durableAppendApproved, false)
  assert.equal(compatibilityResult.bundle.studioSourcePressureAdapterSummary.edgeActionQueued, false)
  assert.equal(compatibilityResult.bundle.swarmSeamPosture.state, 'local_package_attention')
  assert.equal(compatibilityResult.bundle.swarmSeamPosture.publicSwarmProof, false)
  assert.equal(compatibilityResult.bundle.swarmSeamPosture.swarmRuntimeActivated, false)
  assert.equal(compatibilityResult.bundle.studioReviewEvidence.swarmSeamPosture.state, 'local_package_attention')
  assert.equal(validateRequiredRecord(compatibilityResult.bundle), true)
})

test('Studio pressure adapter chain is visible through public CLI print surfaces', async () => {
  const dir = await preparePressureProject()

  const pressure = await runStudioCli('pressure:studio', [
    '--project-dir',
    dir,
    '--adapter-chain',
    '--print'
  ])
  assert.equal(pressure.adapter.enabled, true)
  assert.equal(pressure.adapter.decision, 'approved')
  assert.equal(pressure.adapter.targetGenericEnvelope, 'layer_source_pressure_review.v0')
  assert.equal(pressure.adapter.observationWritten, true)
  assert.equal(pressure.adapter.nonClaims.layerAdmission, false)
  assert.equal(pressure.adapter.nonClaims.edgeAuthority, false)
  assert.equal(pressure.adapter.nonClaims.autoExecute, false)
  assert.equal(pressure.swarmSeamPosture.state, 'local_package_attention')
  assert.equal(pressure.swarmSeamPosture.publicSwarmProof, false)
  assert.equal(pressure.swarmSeamPosture.swarmRuntimeActivated, false)

  const inspection = await runStudioCli('inspect:local-run', [
    '--project-dir',
    dir,
    '--print'
  ])
  assert.ok(inspection.artifactKinds.includes(artifactKinds.mediaStudioSourcePressureAdapterCandidateLocal))
  assert.ok(inspection.artifactKinds.includes(artifactKinds.mediaStudioSourcePressureAdapterOperatorDecisionLocal))
  assert.ok(inspection.artifactKinds.includes(artifactKinds.mediaStudioSourcePressureObservationResultLocal))
  assert.ok(Object.values(inspection.recordRefs).some((ref) => ref.schema === artifactKinds.mediaStudioSourcePressureObservationResultLocal))

  const operatorIndex = await runStudioCli('operator:index', [
    '--project-dir',
    dir,
    '--print'
  ])
  assert.equal(operatorIndex.studioSourcePressureAdapterCandidateRefs.length, 1)
  assert.equal(operatorIndex.studioSourcePressureAdapterDecisionRefs.length, 1)
  assert.equal(operatorIndex.studioSourcePressureObservationRefs.length, 1)
  assert.equal(operatorIndex.summary.studioSourcePressureAdapterCandidates, 1)
  assert.equal(operatorIndex.summary.studioSourcePressureAdapterDecisionStatus, 'approved_bounded_studio_source_pressure_observation')
  assert.equal(operatorIndex.summary.studioSourcePressureObservationStatus, 'studio_source_pressure_routed_through_generic_layer_seam')
  assert.equal(operatorIndex.summary.studioSourcePressureTargetEnvelope, 'layer_source_pressure_review.v0')
  assert.equal(operatorIndex.studioSourcePressureAdapterSummary.layerAdmissionApproved, false)
  assert.equal(operatorIndex.studioSourcePressureAdapterSummary.edgeActionQueued, false)
  assert.equal(operatorIndex.swarmSeamPosture.state, 'local_package_attention')
  assert.equal(operatorIndex.summary.swarmSeamState, 'local_package_attention')
  assert.equal(operatorIndex.summary.swarmProof, false)
  assert.equal(operatorIndex.summary.swarmActivation, false)

  const edgeCompatibility = await runStudioCli('edge:compat', [
    '--project-dir',
    dir,
    '--print'
  ])
  assert.ok(edgeCompatibility.studioSourceRefs.some((ref) => ref.schema === artifactKinds.mediaStudioSourcePressureAdapterCandidateLocal))
  assert.ok(edgeCompatibility.studioSourceRefs.some((ref) => ref.schema === artifactKinds.mediaStudioSourcePressureAdapterOperatorDecisionLocal))
  assert.ok(edgeCompatibility.studioSourceRefs.some((ref) => ref.schema === artifactKinds.mediaStudioSourcePressureObservationResultLocal))
  assert.equal(edgeCompatibility.studioSourcePressureAdapterSummary.latestDecisionStatus, 'approved_bounded_studio_source_pressure_observation')
  assert.equal(edgeCompatibility.studioSourcePressureAdapterSummary.observationStatus, 'studio_source_pressure_routed_through_generic_layer_seam')
  assert.equal(edgeCompatibility.studioSourcePressureAdapterSummary.targetGenericEnvelope, 'layer_source_pressure_review.v0')
  assert.equal(edgeCompatibility.studioSourcePressureAdapterSummary.layerAdmissionApproved, false)
  assert.equal(edgeCompatibility.studioSourcePressureAdapterSummary.edgeActionQueued, false)
  assert.equal(edgeCompatibility.swarmSeamPosture.state, 'local_package_attention')
  assert.equal(edgeCompatibility.swarmSeamPosture.publicSwarmProof, false)
  assert.equal(edgeCompatibility.swarmSeamPosture.swarmRuntimeActivated, false)
  assert.equal(edgeCompatibility.edgeRuntimeBuilt, false)
  assert.equal(edgeCompatibility.edgeRuntimeVerified, false)
})

test('Studio pressure command emission can reject adapter observation', async () => {
  const dir = await preparePressureProject()
  const result = await writeStudioPressureArtifacts({
    projectDir: dir,
    adapterChain: true,
    adapterDecision: 'rejected',
    quiet: true,
    createdAt: '2026-05-26T00:00:00.000Z'
  })

  assert.equal(result.adapter.enabled, true)
  assert.equal(result.adapter.decision, 'rejected')
  assert.equal(result.adapter.observationWritten, false)
  assert.equal(result.adapter.operatorDecision.decisionStatus, 'rejected_bounded_studio_source_pressure_observation')
  assert.deepEqual(result.adapter.operatorDecision.approvedOnly, [])
  assert.equal(result.adapter.operatorDecision.nextSafeMove, 'hold')
  assert.equal(result.adapter.observationResult, null)
  assert.equal(result.outputs.adapterObservationOutput, undefined)
  assert.equal(result.swarmSeamPosture.state, 'local_package_attention')
  assert.ok(result.swarmSeamPosture.attentionCodes.includes('adapter_hold'))
  assert.equal(result.swarmSeamPosture.publicSwarmProof, false)

  const writtenCandidate = JSON.parse(await readFile(path.join(dir, result.outputs.adapterCandidateOutput), 'utf8'))
  const writtenDecision = JSON.parse(await readFile(path.join(dir, result.outputs.adapterDecisionOutput), 'utf8'))
  await assert.rejects(
    () => readFile(path.join(dir, 'records/exports/media-studio-source-pressure-observation-result.local.json'), 'utf8'),
    /ENOENT/
  )
  assert.equal(validateRequiredRecord(writtenCandidate), true)
  assert.equal(validateRequiredRecord(writtenDecision), true)
})

test('Studio pressure rejected adapter chain surfaces without observation error', async () => {
  const dir = await preparePressureProject()
  await writeStudioPressureArtifacts({
    projectDir: dir,
    adapterChain: true,
    adapterDecision: 'rejected',
    quiet: true,
    createdAt: '2026-05-26T00:00:00.000Z'
  })

  const inspection = await inspectLocalRun({ projectDir: dir })
  assert.ok(inspection.packet.artifactKinds.includes(artifactKinds.mediaStudioSourcePressureAdapterCandidateLocal))
  assert.ok(inspection.packet.artifactKinds.includes(artifactKinds.mediaStudioSourcePressureAdapterOperatorDecisionLocal))
  assert.equal(inspection.packet.artifactKinds.includes(artifactKinds.mediaStudioSourcePressureObservationResultLocal), false)

  const indexResult = await writeOperatorPacketIndex({ projectDir: dir, quiet: true })
  assert.equal(indexResult.index.studioSourcePressureAdapterCandidateRefs.length, 1)
  assert.equal(indexResult.index.studioSourcePressureAdapterDecisionRefs.length, 1)
  assert.equal(indexResult.index.studioSourcePressureObservationRefs.length, 0)
  assert.equal(indexResult.index.studioSourcePressureAdapterSummary.latestDecisionStatus, 'rejected_bounded_studio_source_pressure_observation')
  assert.equal(indexResult.index.studioSourcePressureAdapterSummary.observationStatus, 'skipped')
  assert.equal(indexResult.index.summary.studioSourcePressureObservationStatus, 'skipped')
  assert.equal(indexResult.index.swarmSeamPosture.state, 'local_package_attention')
  assert.ok(indexResult.index.swarmSeamPosture.attentionCodes.includes('adapter_hold'))
  assert.equal(validateRequiredRecord(indexResult.index), true)

  const compatibilityResult = await writeEdgeCompatibilityBundle({ projectDir: dir, quiet: true })
  assert.ok(compatibilityResult.bundle.studioSourceRefs.some((ref) => ref.schema === artifactKinds.mediaStudioSourcePressureAdapterCandidateLocal))
  assert.ok(compatibilityResult.bundle.studioSourceRefs.some((ref) => ref.schema === artifactKinds.mediaStudioSourcePressureAdapterOperatorDecisionLocal))
  assert.equal(compatibilityResult.bundle.studioSourceRefs.some((ref) => ref.schema === artifactKinds.mediaStudioSourcePressureObservationResultLocal), false)
  assert.equal(compatibilityResult.bundle.studioSourcePressureAdapterSummary.latestDecisionStatus, 'rejected_bounded_studio_source_pressure_observation')
  assert.equal(compatibilityResult.bundle.studioSourcePressureAdapterSummary.observationStatus, 'skipped')
  assert.equal(compatibilityResult.bundle.studioSourcePressureAdapterSummary.edgeActionQueued, false)
  assert.equal(compatibilityResult.bundle.swarmSeamPosture.state, 'local_package_attention')
  assert.ok(compatibilityResult.bundle.swarmSeamPosture.attentionCodes.includes('adapter_hold'))
  assert.equal(validateRequiredRecord(compatibilityResult.bundle), true)
})

test('Studio pressure rejected adapter chain is visible through public CLI print surfaces', async () => {
  const dir = await preparePressureProject()

  const pressure = await runStudioCli('pressure:studio', [
    '--project-dir',
    dir,
    '--adapter-chain',
    '--adapter-decision',
    'rejected',
    '--print'
  ])
  assert.equal(pressure.adapter.enabled, true)
  assert.equal(pressure.adapter.decision, 'rejected')
  assert.equal(pressure.adapter.observationWritten, false)
  assert.equal(pressure.adapter.operatorDecision.nextSafeMove, 'hold')
  assert.equal(pressure.adapter.observationResult, null)
  assert.equal(pressure.outputs.adapterObservationOutput, undefined)
  assert.equal(pressure.swarmSeamPosture.state, 'local_package_attention')
  assert.ok(pressure.swarmSeamPosture.attentionCodes.includes('adapter_hold'))

  const inspection = await runStudioCli('inspect:local-run', [
    '--project-dir',
    dir,
    '--print'
  ])
  assert.ok(inspection.artifactKinds.includes(artifactKinds.mediaStudioSourcePressureAdapterCandidateLocal))
  assert.ok(inspection.artifactKinds.includes(artifactKinds.mediaStudioSourcePressureAdapterOperatorDecisionLocal))
  assert.equal(inspection.artifactKinds.includes(artifactKinds.mediaStudioSourcePressureObservationResultLocal), false)

  const operatorIndex = await runStudioCli('operator:index', [
    '--project-dir',
    dir,
    '--print'
  ])
  assert.equal(operatorIndex.studioSourcePressureAdapterCandidateRefs.length, 1)
  assert.equal(operatorIndex.studioSourcePressureAdapterDecisionRefs.length, 1)
  assert.equal(operatorIndex.studioSourcePressureObservationRefs.length, 0)
  assert.equal(operatorIndex.summary.studioSourcePressureAdapterDecisionStatus, 'rejected_bounded_studio_source_pressure_observation')
  assert.equal(operatorIndex.summary.studioSourcePressureObservationStatus, 'skipped')
  assert.equal(operatorIndex.studioSourcePressureAdapterSummary.observationStatus, 'skipped')
  assert.equal(operatorIndex.swarmSeamPosture.state, 'local_package_attention')
  assert.ok(operatorIndex.swarmSeamPosture.attentionCodes.includes('adapter_hold'))

  const edgeCompatibility = await runStudioCli('edge:compat', [
    '--project-dir',
    dir,
    '--print'
  ])
  assert.ok(edgeCompatibility.studioSourceRefs.some((ref) => ref.schema === artifactKinds.mediaStudioSourcePressureAdapterCandidateLocal))
  assert.ok(edgeCompatibility.studioSourceRefs.some((ref) => ref.schema === artifactKinds.mediaStudioSourcePressureAdapterOperatorDecisionLocal))
  assert.equal(edgeCompatibility.studioSourceRefs.some((ref) => ref.schema === artifactKinds.mediaStudioSourcePressureObservationResultLocal), false)
  assert.equal(edgeCompatibility.studioSourcePressureAdapterSummary.latestDecisionStatus, 'rejected_bounded_studio_source_pressure_observation')
  assert.equal(edgeCompatibility.studioSourcePressureAdapterSummary.observationStatus, 'skipped')
  assert.equal(edgeCompatibility.studioSourcePressureAdapterSummary.edgeActionQueued, false)
  assert.equal(edgeCompatibility.swarmSeamPosture.state, 'local_package_attention')
  assert.ok(edgeCompatibility.swarmSeamPosture.attentionCodes.includes('adapter_hold'))
  assert.equal(edgeCompatibility.edgeRuntimeBuilt, false)
  assert.equal(edgeCompatibility.edgeRuntimeVerified, false)
})

test('Studio pressure source discovery excludes prior pressure outputs', async () => {
  const dir = await preparePressureProject()
  await writeStudioPressureArtifacts({
    projectDir: dir,
    adapterChain: true,
    quiet: true,
    createdAt: '2026-05-26T00:00:00.000Z'
  })
  const second = await writeStudioPressureArtifacts({
    projectDir: dir,
    adapterChain: true,
    quiet: true,
    createdAt: '2026-05-26T00:01:00.000Z'
  })

  const sourceRefs = [
    ...second.edgePressureArtifact.sourceRefs,
    ...second.layerPressureArtifact.sourceRefs,
    ...second.adapter.candidate.sourceRefs
  ]
  assert.equal(sourceRefs.some((ref) => pressureOutputSchemas.has(ref.schema)), false)
})
