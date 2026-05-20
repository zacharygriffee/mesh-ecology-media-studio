import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { artifactKinds } from '../contracts/artifact-kinds.js'
import { makeRef, nowIso } from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import { assertSafeLocalPath } from '../local/project-layout.js'

const modulePath = fileURLToPath(import.meta.url)
const truthStatus = 'not mesh truth; not distributed proof; not ratified shared state'
const defaultProjectDir = 'examples/card-to-candidate'
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

export async function writeByteDescriptorProposals({
  projectDir = defaultProjectDir,
  quiet = false
} = {}) {
  const root = path.resolve(projectDir)
  const assetEntries = await readAssetDescriptors(root)
  const eligibleAssets = assetEntries.filter(({ record }) => isEligibleAsset(record))

  if (eligibleAssets.length === 0) {
    throw new Error('Byte descriptor proposal requires at least one accepted or reference asset descriptor')
  }

  const proposals = []
  const seenProposalIds = new Set()
  for (const entry of eligibleAssets) {
    const proposal = createByteDescriptorProposal({
      assetDescriptor: entry.record,
      assetRecordPath: entry.path
    })
    if (seenProposalIds.has(proposal.byteDescriptorProposalId)) continue
    seenProposalIds.add(proposal.byteDescriptorProposalId)
    const output = `records/bytes/${proposal.byteDescriptorProposalId}.local.json`
    assertSafeLocalPath(output)
    await mkdir(path.dirname(path.join(root, output)), { recursive: true })
    await writeFile(path.join(root, output), `${JSON.stringify(proposal, null, 2)}\n`)
    proposals.push({ proposal, output })
  }

  if (!quiet) {
    console.log(`byte descriptor proposals: ${proposals.length}`)
    console.log('materialization: not claimed')
  }

  return { proposals }
}

export function createByteDescriptorProposal({
  assetDescriptor,
  assetRecordPath,
  createdAt = nowIso()
}) {
  const sourceAssetRef = makeRef('media-asset', assetDescriptor.assetId, assetDescriptor.schema)
  const proposal = {
    schema: artifactKinds.mediaByteDescriptorProposalLocal,
    byteDescriptorProposalId: `byte-descriptor-proposal-${assetDescriptor.assetId}`,
    projectId: assetDescriptor.projectId,
    sourceAssetRef,
    assetRecordRef: {
      ...makeRef('media-asset-record', assetRecordPath, assetDescriptor.schema),
      path: assetRecordPath,
      localOnly: true
    },
    localRef: assetDescriptor.localRef,
    hash: assetDescriptor.hash,
    size: assetDescriptor.size,
    contentType: assetDescriptor.contentType,
    proposedByteDescriptor: {
      intendedSchema: 'media.byte_descriptor.v1',
      descriptorKind: 'sha256-local-file-proposal',
      sourceAssetRef,
      digest: assetDescriptor.hash,
      size: assetDescriptor.size,
      contentType: assetDescriptor.contentType,
      localRef: assetDescriptor.localRef,
      materializationRequired: true,
      byteAvailabilityProof: false,
      materializationProof: false
    },
    status: 'proposed',
    byteAvailabilityProof: false,
    materializationProof: false,
    byteAuthority: false,
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    localTruthLabel: 'local proposal',
    truthStatus,
    createdAt
  }

  validateRequiredRecord(proposal)
  return proposal
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
  await writeByteDescriptorProposals(parseArgs(process.argv.slice(2)))
}
