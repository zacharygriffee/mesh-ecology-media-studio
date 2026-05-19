import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { artifactKinds } from '../contracts/artifact-kinds.js'
import { makeRef, nowIso } from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import { assertSafeLocalPath } from '../local/project-layout.js'

const modulePath = fileURLToPath(import.meta.url)
const defaultProjectDir = 'examples/card-to-candidate'
const defaultInspectionPacket = 'records/exports/local-run-edge-inspection-packet.local.json'
const defaultCompatibilityBundle = 'records/exports/media-edge-compatibility-bundle.local.json'
const defaultProjectHealth = 'records/manifests/media-project-health.local.json'
const defaultOperatorPacketIndex = 'records/exports/media-operator-packet-index.local.json'
const defaultOutput = 'records/exports/media-edge-handoff-candidate.local.json'
const truthStatus = 'not mesh truth; not distributed proof; not ratified shared state'

function parseArgs(argv) {
  const args = {
    projectDir: defaultProjectDir,
    inspectionPacket: defaultInspectionPacket,
    compatibilityBundle: defaultCompatibilityBundle,
    projectHealth: defaultProjectHealth,
    operatorPacketIndex: defaultOperatorPacketIndex,
    output: defaultOutput,
    print: false
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]

    if (arg === '--project-dir') {
      args.projectDir = next
      i += 1
    } else if (arg === '--inspection-packet') {
      args.inspectionPacket = next
      i += 1
    } else if (arg === '--compatibility-bundle') {
      args.compatibilityBundle = next
      i += 1
    } else if (arg === '--project-health') {
      args.projectHealth = next
      i += 1
    } else if (arg === '--operator-packet-index') {
      args.operatorPacketIndex = next
      i += 1
    } else if (arg === '--output') {
      args.output = next
      i += 1
    } else if (arg === '--print') {
      args.print = true
    }
  }

  return args
}

export async function writeEdgeHandoffCandidate({
  projectDir = defaultProjectDir,
  inspectionPacket = defaultInspectionPacket,
  compatibilityBundle = defaultCompatibilityBundle,
  projectHealth = defaultProjectHealth,
  operatorPacketIndex = defaultOperatorPacketIndex,
  output = defaultOutput,
  print = false
} = {}) {
  for (const localPath of [inspectionPacket, compatibilityBundle, projectHealth, operatorPacketIndex, output]) {
    assertSafeLocalPath(localPath)
  }

  const root = path.resolve(projectDir)
  const packet = await readAndValidate(root, inspectionPacket, artifactKinds.mediaEdgeInspectionPacketLocal)
  const bundle = await readAndValidate(root, compatibilityBundle, artifactKinds.mediaEdgeCompatibilityBundleLocal)
  const health = await readAndValidate(root, projectHealth, artifactKinds.mediaProjectHealthLocal)
  const index = await readAndValidate(root, operatorPacketIndex, artifactKinds.mediaOperatorPacketIndexLocal)
  const projectId = bundle.projectId
  const handoffState = health.healthState === 'ready-for-local-inspection' &&
    bundle.readinessResourceSummary?.edgeReadinessState === 'ready'
    ? 'ready-for-edge-inspection'
    : 'needs-local-attention'

  const handoff = {
    schema: artifactKinds.mediaEdgeHandoffCandidateLocal,
    handoffCandidateId: `edge-handoff-${projectId}`,
    projectId,
    createdAt: nowIso(),
    mode: 'standalone-local',
    targetSurface: 'media-edge-operator-seam',
    targetSeams: [
      'media-edge-operator-seam',
      'media-work-packet-seam',
      'media-evidence-import-seam',
      'media-readiness-guidance-seam',
      'media-operator-decision-seam',
      'media-byte-reference-seam',
      'media-causal-evidence-seam'
    ],
    sourceRefs: [
      localRef('media-edge-inspection-packet', packet.packetId, packet.schema, inspectionPacket),
      localRef('media-edge-compatibility-bundle', bundle.compatibilityBundleId, bundle.schema, compatibilityBundle),
      localRef('media-project-health', health.healthId, health.schema, projectHealth),
      localRef('media-operator-packet-index', index.indexId, index.schema, operatorPacketIndex),
      ...bundle.studioSourceRefs
    ],
    inspectionPacketRef: localRef('media-edge-inspection-packet', packet.packetId, packet.schema, inspectionPacket),
    compatibilityBundleRef: localRef('media-edge-compatibility-bundle', bundle.compatibilityBundleId, bundle.schema, compatibilityBundle),
    projectHealthRef: localRef('media-project-health', health.healthId, health.schema, projectHealth),
    operatorPacketIndexRef: localRef('media-operator-packet-index', index.indexId, index.schema, operatorPacketIndex),
    readinessState: bundle.readinessResourceSummary?.edgeReadinessState ?? 'unknown',
    handoffState,
    edgeShapeTargets: bundle.edgeShapeTargets,
    warnings: [
      'Handoff candidate is Studio-built local guidance only.',
      'This record does not call Edge, verify Edge runtime behavior, or authorize publication.',
      'Edge may later consume these refs, but Edge remains the operator boundary.'
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
    truthStatus
  }

  validateRequiredRecord(handoff)

  const outputPath = path.join(root, output)
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(handoff, null, 2)}\n`)

  if (print) {
    console.log(JSON.stringify(handoff, null, 2))
  } else {
    console.log(`edge handoff candidate: ${output}`)
    console.log(`handoffState: ${handoff.handoffState}`)
  }

  return {
    handoff,
    output
  }
}

async function readAndValidate(root, relativePath, schema) {
  const record = JSON.parse(await readFile(path.join(root, relativePath), 'utf8'))
  validateRequiredRecord(record, schema)
  return record
}

function localRef(kind, id, schema, relativePath) {
  return {
    ...makeRef(kind, id, schema),
    path: relativePath,
    localOnly: true
  }
}

if (process.argv[1] === modulePath) {
  await writeEdgeHandoffCandidate(parseArgs(process.argv.slice(2)))
}
