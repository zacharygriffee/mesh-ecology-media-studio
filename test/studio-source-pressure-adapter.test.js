import test from 'node:test'
import assert from 'node:assert/strict'

import { artifactKinds } from '../src/contracts/artifact-kinds.js'
import { validateRequiredRecord } from '../src/contracts/schemas.js'
import {
  buildStudioSourcePressureAdapterFixture,
  createStudioSourcePressureObservationResult
} from '../src/seams/studio-pressure-artifacts.js'

test('Studio source-pressure adapter candidate targets the generic Layer envelope only', () => {
  const { candidate, layerPressureArtifact } = buildStudioSourcePressureAdapterFixture()

  assert.equal(candidate.schema, artifactKinds.mediaStudioSourcePressureAdapterCandidateLocal)
  assert.equal(candidate.targetRepo, 'mesh-ecology-layer')
  assert.equal(candidate.targetGenericEnvelope, 'layer_source_pressure_review.v0')
  assert.equal(candidate.requestedOutput.schemaVersion, 'layer-source-pressure-review.v0')
  assert.equal(candidate.sourceLayerPressureArtifactRef.id, layerPressureArtifact.pressureArtifactId)
  assert.equal(candidate.studioSpecificLayerApiCreated, false)
  assert.equal(candidate.nonClaims.studioSpecificLayerApiCreated, false)
  assert.equal(candidate.nonClaims.layerAdmission, false)
  assert.equal(candidate.nonClaims.durableAppendApproved, false)
  assert.equal(candidate.nonClaims.acceptedContinuityCreated, false)
  assert.equal(candidate.nonClaims.productionStorageSelected, false)

  validateRequiredRecord(candidate)
})

test('Studio source-pressure adapter operator decision approves only the observation lane', () => {
  const { candidate, operatorDecision } = buildStudioSourcePressureAdapterFixture()

  assert.equal(operatorDecision.schema, artifactKinds.mediaStudioSourcePressureAdapterOperatorDecisionLocal)
  assert.equal(operatorDecision.decisionStatus, 'approved_bounded_studio_source_pressure_observation')
  assert.deepEqual(operatorDecision.approvedOnly, ['future_bounded_studio_source_pressure_observation'])
  assert.equal(operatorDecision.sourceAdapterCandidateRef.id, candidate.adapterCandidateId)
  assert.equal(operatorDecision.studioSourcePressureEmitted, false)
  assert.equal(operatorDecision.layerAdmissionApproved, false)
  assert.equal(operatorDecision.durableAppendApproved, false)
  assert.equal(operatorDecision.acceptedContinuityCreated, false)

  validateRequiredRecord(operatorDecision)
})

test('Studio source-pressure observation routes one bounded artifact through generic Layer seam', () => {
  const {
    candidate,
    operatorDecision,
    observationResult,
    layerPressureArtifact
  } = buildStudioSourcePressureAdapterFixture()

  assert.equal(observationResult.schema, artifactKinds.mediaStudioSourcePressureObservationResultLocal)
  assert.equal(observationResult.observationStatus, 'studio_source_pressure_routed_through_generic_layer_seam')
  assert.equal(observationResult.sourceAdapterCandidateRef.id, candidate.adapterCandidateId)
  assert.equal(observationResult.sourceOperatorDecisionRef.id, operatorDecision.decisionId)
  assert.equal(observationResult.studioSourcePressureRef, layerPressureArtifact.pressureArtifactId)
  assert.equal(observationResult.emittedEnvelopeKind, 'layer_source_pressure_review')
  assert.equal(observationResult.emittedEnvelopeSchemaVersion, 'layer-source-pressure-review.v0')
  assert.equal(observationResult.routedThroughGenericLayerSeam, true)
  assert.equal(observationResult.studioSpecificLayerApiCreated, false)
  assert.equal(observationResult.layerTruthClaimed, false)
  assert.equal(observationResult.edgeActionQueued, false)

  validateRequiredRecord(observationResult)
})

test('Studio source-pressure adapter validation blocks Studio-specific Layer API overclaims', () => {
  const { candidate } = buildStudioSourcePressureAdapterFixture()

  const unsafe = {
    ...candidate,
    nonClaims: {
      ...candidate.nonClaims,
      studioSpecificLayerApiCreated: true
    }
  }

  assert.throws(
    () => validateRequiredRecord(unsafe),
    /studioSpecificLayerApiCreated=false/
  )
})

test('Studio source-pressure observation validation blocks authority overclaims', () => {
  const { candidate, operatorDecision, layerPressureArtifact } = buildStudioSourcePressureAdapterFixture()
  const observation = createStudioSourcePressureObservationResult({
    projectId: candidate.projectId,
    sourceAdapterCandidate: candidate,
    sourceOperatorDecision: operatorDecision,
    sourceLayerPressureArtifact: layerPressureArtifact
  })

  assert.throws(
    () => validateRequiredRecord({
      ...observation,
      routedThroughGenericLayerSeam: false
    }),
    /routedThroughGenericLayerSeam=true/
  )

  assert.throws(
    () => validateRequiredRecord({
      ...observation,
      studioSpecificLayerApiCreated: true
    }),
    /non-authority false posture/
  )
})
