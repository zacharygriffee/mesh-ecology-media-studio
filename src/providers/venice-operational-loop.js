import { fileURLToPath } from 'node:url'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { artifactKinds } from '../contracts/artifact-kinds.js'
import { nowIso } from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import { writeByteDescriptorProposals } from '../assets/byte-descriptor-proposal.js'
import { generateThumbnailDerivatives } from '../assets/generate-thumbnails.js'
import { createMediaSummary } from '../assets/media-summary.js'
import { repairLocalPosture } from '../local/repair-local-posture.js'
import { assertSafeLocalPath } from '../local/project-layout.js'
import { promoteCandidate } from '../local/promote-candidate.js'
import { writeLocalLayerResourceRefCandidates } from '../local/resource-ref-candidates.js'
import { inspectVeniceSmoke } from '../seams/inspect-venice-smoke.js'
import { indexProviderRuns } from '../seams/index-provider-runs.js'
import { readProjectRecords } from '../seams/project-status.js'
import { runVeniceLiveSmoke } from './venice-live-smoke.js'

const modulePath = fileURLToPath(import.meta.url)
const defaultProjectDir = 'examples/venice-smoke'
const defaultStatusOutput = 'records/provider-results/media-provider-loop-status.local.json'
const smokeAssetRecord = 'records/assets/venice-live-smoke-asset-0.local.json'
const smokeProviderResultRecord = 'records/provider-results/venice-live-smoke-provider-result.local.json'
const smokeCardRecord = 'cards/card.json'
const onePixelPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
const truthStatus = 'not mesh truth; not distributed proof; not ratified shared state'

function parseArgs(argv) {
  const args = {
    projectDir: defaultProjectDir,
    output: defaultStatusOutput,
    assetRecord: undefined,
    decision: 'accepted',
    operatorRef: 'local-operator',
    retryDecision: undefined,
    liveProvider: false,
    verbose: false,
    print: false
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]

    if (arg === '--project-dir') {
      args.projectDir = next
      i += 1
    } else if (arg === '--output') {
      args.output = next
      i += 1
    } else if (arg === '--asset-record') {
      args.assetRecord = next
      i += 1
    } else if (arg === '--decision') {
      args.decision = next
      i += 1
    } else if (arg === '--operator-ref') {
      args.operatorRef = next
      i += 1
    } else if (arg === '--retry-decision') {
      args.retryDecision = next
      i += 1
    } else if (arg === '--live-provider') {
      args.liveProvider = true
    } else if (arg === '--no-live-provider') {
      args.liveProvider = false
    } else if (arg === '--verbose') {
      args.verbose = true
    } else if (arg === '--print') {
      args.print = true
    }
  }

  return args
}

