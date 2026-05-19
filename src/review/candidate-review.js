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
    selectedAssetId: undefined,
    operatorRef: 'local-operator',
    output: undefined
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]

    if (arg === '--project-dir') {
      args.projectDir = next
      i += 1
    } else if (arg === '--selected-asset-id') {
      args.selectedAssetId = next
      i += 1
    } else if (arg === '--operator-ref') {
      args.operatorRef = next
      i += 1
    } else if (arg === '--output') {
      args.output = next
      i += 1
    }
  }

  return args
}

export async function writeCandidateReview({
  projectDir = 'examples/card-to-candidate',
  selectedAssetId,
  operatorRef = 'local-operator',
  output
} = {}) {
  const root = path.resolve(projectDir)
  const card = JSON.parse(await readFile(path.join(root, 'cards', 'card.json'), 'utf8'))
  validateRequiredRecord(card, artifactKinds.mediaCard)

  const assetEntries = await readAssetDescriptors(root)
  if (assetEntries.length === 0) {
    throw new Error('Candidate review requires at least one local asset descriptor')
  }

  const selected = selectedAssetId
    ? assetEntries.find((entry) => entry.record.assetId === selectedAssetId)
    : assetEntries[0]

  if (!selected) {
    throw new Error(`Selected asset was not found: ${selectedAssetId}`)
  }

  const review = createCandidateReview({
    card,
    assetEntries,
    selectedAsset: selected.record,
    operatorRef
  })
  const outputRef = output ?? `records/evidence/${review.candidateReviewId}.local.json`
  assertSafeLocalPath(outputRef)
  const outputPath = path.join(root, outputRef)
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(review, null, 2)}\n`)

  console.log(`Wrote local candidate review: ${outputRef}`)

  return {
    review,
    output: outputRef
  }
}

export function createCandidateReview({
  card,
  assetEntries,
  selectedAsset,
  operatorRef,
  createdAt = nowIso()
}) {
  const candidateAssetRefs = assetEntries.map(({ record, path: recordPath }) => ({
    ...makeRef('media-asset', record.assetId, record.schema),
    path: recordPath,
    localRef: record.localRef,
    contentType: record.contentType,
    lifecycleState: record.provenance?.lifecycle?.state,
    localOnly: true
  }))
  const review = {
    schema: artifactKinds.mediaCandidateReviewLocal,
    candidateReviewId: `candidate-review-${card.cardId}-${selectedAsset.assetId}`,
    projectId: card.projectId,
    cardRef: makeRef('media-card', card.cardId, card.schema),
    candidateAssetRefs,
    selectedAssetRef: makeRef('media-asset', selectedAsset.assetId, selectedAsset.schema),
    operatorRef,
    criteria: card.acceptanceCriteria ?? [],
    summary: `Local comparison selected ${selectedAsset.assetId} from ${candidateAssetRefs.length} candidate asset(s).`,
    createdAt,
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    localTruthLabel: 'local evidence',
    truthStatus
  }

  validateRequiredRecord(review)

  return review
}

async function readAssetDescriptors(root) {
  const recordsRoot = path.join(root, 'records', 'assets')
  const files = await listJsonFiles(recordsRoot)
  const entries = []

  for (const file of files) {
    const record = JSON.parse(await readFile(file, 'utf8'))
    if (record.schema !== artifactKinds.mediaAssetDescriptor) continue
    validateRequiredRecord(record)
    entries.push({
      path: path.relative(root, file).split(path.sep).join('/'),
      record
    })
  }

  return entries.sort((left, right) => left.path.localeCompare(right.path))
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

  return files
}

if (process.argv[1] === modulePath) {
  await writeCandidateReview(parseArgs(process.argv.slice(2)))
}
