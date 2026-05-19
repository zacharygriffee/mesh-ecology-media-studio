import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  createAssetDescriptor,
  createLocalRunManifest,
  createOperatorDecision,
  createProviderJobResult,
  createReadiness,
  createReviewEvidence,
  createWorkPacket,
  makeRef
} from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'

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
  const providerName = options.providerName ?? 'local-placeholder-provider'

  if (!['accepted', 'rejected'].includes(decision)) {
    throw new Error('decision must be accepted or rejected')
  }

  const inputDir = path.join(projectDir, 'input')
  const localMediaDir = path.join(projectDir, 'local-media')
  const outDir = path.join(projectDir, 'out')
  const binDir = path.join(outDir, decision)
  const cardPath = path.join(inputDir, 'card.json')
  const sourceCandidatePath = path.join(localMediaDir, 'candidate.txt')
  const ingestedCandidatePath = path.join(binDir, 'candidate.txt')

  await mkdir(binDir, { recursive: true })

  const card = JSON.parse(await readFile(cardPath, 'utf8'))
  validateRequiredRecord(card, 'media.card.v1')

  await copyFile(sourceCandidatePath, ingestedCandidatePath)

  const fileStat = await stat(ingestedCandidatePath)
  const hash = await sha256File(ingestedCandidatePath)
  const localPath = path.relative(projectDir, ingestedCandidatePath)
  const candidateInputPath = path.relative(projectDir, sourceCandidatePath)
  const contentType = contentTypeFor(ingestedCandidatePath)

  const workPacket = createWorkPacket({ card, operatorRef })
  const providerJobResult = createProviderJobResult({
    card,
    workPacket,
    providerName,
    candidateLocalPath: localPath
  })
  const assetDescriptor = createAssetDescriptor({
    card,
    workPacket,
    providerJobResult,
    hash,
    size: fileStat.size,
    contentType,
    localPath
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
    providerJobResult,
    assetDescriptor,
    reviewEvidence,
    readiness,
    operatorDecision
  }
  const generatedRecordPaths = {
    workPacket: 'out/media-work-packet.local.json',
    providerJobResult: 'out/provider-job-result.local.json',
    assetDescriptor: 'out/media-asset-descriptor.local.json',
    reviewEvidence: 'out/media-evidence.local.json',
    readiness: 'out/media-readiness.local.json',
    operatorDecision: 'out/media-operator-decision.local.json'
  }
  const localRunManifest = createLocalRunManifest({
    card,
    candidateInputPath,
    candidateHash: hash,
    generatedRecords,
    generatedRecordPaths
  })

  validateRequiredRecord(workPacket)
  validateRequiredRecord(providerJobResult)
  validateRequiredRecord(assetDescriptor)
  validateRequiredRecord(reviewEvidence)
  validateRequiredRecord(readiness)
  validateRequiredRecord(operatorDecision)
  validateRequiredRecord(localRunManifest)

  await mkdir(outDir, { recursive: true })
  await writeJson(path.join(outDir, 'media-work-packet.local.json'), workPacket)
  await writeJson(path.join(outDir, 'provider-job-result.local.json'), providerJobResult)
  await writeJson(path.join(outDir, 'media-asset-descriptor.local.json'), assetDescriptor)
  await writeJson(path.join(outDir, 'media-evidence.local.json'), reviewEvidence)
  await writeJson(path.join(outDir, 'media-readiness.local.json'), readiness)
  await writeJson(path.join(outDir, 'media-operator-decision.local.json'), operatorDecision)
  await writeJson(path.join(outDir, 'media-local-run-manifest.local.json'), localRunManifest)

  return {
    projectDir,
    outputs: {
      workPacket,
      providerJobResult,
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
