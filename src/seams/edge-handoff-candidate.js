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
  const diagnosis = createHandoffDiagnosis({ health, bundle })
  const handoffState = diagnosis.readyForEdgeInspection ? 'ready-for-edge-inspection' : 'needs-local-attention'

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
    readinessDiagnosis: diagnosis,
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
    console.log(formatHandoffSummary(handoff, output))
    if (handoff.readinessDiagnosis.nextActions.length > 0) {
      console.log(`nextAction: ${handoff.readinessDiagnosis.nextActions[0]}`)
    }
  }

  return {
    handoff,
    output
  }
}

function createHandoffDiagnosis({ health, bundle }) {
  const readinessSummary = bundle.readinessResourceSummary ?? {}
  const productionFreshness = health.productionValidation?.freshness ?? {}
  const reasons = []
  const nextActions = []

  if (health.healthState !== 'ready-for-local-inspection') {
    reasons.push(`project health is ${health.healthState}`)
    nextActions.push('Run npm run health:summary and resolve listed blocking issues before handoff.')
  }

  if (readinessSummary.edgeReadinessState !== 'ready') {
    reasons.push(`Edge readiness guidance is ${readinessSummary.edgeReadinessState ?? 'unknown'}`)
    nextActions.push('Run npm run readiness:edge and address unresolved byte/resource guidance.')
  }

  if (readinessSummary.assetResourceReady !== true) {
    reasons.push('asset/resource refs are not ready for Edge inspection')
    nextActions.push('Run npm run bytes:proposal and npm run resource:refs, then regenerate readiness and health.')
  }

  if (health.productionValidation?.valid !== true) {
    reasons.push('production graph is not valid')
    nextActions.push('Run npm run production:validate and fix production parentage before handoff.')
  }

  if (productionFreshness.fresh === false) {
    reasons.push(`${productionFreshness.staleDescriptorIds?.length ?? 0} production descriptors are stale`)
    nextActions.push('Regenerate or update production descriptors after production-unit changes.')
  }

  if (health.blockingIssues.length > 0) {
    reasons.push(`project health has ${health.blockingIssues.length} blocking issues`)
  }

  if (reasons.length === 0) {
    reasons.push('local inspection packet, compatibility bundle, project health, and resource readiness are aligned')
  }

  return {
    healthState: health.healthState,
    edgeReadinessState: readinessSummary.edgeReadinessState ?? 'unknown',
    assetResourceReady: readinessSummary.assetResourceReady === true,
    productionGraphValid: health.productionValidation?.valid === true,
    productionFreshness,
    operatorHealthExplanations: health.operatorHealthExplanations ?? [],
    blockingIssues: health.blockingIssues,
    reasons,
    nextActions: Array.from(new Set(nextActions)),
    readyForEdgeInspection: reasons.length === 1 && reasons[0].startsWith('local inspection packet'),
    operatorGuidanceOnly: true,
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    edgeRuntimeVerified: false
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

function formatHandoffSummary(handoff, output) {
  const diagnosis = handoff.readinessDiagnosis
  return [
    `edge handoff: ${handoff.handoffState}`,
    `health=${diagnosis.healthState}`,
    `readiness=${diagnosis.edgeReadinessState}`,
    `blockers=${diagnosis.blockingIssues.length}`,
    `output=${output}`
  ].join(' | ')
}

if (process.argv[1] === modulePath) {
  await writeEdgeHandoffCandidate(parseArgs(process.argv.slice(2)))
}
