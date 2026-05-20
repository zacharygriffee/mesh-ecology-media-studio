import { createHash } from 'node:crypto'
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
    selectedAssetDescriptorRef: undefined,
    selectedSituationRef: undefined,
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
    } else if (arg === '--selected-asset-descriptor-ref') {
      args.selectedAssetDescriptorRef = next
      i += 1
    } else if (arg === '--selected-situation-ref') {
      args.selectedSituationRef = next
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
  selectedAssetDescriptorRef,
  selectedSituationRef,
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

  const selected = selectAssetEntry({
    assetEntries,
    selectedAssetId,
    selectedAssetDescriptorRef,
    selectedSituationRef
  })

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
    contentId: record.contentId,
    assetDescriptorRef: record.assetDescriptorRef ?? null,
    situationRef: record.situationRef ?? null,
    placementRef: record.placementRef ?? null,
    localRef: record.localRef,
    contentType: record.contentType,
    lifecycleState: record.provenance?.lifecycle?.state,
    localOnly: true
  }))
  const selectedSituationToken = selectedAsset.situationRef?.id
    ? `-${compactRefToken(selectedAsset.situationRef.id)}`
    : ''
  const review = {
    schema: artifactKinds.mediaCandidateReviewLocal,
    candidateReviewId: `candidate-review-${card.cardId}-${selectedAsset.assetId}${selectedSituationToken}`,
    projectId: card.projectId,
    cardRef: makeRef('media-card', card.cardId, card.schema),
    candidateAssetRefs,
    selectedAssetRef: makeRef('media-asset', selectedAsset.assetId, selectedAsset.schema),
    selectedAssetDescriptorRef: selectedAsset.assetDescriptorRef ?? null,
    selectedSituationRef: selectedAsset.situationRef ?? null,
    selectedPlacementRef: selectedAsset.placementRef ?? null,
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

function selectAssetEntry({
  assetEntries,
  selectedAssetId,
  selectedAssetDescriptorRef,
  selectedSituationRef
}) {
  if (selectedAssetDescriptorRef) {
    const matches = assetEntries.filter((entry) => entry.record.assetDescriptorRef?.id === selectedAssetDescriptorRef)
    if (matches.length === 0) {
      throw new Error(`Selected asset descriptor ref was not found: ${selectedAssetDescriptorRef}`)
    }
    if (matches.length > 1) {
      throw new Error(`Selected asset descriptor ref is ambiguous: ${selectedAssetDescriptorRef}. Use --selected-situation-ref.`)
    }
    return matches[0]
  }

  if (selectedSituationRef) {
    const matches = assetEntries.filter((entry) => entry.record.situationRef?.id === selectedSituationRef)
    if (matches.length === 0) {
      throw new Error(`Selected situation ref was not found: ${selectedSituationRef}`)
    }
    if (matches.length > 1) {
      throw new Error(`Selected situation ref is ambiguous: ${selectedSituationRef}`)
    }
    return matches[0]
  }

  if (selectedAssetId) {
    const matches = assetEntries.filter((entry) => entry.record.assetId === selectedAssetId)
    if (matches.length === 0) {
      throw new Error(`Selected asset was not found: ${selectedAssetId}`)
    }
    if (matches.length > 1) {
      throw new Error(`Selected asset id is ambiguous: ${selectedAssetId}. Use --selected-asset-descriptor-ref or --selected-situation-ref.`)
    }
    return matches[0]
  }

  return assetEntries[0]
}

function compactRefToken(ref) {
  return createHash('sha256').update(ref).digest('hex').slice(0, 12)
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
