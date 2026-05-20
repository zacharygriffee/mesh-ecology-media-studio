import { createHash } from 'node:crypto'
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
import {
  contentTypeFor,
  derivativeIssueCodesForContentType,
  mediaKindForContentType,
  probeLocalMediaMetadata,
  sha256File
} from './media-metadata.js'

const modulePath = fileURLToPath(import.meta.url)
const truthStatus = 'not mesh truth; not distributed proof; not ratified shared state'

const placementByName = Object.freeze({
  source: {
    placementClass: placementClasses.mediaSource,
    lifecycleState: 'source',
    role: 'source-media'
  },
  generated: {
    placementClass: placementClasses.mediaGenerated,
    lifecycleState: 'generated',
    role: 'generated-media'
  },
  reference: {
    placementClass: placementClasses.mediaReference,
    lifecycleState: 'ingested',
    role: 'reference-asset'
  }
})

function parseArgs(argv) {
  const args = {
    projectDir: 'examples/card-to-candidate',
    source: undefined,
    placement: 'source',
    filename: undefined,
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
    } else if (arg === '--placement') {
      args.placement = next
      i += 1
    } else if (arg === '--filename') {
      args.filename = next
      i += 1
    } else if (arg === '--operator-ref') {
      args.operatorRef = next
      i += 1
    }
  }

  return args
}

export async function importMediaAsset({
  projectDir = 'examples/card-to-candidate',
  source,
  placement = 'source',
  filename,
  operatorRef = 'local-operator',
  createdAt = nowIso(),
  ffprobe = true
} = {}) {
  if (!source) {
    throw new Error('Media import requires --source')
  }
  assertSafeLocalPath(source)

  const placementConfig = placementByName[placement]
  if (!placementConfig) {
    throw new Error(`Unsupported media import placement: ${placement}`)
  }

  const root = path.resolve(projectDir)
  const projectId = await readProjectId(root)
  const targetFilename = filename ?? path.posix.basename(source)
  assertSafeFilename(targetFilename)

  const targetRef = projectRelativePath(placementConfig.placementClass, targetFilename)
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
    placementClass: placementConfig.placementClass,
    relativePath: targetRef,
    contentType,
    hash,
    size: fileStat.size
  })
  const assetId = `asset-${hash.value.slice(0, 16)}`
  const lifecycle = createAssetLifecycle({
    assetId,
    projectId,
    state: placementConfig.lifecycleState,
    refs: [],
    reason: `local media imported as ${placement}`
  })
  const metadataProbe = await probeLocalMediaMetadata({
    filePath: targetPath,
    localRef,
    contentType,
    hash,
    size: fileStat.size,
    ffprobe
  })
  const derivativeReadiness = createDerivativeReadiness({
    contentType,
    metadataProbe
  })
  const assetDescriptor = createImportedMediaAssetDescriptor({
    assetId,
    projectId,
    contentType,
    hash,
    size: fileStat.size,
    localRef,
    lifecycle,
    source,
    placement,
    role: placementConfig.role,
    operatorRef,
    metadataProbe,
    derivativeReadiness,
    createdAt
  })
  const recordToken = importRecordToken({ projectId, source, targetRef, placement })
  const assetRecordRef = `records/assets/media-import-${recordToken}.local.json`
  assertSafeLocalPath(assetRecordRef)
  await writeJson(path.join(root, assetRecordRef), assetDescriptor)

  const imageMetadata = contentType.startsWith('image/')
    ? await maybeWriteImageMetadata({ root, assetDescriptor, recordToken })
    : undefined

  console.log(`imported media asset: ${targetRef}`)

  return {
    assetDescriptor,
    assetRecordRef,
    imageMetadata
  }
}

export function createImportedMediaAssetDescriptor({
  assetId,
  projectId,
  contentType,
  hash,
  size,
  localRef,
  lifecycle,
  source,
  placement,
  role,
  operatorRef,
  metadataProbe,
  derivativeReadiness,
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
    id: `basis:${projectId}:media-import:${source}`,
    refs: [originRef]
  })
  const placementRef = createPlacementRef({
    projectId,
    localRef,
    lifecycleState: lifecycle?.state
  })
  const situationRef = createSituationRef({
    projectId,
    role,
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
    mediaImport: {
      placement,
      operatorRef,
      localOnly: true,
      meshTruth: false
    },
    metadataProbe,
    derivativeReadiness,
    source: {
      sourceType: 'local-media-import',
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
      branchId: `${projectId}:media-import`,
      contextId: projectId,
      observerRef: operatorRef,
      continuityClaims: [],
      transitionSummary: `Local media imported into ${localRef.path}.`
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

function createDerivativeReadiness({ contentType, metadataProbe }) {
  const mediaKind = mediaKindForContentType(contentType)
  const issueCodes = [
    ...derivativeIssueCodesForContentType(contentType),
    ['unavailable', 'failed'].includes(metadataProbe.metadataProbeState)
      ? 'metadata_probe_unavailable'
      : null
  ].filter(Boolean)

  return {
    evaluate: true,
    mediaKind,
    state: issueCodes.length === 0 ? 'ready-for-local-inspection' : 'needs-local-attention',
    issueCodes,
    requiredDerivativeKinds: requiredDerivativeKindsFor(mediaKind),
    metadataProbeState: metadataProbe.metadataProbeState,
    nextAction: nextDerivativeAction(issueCodes),
    localOnly: true,
    operatorGuidanceOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    byteAvailabilityProof: false,
    materializationProof: false,
    resourceAdmission: false,
    publicationAuthorization: false
  }
}

function requiredDerivativeKindsFor(mediaKind) {
  if (mediaKind === 'image') return ['thumbnail']
  if (mediaKind === 'video') return ['thumbnail', 'proxy']
  if (mediaKind === 'audio') return ['waveform']
  return []
}

function nextDerivativeAction(issueCodes) {
  if (issueCodes.includes('unsupported_media_type')) {
    return 'Review content type before derivative preparation.'
  }
  if (issueCodes.includes('metadata_probe_unavailable')) {
    return 'Install or repair local metadata tools before derivative preparation.'
  }
  if (issueCodes.some((code) => ['missing_thumbnail', 'missing_proxy', 'missing_waveform'].includes(code))) {
    return 'Prepare local derivatives when derivative generation exists.'
  }
  return 'No local derivative readiness action needed.'
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
      recordRef: `records/assets/media-import-${recordToken}-image-metadata.local.json`
    })
  } catch {
    return undefined
  }
}

function importRecordToken({ projectId, source, targetRef, placement }) {
  return createHash('sha256')
    .update([
      projectId,
      source,
      targetRef,
      placement
    ].join('|'))
    .digest('hex')
    .slice(0, 16)
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

if (process.argv[1] === modulePath) {
  await importMediaAsset(parseArgs(process.argv.slice(2)))
}
