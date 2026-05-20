import { createHash } from 'node:crypto'

import { makeRef } from '../contracts/constructors.js'

export const derivativeSubjectKeyKind = 'derivativeKind+contentId+assetDescriptorRef+situationRef+placementRef+localPath'

export function derivativeSubjectKeyForAsset(asset, derivativeKind) {
  return derivativeSubjectFieldsForAsset(asset, derivativeKind).join('|')
}

export function derivativeSubjectKeyForRecord(record) {
  return derivativeSubjectFieldsForRecord(record).join('|')
}

export function derivativeSubjectTokenForAsset(asset, derivativeKind) {
  return hashSubjectKey(derivativeSubjectKeyForAsset(asset, derivativeKind))
}

export function createDerivativeSubjectRefForAsset(asset, derivativeKind) {
  return makeRef(
    'media-derivative-subject',
    `derivative-subject-${derivativeSubjectTokenForAsset(asset, derivativeKind)}`,
    'media.derivative_subject.local.v1'
  )
}

export function createDerivativeSubjectRefForRecord(record) {
  return makeRef(
    'media-derivative-subject',
    `derivative-subject-${hashSubjectKey(derivativeSubjectKeyForRecord(record))}`,
    'media.derivative_subject.local.v1'
  )
}

export function derivativeIdentityForAsset(asset, derivativeKind) {
  const derivativeSubjectKey = derivativeSubjectKeyForAsset(asset, derivativeKind)
  const fields = derivativeSubjectFieldsForAsset(asset, derivativeKind)

  return {
    keyKind: derivativeSubjectKeyKind,
    derivativeSubjectKey,
    derivativeSubjectRef: createDerivativeSubjectRefForAsset(asset, derivativeKind),
    sourceContentId: fields[1],
    sourceAssetDescriptorId: fields[2],
    sourceSituationId: fields[3],
    sourcePlacementId: fields[4],
    sourceLocalPath: fields[5],
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    materializationProof: false,
    resourceAdmission: false
  }
}

function derivativeSubjectFieldsForAsset(asset, derivativeKind) {
  return [
    derivativeKind,
    contentIdForAsset(asset),
    asset.assetDescriptorRef?.id ?? asset.assetId,
    asset.situationRef?.id ?? 'missing-situation',
    asset.placementRef?.id ?? 'missing-placement',
    asset.localRef?.path ?? 'missing-path'
  ]
}

function derivativeSubjectFieldsForRecord(record) {
  return [
    record.derivativeKind,
    record.sourceContentRef?.id,
    record.sourceAssetDescriptorRef?.id ?? record.sourceAssetRef?.id,
    record.sourceSituationRef?.id ?? 'missing-situation',
    record.sourcePlacementRef?.id ?? 'missing-placement',
    record.sourceLocalRef?.path ?? 'missing-path'
  ]
}

function hashSubjectKey(key) {
  return createHash('sha256').update(key).digest('hex').slice(0, 16)
}

function contentIdForAsset(asset) {
  return asset.contentId ?? (asset.hash?.algorithm === 'sha256' ? `sha256:${asset.hash.value}` : 'missing-content')
}
