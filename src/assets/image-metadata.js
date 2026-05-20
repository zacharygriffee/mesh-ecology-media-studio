import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

import { makeRef, nowIso } from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import { assertSafeLocalPath } from '../local/project-layout.js'

export async function readLocalImageMetadata({
  projectDir,
  assetDescriptor,
  createdAt = nowIso()
}) {
  const localPath = assetDescriptor.localRef?.path
  assertSafeLocalPath(localPath)

  const bytes = await readFile(path.join(projectDir, localPath))
  const dimensions = imageDimensions(bytes, assetDescriptor.contentType)
  const metadata = {
    schema: 'media.image_metadata.local.v1',
    metadataId: `image-metadata-${assetDescriptor.assetId}`,
    assetRef: makeRef('media-asset', assetDescriptor.assetId, assetDescriptor.schema),
    localRef: assetDescriptor.localRef,
    contentType: assetDescriptor.contentType,
    width: dimensions.width,
    height: dimensions.height,
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    localTruthLabel: 'local cache',
    truthStatus: 'not mesh truth; not distributed proof; not ratified shared state',
    createdAt
  }

  validateRequiredRecord(metadata)

  return metadata
}

export async function writeLocalImageMetadataRecord({
  projectDir,
  assetDescriptor,
  recordRef = `records/assets/${assetDescriptor.assetId}-image-metadata.local.json`
}) {
  assertSafeLocalPath(recordRef)
  const metadata = await readLocalImageMetadata({ projectDir, assetDescriptor })
  const outputPath = path.join(projectDir, recordRef)
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(metadata, null, 2)}\n`)

  return {
    metadata,
    recordRef
  }
}

export function imageDimensions(bytes, contentType) {
  if (contentType === 'image/png' || bytes.subarray(1, 4).toString('ascii') === 'PNG') {
    return pngDimensions(bytes)
  }

  throw new Error(`Unsupported image metadata content type: ${contentType}`)
}

function pngDimensions(bytes) {
  const signature = bytes.subarray(0, 8).toString('hex')
  if (signature !== '89504e470d0a1a0a') {
    throw new Error('PNG metadata probe received non-PNG bytes')
  }

  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20)
  }
}
