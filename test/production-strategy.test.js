import assert from 'node:assert/strict'
import test from 'node:test'

import { makeRef } from '../src/contracts/constructors.js'
import { validateRequiredRecord } from '../src/contracts/schemas.js'
import {
  createContinuityBand,
  createClipDescriptor,
  createExportDescriptor,
  createProductionUnit,
  createProductionDescriptor,
  createReferencePrimitive,
  createRenderStrategy,
  createRoughCutDescriptor,
  createSceneDescriptor,
  createShotDescriptor,
  refForProductionRecord,
  validateProductionDescriptorGraph
} from '../src/production/strategy.js'

test('production strategy supports classic scene shot clip as one strategy', () => {
  const character = createReferencePrimitive({
    projectId: 'project-strategy',
    primitiveKind: 'character',
    name: 'Local Character Reference',
    descriptor: {
      lens: 'reference primitive',
      authority: 'local render anchor only'
    },
    anchors: ['hair silhouette', 'jacket edge', 'neutral pose']
  })
  const lookBand = createContinuityBand({
    projectId: 'project-strategy',
    bandKind: 'appearance',
    label: 'scene one look band',
    subjectRefs: [refForProductionRecord(character)],
    stateAnchors: ['same jacket', 'same hair silhouette'],
    riskLevel: 'high',
    locks: ['do not change wardrobe inside this band']
  })
  const scene = createProductionUnit({
    projectId: 'project-strategy',
    unitKind: 'scene',
    title: 'Scene one',
    purpose: 'Traditional scene planning remains supported as a production unit.',
    sourceRefs: [makeRef('source-intent', 'source-1')],
    continuityBandRefs: [refForProductionRecord(lookBand)],
    referencePrimitiveRefs: [refForProductionRecord(character)],
    outputIntent: {
      outputKind: 'video',
      traditionalHierarchy: true
    }
  })
  const strategy = createRenderStrategy({
    projectId: 'project-strategy',
    strategyKind: 'classic-scene-shot-clip',
    productionUnitRef: refForProductionRecord(scene),
    inputModes: ['reference-to-media', 'frame-to-media'],
    fallbackModes: ['text-to-media'],
    continuityRisk: {
      riskLevel: 'high',
      reason: 'dialog and appearance continuity'
    },
    providerCapabilityPosture: {
      providerSpecific: false,
      modelCapabilitiesMayDrift: true
    },
    referenceBurden: {
      requiredPrimitives: [character.primitiveId],
      continuityBands: [lookBand.bandId]
    },
    recoveryStrategy: ['split clip', 'add insert', 'fall back to reference-first render']
  })

  assert.equal(validateRequiredRecord(character), true)
  assert.equal(validateRequiredRecord(lookBand), true)
  assert.equal(validateRequiredRecord(scene), true)
  assert.equal(validateRequiredRecord(strategy), true)
  assert.equal(strategy.guidanceOnly, true)
  assert.equal(scene.localOnly, true)
  assert.equal(strategy.meshTruth, false)
})

test('production strategy supports world and panorama units without video lock-in', () => {
  const panorama = createReferencePrimitive({
    projectId: 'project-strategy',
    primitiveKind: 'panorama',
    name: 'Courtyard panorama',
    descriptor: {
      usage: 'world or panorama reference',
      staticIdentityOnly: true
    },
    anchors: ['north gate', 'central fountain', 'brick arcade']
  })
  const worldBand = createContinuityBand({
    projectId: 'project-strategy',
    bandKind: 'world-state',
    label: 'courtyard spatial state',
    subjectRefs: [refForProductionRecord(panorama)],
    stateAnchors: ['north gate visible', 'fountain centerline stable'],
    riskLevel: 'medium',
    locks: ['do not treat panorama as proof of mesh world truth']
  })
  const worldUnit = createProductionUnit({
    projectId: 'project-strategy',
    unitKind: 'world',
    title: 'Courtyard world reference',
    purpose: 'Represent future world/panorama workflows without requiring shot planning.',
    continuityBandRefs: [refForProductionRecord(worldBand)],
    referencePrimitiveRefs: [refForProductionRecord(panorama)],
    outputIntent: {
      outputKind: 'world-reference',
      sceneShotRequired: false
    }
  })
  const strategy = createRenderStrategy({
    projectId: 'project-strategy',
    strategyKind: 'world-panorama',
    productionUnitRef: refForProductionRecord(worldUnit),
    inputModes: ['world-to-media', 'multi-reference-to-media'],
    fallbackModes: ['reference-to-media'],
    continuityRisk: {
      riskLevel: 'medium',
      reason: 'provider may interpret panorama geometry differently'
    },
    providerCapabilityPosture: {
      providerSpecific: false,
      providerShapeRegistryRequiredBeforeExecution: true
    },
    referenceBurden: {
      requiredPrimitives: [panorama.primitiveId]
    },
    recoveryStrategy: ['create local plate refs', 'downgrade to reference-first stills']
  })

  assert.equal(worldUnit.unitKind, 'world')
  assert.equal(strategy.strategyKind, 'world-panorama')
  assert.equal(validateRequiredRecord(strategy), true)
})