export async function runVeniceOperationalLoop({
  projectDir = defaultProjectDir,
  output = defaultStatusOutput,
  assetRecord,
  decision = 'accepted',
  operatorRef = 'local-operator',
  retryDecision,
  liveProvider = false,
  verbose = false,
  env = process.env,
  envPath = '.env',
  fetchImpl
} = {}) {
  const status = {
    schema: artifactKinds.mediaProviderLoopStatusLocal,
    statusId: 'provider-loop-status-venice-smoke',
    projectId: 'venice-smoke-project',
    providerId: 'venice',
    loopKind: 'generated-image-provider-loop',
    adapterFixture: 'venice',
    createdAt: nowIso(),
    completionScope: 'generated-candidate-local-loop',
    productionReady: false,
    productionReadiness: 'not assessed; local generated-candidate loop status only',
    projectDir,
    output,
    decision,
    liveProviderRequested: liveProvider,
    liveProviderCalled: false,
    retryGate: {
      required: false,
      satisfied: false,
      localOnly: true,
      executionPerformed: false,
      authorityGranted: false
    },
    state: 'running',
    completedSteps: [],
    failedStep: null,
    nextAction: null,
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
    meshPublished: false,
    localTruthLabel: 'local status',
    truthStatus
  }

  try {
    status.retryGate = await evaluateRetryGate({
      projectDir,
      output,
      retryDecision,
      liveProvider
    })
  } catch (error) {
    return writeAndReturnStatus(projectDir, output, failStatus(status, {
      failedStep: 'retry_decision_gate',
      error,
      nextAction: 'Create a local provider-loop retry decision with npm run operator:provider-loop-decision before retrying live provider execution.'
    }))
  }

  try {
    status.liveProviderCalled = liveProvider
    const provider = await runMaybeQuiet(verbose, () => runVeniceLiveSmoke({
      projectDir,
      env: liveProvider ? env : dryRunEnv(env),
      envPath,
      fetchImpl: liveProvider ? fetchImpl : localVeniceFetch,
      externalApiCall: liveProvider
    }))
    status.liveProviderCalled = provider.live === true
    status.provider = {
      status: provider.providerResult.status,
      generatedAssets: provider.generatedAssets.assets.length,
      providerResultRef: smokeProviderResultRecord,
      localOnly: true,
      providerTruth: false
    }
    status.completedSteps.push('provider_smoke')
  } catch (error) {
    return writeAndReturnStatus(projectDir, output, failStatus(status, {
      failedStep: 'provider_smoke',
      error,
      nextAction: liveProvider
        ? 'Check VENICE_LIVE, VENICE_INFERENCE_KEY, network access, provider budget, retry decision, and provider failure evidence.'
        : 'Check the local Venice-shaped smoke response and provider normalization path.'
    }))
  }

  try {
    const ledger = await runMaybeQuiet(verbose, () => indexProviderRuns({ projectDir }))
    status.providerLedger = {
      output: ledger.output,
      total: ledger.ledger.summary.total,
      succeeded: ledger.ledger.summary.byStatus.succeeded ?? 0,
      failed: ledger.ledger.summary.byStatus.failed ?? 0,
      localOnly: true,
      providerTruth: false
    }
    status.completedSteps.push('provider_run_ledger')
  } catch (error) {
    return writeAndReturnStatus(projectDir, output, failStatus(status, {
      failedStep: 'provider_run_ledger',
      error,
      nextAction: 'Run npm run inspect:provider-runs to inspect provider result and adapter run records.'
    }))
  }

  try {
    const beforePromotion = await runMaybeQuiet(verbose, () => generateThumbnailDerivatives({ projectDir }))
    status.thumbnailsBeforePromotion = thumbnailCounts(beforePromotion)
    status.completedSteps.push('thumbnail_generated_candidate')
  } catch (error) {
    return writeAndReturnStatus(projectDir, output, failStatus(status, {
      failedStep: 'thumbnail_generated_candidate',
      error,
      nextAction: 'Review image metadata and rerun npm run derivatives:thumbnail for the project.'
    }))
  }

  let selectedCandidate
  try {
    selectedCandidate = await selectVenicePromotionCandidate({
      projectDir,
      assetRecord
    })
    status.selectedCandidate = {
      selectionMode: assetRecord ? 'explicit-asset-record' : 'latest-generated',
      assetRecord: selectedCandidate.assetRecord,
      providerResultRecord: selectedCandidate.providerResultRecord,
      path: selectedCandidate.assetDescriptor.localRef?.path,
      createdAt: selectedCandidate.assetDescriptor.createdAt,
      localOnly: true
    }
    status.completedSteps.push('select_generated_candidate')
  } catch (error) {
    return writeAndReturnStatus(projectDir, output, failStatus(status, {
      failedStep: 'select_generated_candidate',
      error,
      nextAction: 'Run npm run media:summary and choose a generated asset record with --asset-record, or rerun the provider smoke step.'
    }))
  }

  try {
    const promotion = await runMaybeQuiet(verbose, () => promoteCandidate({
      projectDir,
      assetRecord: selectedCandidate.assetRecord,
      cardRecord: smokeCardRecord,
      providerResultRecord: selectedCandidate.providerResultRecord,
      decision,
      operatorRef
    }))
    status.promotion = {
      decision,
      assetRecord: promotion.assetRecord,
      path: promotion.assetDescriptor.localRef.path,
      localOnly: true,
      publicationAuthorization: false
    }
    status.completedSteps.push('promote_candidate')
  } catch (error) {
    return writeAndReturnStatus(projectDir, output, failStatus(status, {
      failedStep: 'promote_candidate',
      error,
      nextAction: 'Check the generated asset/provider result records, then rerun promote:candidate or this loop.'
    }))
  }

  try {
    const afterPromotion = await runMaybeQuiet(verbose, () => generateThumbnailDerivatives({ projectDir }))
    status.thumbnailsAfterPromotion = thumbnailCounts(afterPromotion)
    status.completedSteps.push('thumbnail_promoted_candidate')
  } catch (error) {
    return writeAndReturnStatus(projectDir, output, failStatus(status, {
      failedStep: 'thumbnail_promoted_candidate',
      error,
      nextAction: 'Review promoted asset metadata and rerun npm run derivatives:thumbnail for the project.'
    }))
  }

  try {
    const byteResult = await writeByteDescriptorProposals({ projectDir, quiet: true })
    status.byteDescriptorProposals = byteResult.proposals.length
    status.completedSteps.push('byte_descriptor_proposals')
  } catch (error) {
    return writeAndReturnStatus(projectDir, output, failStatus(status, {
      failedStep: 'byte_descriptor_proposals',
      error,
      nextAction: 'Check accepted/reference asset descriptors before rerunning npm run bytes:proposal.'
    }))
  }

  try {
    const resourceResult = await writeLocalLayerResourceRefCandidates({ projectDir, quiet: true })
    status.resourceRefCandidates = resourceResult.candidates.length
    status.completedSteps.push('resource_ref_candidates')
  } catch (error) {
    return writeAndReturnStatus(projectDir, output, failStatus(status, {
      failedStep: 'resource_ref_candidates',
      error,
      nextAction: 'Check byte descriptor proposals and situated asset descriptors before rerunning npm run resource:refs.'
    }))
  }

  try {
    const repair = await runMaybeQuiet(verbose, () => repairLocalPosture({ projectDir }))
    status.repair = {
      repaired: repair.repairs.length,
      skipped: repair.skippedIssues.length,
      remainingAttention: repair.remainingAttention,
      skippedIssues: repair.skippedIssues,
      localOnly: true
    }
    status.completedSteps.push('repair_local_posture')
  } catch (error) {
    return writeAndReturnStatus(projectDir, output, failStatus(status, {
      failedStep: 'repair_local_posture',
      error,
      nextAction: 'Run npm run repair:local-posture manually to inspect repairable and skipped issues.'
    }))
  }

  try {
    const inspection = await runMaybeQuiet(verbose, () => inspectVeniceSmoke({ projectDir }))
    status.inspection = {
      output: inspection.output,
      operationalSummary: inspection.packet.operationalSummary,
      localOnly: true,
      edgeCalled: false
    }
    status.completedSteps.push('inspect_venice_smoke')
  } catch (error) {
    return writeAndReturnStatus(projectDir, output, failStatus(status, {
      failedStep: 'inspect_venice_smoke',
      error,
      nextAction: 'Run npm run inspect:venice-smoke to see which Venice smoke records are missing.'
    }))
  }

  const summary = await createMediaSummary({ projectDir })
  status.projectId = summary.projectId
  status.mediaSummary = compactMediaSummary(summary)
  status.state = status.mediaSummary.remainingAttention === 0
    ? 'complete_review_only'
    : 'complete_with_attention'
  status.nextAction = status.state === 'complete_review_only'
    ? 'Review the local-only generated image loop outputs; no truth, authority, or resource admission was granted.'
    : 'Review attention rows in npm run media:summary before considering the loop complete.'

  return writeAndReturnStatus(projectDir, output, status)
}

