import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { artifactKinds } from '../contracts/artifact-kinds.js'
import { makeRef, nowIso } from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import { assertSafeLocalPath } from '../local/project-layout.js'

const modulePath = fileURLToPath(import.meta.url)
const defaultOutput = 'records/manifests/media-project-status.local.json'
const truthStatus = 'not mesh truth; not distributed proof; not ratified shared state'

function parseArgs(argv) {
  const args = {
    projectDir: 'examples/card-to-candidate',
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

export async function writeProjectStatus({
  projectDir = 'examples/card-to-candidate',
  output = defaultOutput,
  print = false
} = {}) {
  assertSafeLocalPath(output)
  const root = path.resolve(projectDir)
  const records = await readProjectRecords(root)
  const card = records.find((entry) => entry.record.schema === artifactKinds.mediaCard)?.record ??
    await readOptionalCard(root)
  const projectId = card?.projectId ?? path.basename(root)
  const counts = countRecords(records)
  const latestRefs = latestRecordRefs(records)
  const status = {
    schema: artifactKinds.mediaProjectStatusLocal,
    statusId: `project-status-${projectId}`,
    projectId,
    createdAt: nowIso(),
    mode: 'standalone-local',
    counts,
    latestRefs,
    warnings: [
      'Project status is a local snapshot only.',
      'Counts and refs are not mesh truth, provider truth, byte proof, or ratifier authority.'
    ],
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    providerTruth: false,
    byteAvailabilityProof: false,
    materializationProof: false,
    localTruthLabel: 'local cache',
    truthStatus
  }

  validateRequiredRecord(status)

  const outputPath = path.join(root, output)
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(status, null, 2)}\n`)

  if (print) {
    console.log(JSON.stringify(status, null, 2))
  } else {
    console.log(`project status: ${output}`)
    for (const [name, count] of Object.entries(counts)) {
      console.log(`${name}: ${count}`)
    }
  }

  return {
    status,
    output
  }
}

async function readProjectRecords(root) {
  const files = [
    ...await listJsonFiles(path.join(root, 'cards')),
    ...await listJsonFiles(path.join(root, 'records'))
  ]
  const records = []

  for (const file of files) {
    const relativePath = path.relative(root, file).split(path.sep).join('/')
    if (relativePath.startsWith('records/exports/bundles/')) continue
    const raw = JSON.parse(await readFile(file, 'utf8'))
    const record = raw.providerResult?.schema === artifactKinds.mediaProviderResult ? raw.providerResult : raw
    if (!record.schema) continue
    validateRequiredRecord(record)
    records.push({
      path: relativePath,
      record
    })
  }

  return records
}

async function readOptionalCard(root) {
  try {
    return JSON.parse(await readFile(path.join(root, 'cards', 'card.json'), 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return undefined
    throw error
  }
}

function countRecords(records) {
  const bySchema = (schema) => records.filter((entry) => entry.record.schema === schema).length
  const assetRecords = records.filter((entry) => entry.record.schema === artifactKinds.mediaAssetDescriptor)

  return {
    cards: bySchema(artifactKinds.mediaCard),
    references: assetRecords.filter((entry) => entry.record.localRef?.placementClass === 'media-reference').length,
    providerResults: bySchema(artifactKinds.mediaProviderResult),
    adapterRuns: bySchema(artifactKinds.mediaProviderAdapterRunLocal),
    assets: assetRecords.length,
    reviewEvidence: records.filter((entry) => entry.record.schema === artifactKinds.mediaEvidence && entry.record.evidenceKind === 'local-review').length,
    candidateReviews: bySchema(artifactKinds.mediaCandidateReviewLocal),
    continuityEvidence: bySchema(artifactKinds.mediaContinuityEvidenceLocal),
    decisions: bySchema(artifactKinds.mediaOperatorDecision),
    manifests: bySchema(artifactKinds.mediaLocalRunManifest),
    inspectionPackets: bySchema(artifactKinds.mediaEdgeInspectionPacketLocal),
    exportBundles: bySchema(artifactKinds.mediaEdgeExportBundleLocal),
    providerLedgers: bySchema(artifactKinds.mediaProviderRunLedgerLocal)
  }
}

function latestRecordRefs(records) {
  const refs = {}

  for (const entry of records) {
    const schema = entry.record.schema
    refs[schema] = {
      ...makeRef(schema, entry.path, schema),
      path: entry.path,
      localOnly: true
    }
  }

  return refs
}

async function listJsonFiles(root) {
  let dirents
  try {
    dirents = await readdir(root, { withFileTypes: true })
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }

  const files = []

  for (const dirent of dirents) {
    const fullPath = path.join(root, dirent.name)
    if (dirent.isDirectory()) {
      files.push(...await listJsonFiles(fullPath))
    } else if (dirent.isFile() && dirent.name.endsWith('.json')) {
      files.push(fullPath)
    }
  }

  return files.sort()
}

if (process.argv[1] === modulePath) {
  await writeProjectStatus(parseArgs(process.argv.slice(2)))
}