test('production strategy rejects rigid or unknown vocabulary', () => {
  assert.throws(
    () => createProductionUnit({
      projectId: 'project-strategy',
      unitKind: 'storyboard-only',
      title: 'Bad unit',
      purpose: 'invalid'
    }),
    /Invalid production unit kind/
  )

  assert.throws(
    () => createRenderStrategy({
      projectId: 'project-strategy',
      strategyKind: 'classic-scene-shot-clip',
      productionUnitRef: makeRef('media-production-unit', 'unit-1', 'media.production_unit.v1'),
      inputModes: ['provider-magic-mode'],
      fallbackModes: []
    }),
    /Invalid render input mode/
  )
})

test('production descriptors specialize scene shot clip without replacing production units', () => {
  const sceneUnit = createProductionUnit({
    projectId: 'project-descriptors',
    unitKind: 'scene',
    title: 'Scene descriptor unit',
    purpose: 'Scene planning as a production-unit specialization.'
  })
  const shotUnit = createProductionUnit({
    projectId: 'project-descriptors',
    unitKind: 'shot',
    title: 'Shot descriptor unit',
    purpose: 'Shot planning as a production-unit specialization.',
    parentRefs: [refForProductionRecord(sceneUnit)]
  })
  const clipUnit = createProductionUnit({
    projectId: 'project-descriptors',
    unitKind: 'clip',
    title: 'Clip descriptor unit',
    purpose: 'Clip planning as a production-unit specialization.',
    parentRefs: [refForProductionRecord(shotUnit)]
  })

  const scene = createSceneDescriptor({
    projectId: 'project-descriptors',
    productionUnitRef: refForProductionRecord(sceneUnit),
    title: 'Scene descriptor',
    scene: {
      summary: 'Local scene planning note'
    }
  })
  const shot = createShotDescriptor({
    projectId: 'project-descriptors',
    productionUnitRef: refForProductionRecord(shotUnit),
    title: 'Shot descriptor',
    sceneRef: refForProductionRecord(sceneUnit),
    shot: {
      framing: 'medium',
      motionPromptRole: 'render guidance only'
    }
  })
  const clip = createClipDescriptor({
    projectId: 'project-descriptors',
    productionUnitRef: refForProductionRecord(clipUnit),
    title: 'Clip descriptor',
    shotRef: refForProductionRecord(shotUnit),
    clip: {
      durationSeconds: 4,
      providerAgnostic: true
    }
  })

  assert.equal(validateRequiredRecord(scene), true)
  assert.equal(validateRequiredRecord(shot), true)
  assert.equal(validateRequiredRecord(clip), true)
  assert.equal(scene.descriptorKind, 'scene')
  assert.equal(shot.descriptor.sceneShotClipProjectionOnly, true)
  assert.equal(clip.productionUnitRef.id, clipUnit.productionUnitId)
  assert.equal(validateProductionDescriptorGraph([sceneUnit, shotUnit, clipUnit, scene, shot, clip]), true)
})

