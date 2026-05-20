import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { artifactKinds } from './artifact-kinds.js'
import { makeRef, nowIso } from './constructors.js'
import {
  assertMediaOperationCandidateDimensions,
  createMediaOperationCandidate,
  refForOperationCandidate
} from './operation-candidates.js'

export const ruleResolutionModes = Object.freeze(['auto_prepare', 'ask_operator', 'forbid'])
export const ruleDeliveryModes = Object.freeze(['log_only', 'inbox', 'urgent', 'critical', 'digest'])

const localFalseFlags = Object.freeze({
  localOnly: true,
  meshTruth: false,
  distributedProof: false,
  ratifiedSharedState: false
})

const traceFalseFlags = Object.freeze({
  authorityGranted: false,
  executionPerformed: false,
  edgeCalled: false,
  meshPublished: false,
  truthClaimed: false,
  completionClaimed: false,
  providerTruthClaimed: false,
  byteAvailabilityProven: false,
  materializationProven: false,
  causalTruthClaimed: false,
  publicationAuthorized: false
})

export function createMediaRuleResolutionTrace({
  traceId = `rule-trace-${randomUUID()}`,
  operationRef,
  projectId,
  effectiveRuleBookRef = makeRef('studio-rule-book', 'studio-local-media-rulebook-draft', 'media.rule_book.local.draft'),
  resolutionMode,
  deliveryMode,
  reasons,
  appliedRules,
  blockedClaims,
  createdAt = nowIso()
}) {
  assertAllowed(resolutionMode, ruleResolutionModes, 'resolutionMode')
  assertAllowed(deliveryMode, ruleDeliveryModes, 'deliveryMode')

  if (!Array.isArray(reasons) || reasons.length === 0) {
    throw new Error('Rule resolution trace must include reasons')
  }

  if (!Array.isArray(appliedRules) || appliedRules.length === 0) {
    throw new Error('Rule resolution trace must include appliedRules')
  }

  if (!Array.isArray(blockedClaims)) {
    throw new Error('Rule resolution trace blockedClaims must be an array')
  }

  return {
    schema: artifactKinds.mediaRuleResolutionTraceLocal,
    traceId,
    operationRef,
    projectId,
    effectiveRuleBookRef,
    resolutionMode,
    deliveryMode,
    reasons,
    appliedRules,
    blockedClaims,
    createdAt,
    operatorGuidanceOnly: true,
    nonClaims: {
      ...traceFalseFlags
    },
    localTruthLabel: 'local guidance',
    truthStatus: 'not mesh truth; not distributed proof; not ratified shared state',
    ...localFalseFlags,
    ...traceFalseFlags
  }
}

export function resolveMediaOperationCandidate(candidate, options = {}) {
  assertMediaOperationCandidateDimensions(candidate)

  const outcome = outcomeForCandidate(candidate)

  return createMediaRuleResolutionTrace({
    operationRef: refForOperationCandidate(candidate),
    projectId: candidate.projectId,
    effectiveRuleBookRef: options.effectiveRuleBookRef,
    resolutionMode: outcome.resolutionMode,
    deliveryMode: outcome.deliveryMode,
    reasons: outcome.reasons,
    appliedRules: outcome.appliedRules,
    blockedClaims: outcome.blockedClaims,
    createdAt: options.createdAt
  })
}

