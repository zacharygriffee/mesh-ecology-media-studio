import path from 'node:path'

export const projectLayoutSchema = 'media.project_layout.v1'
export const localRefSchema = 'media.local_ref.v1'
export const assetLifecycleSchema = 'media.asset_lifecycle.v1'

export const placementClasses = Object.freeze({
  card: 'card',
  mediaSource: 'media-source',
  mediaGenerated: 'media-generated',
  mediaAccepted: 'media-accepted',
  mediaRejected: 'media-rejected',
  mediaReference: 'media-reference',
  mediaProxy: 'media-proxy',
  mediaThumbnail: 'media-thumbnail',
  mediaExport: 'media-export',
  recordWorkPacket: 'record-work-packet',
  recordProviderResult: 'record-provider-result',
  recordAsset: 'record-asset',
  recordEvidence: 'record-evidence',
  recordReadiness: 'record-readiness',
  recordDecision: 'record-decision',
  recordManifest: 'record-manifest'
})

export const lifecycleStates = Object.freeze({
  source: 'source',
  generated: 'generated',
  ingested: 'ingested',
  underReview: 'under-review',
  accepted: 'accepted',
  rejected: 'rejected',
  proxied: 'proxied',
  exported: 'exported'
})

const placementDirectories = Object.freeze({
  [placementClasses.card]: 'cards',
  [placementClasses.mediaSource]: 'media/source',
  [placementClasses.mediaGenerated]: 'media/generated',
  [placementClasses.mediaAccepted]: 'media/accepted',
  [placementClasses.mediaRejected]: 'media/rejected',
  [placementClasses.mediaReference]: 'media/references',
  [placementClasses.mediaProxy]: 'media/proxies',
  [placementClasses.mediaThumbnail]: 'media/thumbnails',
  [placementClasses.mediaExport]: 'media/exports',
  [placementClasses.recordWorkPacket]: 'records/work-packets',
  [placementClasses.recordProviderResult]: 'records/provider-results',
  [placementClasses.recordAsset]: 'records/assets',
  [placementClasses.recordEvidence]: 'records/evidence',
  [placementClasses.recordReadiness]: 'records/readiness',
  [placementClasses.recordDecision]: 'records/decisions',
  [placementClasses.recordManifest]: 'records/manifests'
})

const urlPattern = /^[a-z][a-z0-9+.-]*:/i

export function createProjectLayout(projectId) {
  return {
    schema: projectLayoutSchema,
    projectId,
    mode: 'standalone-local',
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    directories: { ...placementDirectories }
  }
}

export function assertPlacementClass(placementClass) {
  if (!Object.values(placementClasses).includes(placementClass)) {
    throw new Error(`Invalid placement class: ${placementClass}`)
  }

  return true
}

export function assertLifecycleState(state) {
  if (!Object.values(lifecycleStates).includes(state)) {
    throw new Error(`Invalid asset lifecycle state: ${state}`)
  }

  return true
}

export function assertSafeLocalPath(relativePath) {
  if (typeof relativePath !== 'string' || relativePath.length === 0) {
    throw new Error('Local ref path must be a non-empty string')
  }

  if (path.isAbsolute(relativePath)) {
    throw new Error(`Local ref path must be relative: ${relativePath}`)
  }

  if (relativePath.startsWith('~')) {
    throw new Error(`Local ref path must not use home expansion: ${relativePath}`)
  }

  if (urlPattern.test(relativePath)) {
    throw new Error(`Local ref path must not be a URL: ${relativePath}`)
  }

  if (relativePath.includes('\\')) {
    throw new Error(`Local ref path must use forward slashes: ${relativePath}`)
  }

  const normalized = path.posix.normalize(relativePath)

  if (normalized === '.' || normalized.startsWith('../') || normalized === '..') {
    throw new Error(`Local ref path must not traverse outside project: ${relativePath}`)
  }

  if (normalized !== relativePath) {
    throw new Error(`Local ref path must be normalized: ${relativePath}`)
  }

  return true
}

export function createLocalRef({ placementClass, relativePath, contentType, hash, size }) {
  assertPlacementClass(placementClass)
  assertSafeLocalPath(relativePath)

  return {
    schema: localRefSchema,
    refKind: 'local-file',
    placementClass,
    path: relativePath,
    contentType,
    hash,
    size,
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false
  }
}

export function createAssetLifecycle({ assetId, projectId, state, refs = [], reason }) {
  assertLifecycleState(state)

  return {
    schema: assetLifecycleSchema,
    assetId,
    projectId,
    state,
    refs,
    reason,
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false
  }
}

export function projectRelativePath(placementClass, filename) {
  assertPlacementClass(placementClass)
  assertSafeFilename(filename)

  return path.posix.join(placementDirectories[placementClass], filename)
}

export function placementDirectory(placementClass) {
  assertPlacementClass(placementClass)
  return placementDirectories[placementClass]
}

export function assertSafeFilename(filename) {
  if (typeof filename !== 'string' || filename.length === 0) {
    throw new Error('Filename must be a non-empty string')
  }

  if (filename.includes('/') || filename.includes('\\')) {
    throw new Error(`Filename must not include path separators: ${filename}`)
  }

  assertSafeLocalPath(filename)

  return true
}
