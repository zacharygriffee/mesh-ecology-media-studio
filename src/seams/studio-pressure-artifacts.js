import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { artifactKinds } from '../contracts/artifact-kinds.js'
import { nowIso } from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import { summarizeLayerInteropFromRecords } from '../layer/layer-interop.js'
import { writeJsonAtomic } from '../local/atomic-json.js'
import { assertSafeLocalPath } from '../local/project-layout.js'
import { createLocalPackagePostureSummary } from '../production/local-package-posture.js'
import { readProjectRecords } from './project-status.js'
import { summarizeSwarmSeamPosture, formatSwarmSeamPostureFields } from './swarm-seam-posture.js'

const modulePath = fileURLToPath(import.meta.url)
const defaultProjectDir = 'examples/card-to-candidate'
const defaultEdgeOutput = 'records/exports/media-edge-pressure-artifact.local.json'
const defaultLayerOutput = 'records/exports/media-layer-pressure-artifact.local.json'
const defaultAdapterCandidateOutput = 'records/exports/media-studio-source-pressure-adapter-candidate.local.json'
const defaultAdapterDecisionOutput = 'records/exports/media-studio-source-pressure-adapter-operator-decision.local.json'
const defaultAdapterObservationOutput = 'records/exports/media-studio-source-pressure-observation-result.local.json'
const truthStatus = 'not mesh truth; not distributed proof; not ratified shared state'
const genericLayerEnvelope = 'layer_source_pressure_review.v0'
const genericLayerEnvelopeSchema = 'layer-source-pressure-review.v0'
const defaultLayerRef = 'layer:operator-local:operator-alpha'
const defaultLayerProfileRef = 'layer-profile:operator-local:v0:example'

const edgePressureSchemas = new Set([
  artifactKinds.mediaEdgeInspectionPacketLocal,
  artifactKinds.mediaEdgeCompatibilityBundleLocal,
  artifactKinds.mediaOperatorPacketIndexLocal,
  artifactKinds.mediaOperatorDecisionRequestLocal
])

const layerPressureSchemas = new Set([
  artifactKinds.mediaLocalLayerResourceRefCandidateLocal,
  artifactKinds.mediaAuthorityHandoffCandidateLocal,
  artifactKinds.mediaProductionAuthorityPrerequisitesLocal,
  artifactKinds.mediaProductionAssetCapsuleLocal,
  artifactKinds.mediaProductionBundleLocal
])

const pressureOutputSchemas = new Set([
  artifactKinds.mediaEdgePressureArtifactLocal,
  artifactKinds.mediaLayerPressureArtifactLocal,
  artifactKinds.mediaStudioSourcePressureAdapterCandidateLocal,
  artifactKinds.mediaStudioSourcePressureAdapterOperatorDecisionLocal,
  artifactKinds.mediaStudioSourcePressureObservationResultLocal
])

function parseArgs(argv) {
  const args = {
    projectDir: defaultProjectDir,
    edgeOutput: defaultEdgeOutput,
    layerOutput: defaultLayerOutput,
    adapterCandidateOutput: defaultAdapterCandidateOutput,
    adapterDecisionOutput: defaultAdapterDecisionOutput,
    adapterObservationOutput: defaultAdapterObservationOutput,
    adapterChain: false,
    adapterDecision: 'approved',
    print: false,
    quiet: false
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]

    if (arg === '--project-dir') {
      args.projectDir = next
      i += 1
    } else if (arg === '--edge-output') {
      args.edgeOutput = next
      i += 1
    } else if (arg === '--layer-output') {
      args.layerOutput = next
      i += 1
    } else if (arg === '--adapter-chain') {
      args.adapterChain = true
    } else if (arg === '--adapter-decision') {
      args.adapterDecision = next
      i += 1
    } else if (arg === '--print') {
      args.print = true
    } else if (arg === '--quiet') {
      args.quiet = true
    }
  }

  return args
}

