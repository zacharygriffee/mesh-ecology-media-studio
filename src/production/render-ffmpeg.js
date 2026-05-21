import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

import ffmpegStaticPath from 'ffmpeg-static'

import { artifactKinds } from '../contracts/artifact-kinds.js'
import { makeRef, nowIso } from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import {
  assertSafeLocalPath,
  createLocalRef,
  placementClasses
} from '../local/project-layout.js'
import { sha256File } from '../assets/media-metadata.js'

const execFileAsync = promisify(execFile)
const modulePath = fileURLToPath(import.meta.url)
const defaultProjectDir = 'examples/venice-smoke'
const defaultPlan = 'records/production/media-render-plan-candidate.local.json'
const defaultOutput = 'records/production/media-ffmpeg-render-receipt.local.json'
const truthStatus = 'not mesh truth; not distributed proof; not ratified shared state'

function parseArgs(argv) {
  const args = {
    projectDir: defaultProjectDir,
    plan: defaultPlan,
    output: defaultOutput,
    secondsPerItem: 2,
    width: 1280,
    height: 720,
    fps: 24,
    disableFfmpeg: false,
    print: false,
    quiet: false
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]

    if (arg === '--project-dir') {
      args.projectDir = next
      i += 1
    } else if (arg === '--plan') {
      args.plan = next
      i += 1
    } else if (arg === '--output') {
      args.output = next
      i += 1
    } else if (arg === '--seconds-per-item') {
      args.secondsPerItem = Number(next)
      i += 1
    } else if (arg === '--width') {
      args.width = Number(next)
      i += 1
    } else if (arg === '--height') {
      args.height = Number(next)
      i += 1
    } else if (arg === '--fps') {
      args.fps = Number(next)
      i += 1
    } else if (arg === '--disable-ffmpeg') {
      args.disableFfmpeg = true
    } else if (arg === '--print') {
      args.print = true
    } else if (arg === '--quiet') {
      args.quiet = true
    }
  }

  return args
}

