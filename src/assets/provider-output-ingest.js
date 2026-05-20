import { createHash } from 'node:crypto'
import { mkdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

import {
  createAssetDescriptor,
  createWorkPacket,
  makeRef
} from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import {
  assertSafeLocalPath,
  createAssetLifecycle,
  createLocalRef,
  placementClasses,
  placementDirectory
} from '../local/project-layout.js'
import { writeLocalImageMetadataRecord } from './image-metadata.js'
import {
  createDerivativeReadinessForMedia,
  probeLocalMediaMetadata
} from './media-metadata.js'

export async function writeProviderOutputAssets({
  projectDir,
  card,
  generationRequest,
  providerResult,
  outputs,
  operatorRef = 'local-operator',
  workPacket = createWorkPacket({ card, operatorRef }),
  placementClass = placementClasses.mediaGenerated,
  outputSubdir,
  filenamePrefix = 'provider-output',
  recordPrefix = 'provider-output',
  lifecycleState = 'generated',
  ffprobe = true,
  sourceApiCalled = false,
  lifecycleReason = 'Provider output placed locally after provider result normalization.',
  transitionSummary = 'Provider output decoded and placed as a local generated asset.'
}) {
  if (!Array.isArray(outputs) || outputs.length === 0) {
    return {
      workPacket,
      assets: []
    }
  }

  const assets = []

  for (const output of outputs) {
    const index = output.index ?? assets.length
    const extension = output.extension ?? extensionForContentType(output.contentType)
    const filename = `${filenamePrefix}-${index}.${extension}`
    const relativePath = outputSubdir
      ? path.posix.join(placementDirectory(placementClass), outputSubdir, filename)
      : path.posix.join(placementDirectory(placementClass), filename)
    assertSafeLocalPath(relativePath)

    const bytes = Buffer.isBuffer(output.bytes) ? output.bytes : Buffer.from(output.bytes)
    const outputPath = path.join(projectDir, relativePath)
    await mkdir(path.dirname(outputPath), { recursive: true })
    await writeFile(outputPath, bytes)

    const fileStat = await stat(outputPath)
    const hash = {
      algorithm: 'sha256',
      value: createHash('sha256').update(bytes).digest('hex')
    }
    const localRef = createLocalRef({
      placementClass,
      relativePath,
      contentType: output.contentType,
      hash,
      size: fileStat.size
    })
    const metadataProbe = await probeLocalMediaMetadata({
      filePath: outputPath,
      localRef,
      contentType: output.contentType,
      hash,
      size: fileStat.size,
      ffprobe
    })
    const derivativeReadiness = createDerivativeReadinessForMedia({
      contentType: output.contentType,
      metadataProbe
    })
    const assetId = `asset-${hash.value.slice(0, 16)}`
    const lifecycle = createAssetLifecycle({
      assetId,
      projectId: generationRequest.projectId,
      state: lifecycleState,
      refs: [
        makeRef('media-card', card.cardId, card.schema),
        makeRef('media-generation-request', generationRequest.requestId, generationRequest.schema),
        makeRef('provider-result', providerResult.resultId, providerResult.schema)
      ],
      reason: lifecycleReason
    })
    const assetDescriptor = createAssetDescriptor({
      card,
      workPacket,
      providerResult,
      hash,
      size: fileStat.size,
      contentType: output.contentType,
      localPath: relativePath,
      localRef,
      lifecycle,
      metadataProbe,
      derivativeReadiness,
      sourceApiCalled,
      transitionSummary
    })

    validateRequiredRecord(assetDescriptor)

    const assetRecordRef = `records/assets/${recordPrefix}-asset-${index}.local.json`
    assertSafeLocalPath(assetRecordRef)
    const assetRecordPath = path.join(projectDir, assetRecordRef)
    await mkdir(path.dirname(assetRecordPath), { recursive: true })
    await writeFile(assetRecordPath, `${JSON.stringify(assetDescriptor, null, 2)}\n`)

    const imageMetadata = output.contentType?.startsWith('image/')
      ? await maybeWriteImageMetadata({ projectDir, assetDescriptor, index, recordPrefix })
      : undefined

    assets.push({
      index,
      localRef,
      assetDescriptor,
      assetRecordRef,
      imageMetadata
    })
  }

  return {
    workPacket,
    assets
  }
}

async function maybeWriteImageMetadata({ projectDir, assetDescriptor, index, recordPrefix }) {
  try {
    return await writeLocalImageMetadataRecord({
      projectDir,
      assetDescriptor,
      recordRef: `records/assets/${recordPrefix}-image-metadata-${index}.local.json`
    })
  } catch {
    return undefined
  }
}

function extensionForContentType(contentType) {
  if (contentType === 'image/png') return 'png'
  if (contentType === 'image/jpeg') return 'jpg'
  if (contentType === 'video/mp4') return 'mp4'
  if (contentType === 'audio/mpeg') return 'mp3'
  if (contentType === 'audio/wav') return 'wav'
  return 'bin'
}
