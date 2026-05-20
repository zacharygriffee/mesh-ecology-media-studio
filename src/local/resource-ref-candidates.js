import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { artifactKinds } from '../contracts/artifact-kinds.js'
import { makeRef, nowIso } from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import { assertSafeLocalPath } from './project-layout.js'
import { createScaffoldResolvabilityPosture } from './resolvability.js'

const modulePath = fileURLToPath(import.meta.url)
const defaultProjectDir = 'examples/card-to-candidate'
const truthStatus = 'not mesh truth; not distributed proof; not ratified shared state'
const eligiblePlacementClasses = new Set(['media-accepted', 'media-reference'])

function parseArgs(argv) {
  const args = {
    projectDir: defaultProjectDir,
    quiet: false
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]

    if (arg === '--project-dir') {
      args.projectDir = next
      i += 1
    } else if (arg === '--quiet') {
      args.quiet = true
    }
  }

  return args
}

export async function writeLocalLayerResourceRefCandidates({
  projectDir = defaultProjectDir,
  quiet = false
} = {}) {
  const root = path.resolve(projectDir)
  const assetEntries = await readAssetDescriptors(root)
  const byteDescriptorProposalEntries = await readByteDescriptorProposals(root)
  const byteDescriptorProposalByAssetId = indexByteDescriptorProposalsByAssetId(byteDescriptorProposalEntries)
  const eligibleAssets = assetEntries.filter(({ record }) => isEligibleAsset(record))

  if (eligibleAssets.length === 0) {
    throw new Error('Resource ref candidates require at least one accepted or reference asset descriptor')
  }

  const candidates = []
  const seenCandidateIds = new Set()
  for (const entry of eligibleAssets) {
    const byteDescriptorProposalEntry = byteDescriptorProposalByAssetId.get(entry.record.assetId)
    const candidate = createLocalLayerResourceRefCandidate({
      assetDescriptor: entry.record,
      assetRecordPath: entry.path,
      byteDescriptorProposalEntry
    })
    if (seenCandidateIds.has(candidate.resourceRefCandidateId)) continue
    seenCandidateIds.add(candidate.resourceRefCandidateId)
    const output = `records/resources/${candidate.resourceRefCandidateId}.local.json`
    assertSafeLocalPath(output)
    await mkdir(path.dirname(path.join(root, output)), { recursive: true })
    await writeFile(path.join(root, output), `${JSON.stringify(candidate, null, 2)}\n`)
    candidates.push({ candidate, output })
  }

  if (!quiet) {
    console.log(`resource ref candidates: ${candidates.length}`)
    console.log('resource identity: candidate only')
  }

  return { candidates }
}

export function createLocalLayerResourceRefCandidate({
  assetDescriptor,
  assetRecordPath,
  byteDescriptorProposalEntry,
  createdAt = nowIso()
}) {
  const sourceRef = makeRef('media-asset', assetDescriptor.assetId, assetDescriptor.schema)
  const hashValue = assetDescriptor.hash?.value ?? assetDescriptor.assetId
  const byteDescriptorProposalRef = byteDescriptorProposalEntry
    ? {
        ...makeRef(
          'media-byte-descriptor-proposal',
          byteDescriptorProposalEntry.record.byteDescriptorProposalId,
          byteDescriptorProposalEntry.record.schema
        ),
        path: byteDescriptorProposalEntry.path,
        localOnly: true
      }
    : null
  const candidate = {
    schema: artifactKinds.mediaLocalLayerResourceRefCandidateLocal,
    resourceRefCandidateId: `resource-ref-candidate-${assetDescriptor.assetId}`,
    projectId: assetDescriptor.projectId,
    sourceRef,
    sourcePath: assetRecordPath,
    resourceKind: 'media-asset-by-hash',
    currentRefCategory: 'device_dependent_scaffold',
    targetRefCategory: 'local_layer_resource_ref',
    proposedResourceRef: {
      kind: 'local-layer-resource-ref-candidate',
      id: `media-asset:${assetDescriptor.projectId}:${assetDescriptor.assetId}`,
      resourceKind: 'media-asset-by-hash',
      hash: assetDescriptor.hash,
      localRef: assetDescriptor.localRef,
      byteDescriptorProposalRef,
      identitySeed: `sha256:${hashValue}`,
      candidateOnly: true,
      promotionStatus: 'candidate-only',
      promotionAuthority: false
    },
    byteDescriptorAlignment: {
      status: byteDescriptorProposalRef ? 'aligned' : 'missing-byte-descriptor-proposal',
      byteDescriptorProposalRef,
      requiredBeforePromotion: true
    },
    promotionPosture: {
      status: 'candidate-only',
      admissionRequired: true,
      requiredTargetCategory: 'local_layer_resource_ref',
      byteDescriptorRequired: true,
      promotionAuthority: false,
      localLayerResourceRef: false,
      replicatedPointerRef: false,
      causalReviewableRef: false,
      notes: [
        'This record proposes a local-layer resource ref candidate only.',
        'Promotion must be performed by a later local-layer or Edge-mediated lane.',
        'This candidate does not prove resource admission, replication, materialization, or authority.'
      ]
    },
    resolvabilityPosture: createScaffoldResolvabilityPosture({
      reason: 'Asset descriptor and local file path are Mode 0 scaffold inputs until a local-layer resource ref is admitted.'
    }),
    status: 'candidate',
    localLayerResourceRef: false,
    replicatedPointerRef: false,
    causalReviewableRef: false,
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    localTruthLabel: 'local proposal',
    truthStatus,
    createdAt
  }

  validateRequiredRecord(candidate)
  return candidate
}

async function readAssetDescriptors(root) {
  const files = await listJsonFiles(path.join(root, 'records', 'assets'))
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

async function readByteDescriptorProposals(root) {
  const files = await listJsonFiles(path.join(root, 'records', 'bytes'))
  const entries = []

  for (const file of files) {
    const record = JSON.parse(await readFile(file, 'utf8'))
    if (record.schema !== artifactKinds.mediaByteDescriptorProposalLocal) continue
    validateRequiredRecord(record)
    entries.push({
      path: path.relative(root, file).split(path.sep).join('/'),
      record
    })
  }

  return entries.sort((left, right) => left.path.localeCompare(right.path))
}

function indexByteDescriptorProposalsByAssetId(entries) {
  const index = new Map()

  for (const entry of entries) {
    for (const ref of assetRefsForByteProposal(entry.record)) {
      if (!index.has(ref.id)) index.set(ref.id, entry)
    }
  }

  return index
}

function assetRefsForByteProposal(record) {
  if (Array.isArray(record.sourceAssetRefs) && record.sourceAssetRefs.length > 0) {
    return record.sourceAssetRefs
  }

  return record.sourceAssetRef ? [record.sourceAssetRef] : []
}

function isEligibleAsset(record) {
  const placementClass = record.localRef?.placementClass
  const localPath = record.localRef?.path
  return eligiblePlacementClasses.has(placementClass) ||
    localPath?.startsWith('media/accepted/') ||
    localPath?.startsWith('media/references/')
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
  await writeLocalLayerResourceRefCandidates(parseArgs(process.argv.slice(2)))
}
