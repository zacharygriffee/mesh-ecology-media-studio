import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  createAssetDescriptor,
  createByteReferencePreview,
  createEdgeInspectionPacket,
  createWorkPacket,
  makeRef
} from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import {
  createAssetLifecycle,
  createLocalRef,
  placementClasses,
  placementDirectory
} from './project-layout.js'
import { writeLocalAssetReview } from '../review/local-review.js'
import { writeLocalImageMetadataRecord } from '../assets/image-metadata.js'

const modulePath = fileURLToPath(import.meta.url)

function parseArgs(argv) {
  const args = {
    projectDir: 'examples/card-to-candidate',
    assetRecord: 'records/assets/media-asset-descriptor.local.json',
    cardRecord: 'cards/card.json',
    providerResultRecord: 'records/provider-results/media-provider-result.local.json',
    decision: 'accepted',
    operatorRef: 'local-operator'
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]

    if (arg === '--project-dir') {
      args.projectDir = next
      i += 1
    } else if (arg === '--asset-record') {
      args.assetRecord = next
      i += 1
    } else if (arg === '--card-record') {
      args.cardRecord = next
      i += 1
    } else if (arg === '--provider-result-record') {
      args.providerResultRecord = next
      i += 1
    } else if (arg === '--decision') {
      args.decision = next
      i += 1
    } else if (arg === '--operator-ref') {
      args.operatorRef = next
      i += 1
    }
  }

  return args
}

export async function promoteCandidate({
  projectDir = 'examples/card-to-candidate',
  assetRecord = 'records/assets/media-asset-descriptor.local.json',
  cardRecord = 'cards/card.json',
  providerResultRecord = 'records/provider-results/media-provider-result.local.json',
  decision = 'accepted',
  operatorRef = 'local-operator'
} = {}) {
  if (!['accepted', 'rejected'].includes(decision)) {
    throw new Error('promotion decision must be accepted or rejected')
  }

  const root = path.resolve(projectDir)
  const originalAsset = JSON.parse(await readFile(path.join(root, assetRecord), 'utf8'))
  const card = JSON.parse(await readFile(path.join(root, cardRecord), 'utf8'))
  const rawProviderResult = JSON.parse(await readFile(path.join(root, providerResultRecord), 'utf8'))
  const providerResult = rawProviderResult.providerResult ?? rawProviderResult

  validateRequiredRecord(originalAsset, 'media.asset.descriptor.v1')
  validateRequiredRecord(card, 'media.card.v1')
  validateRequiredRecord(providerResult, 'media.provider_result.v1')

  const sourcePath = path.join(root, originalAsset.localRef.path)
  const filename = path.basename(originalAsset.localRef.path)
  const finalPlacementClass = decision === 'accepted'
    ? placementClasses.mediaAccepted
    : placementClasses.mediaRejected
  const finalRelativePath = path.posix.join(placementDirectory(finalPlacementClass), filename)
  const finalPath = path.join(root, finalRelativePath)

  await mkdir(path.dirname(finalPath), { recursive: true })
  if (path.resolve(sourcePath) !== path.resolve(finalPath)) {
    await copyFile(sourcePath, finalPath)
  }

  const fileStat = await stat(finalPath)
  const hash = await sha256File(finalPath)
  const localRef = createLocalRef({
    placementClass: finalPlacementClass,
    relativePath: finalRelativePath,
    contentType: originalAsset.contentType,
    hash,
    size: fileStat.size
  })
  const workPacket = createWorkPacket({ card, operatorRef })
  const lifecycle = createAssetLifecycle({
    assetId: `asset-${hash.value.slice(0, 16)}`,
    projectId: card.projectId,
    state: decision,
    refs: [
      makeRef('media-card', card.cardId, card.schema),
      makeRef('media-asset', originalAsset.assetId, originalAsset.schema)
    ],
    reason: `local promotion marked candidate ${decision}`
  })
  const promotedAsset = createAssetDescriptor({
    card,
    workPacket,
    providerResult,
    hash,
    size: fileStat.size,
    contentType: originalAsset.contentType,
    localPath: finalRelativePath,
    localRef,
    lifecycle,
    sourceApiCalled: originalAsset.source?.apiCalled === true,
    transitionSummary: `local candidate promoted to ${decision} placement without rerunning provider work`
  })

  validateRequiredRecord(promotedAsset)

  const recordPrefix = `promoted-candidate-${decision}`
  const promotedAssetRecord = `records/assets/${recordPrefix}.local.json`
  await mkdir(path.dirname(path.join(root, promotedAssetRecord)), { recursive: true })
  await writeFile(path.join(root, promotedAssetRecord), `${JSON.stringify(promotedAsset, null, 2)}\n`)

  const review = await writeLocalAssetReview({
    projectDir: root,
    card,
    assetDescriptor: promotedAsset,
    decision,
    operatorRef,
    recordPrefix,
    summary: `Local promotion recorded ${decision} for ${finalRelativePath}.`
  })
  const imageMetadata = originalAsset.contentType?.startsWith('image/')
    ? await maybeWriteImageMetadata({ root, promotedAsset, recordPrefix })
    : undefined
  const exportRecord = await writePromotionInspectionPacket({
    root,
    decision,
    promotedAsset,
    promotedAssetRecord,
    review,
    imageMetadata
  })

  console.log(`Promoted candidate to ${decision}: ${finalRelativePath}`)

  return {
    assetDescriptor: promotedAsset,
    assetRecord: promotedAssetRecord,
    review,
    imageMetadata,
    exportRecord
  }
}