function failStatus(status, { failedStep, error, nextAction }) {
  return {
    ...status,
    state: 'failed_review_only',
    failedStep,
    error: error?.message ?? String(error),
    nextAction: `${nextAction} Operator retry must be explicit; this status does not execute retries automatically.`,
    localOnly: true,
    operatorGuidanceOnly: true,
    meshTruth: false,
    providerTruth: false,
    byteAvailabilityProof: false,
    materializationProof: false,
    resourceAdmission: false,
    edgeCalled: false,
    meshPublished: false
  }
}

async function evaluateRetryGate({
  projectDir,
  output,
  retryDecision,
  liveProvider
}) {
  const base = {
    required: false,
    satisfied: false,
    reason: liveProvider
      ? 'No prior failed provider-loop status requires retry mediation.'
      : 'Dry-run provider loop does not require retry mediation.',
    localOnly: true,
    executionPerformed: false,
    authorityGranted: false,
    providerTruth: false,
    meshTruth: false
  }

  if (!liveProvider) return base

  const previousStatus = await readExistingStatus(projectDir, output)
  if (previousStatus?.state !== 'failed_review_only') return base

  if (!retryDecision) {
    throw new Error('Live provider retry requires --retry-decision after a failed provider-loop status')
  }

  assertSafeLocalPath(retryDecision)
  const decision = JSON.parse(await readFile(path.join(projectDir, retryDecision), 'utf8'))
  validateRequiredRecord(decision, artifactKinds.mediaOperatorDecision)

  if (decision.decisionType !== 'retry_provider_loop' || decision.allowsExplicitRetryAttempt !== true) {
    throw new Error(`Retry decision must be retry_provider_loop with allowsExplicitRetryAttempt=true, received ${decision.decisionType}`)
  }

  if (decision.subjectRef?.id !== previousStatus.statusId) {
    throw new Error(`Retry decision subject ${decision.subjectRef?.id ?? 'missing'} does not match failed provider-loop status ${previousStatus.statusId}`)
  }

  return {
    required: true,
    satisfied: true,
    reason: 'Prior failed provider-loop status has an explicit local retry decision.',
    previousStatusRef: output,
    decisionRef: retryDecision,
    decisionId: decision.decisionId,
    localOnly: true,
    executionPerformed: false,
    authorityGranted: false,
    providerTruth: false,
    meshTruth: false
  }
}