export async function writeFfmpegRender({
  projectDir = defaultProjectDir,
  plan = defaultPlan,
  output = defaultOutput,
  secondsPerItem = 2,
  width = 1280,
  height = 720,
  fps = 24,
  disableFfmpeg = false,
  ffmpegPath = resolveFfmpegPath(),
  print = false,
  quiet = false,
  createdAt = nowIso()
} = {}) {
  assertSafeLocalPath(plan)
  assertSafeLocalPath(output)
  assertFfmpegOptions({ secondsPerItem, width, height, fps })

  if (ffmpegDisabled(disableFfmpeg)) {
    const skipped = {
      skipped: true,
      reason: 'ffmpeg disabled',
      localOnly: true,
      renderPerformed: false,
      exportPerformed: false,
      productionReady: false
    }
    if (!quiet) console.log('ffmpeg render: skipped | reason=ffmpeg disabled | renderPerformed=false | exportPerformed=false | productionReady=false')
    return {
      receipt: null,
      skipped,
      output
    }
  }

  if (!ffmpegPath) {
    throw new Error('ffmpeg is unavailable; install ffmpeg, keep ffmpeg-static installed, or pass --disable-ffmpeg to skip')
  }

  const root = path.resolve(projectDir)
  const renderPlan = JSON.parse(await readFile(path.join(root, plan), 'utf8'))
  validateRequiredRecord(renderPlan, artifactKinds.mediaRenderPlanCandidateLocal)
  const receipt = await createFfmpegRenderReceipt({
    root,
    renderPlan,
    planPath: plan,
    ffmpegPath,
    secondsPerItem,
    width,
    height,
    fps,
    createdAt
  })

  const outputPath = path.join(root, output)
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(receipt, null, 2)}\n`)

  if (print) {
    console.log(JSON.stringify(receipt, null, 2))
  } else if (!quiet) {
    console.log(formatFfmpegRenderSummary(receipt, output))
    console.log('nonClaims: local-only ffmpeg render receipt; no export delivery; no production authority; no publication authorization; productionReady=false')
  }

  return {
    receipt,
    skipped: null,
    output
  }
}

export async function createFfmpegRenderReceipt({
  root,
  renderPlan,
  planPath = defaultPlan,
  ffmpegPath = resolveFfmpegPath(),
  secondsPerItem = 2,
  width = 1280,
  height = 720,
  fps = 24,
  createdAt = nowIso()
}) {
  if (renderPlan.renderPerformed || renderPlan.exportPerformed || renderPlan.productionReady) {
    throw new Error('ffmpeg render expects a dry-run render plan candidate without prior render/export completion')
  }
  if (!renderPlan.planPosture?.refsResolved || !renderPlan.planPosture?.targetOutputPathResolved) {
    throw new Error('ffmpeg render requires a render plan with resolved refs and target output path')
  }
  if (!Array.isArray(renderPlan.orderedItems) || renderPlan.orderedItems.length === 0) {
    throw new Error('ffmpeg render requires at least one ordered item')
  }

  const renderReceiptId = `render-receipt-${stableId([
    renderPlan.projectId,
    renderPlan.planId,
    'ffmpeg',
    secondsPerItem,
    width,
    height,
    fps,
    ...renderPlan.orderedItems.map((item) => `${item.itemRef?.order}:${item.itemRef?.id}:${item.localRef?.path}`)
  ].join('|'))}`
  const outputRelativePath = `${renderPlan.targetOutputRef.path}/ffmpeg-review-${renderReceiptId.slice('render-receipt-'.length)}.mp4`
  assertSafeLocalPath(outputRelativePath)
  const outputPath = path.join(root, outputRelativePath)
  await mkdir(path.dirname(outputPath), { recursive: true })

  const renderedItems = validateAndResolveImageItems({ root, orderedItems: renderPlan.orderedItems })
  const args = ffmpegArgs({
    inputPaths: renderedItems.map((item) => item.sourcePath),
    outputPath,
    secondsPerItem,
    width,
    height,
    fps
  })
  await execFileAsync(ffmpegPath, args, {
    timeout: 30000,
    maxBuffer: 1024 * 1024 * 4
  })

  const fileStat = await stat(outputPath)
  const hash = await sha256File(outputPath)
  const outputLocalRef = createLocalRef({
    placementClass: placementClasses.mediaExport,
    relativePath: outputRelativePath,
    contentType: 'video/mp4',
    hash,
    size: fileStat.size
  })

  const receipt = {
    schema: artifactKinds.mediaRenderReceiptLocal,
    renderReceiptId,
    projectId: renderPlan.projectId,
    mode: 'standalone-local',
    renderKind: 'local-ffmpeg-review-mp4',
    sourceRenderPlanRef: localRecordRef('media-render-plan-candidate', renderPlan.planId, renderPlan.schema, planPath),
    sourceRenderExportCandidateRef: renderPlan.sourceRenderExportCandidateRef,
    renderAdapterContractRef: renderPlan.renderAdapterContractRef,
    sourceRoughCutRef: renderPlan.sourceRoughCutRef,
    reviewDecisionRef: renderPlan.reviewDecisionRef,
    orderedItems: renderedItems.map((item) => ({
      itemRef: item.item.itemRef,
      acceptedAssetRef: item.item.acceptedAssetRef,
      productionAssetCapsuleRef: item.item.productionAssetCapsuleRef,
      sourceLocalRef: item.item.localRef,
      order: item.item.itemRef?.order ?? item.index,
      seconds: secondsPerItem,
      bytesRead: true,
      rendered: true,
      localOnly: true
    })),
    outputLocalRef,
    output: {
      contentType: 'video/mp4',
      width,
      height,
      fps,
      durationSeconds: renderedItems.length * secondsPerItem,
      bytes: fileStat.size,
      hash,
      localOnly: true,
      byteAvailabilityProof: false,
      materializationProof: false
    },
    executionPosture: {
      rendererSelected: true,
      rendererId: 'local-ffmpeg-review-mp4',
      rendererEngine: 'ffmpeg',
      ffmpegDefault: true,
      ffmpegDisableSupported: true,
      localCommandExecution: true,
      mediaBytesRead: true,
      outputBytesCreated: true,
      renderPerformed: true,
      exportPerformed: false,
      publicationAuthorization: false,
      productionReady: false,
      localOnly: true,
      operatorGuidanceOnly: true
    },
    sourceRefs: compactRefs([
      localRecordRef('media-render-plan-candidate', renderPlan.planId, renderPlan.schema, planPath),
      renderPlan.sourceRenderExportCandidateRef,
      renderPlan.renderAdapterContractRef,
      renderPlan.sourceRoughCutRef,
      renderPlan.reviewDecisionRef,
      ...(renderPlan.sourceRefs ?? [])
    ]),
    nextActions: [
      'Review the ffmpeg local render output as preview evidence only.',
      'Keep export delivery, publication authorization, and production readiness separate.'
    ],
    createdAt,
    localOnly: true,
    renderPerformed: true,
    exportPerformed: false,
    productionReady: false,
    approvalAuthority: false,
    ratifierAuthority: false,
    publicationAuthorization: false,
    providerTruth: false,
    byteAvailabilityProof: false,
    materializationProof: false,
    resourceAdmission: false,
    causalTruth: false,
    edgeCalled: false,
    meshPublished: false,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    localTruthLabel: 'local ffmpeg render receipt',
    truthStatus
  }

  validateRequiredRecord(receipt)
  return receipt
}

export function formatFfmpegRenderSummary(receipt, output = defaultOutput) {
  return [
    `ffmpeg render: project=${receipt.projectId}`,
    `items=${receipt.orderedItems.length}`,
    `output=${receipt.outputLocalRef.path}`,
    `bytesRead=${receipt.executionPosture.mediaBytesRead}`,
    `renderPerformed=${receipt.renderPerformed}`,
    `exportPerformed=${receipt.exportPerformed}`,
    `productionReady=${receipt.productionReady}`,
    `receipt=${output}`
  ].join(' | ')
}

function validateAndResolveImageItems({ root, orderedItems }) {
  return orderedItems.map((item, index) => {
    const localPath = item.localRef?.path
    if (!localPath) {
      throw new Error(`ffmpeg render item ${item.itemRef?.id ?? index} is missing a localRef path`)
    }
    assertSafeLocalPath(localPath)
    const contentType = item.localRef?.contentType
    const ext = path.extname(localPath).toLowerCase()
    if (contentType && !contentType.startsWith('image/')) {
      throw new Error(`ffmpeg review render currently supports image refs only; got ${contentType}`)
    }
    if (!['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
      throw new Error(`ffmpeg review render currently supports image file extensions only; got ${localPath}`)
    }

    return {
      index,
      item,
      sourcePath: path.join(root, localPath)
    }
  })
}

function ffmpegArgs({
  inputPaths,
  outputPath,
  secondsPerItem,
  width,
  height,
  fps
}) {
  const args = ['-y']
  for (const inputPath of inputPaths) {
    args.push('-loop', '1', '-t', String(secondsPerItem), '-i', inputPath)
  }

  const filters = inputPaths.map((_, index) => (
    `[${index}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
    `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1[v${index}]`
  ))
  const concatInputs = inputPaths.map((_, index) => `[v${index}]`).join('')
  const filter = `${filters.join(';')};${concatInputs}concat=n=${inputPaths.length}:v=1:a=0,format=yuv420p[v]`

  args.push(
    '-filter_complex',
    filter,
    '-map',
    '[v]',
    '-r',
    String(fps),
    '-movflags',
    '+faststart',
    outputPath
  )

  return args
}

