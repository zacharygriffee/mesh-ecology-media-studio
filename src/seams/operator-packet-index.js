import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { artifactKinds } from '../contracts/artifact-kinds.js'
import { makeRef, nowIso } from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import { assertSafeLocalPath } from '../local/project-layout.js'

const modulePath = fileURLToPath(import.meta.url)
const defaultProjectDir = 'examples/card-to-candidate'
const defaultOutput = 'records/exports/media-operator-packet-index.local.json'
const truthStatus = 'not mesh truth; not distributed proof; not ratified shared state'

function parseArgs(argv) {
  const args = {
    projectDir: defaultProjectDir,
    output: defaultOutput,
    print: false
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]

    if (arg === '--project-dir') {
      args.projectDir = next
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

export async function writeOperatorPacketIndex({
  projectDir = defaultProjectDir,
  output = defaultOutput,
  print = false
} = {}) {
  assertSafeLocalPath(output)

  const root = path.resolve(projectDir)
  const records = await readIndexableRecords(root)
  const projectId = inferProjectId(records, path.basename(root))
  const packetRefs = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaEdgeInspectionPacketLocal)
    .map(toInspectionRef)
  const bundleRefs = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaEdgeExportBundleLocal || entry.record.schema === artifactKinds.mediaEdgeCompatibilityBundleLocal)
    .map(toInspectionRef)
  const healthRefs = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaProjectHealthLocal)
    .map(toInspectionRef)
  const handoffCandidateRefs = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaEdgeHandoffCandidateLocal)
    .map(toInspectionRef)
  const operatorDecisionRequestRefs = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaOperatorDecisionRequestLocal)
    .map(toInspectionRef)
  const readinessStates = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaProjectHealthLocal)
    .map((entry) => entry.record.healthState)

  const index = {
    schema: artifactKinds.mediaOperatorPacketIndexLocal,
    indexId: `operator-packet-index-${projectId}`,
    projectId,
    createdAt: nowIso(),
    mode: 'standalone-local',
    indexedRootRef: {
      ...makeRef('local-directory', 'records', 'media.local_ref.v1'),
      path: 'records',
      localOnly: true
    },
    packetRefs,
    bundleRefs,
    healthRefs,
    handoffCandidateRefs,
    operatorDecisionRequestRefs,
    summary: {
      packets: packetRefs.length,
      bundles: bundleRefs.length,
      healthRecords: healthRefs.length,
      handoffCandidates: handoffCandidateRefs.length,
      operatorDecisionRequests: operatorDecisionRequestRefs.length,
      readyHealthRecords: readinessStates.filter((state) => state === 'ready-for-local-inspection').length,
      needsAttentionHealthRecords: readinessStates.filter((state) => state === 'needs-local-attention').length,
      newestRecordPath: newestPath(records),
      operatorGuidanceOnly: true
    },
    warnings: [
      'Operator packet index is a local scanning aid, not a UI contract.',
      'Indexed records are local-only artifacts and not mesh truth.',
      'Edge may inspect these refs later, but this index does not call or verify Edge.'
    ],
    operatorGuidanceOnly: true,
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    providerTruth: false,
    edgeRuntimeVerified: false,
    localTruthLabel: 'local cache',
    truthStatus
  }

  validateRequiredRecord(index)

  const outputPath = path.join(root, output)
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(index, null, 2)}\n`)

  if (print) {
    console.log(JSON.stringify(index, null, 2))
  } else {
    console.log(`operator packet index: ${output}`)
    console.log(`packets: ${packetRefs.length}`)
    console.log(`bundles: ${bundleRefs.length}`)
    console.log(`handoffCandidates: ${handoffCandidateRefs.length}`)
    console.log(`operatorDecisionRequests: ${operatorDecisionRequestRefs.length}`)
  }

  return {
    index,
    output
  }
}

async function readIndexableRecords(root) {
  const candidates = [
    ...(await findJsonFiles(root, 'records/exports')),
    ...(await findJsonFiles(root, 'records/manifests')),
    ...(await findJsonFiles(root, 'records/requests'))
  ]
  const entries = []

  for (const relativePath of candidates.sort()) {
    const record = await readOptionalRecord(root, relativePath)
    if (!record?.schema || !indexableSchemas.has(record.schema)) continue
    validateRequiredRecord(record)
    entries.push({ record, relativePath })
  }

  return entries
}

const indexableSchemas = new Set([
  artifactKinds.mediaEdgeInspectionPacketLocal,
  artifactKinds.mediaEdgeExportBundleLocal,
  artifactKinds.mediaEdgeCompatibilityBundleLocal,
  artifactKinds.mediaProjectHealthLocal,
  artifactKinds.mediaEdgeHandoffCandidateLocal,
  artifactKinds.mediaOperatorDecisionRequestLocal
])

async function findJsonFiles(root, relativeRoot) {
  assertSafeLocalPath(relativeRoot)
  const absoluteRoot = path.join(root, relativeRoot)
  const files = []

  try {
    await collectJsonFiles(absoluteRoot, relativeRoot, files)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }

  return files
}

async function collectJsonFiles(absoluteDir, relativeDir, files) {
  for (const entry of await readdir(absoluteDir, { withFileTypes: true })) {
    const relativePath = path.posix.join(relativeDir, entry.name)
    if (entry.isDirectory()) {
      await collectJsonFiles(path.join(absoluteDir, entry.name), relativePath, files)
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      assertSafeLocalPath(relativePath)
      files.push(relativePath)
    }
  }
}

async function readOptionalRecord(root, relativePath) {
  try {
    return JSON.parse(await readFile(path.join(root, relativePath), 'utf8'))
  } catch {
    return null
  }
}

function toInspectionRef({ record, relativePath }) {
  return {
    ...makeRef(kindForSchema(record.schema), idForRecord(record), record.schema),
    path: relativePath,
    localOnly: true
  }
}

function inferProjectId(records, fallback) {
  return records.find((entry) => typeof entry.record.projectId === 'string')?.record.projectId ?? fallback
}

function newestPath(records) {
  return records
    .filter((entry) => typeof entry.record.createdAt === 'string')
    .sort((left, right) => right.record.createdAt.localeCompare(left.record.createdAt))
    .at(0)?.relativePath ?? null
}

function kindForSchema(schema) {
  return {
    [artifactKinds.mediaEdgeInspectionPacketLocal]: 'media-edge-inspection-packet',
    [artifactKinds.mediaEdgeExportBundleLocal]: 'media-edge-export-bundle',
    [artifactKinds.mediaEdgeCompatibilityBundleLocal]: 'media-edge-compatibility-bundle',
    [artifactKinds.mediaProjectHealthLocal]: 'media-project-health',
    [artifactKinds.mediaEdgeHandoffCandidateLocal]: 'media-edge-handoff-candidate',
    [artifactKinds.mediaOperatorDecisionRequestLocal]: 'media-operator-decision-request'
  }[schema] ?? schema
}

function idForRecord(record) {
  return record.packetId ??
    record.bundleId ??
    record.compatibilityBundleId ??
    record.healthId ??
    record.handoffCandidateId ??
    record.requestId
}

if (process.argv[1] === modulePath) {
  await writeOperatorPacketIndex(parseArgs(process.argv.slice(2)))
}