export async function writeStudioPressureArtifacts({
  projectDir = defaultProjectDir,
  edgeOutput = defaultEdgeOutput,
  layerOutput = defaultLayerOutput,
  adapterCandidateOutput = defaultAdapterCandidateOutput,
  adapterDecisionOutput = defaultAdapterDecisionOutput,
  adapterObservationOutput = defaultAdapterObservationOutput,
  adapterChain = false,
  adapterDecision = 'approved',
  createdAt = nowIso(),
  print = false,
  quiet = false
} = {}) {
  assertSafeLocalPath(edgeOutput)
  assertSafeLocalPath(layerOutput)

  if (!['approved', 'rejected'].includes(adapterDecision)) {
    throw new Error('adapter decision must be approved or rejected')
  }

  if (adapterChain) {
    assertSafeLocalPath(adapterCandidateOutput)
    assertSafeLocalPath(adapterDecisionOutput)
    assertSafeLocalPath(adapterObservationOutput)
  }

  const root = path.resolve(projectDir)
  const records = (await readProjectRecords(root))
    .filter((entry) => !pressureOutputSchemas.has(entry.record.schema))
  const projectId = records.find((entry) => typeof entry.record.projectId === 'string')?.record.projectId ??
    path.basename(root)
  const edgeSourceRefs = refsForSchemas(records, edgePressureSchemas)
  const layerSourceRefs = refsForSchemas(records, layerPressureSchemas)
  const missingEdgeSourceSchemas = missingSchemas(records, edgePressureSchemas)
  const missingLayerSourceSchemas = missingSchemas(records, layerPressureSchemas)
  const layerInteropSummary = summarizeLayerInteropFromRecords(records)
  const localPackagePosture = await createLocalPackagePostureSummary({
    projectDir: root,
    records
  })

  if (edgeSourceRefs.length === 0) {
    throw new Error('Edge pressure artifact requires at least one Edge-facing Studio source ref')
  }

  if (layerSourceRefs.length === 0) {
    throw new Error('Layer pressure artifact requires at least one Layer-facing Studio source ref')
  }

  const edgePressureArtifact = createEdgePressureArtifact({
    projectId,
    sourceRefs: edgeSourceRefs,
    missingSourceSchemas: missingEdgeSourceSchemas,
    createdAt
  })
  const layerPressureArtifact = createLayerPressureArtifact({
    projectId,
    sourceRefs: layerSourceRefs,
    layerInteropSummary,
    missingSourceSchemas: missingLayerSourceSchemas,
    createdAt
  })

  const adapterResult = adapterChain
    ? await writeStudioSourcePressureAdapterChain({
      root,
      projectId,
      layerPressureArtifact,
      layerOutput,
      adapterCandidateOutput,
      adapterDecisionOutput,
      adapterObservationOutput,
      adapterDecision,
      createdAt
    })
    : {
      enabled: false,
      decision: null,
      targetGenericEnvelope: genericLayerEnvelope,
      emittedEnvelopeSchemaVersion: genericLayerEnvelopeSchema,
      observationWritten: false,
      outputs: {}
    }

  const swarmSeamPosture = summarizeSwarmSeamPosture({
    localPackagePosture,
    adapterSummary: adapterResult,
    edgeSourceRefs,
    layerSourceRefs,
    missingEdgeSourceSchemas,
    missingLayerSourceSchemas,
    layerInteropSummary
  })
  edgePressureArtifact.swarmSeamPosture = swarmSeamPosture
  layerPressureArtifact.swarmSeamPosture = swarmSeamPosture
  adapterResult.swarmSeamPosture = swarmSeamPosture

  validateRequiredRecord(edgePressureArtifact)
  validateRequiredRecord(layerPressureArtifact)

  await writeJsonAtomic(root, edgeOutput, edgePressureArtifact)
  await writeJsonAtomic(root, layerOutput, layerPressureArtifact)

  const result = {
    edgePressureArtifact,
    layerPressureArtifact,
    adapter: adapterResult,
    swarmSeamPosture,
    outputs: {
      edgeOutput,
      layerOutput,
      ...adapterResult.outputs
    }
  }

  if (print) {
    console.log(JSON.stringify(result, null, 2))
  } else if (!quiet) {
    console.log(`edge pressure artifact: ${edgeOutput}`)
    console.log(`layer pressure artifact: ${layerOutput}`)
    console.log(`adapter chain: ${adapterResult.enabled ? adapterResult.decision : 'disabled'} | target=${genericLayerEnvelope}`)
    console.log(`swarm seam posture: ${formatSwarmSeamPostureFields(swarmSeamPosture)}`)
    if (adapterResult.enabled) {
      console.log(`adapter candidate: ${adapterCandidateOutput}`)
      console.log(`adapter decision: ${adapterDecisionOutput}`)
      console.log(adapterResult.observationWritten
        ? `adapter observation: ${adapterObservationOutput}`
        : 'adapter observation: skipped')
    }
    console.log('nonClaims: source pressure only; no Edge approval; no Layer admission; no production authority; productionReady=false')
  }

  return result
}

