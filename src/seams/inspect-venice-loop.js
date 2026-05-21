import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { artifactKinds } from '../contracts/artifact-kinds.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import { assertSafeLocalPath } from '../local/project-layout.js'

const modulePath = fileURLToPath(import.meta.url)
const defaultProjectDir = 'examples/venice-smoke'
const defaultStatusRef = 'records/provider-results/media-provider-loop-status.local.json'
const defaultRequestRef = 'records/requests/media-provider-loop-operator-decision-request.local.json'
const defaultDecisionRef = 'records/decisions/media-provider-loop-operator-decision.local.json'

function parseArgs(argv) {
  const args = {
    projectDir: defaultProjectDir,
    status: defaultStatusRef,
    request: defaultRequestRef,
    decision: defaultDecisionRef,
    print: false
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]

    if (arg === '--project-dir') {
      args.projectDir = next
      i += 1
    } else if (arg === '--status') {
      args.status = next
      i += 1
    } else if (arg === '--request') {
      args.request = next
      i += 1
    } else if (arg === '--decision') {
      args.decision = next
      i += 1
    } else if (arg === '--print') {
      args.print = true
    }
  }

  return args
}

export async function inspectVeniceLoop({
  projectDir = defaultProjectDir,
  status = defaultStatusRef,
  request = defaultRequestRef,
  decision = defaultDecisionRef,
  print = false
} = {}) {
  assertSafeLocalPath(status)
  assertSafeLocalPath(request)
  assertSafeLocalPath(decision)

  const root = path.resolve(projectDir)
  const record = JSON.parse(await readFile(path.join(root, status), 'utf8'))
  validateRequiredRecord(record)
  const requestRecord = await readOptionalRecord(root, request, artifactKinds.mediaOperatorDecisionRequestLocal)
  const decisionRecord = await readOptionalRecord(root, decision, artifactKinds.mediaOperatorDecision)
  const summary = createVeniceLoopInspectionSummary(record, status, {
    requestRef: request,
    requestRecord,
    decisionRef: decision,
    decisionRecord
  })

  if (print) {
    console.log(JSON.stringify(summary, null, 2))
  } else {
    printVeniceLoopInspectionSummary(summary)
  }

  return {
    summary,
    record,
    status,
    requestRecord,
    decisionRecord
  }
}

export function createVeniceLoopInspectionSummary(record, statusRef = defaultStatusRef, {
  requestRef = defaultRequestRef,
  requestRecord,
  decisionRef = defaultDecisionRef,
  decisionRecord
} = {}) {
  const media = record.mediaSummary
  const candidate = record.selectedCandidate
  const retryPath = summarizeRetryPath({
    record,
    requestRef,
    requestRecord,
    decisionRef,
    decisionRecord
  })

  return {
    summaryKind: 'venice-loop-inspection-summary',
    statusRef,
    projectId: record.projectId,
    providerId: record.providerId,
    adapterFixture: record.adapterFixture,
    loopKind: record.loopKind,
    completionScope: record.completionScope ?? 'generated-candidate-local-loop',
    productionReady: record.productionReady === true,
    productionReadiness: record.productionReadiness ?? 'not assessed; provider-loop status only',
    productionBlockers: record.productionBlockers ?? productionBlockersForProviderLoop(record),
    productionNextAction: record.productionNextAction ?? productionNextActionForProviderLoop(record),
    state: record.state,
    failedStep: record.failedStep,
    completedSteps: record.completedSteps,
    selectedCandidate: candidate
      ? {
          selectionMode: candidate.selectionMode,
          assetRecord: candidate.assetRecord,
          path: candidate.path,
          localOnly: true
        }
      : undefined,
    providerRuns: record.providerLedger
      ? {
          total: record.providerLedger.total,
          succeeded: record.providerLedger.succeeded,
          failed: record.providerLedger.failed,
          localOnly: true,
          providerTruth: false
        }
      : undefined,
    generatedCandidates: media?.generatedCandidates,
    derivatives: media?.derivatives,
    identity: media?.identity,
    remainingAttention: media?.remainingAttention,
    retryGate: record.retryGate,
    retryPath,
    nextAction: record.nextAction,
    localOnly: true,
    operatorGuidanceOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    providerTruth: false,
    byteAvailabilityProof: false,
    materializationProof: false,
    resourceAdmission: false,
    edgeCalled: false,
    meshPublished: false
  }
}

async function readOptionalRecord(root, relativePath, schemaId) {
  try {
    const record = JSON.parse(await readFile(path.join(root, relativePath), 'utf8'))
    validateRequiredRecord(record, schemaId)
    return record
  } catch (error) {
    if (error?.code === 'ENOENT') return undefined
    throw error
  }
}

