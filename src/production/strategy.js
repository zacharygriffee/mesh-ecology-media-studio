import { randomUUID } from 'node:crypto'

import { artifactKinds } from '../contracts/artifact-kinds.js'
import { makeRef, nowIso } from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'

const truthStatus = 'not mesh truth; not distributed proof; not ratified shared state'
const localFalseFlags = Object.freeze({
  localOnly: true,
  meshTruth: false,
  distributedProof: false,
  ratifiedSharedState: false
})

export const productionUnitKinds = Object.freeze([
  'project',
  'episode',
  'sequence',
  'scene',
  'shot',
  'clip',
  'still',
  'audio-take',
  'reference-plate',
  'world',
  'panorama',
  'entity-reference',
  'look-variant',
  'rough-cut',
  'export'
])

export const referencePrimitiveKinds = Object.freeze([
  'entity',
  'character',
  'prop',
  'environment',
  'space',
  'world',
  'panorama',
  'look',
  'plate',
  'audio-voice',
  'text-lock'
])

export const continuityBandKinds = Object.freeze([
  'time',
  'location',
  'appearance',
  'entity-state',
  'world-state',
  'audio-state',
  'render-pass'
])

export const continuityRiskLevels = Object.freeze([
  'none',
  'low',
  'medium',
  'high',
  'critical'
])

export const renderStrategyKinds = Object.freeze([
  'classic-scene-shot-clip',
  'reference-first',
  'frame-chain',
  'world-panorama',
  'entity-look',
  'audio-first',
  'rough-cut',
  'export'
])

export const renderInputModes = Object.freeze([
  'text-to-media',
  'reference-to-media',
  'frame-to-media',
  'multi-reference-to-media',
  'world-to-media',
  'audio-to-media',
  'media-transformation'
])

export function assertProductionUnitKind(kind) {
  assertKnown(kind, productionUnitKinds, 'production unit kind')
  return true
}

export function assertReferencePrimitiveKind(kind) {
  assertKnown(kind, referencePrimitiveKinds, 'reference primitive kind')
  return true
}

export function assertContinuityBandKind(kind) {
  assertKnown(kind, continuityBandKinds, 'continuity band kind')
  return true
}

export function assertContinuityRiskLevel(riskLevel) {
  assertKnown(riskLevel, continuityRiskLevels, 'continuity risk level')
  return true
}

export function assertRenderStrategyKind(kind) {
  assertKnown(kind, renderStrategyKinds, 'render strategy kind')
  return true
}

export function assertRenderInputMode(mode) {
  assertKnown(mode, renderInputModes, 'render input mode')
  return true
}

export function createReferencePrimitive({
  projectId,
  primitiveKind,
  name,
  descriptor = {},
  anchors = [],
  evidenceRefs = [],
  assetRefs = [],
  scope = {},
  createdAt = nowIso()
}) {
  assertReferencePrimitiveKind(primitiveKind)
  const primitive = {
    schema: artifactKinds.mediaReferencePrimitive,
    primitiveId: `reference-primitive-${primitiveKind}-${randomUUID()}`,
    projectId,
    primitiveKind,
    name,
    descriptor,
    anchors,
    evidenceRefs,
    assetRefs,
    scope,
    localTruthLabel: 'local draft',
    ...localFalseFlags,
    truthStatus,
    createdAt
  }

  validateRequiredRecord(primitive)
  return primitive
}

export function createContinuityBand({
  projectId,
  bandKind,
  label,
  subjectRefs = [],
  stateAnchors = [],
  riskLevel = 'medium',
  locks = [],
  sourceRefs = [],
  createdAt = nowIso()
}) {
  assertContinuityBandKind(bandKind)
  assertContinuityRiskLevel(riskLevel)
  const band = {
    schema: artifactKinds.mediaContinuityBand,
    bandId: `continuity-band-${bandKind}-${randomUUID()}`,
    projectId,
    bandKind,
    label,
    subjectRefs,
    stateAnchors,
    riskLevel,
    locks,
    sourceRefs,
    localTruthLabel: 'local draft',
    ...localFalseFlags,
    truthStatus,
    createdAt
  }

  validateRequiredRecord(band)
  return band
}

export function createProductionUnit({
  projectId,
  unitKind,
  title,
  purpose,
  parentRefs = [],
  sourceRefs = [],
  continuityBandRefs = [],
  referencePrimitiveRefs = [],
  renderStrategyRefs = [],
  outputIntent = {},
  createdAt = nowIso()
}) {
  assertProductionUnitKind(unitKind)
  const productionUnit = {
    schema: artifactKinds.mediaProductionUnit,
    productionUnitId: `production-unit-${unitKind}-${randomUUID()}`,
    projectId,
    unitKind,
    title,
    purpose,
    parentRefs,
    sourceRefs,
    continuityBandRefs,
    referencePrimitiveRefs,
    renderStrategyRefs,
    outputIntent,
    localTruthLabel: 'local draft',
    ...localFalseFlags,
    truthStatus,
    createdAt
  }

  validateRequiredRecord(productionUnit)
  return productionUnit
}

export function createRenderStrategy({
  projectId,
  strategyKind,
  productionUnitRef,
  inputModes = [],
  fallbackModes = [],
  continuityRisk = {},
  providerCapabilityPosture = {},
  referenceBurden = {},
  recoveryStrategy = [],
  createdAt = nowIso()
}) {
  assertRenderStrategyKind(strategyKind)
  inputModes.forEach(assertRenderInputMode)
  fallbackModes.forEach(assertRenderInputMode)
  const strategy = {
    schema: artifactKinds.mediaRenderStrategy,
    strategyId: `render-strategy-${strategyKind}-${randomUUID()}`,
    projectId,
    strategyKind,
    productionUnitRef,
    inputModes,
    fallbackModes,
    continuityRisk,
    providerCapabilityPosture,
    referenceBurden,
    recoveryStrategy,
    guidanceOnly: true,
    localTruthLabel: 'local draft',
    ...localFalseFlags,
    truthStatus,
    createdAt
  }

  validateRequiredRecord(strategy)
  return strategy
}

export function refForProductionRecord(record) {
  return makeRef(record.schema, idForProductionRecord(record), record.schema)
}

function assertKnown(value, knownValues, label) {
  if (!knownValues.includes(value)) {
    throw new Error(`Invalid ${label}: ${value}`)
  }
}

function idForProductionRecord(record) {
  return record.productionUnitId ??
    record.primitiveId ??
    record.bandId ??
    record.strategyId
}