async function writeStudioSourcePressureAdapterChain({
  root,
  projectId,
  layerPressureArtifact,
  layerOutput,
  adapterCandidateOutput,
  adapterDecisionOutput,
  adapterObservationOutput,
  adapterDecision,
  createdAt
}) {
  const approved = adapterDecision === 'approved'
  const candidate = createStudioSourcePressureAdapterCandidate({
    projectId,
    sourceLayerPressureArtifact: layerPressureArtifact,
    sourceLayerPressureArtifactPath: layerOutput,
    createdAt
  })
  const operatorDecision = createStudioSourcePressureAdapterOperatorDecision({
    projectId,
    sourceAdapterCandidate: candidate,
    approved,
    createdAt
  })
  const observationResult = approved
    ? createStudioSourcePressureObservationResult({
      projectId,
      sourceAdapterCandidate: candidate,
      sourceOperatorDecision: operatorDecision,
      sourceLayerPressureArtifact: layerPressureArtifact,
      createdAt
    })
    : null

  await writeJsonAtomic(root, adapterCandidateOutput, candidate)
  await writeJsonAtomic(root, adapterDecisionOutput, operatorDecision)

  if (observationResult) {
    await writeJsonAtomic(root, adapterObservationOutput, observationResult)
  }

  return {
    enabled: true,
    decision: adapterDecision,
    targetGenericEnvelope: genericLayerEnvelope,
    emittedEnvelopeSchemaVersion: genericLayerEnvelopeSchema,
    observationWritten: Boolean(observationResult),
    candidate,
    operatorDecision,
    observationResult,
    nonClaims: studioSourcePressureAdapterNonClaims(),
    outputs: {
      adapterCandidateOutput,
      adapterDecisionOutput,
      ...(observationResult ? { adapterObservationOutput } : {})
    }
  }
}

export function createEdgePressureArtifact({
  projectId,
  sourceRefs,
  missingSourceSchemas = [],
  createdAt = nowIso()
}) {
  const artifact = {
    schema: artifactKinds.mediaEdgePressureArtifactLocal,
    pressureArtifactId: `media-edge-pressure-${projectId}`,
    projectId,
    createdAt,
    mode: 'standalone-local',
    pressureKind: 'studio-to-edge-operator-pressure',
    targetRepo: 'mesh-ecology-edge',
    targetSurface: 'media-edge-operator-seam',
    sourceRefs,
    domainOwnedMeaning: 'Studio describes local media work, evidence, readiness blockers, and requested operator attention.',
    crossRepoRefs: {
      targetRepo: 'mesh-ecology-edge',
      targetSurface: 'media-edge-operator-seam',
      spinePacketRef: '../mesh-ecology-spine/docs/work-packets/studio-virtualia-opaque-layer-pressure-v0.md',
      sourcePressureOnly: true
    },
    requestedOperatorAttention: [
      'inspect_studio_media_pressure',
      'preserve_studio_owned_media_semantics',
      'classify_as_operator_pressure_only'
    ],
    readinessBlockers: missingSourceSchemas.map((schema) => `missing_source_schema:${schema}`),
    blockedClaims: [
      'edge_approval',
      'edge_runtime_verified',
      'mesh_published',
      'publication_authorization',
      'production_ready',
      'operator_authority_granted',
      'local_scaffold_authority'
    ],
    nextSafeMove: 'Edge may inspect and classify this artifact as operator pressure after source refs and non-claims are preserved.',
    nonClaims: {
      edgeApproval: false,
      edgeRuntimeVerified: false,
      meshPublished: false,
      publicationAuthorization: false,
      productionReady: false,
      operatorAuthorityGranted: false,
      localScaffoldAuthority: false
    },
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    providerTruth: false,
    edgeRuntimeBuilt: false,
    edgeRuntimeVerified: false,
    localTruthLabel: 'local source pressure',
    truthStatus
  }

  validateRequiredRecord(artifact)
  return artifact
}

