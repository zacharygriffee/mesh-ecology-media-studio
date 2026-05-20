import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { artifactKinds } from '../contracts/artifact-kinds.js'
import {
  createAssetDescriptorRef,
  createBasisRef,
  createContentId,
  createDeferredCausalRefs,
  createOriginRef,
  createPlacementRef,
  createSituationRef,
  makeRef,
  nowIso
} from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import {
  assertSafeFilename,
  assertSafeLocalPath,
  createAssetLifecycle,
  createLocalRef,
  placementClasses,
  projectRelativePath
} from '../local/project-layout.js'
import { writeLocalImageMetadataRecord } from './image-metadata.js'

const modulePath = fileURLToPath(import.meta.url)
const truthStatus = 'not mesh truth; not distributed proof; not ratified shared state'

function parseArgs(argv) {
  const args = {
    projectDir: 'examples/card-to-candidate',
    source: undefined,
    filename: undefined,
    projectId: undefined,
    operatorRef: 'local-operator'
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]

    if (arg === '--project-dir') {
      args.projectDir = next
      i += 1
    } else if (arg === '--source') {
      args.source = next
      i += 1
    } else if (arg === '--filename') {
      args.filename = next
      i += 1
    } else if (arg === '--project-id') {
      args.projectId = next
      i += 1
    } else if (arg === '--operator-ref') {
      args.operatorRef = next
      i += 1
    }
  }

  return args
}

export async function ingestReferenceAsset({
  projectDir = 'examples/card-to-candidate',
  source,
  filename,
  projectId,
  operatorRef = 'local-operator',
  createdAt = nowIso()
} = {}) {
  if (!source) {
    throw new Error('Reference ingest requires --source')
  }

  assertSafeLocalPath(source)
  const root = path.resolve(projectDir)
  const resolvedProjectId = projectId ?? await readProjectId(root)
  const targetFilename = filename ?? path.posix.basename(source)
  assertSafeFilename(targetFilename)

  const targetRef = projectRelativePath(placementClasses.mediaReference, targetFilename)
  const sourcePath = path.join(root, source)
  const targetPath = path.join(root, targetRef)
  await mkdir(path.dirname(targetPath), { recursive: true })

  if (path.resolve(sourcePath) !== path.resolve(targetPath)) {
    await copyFile(sourcePath, targetPath)
  }

  const fileStat = await stat(targetPath)
  const hash = await sha256File(targetPath)
  const contentType = contentTypeFor(targetRef)
  const localRef = createLocalRef({
    placementClass: placementClasses.mediaReference,
    relativePath: targetRef,
    contentType,
    hash,
    size: fileStat.size
  })
  const assetId = `asset-${hash.value.slice(0, 16)}`
  const lifecycle = createAssetLifecycle({
    assetId,
    projectId: resolvedProjectId,
    state: 'ingested',
    refs: [],
    reason: 'local reference asset ingested'
  })
  const assetDescriptor = createReferenceAssetDescriptor({
    assetId,
    projectId: resolvedProjectId,
    contentType,
    hash,
    size: fileStat.size,
    localRef,
    lifecycle,
    source,
    operatorRef,
    createdAt
  })
  const recordToken = referenceRecordToken({
    projectId: resolvedProjectId,
    source,
    targetRef
  })
  const assetRecordRef = `records/assets/${recordToken}.local.json`
  assertSafeLocalPath(assetRecordRef)
  await writeJson(path.join(root, assetRecordRef), assetDescriptor)

  const imageMetadata = contentType.startsWith('image/')
    ? await maybeWriteImageMetadata({ root, assetDescriptor, recordToken })
    : undefined
  const ingestRecord = createReferenceIngestRecord({
    ingestId: `reference-ingest-${recordToken}`,
    projectId: resolvedProjectId,
    source,
    assetDescriptor,
    assetRecordRef,
    imageMetadata,
    createdAt
  })
  const ingestRecordRef = `records/assets/reference-ingest-${recordToken}.local.json`
  assertSafeLocalPath(ingestRecordRef)
  await writeJson(path.join(root, ingestRecordRef), ingestRecord)

  console.log(`Ingested reference asset: ${targetRef}`)

  return {
    assetDescriptor,
    assetRecordRef,
    imageMetadata,
    ingestRecord,
    ingestRecordRef
  }
}

