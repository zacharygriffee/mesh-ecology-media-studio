import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  createAssetDescriptor,
  createLocalRunManifest,
  createOperatorDecision,
  createReadiness,
  createReviewEvidence,
  createWorkPacket,
  makeRef
} from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import {
  createAssetLifecycle,
  createLocalRef,
  createProjectLayout,
  placementClasses,
  placementDirectory,
  projectRelativePath
} from './project-layout.js'
import {
  createGenerationRequestFromCard,
  createProviderCapability,
  createProviderProfile,
  normalizeProviderResult
} from '../providers/provider-neutral.js'

const modulePath = fileURLToPath(import.meta.url)

function parseArgs(argv) {
  const args = {
    projectDir: 'examples/card-to-candidate',
    decision: 'accepted',
    operatorRef: 'local-operator',
    providerName: 'local-placeholder-provider'
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]

    if (arg === '--project-dir') {
      args.projectDir = next
      i += 1
    } else if (arg === '--decision') {
      args.decision = next
      i += 1
    } else if (arg === '--operator-ref') {
      args.operatorRef = next
      i += 1
    } else if (arg === '--provider-name') {
      args.providerName = next
      i += 1
    }
  }

  return args
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
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

export async function runFirstWedge(options = {}) {
  const projectDir = path.resolve(options.projectDir ?? 'examples/card-to-candidate')
  const decision = options.decision ?? 'accepted'
  const operatorRef = options.operatorRef ?? 'local-operator'
  const providerId = options.providerName ?? 'local-placeholder-provider'

  if (!['accepted', 'rejected'].includes(decision)) {
    throw new Error('decision must be accepted or rejected')
  }

  const accepted = decision === 'accepted'
  const cardsDir = path.join(projectDir, placementDirectory(placementClasses.card))
  const generatedDir = path.join(projectDir, placementDirectory(placementClasses.mediaGenerated))
  const finalPlacementClass = accepted ? placementClasses.mediaAccepted : placementClasses.mediaRejected
  const finalMediaDir = path.join(projectDir, placementDirectory(finalPlacementClass))
  const cardPath = path.join(cardsDir, 'card.json')
  const sourceCandidatePath = path.join(generatedDir, 'candidate.txt')
  const ingestedCandidateRelativePath = projectRelativePath(finalPlacementClass, 'candidate.txt')
  const ingestedCandidatePath = path.join(projectDir, ingestedCandidateRelativePath)

  await mkdir(finalMediaDir, { recursive: true })

  const card = JSON.parse(await readFile(cardPath, 'utf8'))
  validateRequiredRecord(card, 'media.card.v1')

  await copyFile(sourceCandidatePath, ingestedCandidatePath)

  const fileStat = await stat(ingestedCandidatePath)
  const hash = await sha256File(ingestedCandidatePath)
  const localPath = ingestedCandidateRelativePath
  const candidateInputPath = projectRelativePath(placementClasses.mediaGenerated, 'candidate.txt')
  const contentType = contentTypeFor(ingestedCandidatePath)
  const projectLayout = createProjectLayout(card.projectId)
  const localRef = createLocalRef({
    placementClass: finalPlacementClass,
    relativePath: localPath,
    contentType,
    hash,
    size: fileStat.size
  })

  const workPacket = createWorkPacket({ card, operatorRef })
  const providerCapability = createProviderCapability({
    intentFamily: workPacket.intentFamily,
    outputKinds: [card.kind],
    constraints: {
      integration: 'local-placeholder',
      apiCalled: false
    }
  })
  const providerProfile = createProviderProfile({
    providerId,
    displayName: providerId,
    capabilities: [providerCapability]
  })
  const generationRequest = createGenerationRequestFromCard({
    card,
    providerHints: {
      ...card.providerHints,
      providerId
    }
  })
  const providerResult = normalizeProviderResult({
    generationRequest,
    providerId,
    providerJobRef: {
      kind: 'local-synthetic-provider-job',
      id: `local-placeholder:${generationRequest.requestId}`,
      localOnly: true
    },
    status: 'succeeded',
    outputRefs: [
      {
        kind: 'media-local-ref',
        id: localRef.path,
        schema: localRef.schema,
        localRef
      }
    ],
    rawProviderRef: {
      kind: 'local-placeholder',
      apiCalled: false,
      candidateLocalPath: localPath
    }
  })
  const assetDescriptor = createAssetDescriptor({
    card,
    workPacket,
    providerResult,
    hash,
    size: fileStat.size,
    contentType,
    localPath,
    localRef,
    lifecycle: createAssetLifecycle({
      assetId: `asset-${hash.value.slice(0, 16)}`,
      projectId: card.projectId,
      state: accepted ? 'accepted' : 'rejected',
      refs: [
        makeRef('media-card', card.cardId, card.schema),
        makeRef('media-work-packet', workPacket.packetId, workPacket.schema)
      ],
      reason: `local candidate ${decision}`
    })
  })
  const reviewEvidence = createReviewEvidence({
    card,
    assetDescriptor,
    summary: `Local review recorded ${decision} for first wedge candidate.`
  })
  const readiness = createReadiness({
    subjectRef: makeRef('media-asset', assetDescriptor.assetId, assetDescriptor.schema),
    state: decision === 'accepted' ? 'complete' : 'caution',
    reasons: [`candidate locally ${decision}`],
    nextActions: decision === 'accepted'
      ? ['prepare edge-inspectable work packet when Mode 1 is needed']
      : ['revise card or provider hints before another candidate']
  })
  const operatorDecision = createOperatorDecision({
    assetDescriptor,
    reviewEvidence,
    operatorRef,
    decision,
    reason: `Local operator marked candidate ${decision}.`
  })
  const generatedRecords = {
    workPacket,
    providerProfile,
    generationRequest,
    providerResult,
    assetDescriptor,
    reviewEvidence,
    readiness,
    operatorDecision
  }
  const generatedRecordPaths = {
    workPacket: 'records/work-packets/media-work-packet.local.json',
    providerProfile: 'records/provider-results/media-provider-profile.local.json',
    generationRequest: 'records/work-packets/media-generation-request.local.json',
    providerResult: 'records/provider-results/media-provider-result.local.json',
    assetDescriptor: 'records/assets/media-asset-descriptor.local.json',
    reviewEvidence: 'records/evidence/media-evidence.local.json',
    readiness: 'records/readiness/media-readiness.local.json',
    operatorDecision: 'records/decisions/media-operator-decision.local.json'
  }
  const localRunManifest = createLocalRunManifest({
    card,
    candidateInputPath,
    candidateHash: hash,
    generatedRecords,
    generatedRecordPaths
  })

  validateRequiredRecord(workPacket)
  validateRequiredRecord(providerCapability)
  validateRequiredRecord(providerProfile)
  validateRequiredRecord(generationRequest)
  validateRequiredRecord(providerResult)
  validateRequiredRecord(assetDescriptor)
  validateRequiredRecord(reviewEvidence)
  validateRequiredRecord(readiness)
  validateRequiredRecord(operatorDecision)
  validateRequiredRecord(localRunManifest)

  const manifestPath = 'records/manifests/media-local-run-manifest.local.json'
  const allRecordPaths = {
    ...generatedRecordPaths,
    localRunManifest: manifestPath
  }

  for (const recordPath of Object.values(allRecordPaths)) {
    await mkdir(path.dirname(path.join(projectDir, recordPath)), { recursive: true })
  }

  await writeJson(path.join(projectDir, generatedRecordPaths.workPacket), workPacket)
  await writeJson(path.join(projectDir, generatedRecordPaths.providerProfile), providerProfile)
  await writeJson(path.join(projectDir, generatedRecordPaths.generationRequest), generationRequest)
  await writeJson(path.join(projectDir, generatedRecordPaths.providerResult), providerResult)
  await writeJson(path.join(projectDir, generatedRecordPaths.assetDescriptor), assetDescriptor)
  await writeJson(path.join(projectDir, generatedRecordPaths.reviewEvidence), reviewEvidence)
  await writeJson(path.join(projectDir, generatedRecordPaths.readiness), readiness)
  await writeJson(path.join(projectDir, generatedRecordPaths.operatorDecision), operatorDecision)
  await writeJson(path.join(projectDir, manifestPath), localRunManifest)

  return {
    projectDir,
    projectLayout,
    outputs: {
      workPacket,
      providerProfile,
      generationRequest,
      providerResult,
      assetDescriptor,
      reviewEvidence,
      readiness,
      operatorDecision,
      localRunManifest
    }
  }
}

if (process.argv[1] === modulePath) {
  const args = parseArgs(process.argv.slice(2))
  const result = await runFirstWedge(args)
  const files = Object.keys(result.outputs).join(', ')
  console.log(`Wrote local first-wedge records: ${files}`)
}