export function createLayerPressureArtifact({
  projectId,
  sourceRefs,
  layerInteropSummary,
  missingSourceSchemas = [],
  createdAt = nowIso()
}) {
  const artifact = {
    schema: artifactKinds.mediaLayerPressureArtifactLocal,
    pressureArtifactId: `media-layer-pressure-${projectId}`,
    projectId,
    createdAt,
    mode: 'standalone-local',
    pressureKind: 'studio-to-layer-opaque-ref-pressure',
    targetRepo: 'mesh-ecology-layer',
    targetSurface: 'local-layer-projection-candidate-review',
    sourceRefs,
    layerFacingRefs: {
      layerRefs: layerInteropSummary.layerRefs ?? [],
      layerProfileRefs: layerInteropSummary.layerProfileRefs ?? [],
      continuityRefs: layerInteropSummary.continuityRefs ?? [],
      desyncPostureRefs: layerInteropSummary.desyncPostureRefs ?? [],
      rbcProfileRefs: layerInteropSummary.rbcProfileRefs ?? [],
      resourceRefCandidateRefs: sourceRefs
        .filter((ref) => ref.schema === artifactKinds.mediaLocalLayerResourceRefCandidateLocal)
    },
    domainOwnedMeaning: 'Studio proposes media-domain resource/ref and production-package posture for later Layer inspection.',
    crossRepoRefs: {
      targetRepo: 'mesh-ecology-layer',
      targetSurface: 'local-layer-projection-candidate-review',
      spinePacketRef: '../mesh-ecology-spine/docs/work-packets/studio-virtualia-opaque-layer-pressure-v0.md',
      sourcePressureOnly: true
    },
    readinessBlockers: missingSourceSchemas.map((schema) => `missing_source_schema:${schema}`),
    blockedClaims: [
      'layer_admission',
      'durable_append_approved',
      'continuity_claimed',
      'resource_admission',
      'mesh_truth',
      'production_ready',
      'local_scaffold_authority'
    ],
    nextSafeMove: 'Layer may later review source refs opaquely and decide whether a separate admission/projection artifact is needed.',
    nonClaims: {
      layerAdmission: false,
      durableAppendApproved: false,
      continuityClaimed: false,
      resourceAdmission: false,
      meshTruth: false,
      productionReady: false,
      localScaffoldAuthority: false
    },
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    providerTruth: false,
    edgeRuntimeBuilt: false,
    edgeRuntimeVerified: false,
    localTruthLabel: 'local source pressure',
    truthStatus
  }

  validateRequiredRecord(artifact)
  return artifact
}

