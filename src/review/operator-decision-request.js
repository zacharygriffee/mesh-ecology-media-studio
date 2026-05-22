import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { artifactKinds } from '../contracts/artifact-kinds.js'
import { makeRef, nowIso } from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import { assertSafeLocalPath } from '../local/project-layout.js'
import { writeJsonAtomic } from '../local/atomic-json.js'

const modulePath = fileURLToPath(import.meta.url)
const truthStatus = 'not mesh truth; not distributed proof; not ratified shared state'
const defaultProjectDir = 'examples/card-to-candidate'
const defaultHandoff = 'records/exports/media-edge-handoff-candidate.local.json'
const defaultProviderLoopStatus = 'records/provider-results/media-provider-loop-status.local.json'
const defaultProviderLoopRequest = 'records/requests/media-provider-loop-operator-decision-request.local.json'
const defaultOutput = 'records/requests/media-operator-decision-request.local.json'
const defaultProviderLoopDecisionOutput = 'records/decisions/media-provider-loop-operator-decision.local.json'

function parseArgs(argv) {
  const args = {
    projectDir: defaultProjectDir,
    handoff: defaultHandoff,
    providerLoopStatus: undefined,
    providerLoopRequest: undefined,
    decision: undefined,
    operatorRef: 'local-operator',
    reason: undefined,
    output: defaultOutput,
    print: false
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]

    if (arg === '--project-dir') {
      args.projectDir = next
      i += 1
    } else if (arg === '--handoff') {
      args.handoff = next
      i += 1
    } else if (arg === '--provider-loop-status') {
      args.providerLoopStatus = next ?? defaultProviderLoopStatus
      i += 1
    } else if (arg === '--provider-loop-request') {
      args.providerLoopRequest = next ?? defaultProviderLoopRequest
      args.output = args.output === defaultOutput ? defaultProviderLoopDecisionOutput : args.output
      i += 1
    } else if (arg === '--decision') {
      args.decision = next
      i += 1
    } else if (arg === '--operator-ref') {
      args.operatorRef = next
      i += 1
    } else if (arg === '--reason') {
      args.reason = next
      i += 1
    } else if (arg === '--output') {
      args.output = next
      i += 1
    } else if (arg === '--print') {
      args.print = true
    }
  }

  return args
}

export async function writeOperatorDecisionRequest({
  projectDir = defaultProjectDir,
  handoff = defaultHandoff,
  providerLoopStatus,
  providerLoopRequest,
  decision,
  operatorRef = 'local-operator',
  reason,
  output = defaultOutput,
  print = false
} = {}) {
  assertSafeLocalPath(output)

  if (providerLoopRequest) {
    return writeProviderLoopOperatorDecision({
      projectDir,
      providerLoopRequest,
      decision,
      operatorRef,
      reason,
      output: output === defaultOutput ? defaultProviderLoopDecisionOutput : output,
      print
    })
  }

  const root = path.resolve(projectDir)
  const request = providerLoopStatus
    ? await createProviderLoopDecisionRequestFromProject({ root, providerLoopStatus })
    : await createHandoffDecisionRequestFromProject({ root, handoff })

  await writeJsonAtomic(root, output, request)

  if (print) {
    console.log(JSON.stringify(request, null, 2))
  } else {
    console.log(formatDecisionRequestSummary(request, output))
    if (request.nextActions.length > 0) {
      console.log(`nextAction: ${request.nextActions[0]}`)
    }
  }

  return {
    request,
    output
  }
}

export async function writeProviderLoopOperatorDecision({
  projectDir = defaultProjectDir,
  providerLoopRequest = defaultProviderLoopRequest,
  decision,
  operatorRef = 'local-operator',
  reason,
  output = defaultProviderLoopDecisionOutput,
  print = false
} = {}) {
  assertSafeLocalPath(providerLoopRequest)
  assertSafeLocalPath(output)

  const root = path.resolve(projectDir)
  const request = JSON.parse(await readFile(path.join(root, providerLoopRequest), 'utf8'))
  validateRequiredRecord(request, artifactKinds.mediaOperatorDecisionRequestLocal)

  const operatorDecision = createProviderLoopOperatorDecision({
    request,
    requestPath: providerLoopRequest,
    decision,
    operatorRef,
    reason
  })

  await writeJsonAtomic(root, output, operatorDecision)

  if (print) {
    console.log(JSON.stringify(operatorDecision, null, 2))
  } else {
    console.log([
      `operator decision: ${operatorDecision.decisionType}`,
      `subject=${operatorDecision.subjectRef.id}`,
      `executionPerformed=${operatorDecision.executionPerformed}`,
      `output=${output}`
    ].join(' | '))
    console.log(`nextAction: ${operatorDecision.nextAction}`)
  }

  return {
    decision: operatorDecision,
    output
  }
}

