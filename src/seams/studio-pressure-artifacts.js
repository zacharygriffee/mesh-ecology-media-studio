import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { artifactKinds } from '../contracts/artifact-kinds.js'
import { nowIso } from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import { summarizeLayerInteropFromRecords } from '../layer/layer-interop.js'
import { writeJsonAtomic } from '../local/atomic-json.js'
import { assertSafeLocalPath } from '../local/project-layout.js'
import { readProjectRecords } from './project-status.js'

const modulePath = fileURLToPath(import.meta.url)
const defaultProjectDir = 'examples/card-to-candidate'
const defaultEdgeOutput = 'records/exports/media-edge-pressure-artifact.local.json'
const defaultLayerOutput = 'records/exports/media-layer-pressure-artifact.local.json'
const truthStatus = 'not mesh truth; not distributed proof; not ratified shared state'

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

function parseArgs(argv) {
  const args = {
    projectDir: defaultProjectDir,
    edgeOutput: defaultEdgeOutput,
    layerOutput: defaultLayerOutput,
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
  createdAt = nowIso(),
  print = false,
  quiet = false
} = {}) {
  assertSafeLocalPath(edgeOutput)
  assertSafeLocalPath(layerOutput)

  const root = path.resolve(projectDir)
  const records = (await readProjectRecords(root))
    .filter((entry) => ![
      artifactKinds.mediaEdgePressureArtifactLocal,
      artifactKinds.mediaLayerPressureArtifactLocal
    ].includes(entry.record.schema))
  const projectId = records.find((entry) => typeof entry.record.projectId === 'string')?.record.projectId ??
    path.basename(root)
  const edgeSourceRefs = refsForSchemas(records, edgePressureSchemas)
  const layerSourceRefs = refsForSchemas(records, layerPressureSchemas)

  if (edgeSourceRefs.length === 0) {
    throw new Error('Edge pressure artifact requires at least one Edge-facing Studio source ref')
  }

  if (layerSourceRefs.length === 0) {
    throw new Error('Layer pressure artifact requires at least one Layer-facing Studio source ref')
  }

  const edgePressureArtifact = createEdgePressureArtifact({
    projectId,
    sourceRefs: edgeSourceRefs,
    missingSourceSchemas: missingSchemas(records, edgePressureSchemas),
    createdAt
  })
  const layerPressureArtifact = createLayerPressureArtifact({
    projectId,
    sourceRefs: layerSourceRefs,
    layerInteropSummary: summarizeLayerInteropFromRecords(records),
    missingSourceSchemas: missingSchemas(records, layerPressureSchemas),
    createdAt
  })

  await writeJsonAtomic(root, edgeOutput, edgePressureArtifact)
  await writeJsonAtomic(root, layerOutput, layerPressureArtifact)

  if (print) {
    console.log(JSON.stringify({ edgePressureArtifact, layerPressureArtifact }, null, 2))
  } else if (!quiet) {
    console.log(`edge pressure artifact: ${edgeOutput}`)
    console.log(`layer pressure artifact: ${layerOutput}`)
    console.log('nonClaims: source pressure only; no Edge approval; no Layer admission; no production authority; productionReady=false')
  }

  return {
    edgePressureArtifact,
    layerPressureArtifact,
    outputs: {
      edgeOutput,
      layerOutput
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
