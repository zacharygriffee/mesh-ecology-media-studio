import assert from 'node:assert/strict'
import test from 'node:test'

import { makeRef } from '../src/contracts/constructors.js'
import { validateRequiredRecord } from '../src/contracts/schemas.js'
import {
  createContinuityBand,
  createProductionUnit,
  createReferencePrimitive,
  createRenderStrategy,
  refForProductionRecord
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
