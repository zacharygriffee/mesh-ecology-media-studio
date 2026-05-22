import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { artifactKinds } from '../contracts/artifact-kinds.js'
import { makeRef, nowIso } from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import { summarizeLayerInteropFromRecords } from '../layer/layer-interop.js'
import { assertSafeLocalPath } from '../local/project-layout.js'
import { readJsonFileTolerant, writeJsonAtomic } from '../local/atomic-json.js'

const modulePath = fileURLToPath(import.meta.url)
const defaultInputList = 'examples/inspection-fixtures/cross-project/input-list.local.json'
const defaultOutput = 'examples/inspection-fixtures/cross-project/media-cross-project-operator-index.local.json'
const truthStatus = 'not mesh truth; not distributed proof; not ratified shared state'

function parseArgs(argv) {
  const args = {
    baseDir: '.',
    inputList: defaultInputList,
    output: defaultOutput,
    print: false
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]

    if (arg === '--base-dir') {
      args.baseDir = next
      i += 1
    } else if (arg === '--input-list') {
      args.inputList = next
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

export async function writeCrossProjectOperatorIndex({
  baseDir = '.',
  inputList = defaultInputList,
  output = defaultOutput,
  print = false
} = {}) {
  assertSafeLocalPath(inputList)
  assertSafeLocalPath(output)

  const root = path.resolve(baseDir)
  const inputListRecord = JSON.parse(await readFile(path.join(root, inputList), 'utf8'))
  validateRequiredRecord(inputListRecord, artifactKinds.mediaCrossProjectInspectionInputListLocal)

  const projectSummaries = []

  for (const projectInput of inputListRecord.projects) {
    projectSummaries.push(await summarizeProject(root, projectInput))
  }

  const indexId = `cross-project-operator-index-${inputListRecord.inputListId}`
  const createdAt = await existingCreatedAtForOutput(root, output, indexId) ?? nowIso()
  const index = {
    schema: artifactKinds.mediaCrossProjectOperatorIndexLocal,
    indexId,
    createdAt,
    mode: 'standalone-local',
    inputListRef: localRef(
      'media-cross-project-inspection-input-list',
      inputListRecord.inputListId,
      inputListRecord.schema,
      inputList
    ),
    projectRefs: projectSummaries.map((summary) => summary.rootRef),
    projectSummaries,
    summary: summarizeProjects(projectSummaries),
    warnings: [
      'Cross-project operator index is a local scan over explicit input refs.',
      'It does not discover projects, call Edge, publish mesh state, or ratify readiness.',
      'Each project summary is operator guidance only and may be stale until regenerated.'
    ],
    safeNextAction: summarizeCrossProjectSafeNextAction(projectSummaries),
    operatorGuidanceOnly: true,
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    providerTruth: false,
    edgeRuntimeBuilt: false,
    edgeRuntimeVerified: false,
    localTruthLabel: 'local cache',
    truthStatus
  }

  validateRequiredRecord(index)

  await writeJsonAtomic(root, output, index)

  if (print) {
    console.log(JSON.stringify(index, null, 2))
  } else {
    console.log(formatCrossProjectSummary(index, output))
    console.log(`safeNextAction: ${index.safeNextAction}`)
    for (const project of attentionRows(index.projectSummaries)) {
      console.log(`attention: ${project.label} | handoff=${project.handoffState} | blockers=${project.blockingIssues.length} | warnings=${project.warnings.length}`)
      if (project.providerLoopStatus?.needsOperatorAttention) {
        console.log(`  provider-loop: ${project.providerLoopStatus.providerId}:${project.providerLoopStatus.loopKind} | state=${project.providerLoopStatus.state} | failedStep=${project.providerLoopStatus.failedStep ?? 'none'} | nextAction=${project.providerLoopStatus.nextAction}`)
      }
      if (project.providerLoopStatus?.needsProductionAttention) {
        console.log(`  provider-loop production: ${project.providerLoopStatus.providerId}:${project.providerLoopStatus.loopKind} | blockers=${project.providerLoopStatus.productionBlockers.join(',')} | nextAction=${project.providerLoopStatus.productionNextAction}`)
      }
      if (project.providerLoopDecision) {
        console.log(`  provider-loop decision: ${project.providerLoopDecision.decisionType} | retry=${project.providerLoopDecision.allowsExplicitRetryAttempt} | executionPerformed=${project.providerLoopDecision.executionPerformed} | authorityGranted=${project.providerLoopDecision.authorityGranted}`)
      }
      if (project.approvalProposal?.needsOperatorAttention) {
        console.log(`  approval proposal: ${project.approvalProposal.proposalType} | state=${project.approvalProposal.laneState} | subject=${project.approvalProposal.subjectRef?.id ?? 'unknown'} | nextAction=${project.approvalProposal.nextAction}`)
      }
      if (project.layerInterop?.needsOperatorAttention) {
        console.log(`  layer interop: state=${project.layerInterop.state} | issues=${project.layerInterop.issueCodes.join(',')} | nextAction=${project.layerInterop.attentionRows[0]?.nextAction}`)
      }
      for (const explanation of project.operatorHealthExplanations ?? []) {
        console.log(`  subject: ${explanation.path ?? `${explanation.subjectKind}:${explanation.subjectRef?.id ?? 'unknown'}`} | issues=${(explanation.issueCodes ?? []).join(',') || 'none'} | nextAction=${explanation.nextAction ?? 'none'}`)
      }
      for (const missing of project.missingArtifactRefs ?? []) {
        console.log(`  missing: ${missing.name} | expected=${missing.expectedRef.path} | nextAction=${missing.nextAction}`)
      }
    }
  }

  return {
    index,
    output
  }
}

async function existingCreatedAtForOutput(root, output, indexId) {
  const existing = await readOptionalRecord(root, output)
  if (existing?.schema !== artifactKinds.mediaCrossProjectOperatorIndexLocal) return null
  if (existing.indexId !== indexId) return null
  return typeof existing.createdAt === 'string' ? existing.createdAt : null
}

function formatCrossProjectSummary(index, output) {
  const summary = index.summary
  return [
    `cross-project operator index: projects=${summary.projects}`,
    `ready=${summary.readyForEdgeInspection}`,
    `attention=${summary.attentionRows ?? summary.needsLocalAttention}`,
    `unknown=${summary.unknownHandoffState}`,
    `providerLoops=${summary.providerLoopStatuses ?? 0}`,
    `providerProductionBlockers=${summary.providerLoopsWithProductionAttention ?? 0}`,
    `providerLoopDecisions=${summary.providerLoopDecisions ?? 0}`,
    `approvalProposals=${summary.approvalProposals ?? 0}`,
    `activeDeliveries=${summary.activeDeliveryReceipts ?? 0}`,
    `historicalExportReceiptAttention=${summary.historicalExportReceiptAttention ?? 0}`,
    `layerInterop=${summary.layerInteropProjects ?? 0}`,
    `layerAttention=${summary.layerInteropAttention ?? 0}`,
    `missingArtifacts=${summary.missingArtifacts}`,
    `output=${output}`
  ].join(' | ')
}

function attentionRows(projectSummaries) {
  return projectSummaries.filter((project) => (
    project.handoffState !== 'ready-for-edge-inspection' ||
    project.providerLoopStatus?.needsOperatorAttention === true ||
    project.providerLoopStatus?.needsProductionAttention === true ||
    project.approvalProposal?.needsOperatorAttention === true ||
    project.layerInterop?.needsOperatorAttention === true ||
    project.blockingIssues.length > 0 ||
    project.warnings.length > 0
  ))
}

async function summarizeProject(root, projectInput) {
  const projectRoot = path.join(root, projectInput.rootRef.path)
  const refs = {}
  const loaded = {}
  const warnings = []
  const missingArtifactRefs = []

  for (const [name, ref] of Object.entries(projectInput.artifactRefs)) {
    const record = await readOptionalRecord(projectRoot, ref.path)

    if (!record) {
      warnings.push(`Missing artifact ref: ${name} at ${ref.path}`)
      missingArtifactRefs.push({
        name,
        expectedRef: localRef(ref.kind, ref.id, ref.schema, path.posix.join(projectInput.rootRef.path, ref.path)),
        issueCode: 'missing_cross_project_artifact_ref',
        healthState: 'needs-local-attention',
        summary: `Expected local artifact ${name} is missing at ${ref.path}.`,
        nextAction: nextActionForMissingArtifact(name),
        nonClaims: missingArtifactNonClaims(),
        localOnly: true,
        meshTruth: false,
        distributedProof: false,
        ratifiedSharedState: false
      })
      continue
    }

    validateRequiredRecord(record, ref.schema)
    refs[name] = localRef(ref.kind, idForRecord(record) ?? ref.id, ref.schema, path.posix.join(projectInput.rootRef.path, ref.path))
    loaded[name] = record
  }

  const health = loaded.projectHealth
  const handoff = loaded.handoffCandidate
  const decisionRequest = loaded.operatorDecisionRequest
  const providerLoopDecision = loaded.providerLoopDecision
  const providerLoopStatus = loaded.providerLoopStatus
  const approvalProposal = loaded.approvalProposal
  const layerInterop = summarizeProjectLayerInterop(loaded, refs)
  const outputDeliverySummary = summarizeProjectOutputDelivery(health)
  const blockingIssues = health?.blockingIssues ?? []
  const operatorHealthExplanations = health?.operatorHealthExplanations ??
    handoff?.readinessDiagnosis?.operatorHealthExplanations ??
    []
  const nextActions = Array.from(new Set([
    ...(handoff?.readinessDiagnosis?.nextActions ?? []),
    ...(decisionRequest?.nextActions ?? [])
  ]))

  const summary = {
    projectId: projectInput.projectId,
    label: projectInput.label ?? projectInput.projectId,
    rootRef: projectInput.rootRef,
    refs,
    healthState: health?.healthState ?? 'unknown',
    handoffState: handoff?.handoffState ?? 'unknown',
    requestKind: decisionRequest?.requestKind ?? 'none',
    providerLoopStatus: providerLoopStatus ? summarizeProviderLoopStatus(providerLoopStatus, refs.providerLoopStatus) : undefined,
    providerLoopDecision: providerLoopDecision ? summarizeProviderLoopDecision(providerLoopDecision, refs.providerLoopDecision) : undefined,
    approvalProposal: approvalProposal ? summarizeApprovalProposal(approvalProposal, refs.approvalProposal) : undefined,
    outputDeliverySummary,
    blockingIssues,
    nextActions,
    warnings,
    missingArtifactRefs,
    safeNextAction: summarizeProjectSafeNextAction({
      blockingIssues,
      operatorHealthExplanations,
      missingArtifactRefs,
      providerLoopStatus: providerLoopStatus ? summarizeProviderLoopStatus(providerLoopStatus, refs.providerLoopStatus) : undefined,
      providerLoopDecision: providerLoopDecision ? summarizeProviderLoopDecision(providerLoopDecision, refs.providerLoopDecision) : undefined,
      approvalProposal: approvalProposal ? summarizeApprovalProposal(approvalProposal, refs.approvalProposal) : undefined,
      layerInterop
    }),
    operatorGuidanceOnly: true,
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    edgeRuntimeBuilt: false,
    edgeRuntimeVerified: false
  }

  if (operatorHealthExplanations.length > 0) {
    summary.operatorHealthExplanations = operatorHealthExplanations
  }

  if (layerInterop.state !== 'layer-refs-not-attached' || layerInterop.needsOperatorAttention) {
    summary.layerInterop = layerInterop
  }

  return summary
}

function summarizeProjectOutputDelivery(health) {
  const exportReceiptSummary = health?.exportReceiptSummary ?? {}
  const outputIntegritySummary = health?.outputIntegritySummary ?? {}
  return {
    exportReceipts: exportReceiptSummary.total ?? 0,
    activeDeliveryReceipts: exportReceiptSummary.activeDeliveryReceipts ?? 0,
    currentExportReceiptAttention: exportReceiptSummary.currentAttention ?? 0,
    historicalExportReceiptAttention: exportReceiptSummary.historicalAttention ?? 0,
    localDeliveryEvidenceIntact: outputIntegritySummary.localDeliveryEvidenceIntact ?? 0,
    outputIntegrityBlockingIssues: outputIntegritySummary.outputIntegrityBlockingIssues ?? 0,
    outputIntegrityAttentionIssues: outputIntegritySummary.outputIntegrityAttentionIssues ?? 0,
    publicationAuthorization: false,
    productionReady: false,
    localOnly: true,
    operatorGuidanceOnly: true
  }
}

function summarizeProjectSafeNextAction({
  blockingIssues,
  operatorHealthExplanations,
  missingArtifactRefs,
  providerLoopStatus,
  providerLoopDecision,
  approvalProposal,
  layerInterop
}) {
  if (missingArtifactRefs.length > 0) return missingArtifactRefs[0].nextAction
  if (providerLoopStatus?.state === 'failed_review_only' && !providerLoopDecision) {
    return 'Create a provider-loop retry/defer request and decision before any retry; no retry is automatic.'
  }
  if (providerLoopStatus?.needsProductionAttention) return providerLoopStatus.productionNextAction
  if (approvalProposal?.needsOperatorAttention) return approvalProposal.nextAction
  if (layerInterop?.needsOperatorAttention) return layerInterop.attentionRows[0].nextAction
  if (operatorHealthExplanations.length > 0) return operatorHealthExplanations[0].nextAction
  if (blockingIssues.length > 0) return 'Inspect project health blocking issues and regenerate the indicated local records.'
  return 'No local cross-project attention row is blocking inspection.'
}

function summarizeCrossProjectSafeNextAction(projectSummaries) {
  const attention = attentionRows(projectSummaries)
  if (attention.length === 0) return 'No local cross-project attention rows are blocking inspection.'
  return attention[0].safeNextAction ?? 'Inspect the first attention row and run its local repair command.'
}

function summarizeProjectLayerInterop(loaded, refs) {
  if (loaded.operatorPacketIndex?.layerInterop) {
    return {
      ...loaded.operatorPacketIndex.layerInterop,
      sourceRef: refs.operatorPacketIndex,
      localOnly: true,
      operatorGuidanceOnly: true
    }
  }

  return summarizeLayerInteropFromRecords(Object.entries(loaded).map(([name, record]) => ({
    record,
    relativePath: refs[name]?.path
  })))
}

async function readOptionalRecord(projectRoot, relativePath) {
  assertSafeLocalPath(relativePath)

  const readResult = await readJsonFileTolerant(projectRoot, relativePath)
  return readResult.ok ? readResult.value : null
}

function nextActionForMissingArtifact(name) {
  if (name === 'projectHealth') {
    return 'Run npm run health:project for the project.'
  }

  if (name === 'handoffCandidate') {
    return 'Run npm run handoff:edge for the project.'
  }

  if (name === 'operatorDecisionRequest') {
    return 'Run npm run operator:decision-request for the project.'
  }

  if (name === 'operatorPacketIndex') {
    return 'Run npm run operator:index for the project.'
  }

  if (name === 'authorityPrerequisites') {
    return 'Run npm run production:authority-prereqs for the project.'
  }

  if (name === 'authorityHandoffCandidate') {
    return 'Run npm run production:authority-handoff for the project.'
  }

  if (name === 'providerLoopStatus') {
    return 'Run npm run provider:venice:loop or inspect the provider loop output for the project.'
  }

  if (name === 'providerLoopDecision') {
    return 'Run npm run operator:provider-loop-decision for the project after creating a provider-loop request.'
  }

  if (name === 'approvalProposal') {
    return 'Run npm run approval:proposal after a local decision exists for the project.'
  }

  return 'Regenerate the missing local artifact for the project.'
}

function missingArtifactNonClaims() {
  return {
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    edgeRuntimeVerified: false,
    operatorAuthorization: false
  }
}

function summarizeProviderLoopStatus(record, ref) {
  const productionBlockers = record.productionBlockers ?? productionBlockersForProviderLoop(record)
  return {
    ref,
    providerId: record.providerId,
    loopKind: record.loopKind,
    state: record.state,
    failedStep: record.failedStep ?? null,
    completedSteps: record.completedSteps.length,
    nextAction: record.nextAction,
    needsOperatorAttention: record.state !== 'complete_review_only',
    productionBlockers,
    productionNextAction: record.productionNextAction ?? productionNextActionForProviderLoop(record),
    needsProductionAttention: productionBlockers.length > 0,
    operatorGuidanceOnly: true,
    localOnly: true,
    meshTruth: false,
    providerTruth: false,
    edgeCalled: false,
    meshPublished: false
  }
}

function summarizeApprovalProposal(record, ref) {
  const proposed = record.status === 'proposed'
  return {
    ref,
    proposalId: record.proposalId,
    subjectRef: record.subjectRef,
    proposalType: record.proposalType,
    proposedDecision: record.proposedDecision,
    status: record.status,
    laneState: proposed ? 'pending-authority-review' : `proposal-${record.status}`,
    issueCodes: proposed ? ['authority_required'] : [`proposal_${record.status}`],
    nextAction: proposed
      ? 'Route this proposal through the proper authority lane; do not treat the local proposal as approval.'
      : 'Inspect proposal status before further action.',
    needsOperatorAttention: true,
    operatorGuidanceOnly: true,
    localOnly: true,
    meshTruth: false,
    providerTruth: false,
    approvalAuthority: false,
    ratifierAuthority: false,
    publicationAuthorization: false,
    edgeCalled: false,
    meshPublished: false
  }
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

function summarizeProviderLoopDecision(record, ref) {
  return {
    ref,
    subjectRef: record.subjectRef,
    decisionType: record.decisionType,
    providerLoopDecision: record.providerLoopDecision,
    allowsExplicitRetryAttempt: record.allowsExplicitRetryAttempt === true,
    deferred: record.deferred === true,
    reviewAcknowledged: record.reviewAcknowledged === true,
    executionPerformed: record.executionPerformed === true,
    authorityGranted: record.authorityGranted === true,
    nextAction: record.nextAction,
    operatorGuidanceOnly: true,
    localOnly: true,
    meshTruth: false,
    providerTruth: false,
    edgeCalled: false,
    meshPublished: false
  }
}

function summarizeProjects(projectSummaries) {
  const needsLocalAttention = projectSummaries.filter((project) => project.handoffState === 'needs-local-attention').length
  const readyForEdgeInspection = projectSummaries.filter((project) => project.handoffState === 'ready-for-edge-inspection').length
  const missingArtifacts = projectSummaries.reduce((sum, project) => sum + project.warnings.length, 0)
  const providerLoopStatuses = projectSummaries.filter((project) => project.providerLoopStatus).length
  const providerLoopsWithAttention = projectSummaries.filter((project) => project.providerLoopStatus?.needsOperatorAttention).length
  const providerLoopsWithProductionAttention = projectSummaries.filter((project) => project.providerLoopStatus?.needsProductionAttention).length
  const providerLoopDecisions = projectSummaries.filter((project) => project.providerLoopDecision).length
  const providerLoopRetryDecisions = projectSummaries.filter((project) => project.providerLoopDecision?.allowsExplicitRetryAttempt).length
  const approvalProposals = projectSummaries.filter((project) => project.approvalProposal).length
  const approvalProposalsWithAttention = projectSummaries.filter((project) => project.approvalProposal?.needsOperatorAttention).length
  const activeDeliveryReceipts = projectSummaries.reduce((sum, project) =>
    sum + (project.outputDeliverySummary?.activeDeliveryReceipts ?? 0), 0)
  const historicalExportReceiptAttention = projectSummaries.reduce((sum, project) =>
    sum + (project.outputDeliverySummary?.historicalExportReceiptAttention ?? 0), 0)
  const layerInteropProjects = projectSummaries.filter((project) => project.layerInterop?.state === 'layer-refs-attached-review-only').length
  const layerInteropAttention = projectSummaries.filter((project) => project.layerInterop?.needsOperatorAttention).length
  const attentionRows = projectSummaries.filter((project) => (
    project.handoffState === 'needs-local-attention' ||
    project.providerLoopStatus?.needsOperatorAttention === true ||
    project.providerLoopStatus?.needsProductionAttention === true ||
    project.approvalProposal?.needsOperatorAttention === true ||
    project.layerInterop?.needsOperatorAttention === true ||
    project.blockingIssues.length > 0 ||
    project.warnings.length > 0
  )).length

  return {
    projects: projectSummaries.length,
    readyForEdgeInspection,
    needsLocalAttention,
    unknownHandoffState: projectSummaries.length - readyForEdgeInspection - needsLocalAttention,
    providerLoopStatuses,
    providerLoopsWithAttention,
    providerLoopsWithProductionAttention,
    providerLoopDecisions,
    providerLoopRetryDecisions,
    approvalProposals,
    approvalProposalsWithAttention,
    activeDeliveryReceipts,
    historicalExportReceiptAttention,
    layerInteropProjects,
    layerInteropAttention,
    attentionRows,
    blockingIssues: projectSummaries.reduce((sum, project) => sum + project.blockingIssues.length, 0),
    missingArtifacts,
    operatorGuidanceOnly: true
  }
}

function localRef(kind, id, schema, relativePath) {
  assertSafeLocalPath(relativePath)

  return {
    ...makeRef(kind, id, schema),
    path: relativePath,
    localOnly: true
  }
}

function idForRecord(record) {
  return record.healthId ??
    record.handoffCandidateId ??
    record.requestId ??
    record.decisionId ??
    record.indexId ??
    record.statusId ??
    record.packetId ??
    record.bundleId
}

if (process.argv[1] === modulePath) {
  await writeCrossProjectOperatorIndex(parseArgs(process.argv.slice(2)))
}