export function createReferenceAssetDescriptor({
  assetId,
  projectId,
  contentType,
  hash,
  size,
  localRef,
  lifecycle,
  source,
  operatorRef,
  createdAt = nowIso()
}) {
  const contentId = createContentId(hash)
  const assetDescriptorRef = createAssetDescriptorRef({ assetId })
  const originRef = createOriginRef({
    kind: 'local-file',
    id: source,
    path: source
  })
  const basisRef = createBasisRef({
    id: `basis:${projectId}:reference:${source}`,
    refs: [originRef]
  })
  const placementRef = createPlacementRef({
    projectId,
    localRef,
    lifecycleState: lifecycle?.state
  })
  const situationRef = createSituationRef({
    projectId,
    role: 'reference-asset',
    placementRef,
    contextRef: {
      kind: 'studio-project',
      id: `project:${projectId}`
    }
  })
  const descriptor = {
    schema: artifactKinds.mediaAssetDescriptor,
    assetId,
    projectId,
    contentId,
    contentType,
    hash,
    size,
    localRef,
    assetDescriptorRef,
    artifactDescriptorRef: assetDescriptorRef,
    originRef,
    basisRef,
    situationRef,
    placementRef,
    causalRefs: createDeferredCausalRefs(),
    source: {
      sourceType: 'local-reference-ingest',
      sourceRef: {
        kind: 'local-file',
        id: source,
        path: source,
        localOnly: true
      },
      apiCalled: false
    },
    lineage: {
      parentRefs: [],
      referents: [],
      branchId: `${projectId}:references`,
      contextId: projectId,
      observerRef: operatorRef,
      continuityClaims: [],
      transitionSummary: 'Local reference asset copied into media/references.'
    },
    provenance: {
      providerId: undefined,
      providerResultLocalOnly: false,
      lifecycle
    },
    localTruthLabel: 'local receipt',
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    truthStatus,
    createdAt
  }

  validateRequiredRecord(descriptor)

  return descriptor
}

export function createReferenceIngestRecord({
  ingestId,
  projectId,
  source,
  assetDescriptor,
  assetRecordRef,
  imageMetadata,
  createdAt = nowIso()
}) {
  const ingest = {
    schema: artifactKinds.mediaReferenceIngestLocal,
    ingestId: ingestId ?? `reference-ingest-${assetDescriptor.assetId}`,
    projectId,
    sourceRef: {
      kind: 'local-file',
      id: source,
      path: source,
      localOnly: true
    },
    assetRef: makeRef('media-asset', assetDescriptor.assetId, assetDescriptor.schema),
    assetRecordRef: {
      ...makeRef('media-asset', assetRecordRef, assetDescriptor.schema),
      path: assetRecordRef,
      localOnly: true
    },
    imageMetadataRef: imageMetadata
      ? {
        ...makeRef('media-image-metadata', imageMetadata.recordRef, imageMetadata.metadata.schema),
        path: imageMetadata.recordRef,
        localOnly: true
      }
      : null,
    createdAt,
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    providerTruth: false,
    byteAvailabilityProof: false,
    materializationProof: false,
    localTruthLabel: 'local receipt',
    truthStatus
  }

  validateRequiredRecord(ingest)

  return ingest
}

function referenceRecordToken({ projectId, source, targetRef }) {
  const digest = createHash('sha256')
    .update([
      projectId,
      source,
      targetRef
    ].join('|'))
    .digest('hex')
    .slice(0, 16)

  return `reference-${digest}`
}

async function readProjectId(root) {
  const card = JSON.parse(await readFile(path.join(root, 'cards', 'card.json'), 'utf8'))
  return card.projectId
}

async function maybeWriteImageMetadata({ root, assetDescriptor, recordToken }) {
  try {
    return await writeLocalImageMetadataRecord({
      projectDir: root,
      assetDescriptor,
      recordRef: `records/assets/${recordToken}-image-metadata.local.json`
    })
  } catch {
    return undefined
  }
}

async function sha256File(filePath) {
  const hash = createHash('sha256')

  await new Promise((resolve, reject) => {
    const stream = createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', resolve)
  })

  return {
    algorithm: 'sha256',
    value: hash.digest('hex')
  }
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase()

  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.mp4') return 'video/mp4'
  if (ext === '.mov') return 'video/quicktime'
  if (ext === '.wav') return 'audio/wav'
  if (ext === '.mp3') return 'audio/mpeg'
  if (ext === '.txt') return 'text/plain'

  return 'application/octet-stream'
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

if (process.argv[1] === modulePath) {
  await ingestReferenceAsset(parseArgs(process.argv.slice(2)))
}
