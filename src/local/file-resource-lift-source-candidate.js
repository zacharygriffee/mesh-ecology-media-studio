import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { artifactKinds } from '../contracts/artifact-kinds.js'
import { makeRef, nowIso } from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import { assertSafeLocalPath } from './project-layout.js'

const modulePath = fileURLToPath(import.meta.url)
const defaultProjectDir = 'examples/card-to-candidate'
const truthStatus = 'not mesh truth; not distributed proof; not ratified shared state'

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

export async function writeFileResourceLiftSourceCandidate({
  projectDir = defaultProjectDir,
  quiet = false
} = {}) {
  const root = path.resolve(projectDir)
  const assetEntries = await readRecords(root, 'records/assets', artifactKinds.mediaAssetDescriptor)
  const byteEntries = await readRecords(root, 'records/bytes', artifactKinds.mediaByteDescriptorProposalLocal)
  const resourceEntries = await readRecords(root, 'records/resources', artifactKinds.mediaLocalLayerResourceRefCandidateLocal)
  const candidate = createFileResourceLiftSourceCandidate({
    assetEntries,
    byteDescriptorProposalEntries: byteEntries,
    resourceRefCandidateEntries: resourceEntries
  })
  const output = `records/lift/${candidate.liftSourceCandidateId}.local.json`
  assertSafeLocalPath(output)
  await mkdir(path.dirname(path.join(root, output)), { recursive: true })
  await writeFile(path.join(root, output), `${JSON.stringify(candidate, null, 2)}\n`)

  if (!quiet) {
    console.log('file/resource lift source candidate: 1')
    console.log('admission: not claimed')
  }

  return { candidate, output }
}

export function createFileResourceLiftSourceCandidate({
  assetEntries,
  byteDescriptorProposalEntries,
  resourceRefCandidateEntries,
  createdAt = nowIso()
}) {
  const usableResources = resourceRefCandidateEntries.filter(({ record }) =>
    record?.byteDescriptorAlignment?.status === 'aligned' &&
    record.byteDescriptorAlignment.byteDescriptorProposalRef
  )
  if (usableResources.length === 0) {
    throw new Error('File/resource lift source candidate requires an aligned resource ref candidate with a byte descriptor proposal')
  }

  const resourceEntry = usableResources[0]
  const byteRef = resourceEntry.record.byteDescriptorAlignment.byteDescriptorProposalRef
  const byteEntry = byteDescriptorProposalEntries.find(({ record }) => record.byteDescriptorProposalId === byteRef.id)
  if (!byteEntry) {
    throw new Error('File/resource lift source candidate requires the referenced byte descriptor proposal record')
  }

  const sourceAssetIds = new Set([
    resourceEntry.record.sourceRef?.id,
    ...byteEntry.record.sourceAssetRefs.map((ref) => ref.id)
  ].filter(Boolean))
  const sourceAssets = assetEntries.filter(({ record }) => sourceAssetIds.has(record.assetId))
  if (sourceAssets.length === 0) {
    throw new Error('File/resource lift source candidate requires a local source asset descriptor')
  }

  const primaryAsset = sourceAssets[0].record
  const contentHash = primaryAsset.hash ?? byteEntry.record.hash
  const contentId = primaryAsset.contentId ?? byteEntry.record.contentId
  const shortId = createHash('sha256').update([
    primaryAsset.projectId,
    contentId,
    byteEntry.record.byteDescriptorProposalId,
    resourceEntry.record.resourceRefCandidateId
  ].join('|')).digest('hex').slice(0, 24)

  const candidate = {
    schema: artifactKinds.studioFileResourceLiftSourceCandidateLocal,
    liftSourceCandidateId: `studio-file-resource-lift-source-candidate-${shortId}`,
    projectId: primaryAsset.projectId,
    contentId,
    candidateStatus: 'source_candidate_only_not_admitted',
    sourceLocalAssetRefs: sourceAssets.map(({ path: recordPath, record }) => ({
      ...makeRef('media-asset', record.assetId, record.schema),
      path: record.localRef?.path,
      recordPath,
      placementClass: record.localRef?.placementClass,
      localOnly: true
    })),
    sourceAssetRecordRefs: sourceAssets.map(({ path: recordPath, record }) => ({
      ...makeRef('media-asset-record', recordPath, record.schema),
      path: recordPath,
      localOnly: true
    })),
    byteDescriptorProposalRefs: [{
      ...makeRef('media-byte-descriptor-proposal', byteEntry.record.byteDescriptorProposalId, byteEntry.record.schema),
      path: byteEntry.path,
      localOnly: true
    }],
    resourceRefCandidateRefs: [{
      ...makeRef('media-local-layer-resource-ref-candidate', resourceEntry.record.resourceRefCandidateId, resourceEntry.record.schema),
      path: resourceEntry.path,
      localOnly: true
    }],
    situationRefs: sourceAssets.map(({ record }) => record.situationRef).filter(Boolean).map((ref) => ({
      kind: ref.kind,
      id: ref.id,
      role: ref.role,
      localOnly: true
    })),
    placementRefs: sourceAssets.map(({ record }) => record.placementRef).filter(Boolean).map((ref) => ({
      kind: ref.kind,
      id: ref.id,
      path: ref.path,
      placementClass: ref.placementClass,
      lifecycleState: ref.lifecycleState,
      localOnly: true
    })),
    contentHash,
    byteLength: primaryAsset.size ?? byteEntry.record.size,
    mediaType: primaryAsset.contentType ?? byteEntry.record.contentType,
    bytePosture: {
      byteDescriptorProposalRequired: true,
      byteDescriptorProposalVisible: true,
      byteAvailabilityProof: false,
      materializationProof: false,
      bytesPublished: false
    },
    resourcePosture: {
      resourceRefCandidateVisible: true,
      resourceAdmission: false,
      localLayerResourceRef: false,
      acceptedContinuity: false,
      layerAdmission: false
    },
    sourcePosture: {
      route: 'studio_to_bytes_to_layer_to_edge_to_spine',
      sourceRepo: 'mesh-ecology-media-studio',
      localOnly: true,
      candidateOnly: true,
      existingLocalArtifactsOnly: true,
      providerCalled: false,
      bytesPublished: false,
      layerAdmission: false,
      actionAuthority: false
    },
    blockedClaims: [
      'no_layer_admission',
      'no_accepted_continuity',
      'no_storage_ref_as_admission',
      'no_view_as_source',
      'no_external_url_or_local_path_as_canon',
      'no_action_authority'
    ],
    nonClaims: {
      localPathIsCanon: false,
      externalReferenceIsCanon: false,
      storageRefIsAdmission: false,
      viewIsSourceContinuity: false,
      resourceAdmission: false,
      meshTruth: false,
      authority: false
    },
    providerCalled: false,
    bytesPublished: false,
    resourceAdmission: false,
    byteAvailabilityProof: false,
    materializationProof: false,
    acceptedContinuity: false,
    layerAdmission: false,
    authority: false,
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

async function readRecords(root, relativeDir, schema) {
  const files = await listJsonFiles(path.join(root, relativeDir))
  const entries = []

  for (const file of files) {
    const record = JSON.parse(await readFile(file, 'utf8'))
    if (record.schema !== schema) continue
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
  await writeFileResourceLiftSourceCandidate(parseArgs(process.argv.slice(2)))
}