async function createHandoffDecisionRequestFromProject({ root, handoff }) {
  assertSafeLocalPath(handoff)
  const handoffRecord = JSON.parse(await readFile(path.join(root, handoff), 'utf8'))
  validateRequiredRecord(handoffRecord, artifactKinds.mediaEdgeHandoffCandidateLocal)

  return createOperatorDecisionRequest({
    handoff: handoffRecord,
    handoffPath: handoff
  })
}

async function createProviderLoopDecisionRequestFromProject({ root, providerLoopStatus }) {
  assertSafeLocalPath(providerLoopStatus)
  const statusRecord = JSON.parse(await readFile(path.join(root, providerLoopStatus), 'utf8'))
  validateRequiredRecord(statusRecord, artifactKinds.mediaProviderLoopStatusLocal)

  return createProviderLoopDecisionRequest({
    providerLoopStatus: statusRecord,
    providerLoopStatusPath: providerLoopStatus
  })
}

export function createOperatorDecisionRequest({
  handoff,
  handoffPath,
  createdAt = nowIso()
}) {
  const ready = handoff.handoffState === 'ready-for-edge-inspection'
  const requestKind = ready ? 'review-ready-handoff' : 'resolve-local-attention'
  const requestedDecisionTypes = ready
    ? ['review_handoff', 'defer']
    : ['resolve_blockers', 'request_changes', 'defer']
  const reason = ready
    ? 'Studio local handoff is ready for future Edge-mediated operator review.'
    : 'Studio local handoff needs operator attention before future Edge-mediated review.'
  const nextActions = handoff.readinessDiagnosis?.nextActions?.length > 0
    ? handoff.readinessDiagnosis.nextActions
    : ['Review handoff diagnosis and decide whether to defer or request local changes.']

  const request = {
    schema: artifactKinds.mediaOperatorDecisionRequestLocal,
    requestId: `operator-decision-request-${handoff.projectId}`,
    projectId: handoff.projectId,
    createdAt,
    mode: 'standalone-local',
    requestKind,
    targetSurface: 'media-edge-operator-seam',
    subjectRef: makeRef('media-edge-handoff-candidate', handoff.handoffCandidateId, handoff.schema),
    sourceRefs: [
      {
        ...makeRef('media-edge-handoff-candidate', handoff.handoffCandidateId, handoff.schema),
        path: handoffPath,
        localOnly: true
      },
      handoff.inspectionPacketRef,
      handoff.compatibilityBundleRef,
      handoff.projectHealthRef,
      handoff.operatorPacketIndexRef
    ],
    requestedDecisionTypes,
    reason,
    nextActions,
    status: 'proposed',
    operatorGuidanceOnly: true,
    requestOnly: true,
    authorityRequired: true,
    edgeRuntimeBuilt: false,
    edgeRuntimeVerified: false,
    approvalAuthority: false,
    ratifierAuthority: false,
    publicationAuthorization: false,
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    providerTruth: false,
    localTruthLabel: 'local request',
    truthStatus
  }

  validateRequiredRecord(request)
  return request
}