export function createStudioSourcePressureAdapterCandidate({
  projectId,
  sourceLayerPressureArtifact,
  sourceLayerPressureArtifactPath = defaultLayerOutput,
  layerRef = defaultLayerRef,
  layerProfileRef = defaultLayerProfileRef,
  sourceRefs = sourceLayerPressureArtifact?.sourceRefs ?? [],
  createdAt = nowIso()
}) {
  const sourcePressureRef = sourceLayerPressureArtifact
    ? localRecordRef({
      kind: 'media-layer-pressure-artifact',
      id: sourceLayerPressureArtifact.pressureArtifactId,
      schema: sourceLayerPressureArtifact.schema,
      relativePath: sourceLayerPressureArtifactPath
    })
    : {
      kind: 'media-layer-pressure-artifact',
      id: `media-layer-pressure-${projectId}`,
      schema: artifactKinds.mediaLayerPressureArtifactLocal,
      localOnly: true
    }

  const artifact = {
    schema: artifactKinds.mediaStudioSourcePressureAdapterCandidateLocal,
    adapterCandidateId: `studio-source-pressure-adapter-candidate-${projectId}`,
    projectId,
    createdAt,
    mode: 'standalone-local',
    candidateKind: 'studio_source_pressure_adapter_candidate',
    sourceRepo: 'mesh-ecology-media-studio',
    targetRepo: 'mesh-ecology-layer',
    targetGenericEnvelope: genericLayerEnvelope,
    sourcePressureKind: 'studio-to-layer-opaque-ref-pressure',
    sourceLayerPressureArtifactRef: sourcePressureRef,
    requestedLayerRef: {
      kind: 'layer',
      id: layerRef
    },
    requestedLayerProfileRef: {
      kind: 'layer-profile',
      id: layerProfileRef
    },
    sourceRefs,
    requestedOutput: {
      artifactKind: 'layer_source_pressure_review',
      schemaVersion: genericLayerEnvelopeSchema,
      posture: 'generic_source_pressure_review_only'
    },
    blockedClaims: [
      'studio_specific_layer_api',
      'layer_admission',
      'durable_append',
      'accepted_continuity',
      'production_storage_selection',
      'writer_reader_admission_change',
      'edge_authority',
      'payload_validity_from_ref_discovery',
      'auto_execute'
    ],
    nonClaims: studioSourcePressureAdapterNonClaims(),
    studioSpecificLayerApiCreated: false,
    layerAdmissionApproved: false,
    durableAppendApproved: false,
    acceptedContinuityCreated: false,
    productionStorageSelected: false,
    writerReaderAdmissionChanged: false,
    edgeAuthorityCreated: false,
    payloadValidityFromRefDiscovery: false,
    autoExecute: false,
    nextSafeMove: 'operator_decision_required_before_emitting_studio_source_pressure_observation',
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    providerTruth: false,
    edgeRuntimeBuilt: false,
    edgeRuntimeVerified: false,
    localTruthLabel: 'local Studio source-pressure adapter candidate',
    truthStatus
  }

  validateRequiredRecord(artifact)
  return artifact
}

export function createStudioSourcePressureAdapterOperatorDecision({
  projectId,
  sourceAdapterCandidate,
  approved = true,
  createdAt = nowIso()
}) {
  const artifact = {
    schema: artifactKinds.mediaStudioSourcePressureAdapterOperatorDecisionLocal,
    decisionId: `studio-source-pressure-adapter-operator-decision-${projectId}`,
    projectId,
    createdAt,
    mode: 'standalone-local',
    decisionKind: 'studio_source_pressure_adapter_operator_decision',
    decisionStatus: approved
      ? 'approved_bounded_studio_source_pressure_observation'
      : 'rejected_bounded_studio_source_pressure_observation',
    sourceAdapterCandidateRef: refForStudioSourcePressureAdapterCandidate(sourceAdapterCandidate),
    approvedOnly: approved ? ['future_bounded_studio_source_pressure_observation'] : [],
    blockedClaims: [
      'studio_source_pressure_not_emitted_by_decision',
      'studio_specific_layer_api',
      'layer_admission',
      'durable_append',
      'accepted_continuity',
      'production_storage_selection',
      'edge_authority',
      'auto_execute'
    ],
    nonClaims: studioSourcePressureAdapterNonClaims(),
    studioSourcePressureEmitted: false,
    layerAdmissionApproved: false,
    durableAppendApproved: false,
    acceptedContinuityCreated: false,
    productionStorageSelected: false,
    writerReaderAdmissionChanged: false,
    edgeAuthorityCreated: false,
    autoExecute: false,
    nextSafeMove: approved ? 'studio_source_pressure_observation_result_or_hold' : 'hold',
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    providerTruth: false,
    edgeRuntimeBuilt: false,
    edgeRuntimeVerified: false,
    localTruthLabel: 'local Studio source-pressure adapter operator decision',
    truthStatus
  }

  validateRequiredRecord(artifact)
  return artifact
}

