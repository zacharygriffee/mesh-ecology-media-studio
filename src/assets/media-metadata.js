import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { createReadStream } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

import { imageDimensions } from './image-metadata.js'

const execFileAsync = promisify(execFile)

export async function sha256File(filePath) {
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

export function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase()

  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.mp4') return 'video/mp4'
  if (ext === '.mov') return 'video/quicktime'
  if (ext === '.webm') return 'video/webm'
  if (ext === '.wav') return 'audio/wav'
  if (ext === '.flac') return 'audio/flac'
  if (ext === '.mp3') return 'audio/mpeg'
  if (ext === '.txt') return 'text/plain'

  return 'application/octet-stream'
}

export function mediaKindForContentType(contentType) {
  if (contentType?.startsWith('image/')) return 'image'
  if (contentType?.startsWith('video/')) return 'video'
  if (contentType?.startsWith('audio/')) return 'audio'
  return 'unsupported'
}

export function derivativeIssueCodesForContentType(contentType) {
  const mediaKind = mediaKindForContentType(contentType)

  if (mediaKind === 'image') return ['missing_thumbnail']
  if (mediaKind === 'video') return ['missing_thumbnail', 'missing_proxy']
  if (mediaKind === 'audio') return ['missing_waveform']
  return ['unsupported_media_type']
}

export function createDerivativeReadinessForMedia({ contentType, metadataProbe }) {
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

export async function probeLocalMediaMetadata({
  filePath,
  localRef,
  contentType,
  hash,
  size,
  ffprobe = true
}) {
  const mediaKind = mediaKindForContentType(contentType)
  const probe = {
    probeKind: 'local-media-metadata',
    metadataProbeState: 'available',
    mediaKind,
    contentType,
    size,
    hash,
    localRef,
    toolRefs: [],
    warnings: [],
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    byteAvailabilityProof: false,
    materializationProof: false
  }

  if (mediaKind === 'image') {
    try {
      const bytes = await readFile(filePath)
      const dimensions = imageDimensions(bytes, contentType)
      probe.image = dimensions
    } catch (error) {
      probe.metadataProbeState = 'partial'
      probe.warnings.push(`image metadata probe failed: ${error.message}`)
    }
  } else if (mediaKind === 'video' || mediaKind === 'audio') {
    const ffprobeResult = await resolveFfprobeResult({ filePath, ffprobe })
    probe.toolRefs.push({
      tool: 'ffprobe',
      status: ffprobeResult.status,
      localOnly: true
    })
    if (ffprobeResult.status === 'available') {
      probe.ffprobe = ffprobeResult.summary
    } else {
      probe.metadataProbeState = ffprobeResult.status
      probe.warnings.push(`ffprobe ${ffprobeResult.status}: ${ffprobeResult.reason}`)
    }
  } else {
    probe.metadataProbeState = 'unsupported'
    probe.warnings.push(`unsupported media type for derivative readiness: ${contentType}`)
  }

  return probe
}

function requiredDerivativeKindsFor(mediaKind) {
  if (mediaKind === 'image') return ['thumbnail']
  if (mediaKind === 'video') return ['thumbnail', 'proxy']
  if (mediaKind === 'audio') return ['waveform']
  return []
}

function nextDerivativeAction(issueCodes) {
  if (issueCodes.includes('unsupported_media_type')) {
    return 'No derivative preparation is defined for this content type.'
  }
  if (issueCodes.includes('metadata_probe_unavailable')) {
    return 'Install or repair local metadata tools before derivative preparation.'
  }
  if (issueCodes.some((code) => ['missing_thumbnail', 'missing_proxy', 'missing_waveform'].includes(code))) {
    return issueCodes.includes('missing_thumbnail')
      ? 'Run npm run derivatives:thumbnail for image thumbnails.'
      : 'Prepare local derivatives when derivative generation exists.'
  }
  return 'No local derivative readiness action needed.'
}

async function resolveFfprobeResult({ filePath, ffprobe }) {
  if (ffprobe === false) {
    return { status: 'unavailable', reason: 'ffprobe disabled' }
  }
  if (typeof ffprobe === 'function') {
    return normalizeFfprobeProbeResult(await ffprobe(filePath))
  }
  return probeWithFfprobe(filePath)
}

async function probeWithFfprobe(filePath) {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v',
      'error',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      filePath
    ], {
      timeout: 3000,
      maxBuffer: 1024 * 1024
    })
    const parsed = JSON.parse(stdout)
    return {
      status: 'available',
      summary: summarizeFfprobe(parsed)
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        status: 'unavailable',
        reason: 'ffprobe not found'
      }
    }
    return {
      status: 'failed',
      reason: error.message
    }
  }
}

export function normalizeFfprobeProbeResult(result) {
  if (!result || typeof result !== 'object') {
    return {
      status: 'failed',
      reason: 'ffprobe adapter returned no result'
    }
  }

  if (result.status === 'available') {
    return {
      status: 'available',
      summary: result.summary ?? summarizeFfprobe(result.raw ?? result)
    }
  }

  if (['unavailable', 'failed'].includes(result.status)) {
    return {
      status: result.status,
      reason: result.reason ?? 'no reason supplied'
    }
  }

  return {
    status: 'failed',
    reason: `unsupported ffprobe status: ${result.status ?? 'missing'}`
  }
}

export function summarizeFfprobe(parsed) {
  const streams = Array.isArray(parsed.streams) ? parsed.streams : []
  const primaryVideo = streams.find((stream) => stream.codec_type === 'video')
  const primaryAudio = streams.find((stream) => stream.codec_type === 'audio')

  return {
    duration: parsed.format?.duration ? Number(parsed.format.duration) : undefined,
    formatName: parsed.format?.format_name,
    video: primaryVideo
      ? {
          codec: primaryVideo.codec_name,
          width: primaryVideo.width,
          height: primaryVideo.height,
          fps: frameRate(primaryVideo.avg_frame_rate)
        }
      : undefined,
    audio: primaryAudio
      ? {
          codec: primaryAudio.codec_name,
          sampleRate: primaryAudio.sample_rate ? Number(primaryAudio.sample_rate) : undefined,
          channels: primaryAudio.channels
        }
      : undefined,
    localOnly: true,
    materializationProof: false
  }
}

function frameRate(value) {
  if (!value || value === '0/0') return undefined
  const [left, right] = value.split('/').map(Number)
  if (!left || !right) return undefined
  return left / right
}
