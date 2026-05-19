import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { artifactKinds } from '../contracts/artifact-kinds.js'
import { makeRef, nowIso } from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import { assertSafeLocalPath } from '../local/project-layout.js'

const modulePath = fileURLToPath(import.meta.url)
const truthStatus = 'not mesh truth; not distributed proof; not ratified shared state'

function parseArgs(argv) {
  const args = {
    projectDir: 'examples/card-to-candidate',
    output: undefined,
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

export async function writeContinuityEvidence({
  projectDir = 'examples/card-to-candidate',
  output,
  print = false
} = {}) {
  const root = path.resolve(projectDir)
  const card = JSON.parse(await readFile(path.join(root, 'cards', 'card.json'), 'utf8'))
  validateRequiredRecord(card, artifactKinds.mediaCard)
  const asset = await readFirstAssetDescriptor(root)
  const continuity = createContinuityEvidence({ card, asset })
  const outputRef = output ?? `records/evidence/continuity-${asset.assetId}.local.json`
  assertSafeLocalPath(outputRef)
  const outputPath = path.join(root, outputRef)
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(continuity, null, 2)}\n`)

  if (print) {
    console.log(JSON.stringify(continuity, null, 2))
  } else {
    console.log(`Wrote local continuity evidence: ${outputRef}`)
  }

  return {
    continuity,
    output: outputRef
  }
}

export function createContinuityEvidence({ card, asset, createdAt = nowIso() }) {
  const subjectRef = makeRef('media-asset', asset.assetId, asset.schema)
  const continuity = {
    schema: artifactKinds.mediaContinuityEvidenceLocal,
    continuityEvidenceId: `continuity-${asset.assetId}`,
    projectId: card.projectId,
    subjectRef,
    parentRefs: [
      makeRef('media-card', card.cardId, card.schema),
      ...asset.lineage.parentRefs
    ],
    referents: asset.lineage.referents ?? card.referenceAssetRefs ?? [],
    branchId: asset.lineage.branchId ?? `${card.projectId}:local`,
    contextId: asset.lineage.contextId ?? card.sceneId ?? card.projectId,
    observerRef: asset.lineage.observerRef ?? 'local-operator',
    continuityClaims: asset.lineage.continuityClaims ?? [],
    transitionSummary: asset.lineage.transitionSummary ?? 'Local media asset continuity draft.',
    createdAt,
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    causalTruth: false,
    localTruthLabel: 'local evidence',
    truthStatus
  }

  validateRequiredRecord(continuity)

  return continuity
}

async function readFirstAssetDescriptor(root) {
  const files = await listJsonFiles(path.join(root, 'records', 'assets'))

  for (const file of files) {
    const record = JSON.parse(await readFile(file, 'utf8'))
    if (record.schema === artifactKinds.mediaAssetDescriptor) {
      validateRequiredRecord(record)
      return record
    }
  }

  throw new Error('Continuity evidence requires a local asset descriptor')
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
  await writeContinuityEvidence(parseArgs(process.argv.slice(2)))
}