export function createStudioSourcePressureObservationResult({
  projectId,
  sourceAdapterCandidate,
  sourceOperatorDecision,
  sourceLayerPressureArtifact,
  genericLayerReviewRef = `layer-source-pressure-review:operator-local:v0:studio:${projectId}`,
  createdAt = nowIso()
}) {
  const sourceRefs = [
    refForStudioSourcePressureAdapterCandidate(sourceAdapterCandidate),
    refForStudioSourcePressureAdapterOperatorDecision(sourceOperatorDecision),
    sourceLayerPressureArtifact
      ? {
        kind: 'media-layer-pressure-artifact',
        id: sourceLayerPressureArtifact.pressureArtifactId,
        schema: sourceLayerPressureArtifact.schema,
        localOnly: true
      }
      : null,
    ...(sourceAdapterCandidate?.sourceRefs ?? [])
  ].filter(Boolean)

  const artifact = {
    schema: artifactKinds.mediaStudioSourcePressureObservationResultLocal,
    observationId: `studio-source-pressure-observation-result-${projectId}`,
    projectId,
    createdAt,
    mode: 'standalone-local',
    observationKind: 'studio_source_pressure_observation_result',
    observationStatus: 'studio_source_pressure_routed_through_generic_layer_seam',
    sourceOperatorDecisionRef: refForStudioSourcePressureAdapterOperatorDecision(sourceOperatorDecision),
    sourceAdapterCandidateRef: refForStudioSourcePressureAdapterCandidate(sourceAdapterCandidate),
    studioSourcePressureRef: sourceLayerPressureArtifact?.pressureArtifactId ?? sourceAdapterCandidate?.sourceLayerPressureArtifactRef?.id,
    genericLayerReviewRef,
    emittedEnvelopeKind: 'layer_source_pressure_review',
    emittedEnvelopeSchemaVersion: genericLayerEnvelopeSchema,
    routedThroughGenericLayerSeam: true,
    sourceRefs,
    layerProfileRefs: [sourceAdapterCandidate?.requestedLayerProfileRef?.id ?? defaultLayerProfileRef],
    blockedClaims: [
      'studio_specific_layer_api',
      'layer_truth_from_studio_pressure',
      'layer_admission',
      'durable_append',
      'accepted_continuity',
      'production_storage_selection',
      'edge_action_queue_creation',
      'edge_authority',
      'auto_execute'
    ],
    nonClaims: studioSourcePressureAdapterNonClaims(),
    studioSpecificLayerApiCreated: false,
    layerTruthClaimed: false,
    layerAdmissionApproved: false,
    durableAppendApproved: false,
    acceptedContinuityCreated: false,
    productionStorageSelected: false,
    writerReaderAdmissionChanged: false,
    edgeActionQueued: false,
    edgeAuthorityCreated: false,
    payloadValidityFromRefDiscovery: false,
    autoExecute: false,
    nextSafeMove: 'edge_studio_pressure_review_or_hold',
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    providerTruth: false,
    edgeRuntimeBuilt: false,
    edgeRuntimeVerified: false,
    localTruthLabel: 'local Studio source-pressure observation result',
    truthStatus
  }

  validateRequiredRecord(artifact)
  return artifact
}