test('production descriptor graph rejects missing and mismatched parent units', () => {
  const sceneUnit = createProductionUnit({
    projectId: 'project-descriptors',
    unitKind: 'scene',
    title: 'Scene descriptor unit',
    purpose: 'Scene planning as a production-unit specialization.'
  })
  const shotUnit = createProductionUnit({
    projectId: 'project-descriptors',
    unitKind: 'shot',
    title: 'Shot descriptor unit',
    purpose: 'Shot planning as a production-unit specialization.',
    parentRefs: [refForProductionRecord(sceneUnit)]
  })
  const orphanShot = createShotDescriptor({
    projectId: 'project-descriptors',
    productionUnitRef: refForProductionRecord(shotUnit),
    title: 'Orphan shot descriptor',
    sceneRef: makeRef('media.production_unit.v1', 'missing-scene', 'media.production_unit.v1')
  })

  assert.throws(
    () => validateProductionDescriptorGraph([sceneUnit, shotUnit, orphanShot]),
    /references missing parent unit/
  )

  const otherSceneUnit = createProductionUnit({
    projectId: 'project-descriptors',
    unitKind: 'scene',
    title: 'Other scene descriptor unit',
    purpose: 'Mismatch fixture.'
  })
  const mismatchedShot = createShotDescriptor({
    projectId: 'project-descriptors',
    productionUnitRef: refForProductionRecord(shotUnit),
    title: 'Mismatched shot descriptor',
    sceneRef: refForProductionRecord(otherSceneUnit)
  })

  assert.throws(
    () => validateProductionDescriptorGraph([sceneUnit, shotUnit, otherSceneUnit, mismatchedShot]),
    /parentUnitRefs must match production unit parentRefs/
  )
})

test('rough cut and export descriptors do not claim publication authority', () => {
  const roughCutUnit = createProductionUnit({
    projectId: 'project-descriptors',
    unitKind: 'rough-cut',
    title: 'Rough cut unit',
    purpose: 'Local assembly work.'
  })
  const exportUnit = createProductionUnit({
    projectId: 'project-descriptors',
    unitKind: 'export',
    title: 'Export unit',
    purpose: 'Local export planning.',
    parentRefs: [refForProductionRecord(roughCutUnit)]
  })
  const roughCut = createRoughCutDescriptor({
    projectId: 'project-descriptors',
    productionUnitRef: refForProductionRecord(roughCutUnit),
    title: 'Rough cut descriptor',
    timeline: {
      tracks: ['video-main', 'audio-main'],
      roughAssemblyOnly: true
    },
    notes: ['local edit intent, not publication']
  })
  const exportDescriptor = createExportDescriptor({
    projectId: 'project-descriptors',
    productionUnitRef: refForProductionRecord(exportUnit),
    title: 'Export descriptor',
    sourceUnitRefs: [refForProductionRecord(roughCutUnit)],
    target: {
      format: 'mp4',
      audience: 'local review'
    }
  })

  assert.equal(validateRequiredRecord(roughCut), true)
  assert.equal(validateRequiredRecord(exportDescriptor), true)
  assert.equal(roughCut.descriptor.publicationAuthorization, false)
  assert.equal(exportDescriptor.descriptor.publicationAuthorization, false)
})

test('production descriptors reject unknown descriptor kinds and authority claims', () => {
  const unit = createProductionUnit({
    projectId: 'project-descriptors',
    unitKind: 'scene',
    title: 'Descriptor validation unit',
    purpose: 'Validation fixture.'
  })

  assert.throws(
    () => createProductionDescriptor({
      projectId: 'project-descriptors',
      descriptorKind: 'storyboard-lock',
      productionUnitRef: refForProductionRecord(unit),
      title: 'Bad descriptor'
    }),
    /Invalid production descriptor kind/
  )

  const exportDescriptor = createExportDescriptor({
    projectId: 'project-descriptors',
    productionUnitRef: refForProductionRecord(unit),
    title: 'Export descriptor'
  })
  exportDescriptor.descriptor.publicationAuthorization = true

  assert.throws(
    () => validateRequiredRecord(exportDescriptor),
    /must not claim publication authorization/
  )
})
