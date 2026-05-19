import { randomUUID } from 'node:crypto'

import { artifactKinds } from './artifact-kinds.js'

const truthStatus = 'not mesh truth; not distributed proof; not ratified shared state'
const localFalseFlags = Object.freeze({
  localOnly: true,
  meshTruth: false,
  distributedProof: false,
  ratifiedSharedState: false
})

export function nowIso() {
  return new Date().toISOString()
}

export function makeRef(kind, id, schema) {
  return {
    kind,
    id,
    schema
  }
}

export function intentFamilyForCard(card) {
  if (card.kind === 'video') return 'video-generation'
  if (card.kind === 'audio') return 'audio-generation'
  if (card.kind === 'image') return 'image-generation'
  return 'media-transformation'
}

export function createWorkPacket({ card, operatorRef = 'local-operator', createdAt = nowIso() }) {
  return {
    schema: 'media.work_packet.v1',
    packetId: `packet-${randomUUID()}`,
    intentFamily: intentFamilyForCard(card),
    projectId: card.projectId,
    cardRef: makeRef('media-card', card.cardId, card.schema),
    inputs: card.referenceAssetRefs.map((id) => makeRef('reference-asset', id)),
    requestedOutputs: [
      {
        kind: card.kind,
        target: card.target,
        acceptanceCriteria: card.acceptanceCriteria
      }
    ],
    operatorContext: {
      operatorRef,
      mode: 'standalone-local'
    },
    readiness: {
      state: 'ready',
      reasons: ['card has prompt and target'],
      operatorGuidanceOnly: true
    },
    localTruthLabel: 'local draft',
    ...localFalseFlags,
    truthStatus,
    createdAt
  }
}

export function createAssetDescriptor({
  card,
  workPacket,
  providerResult,
  hash,
  size,
  contentType,
  localPath,
  localRef,
  lifecycle,
  sourceApiCalled = false,
  transitionSummary = 'local candidate ingested from first wedge',
  createdAt = nowIso()
}) {
  return {
    schema: 'media.asset.descriptor.v1',
    assetId: `asset-${hash.value.slice(0, 16)}`,
    projectId: card.projectId,
    contentType,
    hash,
    size,
    localRef: localRef ?? {
      refKind: 'local-file',
      path: localPath
    },
    source: {
      sourceType: 'provider-result',
      providerResultRef: makeRef('provider-result', idForRecord(providerResult), providerResult.schema),
      apiCalled: sourceApiCalled
    },
    lineage: {
      parentRefs: [
        makeRef('media-card', card.cardId, card.schema),
        makeRef('media-work-packet', workPacket.packetId, workPacket.schema)
      ],
      referents: card.referenceAssetRefs,
      branchId: `${card.projectId}:local`,
      contextId: card.sceneId ?? card.projectId,
      observerRef: workPacket.operatorContext.operatorRef,
      continuityClaims: [],
      transitionSummary
    },
    provenance: {
      cardPromptHashScope: 'prompt text retained on card record',
      providerId: providerResult.providerId,
      providerResultLocalOnly: true,
      lifecycle
    },
    localTruthLabel: 'local receipt',
    ...localFalseFlags,
    truthStatus,
    createdAt
  }
}

export function createReviewEvidence({ card, assetDescriptor, summary, createdAt = nowIso() }) {
  return {
    schema: 'media.evidence.v1',
    evidenceId: `evidence-${randomUUID()}`,
    evidenceKind: 'local-review',
    projectId: card.projectId,
    subjectRef: makeRef('media-asset', assetDescriptor.assetId, assetDescriptor.schema),
    source: {
      sourceType: 'local-operator-review',
      mode: 'standalone-local'
    },
    summary,
    refs: [
      makeRef('media-card', card.cardId, card.schema),
      makeRef('media-asset', assetDescriptor.assetId, assetDescriptor.schema)
    ],
    classificationOnly: true,
    localTruthLabel: 'local receipt',
    ...localFalseFlags,
    truthStatus,
    createdAt
  }
}

export function createReadiness({ subjectRef, state, reasons, nextActions, createdAt = nowIso() }) {
  return {
    schema: 'media.readiness.v1',
    readinessId: `readiness-${randomUUID()}`,
    subjectRef,
    state,
    reasons,
    nextActions,
    operatorGuidanceOnly: true,
    localTruthLabel: 'local receipt',
    ...localFalseFlags,
    truthStatus,
    createdAt
  }
}

export function createOperatorDecision({
  assetDescriptor,
  reviewEvidence,
  operatorRef,
  decision,
  reason,
  createdAt = nowIso()
}) {
  const decisionType = decision === 'accepted' ? 'accept' : 'reject'

  return {
    schema: 'media.operator_decision.v1',
    decisionId: `decision-${randomUUID()}`,
    subjectRef: makeRef('media-asset', assetDescriptor.assetId, assetDescriptor.schema),
    decisionType,
    operatorRef,
    reason,
    evidenceRefs: [
      makeRef('media-evidence', reviewEvidence.evidenceId, reviewEvidence.schema)
    ],
    localDecisionOnly: true,
    localTruthLabel: 'local decision',
    ...localFalseFlags,
    truthStatus,
    createdAt
  }
}