export function buildStudioSourcePressureAdapterFixture({
  projectId = 'venice-smoke-project',
  createdAt = '2026-05-26T00:00:00.000Z'
} = {}) {
  const layerPressureArtifact = createLayerPressureArtifact({
    projectId,
    createdAt,
    sourceRefs: [
      localRecordRef({
        kind: 'media-local-layer-resource-ref-candidate',
        id: 'resource-ref-candidate-venice',
        schema: artifactKinds.mediaLocalLayerResourceRefCandidateLocal,
        relativePath: 'records/layer/media-local-layer-resource-ref-candidate.local.json'
      }),
      localRecordRef({
        kind: 'media-authority-handoff-candidate',
        id: 'authority-handoff-venice',
        schema: artifactKinds.mediaAuthorityHandoffCandidateLocal,
        relativePath: 'records/authority/media-authority-handoff-candidate.local.json'
      })
    ],
    layerInteropSummary: {
      layerRefs: [defaultLayerRef],
      layerProfileRefs: [defaultLayerProfileRef],
      continuityRefs: ['continuity-ref:operator-local:v0:decision-log'],
      desyncPostureRefs: ['desync-posture:operator-local:v0:policy-history'],
      rbcProfileRefs: []
    }
  })
  const candidate = createStudioSourcePressureAdapterCandidate({
    projectId,
    sourceLayerPressureArtifact: layerPressureArtifact,
    createdAt
  })
  const operatorDecision = createStudioSourcePressureAdapterOperatorDecision({
    projectId,
    sourceAdapterCandidate: candidate,
    createdAt
  })
  const observationResult = createStudioSourcePressureObservationResult({
    projectId,
    sourceAdapterCandidate: candidate,
    sourceOperatorDecision: operatorDecision,
    sourceLayerPressureArtifact: layerPressureArtifact,
    createdAt
  })

  return {
    layerPressureArtifact,
    candidate,
    operatorDecision,
    observationResult
  }
}

function studioSourcePressureAdapterNonClaims() {
  return {
    studioSpecificLayerApiCreated: false,
    layerAdmission: false,
    durableAppendApproved: false,
    acceptedContinuityCreated: false,
    productionStorageSelected: false,
    writerReaderAdmissionChanged: false,
    edgeAuthority: false,
    payloadValidityFromRefDiscovery: false,
    autoExecute: false
  }
}

function refForStudioSourcePressureAdapterCandidate(candidate) {
  return {
    kind: 'media-studio-source-pressure-adapter-candidate',
    id: candidate.adapterCandidateId,
    schema: candidate.schema,
    localOnly: true
  }
}

function refForStudioSourcePressureAdapterOperatorDecision(decision) {
  return {
    kind: 'media-studio-source-pressure-adapter-operator-decision',
    id: decision.decisionId,
    schema: decision.schema,
    localOnly: true
  }
}

function refsForSchemas(records, schemas) {
  return records
    .filter((entry) => schemas.has(entry.record.schema))
    .map(({ record, path: relativePath }) => localRecordRef({
      kind: kindForSchema(record.schema),
      id: idForRecord(record),
      schema: record.schema,
      relativePath
    }))
}

function missingSchemas(records, schemas) {
  const present = new Set(records.map((entry) => entry.record.schema))
  return [...schemas].filter((schema) => !present.has(schema))
}

function localRecordRef({ kind, id, schema, relativePath }) {
  return {
    kind,
    id,
    schema,
    path: relativePath,
    localOnly: true
  }
}

function kindForSchema(schema) {
  return schema
    .replace(/^media\./, 'media-')
    .replace(/\.local\.v1$/, '')
    .replace(/\.summary$/, '')
    .replace(/\.v1$/, '')
    .replaceAll('_', '-')
    .replaceAll('.', '-')
}

function idForRecord(record) {
  return record.pressureArtifactId ??
    record.compatibilityBundleId ??
    record.packetId ??
    record.indexId ??
    record.requestId ??
    record.resourceRefCandidateId ??
    record.handoffCandidateId ??
    record.reportId ??
    record.capsuleId ??
    record.bundleId ??
    record.schema
}

if (process.argv[1] === modulePath) {
  writeStudioPressureArtifacts(parseArgs(process.argv.slice(2)))
    .catch((error) => {
      console.error(error.message)
      process.exitCode = 1
    })
}