async function readExistingStatus(projectDir, output) {
  try {
    assertSafeLocalPath(output)
    const record = JSON.parse(await readFile(path.join(projectDir, output), 'utf8'))
    if (record.schema !== artifactKinds.mediaProviderLoopStatusLocal) return undefined
    return record
  } catch (error) {
    if (error?.code === 'ENOENT') return undefined
    throw error
  }
}

async function writeAndReturnStatus(projectDir, output, status) {
  assertSafeLocalPath(output)
  validateRequiredRecord(status)

  const outputPath = path.join(projectDir, output)
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(status, null, 2)}\n`)

  return {
    ...status,
    statusRecordRef: output
  }
}

function thumbnailCounts(result) {
  return {
    generated: result.generated.length,
    skipped: result.skipped.length,
    localOnly: true,
    materializationProof: false
  }
}

function compactMediaSummary(summary) {
  return {
    projectId: summary.projectId,
    assets: summary.assets.total,
    images: summary.assets.byMediaKind.image,
    videos: summary.assets.byMediaKind.video,
    audio: summary.assets.byMediaKind.audio,
    unsupported: summary.assets.byMediaKind.unsupported,
    generatedCandidates: {
      total: summary.generatedCandidates.total,
      reviewed: summary.generatedCandidates.reviewed,
      pending: summary.generatedCandidates.pendingReview,
      promotedAccepted: summary.generatedCandidates.promotedAccepted,
      promotedRejected: summary.generatedCandidates.promotedRejected
    },
    derivatives: {
      readyAssets: summary.derivativeReadiness.readyAssets,
      evaluatedAssets: summary.derivativeReadiness.evaluatedAssets,
      attentionAssets: summary.derivativeReadiness.attentionAssets,
      thumbnails: summary.derivatives.byKind.thumbnail
    },
    identity: {
      byteContent: summary.identity.byteContent,
      resourceSituations: summary.identity.resourceSituations
    },
    remainingAttention: summary.derivativeReadiness.attentionAssets +
      summary.generatedCandidates.pendingReview +
      summary.identity.byteContent.missingContentIds.length +
      summary.identity.resourceSituations.missingSubjectRefs.length,
    localOnly: true,
    meshTruth: false,
    byteAvailabilityProof: false,
    materializationProof: false,
    resourceAdmission: false
  }
}

export async function selectVenicePromotionCandidate({
  projectDir,
  assetRecord
}) {
  const root = path.resolve(projectDir)
  const records = await readProjectRecords(root)

  if (assetRecord) {
    const entry = records.find((candidate) => candidate.path === assetRecord)
    if (!entry) throw new Error(`Selected candidate asset record was not found: ${assetRecord}`)
    if (!isGeneratedProviderAsset(entry.record)) {
      throw new Error(`Selected candidate is not a generated provider asset: ${assetRecord}`)
    }

    return candidateSelectionFromEntry({ records, entry })
  }

  const candidates = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaAssetDescriptor)
    .filter((entry) => isGeneratedProviderAsset(entry.record))
    .sort(compareGeneratedCandidateEntries)

  const selected = candidates[0]
  if (!selected) {
    throw new Error('No generated provider asset candidate is available for promotion')
  }

  return candidateSelectionFromEntry({ records, entry: selected })
}

function candidateSelectionFromEntry({ records, entry }) {
  return {
    assetRecord: entry.path,
    assetDescriptor: entry.record,
    providerResultRecord: findProviderResultRecordPath(records, entry.record) ?? smokeProviderResultRecord
  }
}

function isGeneratedProviderAsset(record) {
  return record?.schema === artifactKinds.mediaAssetDescriptor &&
    record.localRef?.placementClass === 'media-generated' &&
    record.source?.sourceType === 'provider-result'
}

function compareGeneratedCandidateEntries(left, right) {
  const rightTime = Date.parse(right.record.createdAt ?? '') || 0
  const leftTime = Date.parse(left.record.createdAt ?? '') || 0
  if (rightTime !== leftTime) return rightTime - leftTime
  return right.path.localeCompare(left.path)
}

function findProviderResultRecordPath(records, assetDescriptor) {
  const providerResultId = assetDescriptor.source?.providerResultRef?.id
  if (!providerResultId) return undefined

  const result = records.find((entry) =>
    entry.record.schema === artifactKinds.mediaProviderResult &&
    entry.record.resultId === providerResultId
  )

  return result?.path
}

function dryRunEnv(env) {
  return {
    ...env,
    VENICE_LIVE: '1',
    VENICE_INFERENCE_KEY: env.VENICE_INFERENCE_KEY ?? 'local-dry-run-venice-key'
  }
}

async function runMaybeQuiet(verbose, fn) {
  if (verbose) return fn()

  const original = console.log
  console.log = () => {}
  try {
    return await fn()
  } finally {
    console.log = original
  }
}

async function localVeniceFetch() {
  return {
    status: 200,
    async json() {
      return {
        id: 'venice-local-dry-run-response',
        images: [onePixelPngBase64],
        request: { format: 'png' }
      }
    }
  }
}

export function printVeniceOperationalLoopStatus(status) {
  const summary = status.mediaSummary
  if (!summary) {
    console.log([
      `venice loop: state=${status.state}`,
      `failedStep=${status.failedStep}`,
      `liveProviderCalled=${status.liveProviderCalled}`
    ].join(' | '))
    console.log(`nextAction: ${status.nextAction}`)
    console.log('nonClaims: local-only; no Edge call; no mesh truth; no byte/materialization proof; no resource admission')
    return
  }

  console.log([
    `venice loop: state=${status.state}`,
    `project=${summary.projectId}`,
    `liveProviderCalled=${status.liveProviderCalled}`,
    `candidate=${status.selectedCandidate?.path ?? 'none'}`,
    `generated=${summary.generatedCandidates.total}`,
    `reviewed=${summary.generatedCandidates.reviewed}`,
    `promotedAccepted=${summary.generatedCandidates.promotedAccepted}`,
    `promotedRejected=${summary.generatedCandidates.promotedRejected}`,
    `derivatives=${summary.derivatives.readyAssets}/${summary.derivatives.evaluatedAssets}`,
    `providerRuns=${status.providerLedger?.total ?? 0}`,
    `byteContent=${summary.identity.byteContent.coveredContentIds}/${summary.identity.byteContent.expectedContentIds}`,
    `resourceSituations=${summary.identity.resourceSituations.coveredSituationPlacements}/${summary.identity.resourceSituations.expectedSituationPlacements}`,
    `remainingAttention=${summary.remainingAttention}`
  ].join(' | '))
  console.log(`nextAction: ${status.nextAction}`)
  console.log('nonClaims: local-only; no Edge call; no mesh truth; no byte/materialization proof; no resource admission')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const status = await runVeniceOperationalLoop(args)

  if (args.print) {
    console.log(JSON.stringify(status, null, 2))
  } else {
    printVeniceOperationalLoopStatus(status)
  }

  if (status.state !== 'complete_review_only') {
    process.exitCode = 1
  }
}

if (process.argv[1] === modulePath) {
  await main()
}