function localRecordRef(kind, id, schema, relativePath) {
  return {
    ...makeRef(kind, id, schema),
    path: relativePath,
    localOnly: true
  }
}

function compactRefs(refs) {
  const output = []
  const seen = new Set()
  for (const ref of refs.filter((candidate) => candidate?.id)) {
    const key = `${ref.schema}:${ref.id}:${ref.path ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    output.push(ref)
  }
  return output
}

function assertFfmpegOptions({ secondsPerItem, width, height, fps }) {
  if (!Number.isFinite(secondsPerItem) || secondsPerItem <= 0 || secondsPerItem > 60) {
    throw new Error('ffmpeg seconds per item must be greater than 0 and no more than 60')
  }
  if (!Number.isInteger(width) || width < 64 || width > 7680) {
    throw new Error('ffmpeg width must be an integer from 64 through 7680')
  }
  if (!Number.isInteger(height) || height < 64 || height > 4320) {
    throw new Error('ffmpeg height must be an integer from 64 through 4320')
  }
  if (!Number.isInteger(fps) || fps < 1 || fps > 120) {
    throw new Error('ffmpeg fps must be an integer from 1 through 120')
  }
}

function resolveFfmpegPath() {
  return process.env.MEDIA_STUDIO_FFMPEG_PATH || ffmpegStaticPath || 'ffmpeg'
}

function ffmpegDisabled(disableFfmpeg) {
  const value = String(process.env.MEDIA_STUDIO_FFMPEG ?? '').toLowerCase()
  return disableFfmpeg || ['0', 'false', 'disabled', 'off', 'no'].includes(value)
}

function stableId(seed) {
  return createHash('sha256').update(seed).digest('hex').slice(0, 24)
}

if (process.argv[1] === modulePath) {
  await writeFfmpegRender(parseArgs(process.argv.slice(2)))
}