async function writePromotionInspectionPacket({
  root,
  decision,
  promotedAsset,
  promotedAssetRecord,
  review,
  imageMetadata
}) {
  const assetRef = makeRef('media-asset', promotedAsset.assetId, promotedAsset.schema)
  const generatedArtifactRef = {
    kind: 'media-promoted-asset',
    id: promotedAsset.assetId,
    schema: promotedAsset.schema,
    path: promotedAsset.localRef.path,
    hash: promotedAsset.hash,
    contentType: promotedAsset.contentType,
    byteRefPreview: createByteReferencePreview({
      sourceRef: assetRef,
      localRef: promotedAsset.localRef,
      hash: promotedAsset.hash,
      size: promotedAsset.size,
      contentType: promotedAsset.contentType
    }),
    localOnly: true
  }
  const packet = createEdgeInspectionPacket({
    packetId: `promotion-${decision}-${promotedAsset.assetId}`,
    sourceRunRef: {
      kind: 'media-asset',
      id: promotedAsset.assetId,
      schema: promotedAsset.schema,
      path: promotedAssetRecord,
      localOnly: true
    },
    recordRefs: {
      assetDescriptor: localRecordRef('media-asset', promotedAssetRecord, promotedAsset.schema),
      reviewEvidence: localRecordRef('media-evidence', review.recordRefs.reviewEvidence, review.reviewEvidence.schema),
      readiness: localRecordRef('media-readiness', review.recordRefs.readiness, review.readiness.schema),
      operatorDecision: localRecordRef('media-operator-decision', review.recordRefs.operatorDecision, review.operatorDecision.schema),
      ...(imageMetadata ? {
        imageMetadata: localRecordRef('media-image-metadata', imageMetadata.recordRef, imageMetadata.metadata.schema)
      } : {})
    },
    artifactKinds: [
      promotedAsset.schema,
      review.reviewEvidence.schema,
      review.readiness.schema,
      review.operatorDecision.schema,
      generatedArtifactRef.byteRefPreview.schema,
      ...(imageMetadata ? [imageMetadata.metadata.schema] : []),
      'media.edge_inspection_packet.local.v1'
    ],
    generatedArtifactRefs: [generatedArtifactRef],
    warnings: [
      'Promotion inspection packet only; not Edge integration.',
      'Promotion records are local decisions and not ratifier authority.',
      'Provider work was not rerun for this promotion.',
      'Byte reference preview is not materialization proof.'
    ]
  })
  validateRequiredRecord(packet)

  const exportRef = `records/exports/promoted-candidate-${decision}-edge-inspection-packet.local.json`
  const exportPath = path.join(root, exportRef)
  await mkdir(path.dirname(exportPath), { recursive: true })
  await writeFile(exportPath, `${JSON.stringify(packet, null, 2)}\n`)

  return {
    packet,
    recordRef: exportRef
  }
}

async function maybeWriteImageMetadata({ root, promotedAsset, recordPrefix }) {
  try {
    return await writeLocalImageMetadataRecord({
      projectDir: root,
      assetDescriptor: promotedAsset,
      recordRef: `records/assets/${recordPrefix}-image-metadata.local.json`
    })
  } catch {
    return undefined
  }
}

function localRecordRef(kind, relativePath, schema) {
  return {
    kind,
    id: relativePath,
    schema,
    path: relativePath,
    localOnly: true
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

if (process.argv[1] === modulePath) {
  await promoteCandidate(parseArgs(process.argv.slice(2)))
}