export function createLocalRunManifest({
  card,
  candidateInputPath,
  candidateHash,
  generatedRecords,
  generatedRecordPaths,
  warnings = [
    'Mode 0 standalone-local output only.',
    'Provider result is synthetic/local-placeholder and not provider truth.',
    'Local file existence and local hashes are not byte availability or materialization proof.',
    'Operator decision is local-only and is not mesh authorization.'
  ],
  createdAt = nowIso()
}) {
  const recordEntries = Object.entries(generatedRecords)
  const generatedRecordRefs = recordEntries.map(([name, record]) => ({
    kind: record.schema,
    id: idForRecord(record),
    path: generatedRecordPaths[name],
    localOnly: true
  }))

  return {
    schema: artifactKinds.mediaLocalRunManifest,
    runId: `local-run-${randomUUID()}`,
    createdAt,
    mode: 'standalone-local',
    inputCardRef: makeRef('media-card', card.cardId, card.schema),
    candidateInputRef: {
      kind: 'local-candidate-input',
      path: candidateInputPath,
      hash: candidateHash,
      localOnly: true
    },
    generatedRecordRefs,
    artifactKinds: [
      card.schema,
      ...recordEntries.map(([, record]) => record.schema),
      ...extractNestedCapabilitySchemas(generatedRecords.providerProfile),
      generatedRecords.assetDescriptor?.localRef?.schema,
      generatedRecords.assetDescriptor?.provenance?.lifecycle?.schema,
      artifactKinds.mediaLocalRunManifest
    ].filter(Boolean),
    hashes: {
      candidate: candidateHash
    },
    doctrineLabels: [
      'local draft',
      'local receipt',
      'local cache',
      'local decision',
      'local evidence',
      'not mesh truth',
      'not distributed proof',
      'not ratified shared state',
      'not provider truth',
      'not byte availability proof',
      'not materialization proof',
      'not causal truth',
      'not publication authorization'
    ],
    warnings,
    operatorGuidanceOnly: true,
    ...localFalseFlags,
    providerTruth: false,
    byteAvailabilityProof: false,
    materializationProof: false,
    causalTruth: false,
    publicationAuthorization: false,
    localTruthLabel: 'local receipt',
    truthStatus
  }
}

export function createEdgeInspectionPacket({
  packetId = `edge-inspection-${randomUUID()}`,
  sourceRunRef,
  recordRefs,
  artifactKinds: packetArtifactKinds,
  generatedArtifactRefs,
  warnings = [],
  createdAt = nowIso()
}) {
  return {
    schema: artifactKinds.mediaEdgeInspectionPacketLocal,
    packetId,
    createdAt,
    mode: 'standalone-local',
    seam: 'media-edge-operator-seam',
    sourceRunRef,
    recordRefs,
    artifactKinds: packetArtifactKinds,
    generatedArtifactRefs,
    warnings,
    operatorGuidanceOnly: true,
    ...localFalseFlags,
    providerTruth: false,
    byteAvailabilityProof: false,
    materializationProof: false,
    publicationAuthorization: false,
    localTruthLabel: 'local receipt',
    truthStatus
  }
}

export function createByteReferencePreview({
  sourceRef,
  localRef,
  hash,
  size,
  contentType,
  createdAt = nowIso()
}) {
  return {
    schema: artifactKinds.mediaByteReferencePreviewLocal,
    byteRefPreviewId: `byte-ref-preview-${hash.value.slice(0, 16)}`,
    sourceRef,
    localRef,
    hash,
    size,
    contentType,
    status: 'not-materialized',
    byteAvailabilityProof: false,
    materializationProof: false,
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    localTruthLabel: 'local cache',
    truthStatus,
    createdAt
  }
}

function extractNestedCapabilitySchemas(providerProfile) {
  if (!providerProfile || !Array.isArray(providerProfile.capabilities)) {
    return []
  }

  return providerProfile.capabilities.map((capability) => capability.schema).filter(Boolean)
}

export function idForRecord(record) {
  if (record.cardId) return record.cardId
  if (record.packetId) return record.packetId
  if (record.providerJobResultId) return record.providerJobResultId
  if (record.assetId) return record.assetId
  if (record.evidenceId) return record.evidenceId
  if (record.readinessId) return record.readinessId
  if (record.decisionId) return record.decisionId
  if (record.runId) return record.runId
  if (record.requestId) return record.requestId
  if (record.providerId) return record.providerId
  if (record.capabilityId) return record.capabilityId
  if (record.resultId) return record.resultId
  if (record.byteRefPreviewId) return record.byteRefPreviewId
  return undefined
}