export async function writeRuleResolutionExample({
  projectDir = 'examples/card-to-candidate',
  createdAt = nowIso()
} = {}) {
  const outputDir = path.join(projectDir, 'records', 'rule-traces')
  await mkdir(outputDir, { recursive: true })

  const candidates = [
    createMediaOperationCandidate({
      operationId: 'operation-example-prepare-provider-job',
      projectId: 'project-test',
      artifactClass: 'media.provider_job',
      operationClass: 'prepare_provider_job',
      subjectRef: makeRef('media-card', 'card-test', artifactKinds.mediaCard),
      scopeDelta: 'local_record_only',
      riskTier: 'low',
      reversibility: 'reversible',
      authorityBoundary: 'local_project',
      evidenceRequirement: 'card_required',
      sourceRefs: [makeRef('media-card', 'card-test', artifactKinds.mediaCard)],
      createdAt
    }),
    createMediaOperationCandidate({
      operationId: 'operation-example-submit-live-provider-job',
      projectId: 'project-test',
      artifactClass: 'media.provider_job',
      operationClass: 'submit_live_provider_job',
      subjectRef: makeRef('media-card', 'card-test', artifactKinds.mediaCard),
      scopeDelta: 'external_provider_call',
      riskTier: 'high',
      reversibility: 'irreversible_cost',
      authorityBoundary: 'external_provider',
      evidenceRequirement: 'operator_decision_required',
      sourceRefs: [makeRef('media-card', 'card-test', artifactKinds.mediaCard)],
      createdAt
    }),
    createMediaOperationCandidate({
      operationId: 'operation-example-delete-local-media',
      projectId: 'project-test',
      artifactClass: 'media.local_file',
      operationClass: 'delete_local_media',
      subjectRef: makeRef('local-media-file', 'media/accepted/candidate.txt', artifactKinds.mediaLocalRef),
      scopeDelta: 'local_file_change',
      riskTier: 'critical',
      reversibility: 'irreversible',
      authorityBoundary: 'local_project',
      evidenceRequirement: 'backup_or_materialization_required',
      sourceRefs: [],
      createdAt
    })
  ]

  const traces = candidates.map((candidate) => resolveMediaOperationCandidate(candidate, { createdAt }))

  for (const candidate of candidates) {
    await writeJson(path.join(outputDir, `${candidate.operationId}.local.json`), candidate)
  }

  for (const trace of traces) {
    await writeJson(path.join(outputDir, `${trace.traceId}.local.json`), trace)
  }

  return {
    outputDir,
    candidates,
    traces
  }
}

