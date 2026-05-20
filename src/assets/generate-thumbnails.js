import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

import { artifactKinds } from '../contracts/artifact-kinds.js'
import { makeRef, nowIso } from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import {
  assertSafeLocalPath,
  createLocalRef,
  placementClasses,
  projectRelativePath
} from '../local/project-layout.js'
import { sha256File } from './media-metadata.js'
import {
  createDerivativeSubjectRefForAsset,
  derivativeIdentityForAsset,
  derivativeSubjectKeyForAsset,
  derivativeSubjectKeyForRecord,
  derivativeSubjectTokenForAsset
} from './derivative-identity.js'

const modulePath = fileURLToPath(import.meta.url)
const defaultMaxSize = 320
const truthStatus = 'not mesh truth; not distributed proof; not ratified shared state'

function parseArgs(argv) {
  const args = {
    projectDir: 'examples/card-to-candidate',
    maxSize: defaultMaxSize,
    force: false
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]

    if (arg === '--project-dir') {
      args.projectDir = next
      i += 1
    } else if (arg === '--max-size') {
      args.maxSize = Number(next)
      i += 1
    } else if (arg === '--force') {
      args.force = true
    }
  }

  return args
}

export async function generateThumbnailDerivatives({
  projectDir = 'examples/card-to-candidate',
  maxSize = defaultMaxSize,
  force = false,
  createdAt = nowIso()
} = {}) {
  if (!Number.isInteger(maxSize) || maxSize < 16 || maxSize > 4096) {
    throw new Error('Thumbnail max size must be an integer from 16 through 4096')
  }

  const root = path.resolve(projectDir)
  const records = await readProjectRecords(root)
  const existingThumbnails = new Set(records
    .filter((entry) => entry.record.schema === artifactKinds.mediaDerivativeLocal)
    .filter((entry) => entry.record.derivativeKind === 'thumbnail')
    .map((entry) => derivativeSubjectKeyForRecord(entry.record)))
  const candidates = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaAssetDescriptor)
    .filter((entry) => imageThumbnailCandidate(entry.record))

  const generated = []
  const skipped = []

  for (const entry of candidates) {
    const subjectKey = derivativeSubjectKeyForAsset(entry.record, 'thumbnail')
    if (!force && existingThumbnails.has(subjectKey)) {
      skipped.push({
        assetId: entry.record.assetId,
        derivativeSubjectRef: createDerivativeSubjectRefForAsset(entry.record, 'thumbnail'),
        reason: 'thumbnail derivative already exists',
        localOnly: true
      })
      continue
    }

    const derivative = await createThumbnailDerivative({
      root,
      assetEntry: entry,
      maxSize,
      createdAt
    })
    await writeJson(path.join(root, derivative.recordRef), derivative.record)
    generated.push(derivative.record)
  }

  console.log(`thumbnail derivatives: generated=${generated.length} skipped=${skipped.length}`)
  for (const record of generated) {
    console.log(`thumbnail: ${record.sourceLocalRef.path} -> ${record.derivativeLocalRef.path} | subject=${record.derivativeSubjectRef.id}`)
  }

  return {
    generated,
    skipped,
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    materializationProof: false
  }
}

async function createThumbnailDerivative({
  root,
  assetEntry,
  maxSize,
  createdAt
}) {
  const asset = assetEntry.record
  const token = derivativeSubjectTokenForAsset(asset, 'thumbnail')
  const derivativeIdentity = derivativeIdentityForAsset(asset, 'thumbnail')
  const targetRef = projectRelativePath(placementClasses.mediaThumbnail, `thumbnail-${token}.png`)
  const sourcePath = path.join(root, asset.localRef.path)
  const targetPath = path.join(root, targetRef)
  await mkdir(path.dirname(targetPath), { recursive: true })

  const output = await sharp(sourcePath)
    .resize({
      width: maxSize,
      height: maxSize,
      fit: 'inside',
      withoutEnlargement: true
    })
    .png()
    .toFile(targetPath)
  const fileStat = await stat(targetPath)
  const hash = await sha256File(targetPath)
  const derivativeLocalRef = createLocalRef({
    placementClass: placementClasses.mediaThumbnail,
    relativePath: targetRef,
    contentType: 'image/png',
    hash,
    size: fileStat.size
  })
  const derivativeId = `thumbnail-${token}`
  const recordRef = `records/assets/media-derivative-${derivativeId}.local.json`
  assertSafeLocalPath(recordRef)
  const record = {
    schema: artifactKinds.mediaDerivativeLocal,
    derivativeId,
    projectId: asset.projectId,
    derivativeKind: 'thumbnail',
    derivativeSubjectRef: derivativeIdentity.derivativeSubjectRef,
    derivativeIdentity,
    sourceAssetRef: makeRef('media-asset-descriptor', asset.assetId, artifactKinds.mediaAssetDescriptor),
    sourceAssetDescriptorRef: asset.assetDescriptorRef,
    sourceContentRef: makeRef('media-content', derivativeIdentity.sourceContentId),
    sourceSituationRef: asset.situationRef,
    sourcePlacementRef: asset.placementRef,
    sourceLocalRef: asset.localRef,
    derivativeLocalRef,
    output: {
      contentType: 'image/png',
      width: output.width,
      height: output.height,
      maxSize,
      bytes: fileStat.size,
      hash,
      localOnly: true,
      materializationProof: false
    },
    toolRef: {
      tool: 'sharp',
      operation: 'resize-to-thumbnail',
      maxSize,
      localOnly: true
    },
    status: 'ready-for-local-inspection',
    createdAt,
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    byteAvailabilityProof: false,
    materializationProof: false,
    resourceAdmission: false,
    localTruthLabel: 'local derivative receipt',
    truthStatus
  }

  validateRequiredRecord(record)

  return {
    record,
    recordRef
  }
}

function imageThumbnailCandidate(record) {
  return record.contentType?.startsWith('image/') &&
    record.localRef?.path &&
    record.derivativeReadiness?.evaluate === true &&
    record.derivativeReadiness.issueCodes?.includes('missing_thumbnail')
}

async function readProjectRecords(root) {
  const files = await listJsonFiles(path.join(root, 'records'))
  const records = []

  for (const file of files) {
    const relativePath = path.relative(root, file).split(path.sep).join('/')
    const raw = JSON.parse(await readFile(file, 'utf8'))
    if (!raw.schema) continue
    try {
      validateRequiredRecord(raw)
    } catch (error) {
      if (raw.schema === artifactKinds.mediaDerivativeLocal) continue
      throw error
    }
    records.push({
      path: relativePath,
      record: raw
    })
  }

  return records
}

async function listJsonFiles(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    const files = []

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        files.push(...await listJsonFiles(fullPath))
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        files.push(fullPath)
      }
    }

    return files
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

if (process.argv[1] === modulePath) {
  await generateThumbnailDerivatives(parseArgs(process.argv.slice(2)))
}
