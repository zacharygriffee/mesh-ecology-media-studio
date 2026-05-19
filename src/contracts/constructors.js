import { randomUUID } from 'node:crypto'

const truthStatus = 'not mesh truth; not distributed proof; not ratified shared state'

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
    truthStatus,
    createdAt
  }
}

export function createProviderJobResult({ card, workPacket, providerName, candidateLocalPath, createdAt = nowIso() }) {
  return {
    schema: 'media.provider_job_result.local.v1',
    providerJobResultId: `provider-result-${randomUUID()}`,
    projectId: card.projectId,
    packetRef: makeRef('media-work-packet', workPacket.packetId, workPacket.schema),
    cardRef: makeRef('media-card', card.cardId, card.schema),
    provider: {
      name: providerName,
      integration: 'local-placeholder',
      apiCalled: false
    },
    result: {
      candidateLocalPath,
      status: 'available-local'
    },
    localTruthLabel: 'local receipt',
    truthStatus,
    createdAt
  }
}

export function createAssetDescriptor({
  card,
  workPacket,
  providerJobResult,
  hash,
  size,
  contentType,
  localPath,
  createdAt = nowIso()
}) {
  return {
    schema: 'media.asset.descriptor.v1',
    assetId: `asset-${hash.value.slice(0, 16)}`,
    projectId: card.projectId,
    contentType,
    hash,
    size,
    localRef: {
      refKind: 'local-file',
      path: localPath
    },
    source: {
      sourceType: 'provider-job-result',
      providerJobResultRef: makeRef(
        'provider-job-result',
        providerJobResult.providerJobResultId,
        providerJobResult.schema
      ),
      apiCalled: false
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
      transitionSummary: 'local candidate ingested from first wedge'
    },
    provenance: {
      cardPromptHashScope: 'prompt text retained on card record',
      providerName: providerJobResult.provider.name,
      providerResultLocalOnly: true
    },
    localTruthLabel: 'local receipt',
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
    truthStatus,
    createdAt
  }
}