export function createProviderLoopDecisionRequest({
  providerLoopStatus,
  providerLoopStatusPath = defaultProviderLoopStatus,
  createdAt = nowIso()
}) {
  const complete = providerLoopStatus.state === 'complete_review_only'
  const failed = providerLoopStatus.state === 'failed_review_only'
  const requestedDecisionTypes = complete
    ? ['review_provider_loop', 'defer']
    : ['retry_provider_loop', 'defer']
  const nextActions = complete
    ? ['Review the local-only provider-loop status and generated candidate records before using the result in broader production work.']
    : [
        providerLoopStatus.nextAction,
        'If the operator chooses retry, rerun npm run provider:venice:loop explicitly; this request does not execute retries.'
      ].filter(Boolean)

  const request = {
    schema: artifactKinds.mediaOperatorDecisionRequestLocal,
    requestId: `operator-decision-request-provider-loop-${providerLoopStatus.projectId}`,
    projectId: providerLoopStatus.projectId,
    createdAt,
    mode: 'standalone-local',
    requestKind: 'review-provider-loop',
    targetSurface: 'media-edge-operator-seam',
    subjectRef: makeRef('media-provider-loop-status', providerLoopStatus.statusId, providerLoopStatus.schema),
    sourceRefs: [
      {
        ...makeRef('media-provider-loop-status', providerLoopStatus.statusId, providerLoopStatus.schema),
        path: providerLoopStatusPath,
        localOnly: true
      }
    ],
    requestedDecisionTypes,
    retryPreview: complete
      ? undefined
      : {
          command: 'npm run provider:venice:loop',
          requiresOperatorDecision: true,
          executionPerformed: false,
          localOnly: true,
          meshTruth: false,
          providerTruth: false
        },
    reason: complete
      ? 'Provider-loop status is complete for local review, but it is not production readiness, provider truth, or authority.'
      : `Provider-loop status is ${providerLoopStatus.state}${failed && providerLoopStatus.failedStep ? ` at ${providerLoopStatus.failedStep}` : ''}; operator review is required before any retry.`,
    nextActions,
    status: 'proposed',
    operatorGuidanceOnly: true,
    requestOnly: true,
    authorityRequired: true,
    edgeRuntimeBuilt: false,
    edgeRuntimeVerified: false,
    approvalAuthority: false,
    ratifierAuthority: false,
    publicationAuthorization: false,
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    providerTruth: false,
    localTruthLabel: 'local request',
    truthStatus
  }

  validateRequiredRecord(request)
  return request
}

export function createProviderLoopOperatorDecision({
  request,
  requestPath = defaultProviderLoopRequest,
  decision,
  operatorRef = 'local-operator',
  reason,
  createdAt = nowIso()
}) {
  if (request.requestKind !== 'review-provider-loop') {
    throw new Error(`Provider-loop operator decision requires review-provider-loop request, received ${request.requestKind}`)
  }

  if (!decision) {
    throw new Error('Provider-loop operator decision requires --decision')
  }

  if (!request.requestedDecisionTypes.includes(decision)) {
    throw new Error(`Decision ${decision} is not allowed by request ${request.requestId}`)
  }

  const retry = decision === 'retry_provider_loop'
  const review = decision === 'review_provider_loop'
  const defer = decision === 'defer'

  const operatorDecision = {
    schema: artifactKinds.mediaOperatorDecision,
    decisionId: `decision-provider-loop-${request.projectId}-${decision}`,
    projectId: request.projectId,
    subjectRef: request.subjectRef,
    decisionType: decision,
    operatorRef,
    reason: reason ?? providerLoopDecisionReason(decision),
    evidenceRefs: request.sourceRefs,
    sourceRequestRef: {
      ...makeRef('media-operator-decision-request', request.requestId, request.schema),
      path: requestPath,
      localOnly: true
    },
    providerLoopDecision: decision,
    allowsExplicitRetryAttempt: retry,
    reviewAcknowledged: review,
    deferred: defer,
    nextAction: retry
      ? 'Rerun npm run provider:venice:loop with --live-provider and --retry-decision pointing at this local decision record.'
      : 'Keep the provider loop in review/deferred posture; no retry was authorized locally.',
    localDecisionOnly: true,
    operatorGuidanceOnly: true,
    executionPerformed: false,
    authorityGranted: false,
    approvalAuthority: false,
    ratifierAuthority: false,
    publicationAuthorization: false,
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    providerTruth: false,
    byteAvailabilityProof: false,
    materializationProof: false,
    resourceAdmission: false,
    edgeCalled: false,
    meshPublished: false,
    localTruthLabel: 'local decision',
    truthStatus,
    createdAt
  }

  validateRequiredRecord(operatorDecision)
  return operatorDecision
}

function providerLoopDecisionReason(decision) {
  if (decision === 'retry_provider_loop') {
    return 'Local operator chose to permit one explicit provider-loop retry attempt; this does not execute the retry or grant provider truth.'
  }

  if (decision === 'review_provider_loop') {
    return 'Local operator acknowledged provider-loop output for review; this does not make it production-ready or authoritative.'
  }

  return 'Local operator deferred provider-loop action; no retry or broader production use is authorized locally.'
}

function formatDecisionRequestSummary(request, output) {
  return [
    `operator decision request: ${request.requestKind}`,
    `status=${request.status}`,
    `decisions=${request.requestedDecisionTypes.join(',')}`,
    `output=${output}`
  ].join(' | ')
}

if (process.argv[1] === modulePath) {
  await writeOperatorDecisionRequest(parseArgs(process.argv.slice(2)))
}
