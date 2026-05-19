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

export const productionDescriptorKinds = Object.freeze([
  'scene',
  'shot',
  'clip',
  'rough-cut',
  'export'
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

export function assertProductionDescriptorKind(kind) {
  assertKnown(kind, productionDescriptorKinds, 'production descriptor kind')
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

export function createProductionDescriptor({
  projectId,
  descriptorKind,
  productionUnitRef,
  title,
  parentUnitRefs = [],
  continuityBandRefs = [],
  referencePrimitiveRefs = [],
  renderStrategyRefs = [],
  descriptor = {},
  createdAt = nowIso()
}) {
  assertProductionDescriptorKind(descriptorKind)
  const productionDescriptor = {
    schema: artifactKinds.mediaProductionDescriptorLocal,
    descriptorId: `production-descriptor-${descriptorKind}-${randomUUID()}`,
    projectId,
    descriptorKind,
    productionUnitRef,
    title,
    parentUnitRefs,
    continuityBandRefs,
    referencePrimitiveRefs,
    renderStrategyRefs,
    descriptor,
    localTruthLabel: 'local draft',
    ...localFalseFlags,
    truthStatus,
    createdAt
  }

  validateRequiredRecord(productionDescriptor)
  return productionDescriptor
}

export function createSceneDescriptor({
  projectId,
  productionUnitRef,
  title,
  sequenceRef,
  continuityBandRefs = [],
  referencePrimitiveRefs = [],
  renderStrategyRefs = [],
  scene = {},
  createdAt = nowIso()
}) {
  return createProductionDescriptor({
    projectId,
    descriptorKind: 'scene',
    productionUnitRef,
    title,
    parentUnitRefs: compactRefs([sequenceRef]),
    continuityBandRefs,
    referencePrimitiveRefs,
    renderStrategyRefs,
    descriptor: {
      scene,
      role: 'classic video planning specialization',
      sceneShotClipProjectionOnly: true
    },
    createdAt
  })
}

export function createShotDescriptor({
  projectId,
  productionUnitRef,
  title,
  sceneRef,
  continuityBandRefs = [],
  referencePrimitiveRefs = [],
  renderStrategyRefs = [],
  shot = {},
  createdAt = nowIso()
}) {
  return createProductionDescriptor({
    projectId,
    descriptorKind: 'shot',
    productionUnitRef,
    title,
    parentUnitRefs: compactRefs([sceneRef]),
    continuityBandRefs,
    referencePrimitiveRefs,
    renderStrategyRefs,
    descriptor: {
      shot,
      role: 'classic video planning specialization',
      sceneShotClipProjectionOnly: true
    },
    createdAt
  })
}

export function createClipDescriptor({
  projectId,
  productionUnitRef,
  title,
  shotRef,
  continuityBandRefs = [],
  referencePrimitiveRefs = [],
  renderStrategyRefs = [],
  clip = {},
  createdAt = nowIso()
}) {
  return createProductionDescriptor({
    projectId,
    descriptorKind: 'clip',
    productionUnitRef,
    title,
    parentUnitRefs: compactRefs([shotRef]),
    continuityBandRefs,
    referencePrimitiveRefs,
    renderStrategyRefs,
    descriptor: {
      clip,
      role: 'classic video planning specialization',
      sceneShotClipProjectionOnly: true
    },
    createdAt
  })
}

export function createRoughCutDescriptor({
  projectId,
  productionUnitRef,
  title,
  sourceUnitRefs = [],
  assetRefs = [],
  timeline = {},
  notes = [],
  createdAt = nowIso()
}) {
  return createProductionDescriptor({
    projectId,
    descriptorKind: 'rough-cut',
    productionUnitRef,
    title,
    parentUnitRefs: sourceUnitRefs,
    descriptor: {
      timeline,
      assetRefs,
      notes,
      assemblyOnly: true,
      publicationAuthorization: false
    },
    createdAt
  })
}

export function createExportDescriptor({
  projectId,
  productionUnitRef,
  title,
  sourceUnitRefs = [],
  sourceAssetRefs = [],
  target = {},
  delivery = {},
  createdAt = nowIso()
}) {
  return createProductionDescriptor({
    projectId,
    descriptorKind: 'export',
    productionUnitRef,
    title,
    parentUnitRefs: sourceUnitRefs,
    descriptor: {
      target,
      delivery,
      sourceAssetRefs,
      exportReceiptOnly: true,
      publicationAuthorization: false
    },
    createdAt
  })
}

export function refForProductionRecord(record) {
  return makeRef(record.schema, idForProductionRecord(record), record.schema)
}

export function validateProductionDescriptorGraph(records) {
  const productionUnits = new Map()
  const descriptors = []

  for (const record of records) {
    validateRequiredRecord(record)
    if (record.schema === artifactKinds.mediaProductionUnit) {
      productionUnits.set(record.productionUnitId, record)
    } else if (record.schema === artifactKinds.mediaProductionDescriptorLocal) {
      descriptors.push(record)
    }
  }

  for (const descriptor of descriptors) {
    const productionUnit = productionUnits.get(descriptor.productionUnitRef.id)
    if (!productionUnit) {
      throw new Error(`Production descriptor ${descriptor.descriptorId} references missing production unit ${descriptor.productionUnitRef.id}`)
    }

    assertDescriptorUnitKind(descriptor, productionUnit)

    for (const parentRef of descriptor.parentUnitRefs) {
      if (!productionUnits.has(parentRef.id)) {
        throw new Error(`Production descriptor ${descriptor.descriptorId} references missing parent unit ${parentRef.id}`)
      }
    }

    if (['scene', 'shot', 'clip'].includes(descriptor.descriptorKind)) {
      const productionUnitParentIds = new Set(productionUnit.parentRefs.map((ref) => ref.id))
      for (const parentRef of descriptor.parentUnitRefs) {
        if (!productionUnitParentIds.has(parentRef.id)) {
          throw new Error(`Production descriptor ${descriptor.descriptorId} parentUnitRefs must match production unit parentRefs`)
        }
      }
    }
  }

  return true
}

export function summarizeProductionFreshness(records) {
  const productionUnits = new Map()
  const descriptors = []

  for (const record of records) {
    if (record.schema === artifactKinds.mediaProductionUnit) {
      productionUnits.set(record.productionUnitId, record)
    } else if (record.schema === artifactKinds.mediaProductionDescriptorLocal) {
      descriptors.push(record)
    }
  }

  const staleDescriptorIds = []
  const parentMismatchDescriptorIds = []
  const missingUnitDescriptorIds = []

  for (const descriptor of descriptors) {
    const productionUnit = productionUnits.get(descriptor.productionUnitRef.id)
    if (!productionUnit) {
      missingUnitDescriptorIds.push(descriptor.descriptorId)
      continue
    }

    if (isDescriptorOlderThanUnit(descriptor, productionUnit)) {
      staleDescriptorIds.push(descriptor.descriptorId)
    }

    if (['scene', 'shot', 'clip'].includes(descriptor.descriptorKind) && !refIdsMatch(descriptor.parentUnitRefs, productionUnit.parentRefs)) {
      parentMismatchDescriptorIds.push(descriptor.descriptorId)
    }

    for (const parentRef of descriptor.parentUnitRefs) {
      const parentUnit = productionUnits.get(parentRef.id)
      if (parentUnit && isDescriptorOlderThanUnit(descriptor, parentUnit)) {
        staleDescriptorIds.push(descriptor.descriptorId)
      }
    }
  }

  const uniqueStaleDescriptorIds = Array.from(new Set(staleDescriptorIds)).sort()

  return {
    descriptorCount: descriptors.length,
    staleDescriptorIds: uniqueStaleDescriptorIds,
    parentMismatchDescriptorIds: parentMismatchDescriptorIds.sort(),
    missingUnitDescriptorIds: missingUnitDescriptorIds.sort(),
    fresh: uniqueStaleDescriptorIds.length === 0 && parentMismatchDescriptorIds.length === 0 && missingUnitDescriptorIds.length === 0,
    localOnly: true,
    operatorGuidanceOnly: true
  }
}

function assertDescriptorUnitKind(descriptor, productionUnit) {
  const allowedUnitKindsByDescriptorKind = {
    scene: ['scene'],
    shot: ['shot'],
    clip: ['clip', 'still', 'audio-take'],
    'rough-cut': ['rough-cut'],
    export: ['export']
  }
  const allowed = allowedUnitKindsByDescriptorKind[descriptor.descriptorKind] ?? []

  if (!allowed.includes(productionUnit.unitKind)) {
    throw new Error(`Production descriptor ${descriptor.descriptorId} kind ${descriptor.descriptorKind} cannot describe production unit kind ${productionUnit.unitKind}`)
  }
}

function assertKnown(value, knownValues, label) {
  if (!knownValues.includes(value)) {
    throw new Error(`Invalid ${label}: ${value}`)
  }
}

function isDescriptorOlderThanUnit(descriptor, productionUnit) {
  const descriptorTime = Date.parse(descriptor.createdAt)
  const unitTime = Date.parse(productionUnit.createdAt)
  return Number.isFinite(descriptorTime) && Number.isFinite(unitTime) && descriptorTime < unitTime
}

function refIdsMatch(leftRefs, rightRefs) {
  const leftIds = leftRefs.map((ref) => ref.id).sort()
  const rightIds = rightRefs.map((ref) => ref.id).sort()
  return JSON.stringify(leftIds) === JSON.stringify(rightIds)
}

function idForProductionRecord(record) {
  return record.productionUnitId ??
    record.primitiveId ??
    record.bandId ??
    record.strategyId ??
    record.descriptorId
}

function compactRefs(refs) {
  return refs.filter((ref) => ref !== undefined && ref !== null)
}