function summarizeRetryPath({
  record,
  requestRef,
  requestRecord,
  decisionRef,
  decisionRecord
}) {
  const failed = record.state === 'failed_review_only'
  const requestAllowsRetry = requestRecord?.requestedDecisionTypes?.includes('retry_provider_loop') === true
  const retryDecision = decisionRecord?.decisionType === 'retry_provider_loop' &&
    decisionRecord?.allowsExplicitRetryAttempt === true
  const deferDecision = decisionRecord?.decisionType === 'defer'

  let state = 'not-required'
  let nextAction = 'No retry path is required for this provider-loop status.'

  if (failed && !requestRecord) {
    state = 'needs-request'
    nextAction = 'Run npm run operator:provider-loop-request to create a local retry/defer request.'
  } else if (failed && requestRecord && !decisionRecord) {
    state = 'needs-decision'
    nextAction = 'Run npm run operator:provider-loop-decision with --decision retry_provider_loop or --decision defer.'
  } else if (failed && retryDecision) {
    state = 'ready-for-explicit-live-retry'
    nextAction = `Rerun npm run provider:venice:loop with --live-provider --retry-decision ${decisionRef}.`
  } else if (failed && deferDecision) {
    state = 'deferred'
    nextAction = 'Provider-loop retry is locally deferred; do not retry until a new local decision is recorded.'
  } else if (failed) {
    state = 'decision-not-retry-capable'
    nextAction = 'Review provider-loop decision; it does not currently permit retry.'
  }

  return {
    state,
    statusState: record.state,
    failedStep: record.failedStep ?? null,
    requestRef,
    requestPresent: requestRecord !== undefined,
    requestAllowsRetry,
    requestedDecisionTypes: requestRecord?.requestedDecisionTypes ?? [],
    decisionRef,
    decisionPresent: decisionRecord !== undefined,
    decisionType: decisionRecord?.decisionType,
    retryDecision,
    deferDecision,
    retryGate: record.retryGate
      ? {
          required: record.retryGate.required === true,
          satisfied: record.retryGate.satisfied === true,
          executionPerformed: record.retryGate.executionPerformed === true,
          authorityGranted: record.retryGate.authorityGranted === true,
          localOnly: true
        }
      : undefined,
    nextAction,
    localOnly: true,
    operatorGuidanceOnly: true,
    executionPerformed: false,
    authorityGranted: false,
    providerTruth: false,
    meshTruth: false,
    edgeCalled: false,
    meshPublished: false
  }
}

function printVeniceLoopInspectionSummary(summary) {
  console.log([
    `venice loop inspection: state=${summary.state}`,
    `project=${summary.projectId}`,
    `scope=${summary.completionScope}`,
    `candidate=${summary.selectedCandidate?.path ?? 'none'}`,
    `generated=${summary.generatedCandidates?.total ?? 0}`,
    `reviewed=${summary.generatedCandidates?.reviewed ?? 0}`,
    `promotedAccepted=${summary.generatedCandidates?.promotedAccepted ?? 0}`,
    `promotedRejected=${summary.generatedCandidates?.promotedRejected ?? 0}`,
    `derivatives=${summary.derivatives ? `${summary.derivatives.readyAssets}/${summary.derivatives.evaluatedAssets}` : '0/0'}`,
    `providerRuns=${summary.providerRuns?.total ?? 0}`,
    `remainingAttention=${summary.remainingAttention ?? 'unknown'}`
  ].join(' | '))

  if (summary.failedStep) {
    console.log(`failedStep: ${summary.failedStep}`)
  }
  console.log([
    `retryPath: ${summary.retryPath.state}`,
    `request=${summary.retryPath.requestPresent}`,
    `decision=${summary.retryPath.decisionType ?? 'none'}`,
    `gate=${summary.retryPath.retryGate ? `${summary.retryPath.retryGate.required}/${summary.retryPath.retryGate.satisfied}` : 'none'}`
  ].join(' | '))
  console.log(`retryNextAction: ${summary.retryPath.nextAction}`)
  console.log(`productionReady: ${summary.productionReady}`)
  console.log(`productionBlockers: ${summary.productionBlockers.length > 0 ? summary.productionBlockers.join(',') : 'none'}`)
  console.log(`productionNextAction: ${summary.productionNextAction}`)
  console.log(`nextAction: ${summary.nextAction}`)
  console.log('nonClaims: local-only; no Edge call; no mesh truth; no provider truth; no byte/materialization proof; no resource admission')
}

function productionBlockersForProviderLoop(record) {
  if (record.productionReady === true) return []
  if (record.state === 'complete_review_only') {
    return [
      'provider_loop_complete_review_only',
      'production_review_or_authority_not_granted'
    ]
  }
  if (record.state === 'complete_with_attention') {
    return [
      'local_attention_required_before_production_review',
      'production_review_or_authority_not_granted'
    ]
  }
  if (record.state === 'failed_review_only') {
    return [
      'provider_loop_failed_review_only',
      'retry_or_defer_decision_required'
    ]
  }
  return ['provider_loop_not_complete']
}

function productionNextActionForProviderLoop(record) {
  if (record.productionReady === true) return 'No local provider-loop production blocker is reported.'
  if (record.state === 'complete_review_only') {
    return 'Inspect accepted assets in media:summary and route any approval proposals before production use.'
  }
  if (record.state === 'complete_with_attention') {
    return record.nextAction ?? 'Clear local attention rows before production review.'
  }
  if (record.state === 'failed_review_only') {
    return 'Request retry or defer decision; do not treat the failed loop as production-ready.'
  }
  return record.nextAction ?? 'Complete the provider loop before production review.'
}

if (process.argv[1] === modulePath) {
  await inspectVeniceLoop(parseArgs(process.argv.slice(2)))
}