function outcomeForCandidate(candidate) {
  switch (candidate.operationClass) {
    case 'submit_live_provider_job':
      return {
        resolutionMode: 'ask_operator',
        deliveryMode: 'urgent',
        reasons: [
          'Live provider submission crosses the external provider boundary.',
          'Provider calls may create cost, irreversible provider state, or rate-limit consequences.'
        ],
        appliedRules: [appliedRule('external-provider-boundary', 'ask_operator')],
        blockedClaims: ['provider truth', 'operator authorization', 'execution']
      }

    case 'prepare_provider_job':
      if (candidate.evidenceRequirement === 'card_required' && !hasSourceRef(candidate, artifactKinds.mediaCard, 'media-card')) {
        return {
          resolutionMode: 'ask_operator',
          deliveryMode: 'inbox',
          reasons: [
            'Preparing a provider job requires an explicit card reference.',
            'The candidate did not include card evidence in sourceRefs.'
          ],
          appliedRules: [appliedRule('card-evidence-required', 'ask_operator')],
          blockedClaims: ['execution', 'provider truth']
        }
      }

      return {
        resolutionMode: 'auto_prepare',
        deliveryMode: 'log_only',
        reasons: [
          'Provider job preparation is local record preparation only.',
          'No provider API call or external boundary crossing is performed.'
        ],
        appliedRules: [appliedRule('local-record-preparation', 'auto_prepare')],
        blockedClaims: ['execution', 'provider truth']
      }

    case 'move_candidate_to_accepted':
    case 'move_candidate_to_rejected':
      if (hasReviewEvidence(candidate)) {
        return {
          resolutionMode: 'auto_prepare',
          deliveryMode: 'log_only',
          reasons: [
            'Candidate movement can be prepared because review evidence is present.',
            'The trace prepares a local record posture only and does not grant approval authority.'
          ],
          appliedRules: [appliedRule('review-evidence-present', 'auto_prepare')],
          blockedClaims: ['approval authority', 'ratifier authority', 'publication authorization']
        }
      }

      return {
        resolutionMode: 'ask_operator',
        deliveryMode: 'inbox',
        reasons: [
          'Candidate movement needs review evidence before local preparation.',
          'Missing review evidence requires operator attention.'
        ],
        appliedRules: [appliedRule('review-evidence-required', 'ask_operator')],
        blockedClaims: ['approval authority', 'ratifier authority', 'execution']
      }

    case 'delete_local_media':
      return {
        resolutionMode: 'forbid',
        deliveryMode: 'urgent',
        reasons: [
          'Deleting local media is a destructive local media operation.',
          'This phase has no backup, byte availability, or materialization proof lane.'
        ],
        appliedRules: [appliedRule('destructive-local-media-operation', 'forbid')],
        blockedClaims: ['execution', 'byte availability proof', 'materialization proof']
      }

    case 'propose_byte_descriptor':
      return {
        resolutionMode: 'auto_prepare',
        deliveryMode: 'log_only',
        reasons: [
          'Byte descriptor proposal preparation is local candidate record preparation only.',
          'The result is not byte availability proof, materialization proof, or byte authority.'
        ],
        appliedRules: [appliedRule('byte-proposal-only', 'auto_prepare')],
        blockedClaims: ['byte availability proof', 'materialization proof', 'byte authority']
      }

    case 'propose_resource_ref':
      return {
        resolutionMode: 'auto_prepare',
        deliveryMode: 'log_only',
        reasons: [
          'Resource ref proposal preparation is local candidate record preparation only.',
          'The result is not resource admission, replicated pointer identity, or authority.'
        ],
        appliedRules: [appliedRule('resource-ref-candidate-only', 'auto_prepare')],
        blockedClaims: ['resource admission', 'replicated pointer identity', 'authority']
      }

    case 'prepare_export':
      return {
        resolutionMode: 'ask_operator',
        deliveryMode: 'inbox',
        reasons: [
          'Export preparation can imply publication or downstream distribution pressure.',
          'Operator review is required before preparing export posture.'
        ],
        appliedRules: [appliedRule('export-operator-review-required', 'ask_operator')],
        blockedClaims: ['publication authorization', 'mesh publication', 'approval authority']
      }

    case 'generate_proxy':
    case 'generate_thumbnail':
      return {
        resolutionMode: 'auto_prepare',
        deliveryMode: 'log_only',
        reasons: [
          'Proxy and thumbnail generation are local reversible derivative artifact preparation.',
          'The trace does not execute generation or claim media truth.'
        ],
        appliedRules: [appliedRule('local-derivative-artifact', 'auto_prepare')],
        blockedClaims: ['execution', 'media truth']
      }

    default:
      throw new Error(`Unsupported media operation class: ${candidate.operationClass}`)
  }
}

function hasReviewEvidence(candidate) {
  return hasSourceRef(candidate, artifactKinds.mediaEvidence, 'media-evidence') ||
    hasSourceRef(candidate, artifactKinds.mediaCandidateReviewLocal, 'media-candidate-review') ||
    candidate.sourceRefs.some((ref) => typeof ref.kind === 'string' && ref.kind.includes('review'))
}

function hasSourceRef(candidate, schema, kind) {
  return candidate.sourceRefs.some((ref) => ref?.schema === schema || ref?.kind === kind)
}

function appliedRule(ruleId, resolutionMode) {
  return {
    ruleId,
    resolutionMode,
    precedence: 'forbid > ask_operator > auto_prepare > auto_execute'
  }
}

function assertAllowed(value, allowed, field) {
  if (!allowed.includes(value)) {
    throw new Error(`Invalid media rule resolution ${field}: ${value}`)
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const projectDirIndex = process.argv.indexOf('--project-dir')
  const projectDir = projectDirIndex === -1
    ? 'examples/card-to-candidate'
    : process.argv[projectDirIndex + 1]

  const result = await writeRuleResolutionExample({ projectDir })
  console.log(`rule traces: ${result.outputDir}`)
  console.log(`operationCandidates: ${result.candidates.length}`)
  console.log(`ruleResolutionTraces: ${result.traces.length}`)
}
