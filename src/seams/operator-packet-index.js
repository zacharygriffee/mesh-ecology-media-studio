import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { artifactKinds } from '../contracts/artifact-kinds.js'
import { makeRef, nowIso } from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import { assertSafeLocalPath } from '../local/project-layout.js'
import { summarizeProductionApprovalLane } from '../production/approval-lane.js'

const modulePath = fileURLToPath(import.meta.url)
const defaultProjectDir = 'examples/card-to-candidate'
const defaultOutput = 'records/exports/media-operator-packet-index.local.json'
const truthStatus = 'not mesh truth; not distributed proof; not ratified shared state'

function parseArgs(argv) {
  const args = {
    projectDir: defaultProjectDir,
    output: defaultOutput,
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
    } else if (arg === '--print') {
      args.print = true
    }
  }

  return args
}

export async function writeOperatorPacketIndex({
  projectDir = defaultProjectDir,
  output = defaultOutput,
  print = false
} = {}) {
  assertSafeLocalPath(output)

  const root = path.resolve(projectDir)
  const records = await readIndexableRecords(root)
  const projectId = inferProjectId(records, path.basename(root))
  const packetRefs = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaEdgeInspectionPacketLocal)
    .map(toInspectionRef)
  const bundleRefs = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaEdgeExportBundleLocal || entry.record.schema === artifactKinds.mediaEdgeCompatibilityBundleLocal)
    .map(toInspectionRef)
  const healthRefs = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaProjectHealthLocal)
    .map(toInspectionRef)
  const handoffCandidateRefs = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaEdgeHandoffCandidateLocal)
    .map(toInspectionRef)
  const operatorDecisionRequestRefs = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaOperatorDecisionRequestLocal)
    .map(toInspectionRef)
  const operatorDecisionRefs = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaOperatorDecision)
    .map(toInspectionRef)
  const approvalProposalRefs = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaApprovalProposalLocal)
    .map(toInspectionRef)
  const approvalProposalsPendingAuthority = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaApprovalProposalLocal)
    .filter((entry) => entry.record.status === 'proposed').length
  const providerLoopStatusRefs = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaProviderLoopStatusLocal)
    .map(toInspectionRef)
  const productionCapsuleRefs = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaProductionAssetCapsuleLocal)
    .map(toInspectionRef)
  const productionBundleRefs = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaProductionBundleLocal)
    .map(toInspectionRef)
  const roughCutCapsuleRefs = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaRoughCutCapsuleLocal)
    .map(toInspectionRef)
  const renderExportCandidateRefs = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaRenderExportCandidateLocal)
    .map(toInspectionRef)
  const mediationRefs = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaRuleResolutionTraceLocal)
    .map(toInspectionRef)
  const providerLoopStatuses = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaProviderLoopStatusLocal)
    .map((entry) => summarizeProviderLoopStatus(entry.record, entry.relativePath))
  const providerLoopDecisions = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaOperatorDecision)
    .filter((entry) => entry.record.providerLoopDecision)
    .map((entry) => summarizeProviderLoopDecision(entry.record, entry.relativePath))
  const roughCutReviewDecisions = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaOperatorDecision)
    .filter((entry) => entry.record.roughCutReview)
    .map((entry) => summarizeRoughCutReviewDecision(entry.record, entry.relativePath))
  const roughCutDecisionBySubject = latestRoughCutDecisionBySubject(roughCutReviewDecisions)
  const productionCapsules = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaProductionAssetCapsuleLocal)
    .map((entry) => summarizeProductionCapsule(entry.record, entry.relativePath))
  const productionBundles = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaProductionBundleLocal)
    .map((entry) => summarizeProductionBundle(entry.record, entry.relativePath))
  const latestProductionBundle = [...productionBundles]
    .sort((left, right) => (right.createdAt ?? '').localeCompare(left.createdAt ?? ''))[0]
  const roughCutCapsules = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaRoughCutCapsuleLocal)
    .map((entry) => summarizeRoughCutCapsule(entry.record, entry.relativePath, {
      latestDecision: roughCutDecisionBySubject.get(entry.record.roughCutId),
      latestProductionBundle
    }))
  const renderExportCandidates = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaRenderExportCandidateLocal)
    .map((entry) => summarizeRenderExportCandidate(entry.record, entry.relativePath))
  const productionApprovalLane = summarizeProductionApprovalLane({
    assetRecords: records
      .filter((entry) => entry.record.schema === artifactKinds.mediaAssetDescriptor)
      .map((entry) => entry.record),
    records
  })
  const readinessStates = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaProjectHealthLocal)
    .map((entry) => entry.record.healthState)
  const operatorHealthExplanations = filterCurrentHealthExplanations(records
    .filter((entry) => entry.record.schema === artifactKinds.mediaProjectHealthLocal)
    .flatMap((entry) => entry.record.operatorHealthExplanations ?? [])
    .filter((entry) => (entry.healthState ?? entry.state) !== 'ready-for-local-inspection'), productionApprovalLane)

  const index = {
    schema: artifactKinds.mediaOperatorPacketIndexLocal,
    indexId: `operator-packet-index-${projectId}`,
    projectId,
    createdAt: nowIso(),
    mode: 'standalone-local',
    indexedRootRef: {
      ...makeRef('local-directory', 'records', 'media.local_ref.v1'),
      path: 'records',
      localOnly: true
    },
    packetRefs,
    bundleRefs,
    healthRefs,
    handoffCandidateRefs,
    operatorDecisionRequestRefs,
    operatorDecisionRefs,
    approvalProposalRefs,
    providerLoopStatusRefs,
    productionCapsuleRefs,
    productionBundleRefs,
    roughCutCapsuleRefs,
    renderExportCandidateRefs,
    mediationRefs,
    providerLoopStatuses,
    providerLoopDecisions,
    roughCutReviewDecisions,
    productionCapsules,
    productionBundles,
    roughCutCapsules,
    renderExportCandidates,
    productionApprovalLane,
    operatorHealthExplanations,
    summary: {
      packets: packetRefs.length,
      bundles: bundleRefs.length,
      healthRecords: healthRefs.length,
      handoffCandidates: handoffCandidateRefs.length,
      operatorDecisionRequests: operatorDecisionRequestRefs.length,
      operatorDecisions: operatorDecisionRefs.length,
      approvalProposals: approvalProposalRefs.length,
      approvalProposalsPendingAuthority,
      providerLoopDecisions: providerLoopDecisions.length,
      providerLoopRetryDecisions: providerLoopDecisions.filter((decision) => decision.allowsExplicitRetryAttempt).length,
      roughCutReviewDecisions: roughCutReviewDecisions.length,
      providerLoopStatuses: providerLoopStatusRefs.length,
      providerLoopsWithAttention: providerLoopStatuses.filter((status) => status.needsOperatorAttention).length,
      productionCapsules: productionCapsuleRefs.length,
      productionCapsulesNeedingAttention: productionCapsules.filter((capsule) => capsule.needsOperatorAttention).length,
      productionBundles: productionBundleRefs.length,
      productionBundlesNeedingAttention: productionBundles.filter((bundle) => bundle.needsOperatorAttention).length,
      roughCutCapsules: roughCutCapsuleRefs.length,
      roughCutCapsulesNeedingAttention: roughCutCapsules.filter((roughCut) => roughCut.needsOperatorAttention).length,
      renderExportCandidates: renderExportCandidateRefs.length,
      renderExportCandidatesNeedingAttention: renderExportCandidates.filter((candidate) => candidate.needsOperatorAttention).length,
      productionApprovalCandidates: productionApprovalLane.candidates,
      productionApprovalPendingAuthority: productionApprovalLane.pendingAuthority,
      ruleResolutionTraces: mediationRefs.length,
      readyHealthRecords: readinessStates.filter((state) => state === 'ready-for-local-inspection').length,
      needsAttentionHealthRecords: readinessStates.filter((state) => state === 'needs-local-attention').length,
      operatorHealthExplanations: operatorHealthExplanations.length,
      attentionRows: operatorHealthExplanations.length +
        providerLoopStatuses.filter((status) => status.needsOperatorAttention).length +
        productionCapsules.filter((capsule) => capsule.needsOperatorAttention).length +
        productionBundles.filter((bundle) => bundle.needsOperatorAttention).length +
        roughCutCapsules.filter((roughCut) => roughCut.needsOperatorAttention).length +
        renderExportCandidates.filter((candidate) => candidate.needsOperatorAttention).length +
        productionApprovalLane.attentionRows.length,
      newestRecordPath: newestPath(records),
      operatorGuidanceOnly: true
    },
    warnings: [
      'Operator packet index is a local scanning aid, not a UI contract.',
      'Indexed records are local-only artifacts and not mesh truth.',
      'Provider-loop decisions are local operator guidance and do not execute retries or grant authority.',
      'Edge may inspect these refs later, but this index does not call or verify Edge.'
    ],
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

  const outputPath = path.join(root, output)
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(index, null, 2)}\n`)

  if (print) {
    console.log(JSON.stringify(index, null, 2))
  } else {
    console.log(formatOperatorPacketIndexSummary(index, output))
    for (const explanation of index.operatorHealthExplanations) {
      console.log(formatHealthExplanation(explanation))
    }
    for (const providerLoop of index.providerLoopStatuses.filter((status) => status.needsOperatorAttention)) {
      console.log(formatProviderLoopAttention(providerLoop))
    }
    for (const decision of index.providerLoopDecisions) {
      console.log(formatProviderLoopDecision(decision))
    }
    for (const decision of index.roughCutReviewDecisions) {
      console.log(formatRoughCutReviewDecision(decision))
    }
    for (const capsule of index.productionCapsules) {
      console.log(formatProductionCapsule(capsule))
    }
    for (const bundle of index.productionBundles) {
      console.log(formatProductionBundle(bundle))
    }
    for (const roughCut of index.roughCutCapsules) {
      console.log(formatRoughCutCapsule(roughCut))
    }
    for (const candidate of index.renderExportCandidates) {
      console.log(formatRenderExportCandidate(candidate))
    }
    if (index.productionApprovalLane.candidates > 0) {
      console.log(formatProductionApprovalLaneSummary(index.productionApprovalLane))
    }
    for (const row of index.productionApprovalLane.attentionRows) {
      console.log(formatProductionApprovalLaneRow(row))
    }
  }

  return {
    index,
    output
  }
}

function formatOperatorPacketIndexSummary(index, output) {
  const summary = index.summary
  return [
    `operator packet index: packets=${summary.packets}`,
    `bundles=${summary.bundles}`,
    `handoffs=${summary.handoffCandidates}`,
    `decisionRequests=${summary.operatorDecisionRequests}`,
    `decisions=${summary.operatorDecisions ?? 0}`,
    `approvalProposals=${summary.approvalProposals ?? 0}`,
    `providerLoops=${summary.providerLoopStatuses ?? 0}`,
    `providerLoopDecisions=${summary.providerLoopDecisions ?? 0}`,
    `roughCutDecisions=${summary.roughCutReviewDecisions ?? 0}`,
    `productionCapsules=${summary.productionCapsules ?? 0}`,
    `productionBundles=${summary.productionBundles ?? 0}`,
    `roughCuts=${summary.roughCutCapsules ?? 0}`,
    `renderExportCandidates=${summary.renderExportCandidates ?? 0}`,
    `productionApprovalPending=${summary.productionApprovalPendingAuthority ?? 0}`,
    `ruleTraces=${summary.ruleResolutionTraces}`,
    `attention=${summary.attentionRows ?? summary.operatorHealthExplanations}`,
    `output=${output}`
  ].join(' | ')
}

function formatHealthExplanation(explanation) {
  const subject = explanation.path ?? `${explanation.subjectKind}:${explanation.subjectRef?.id ?? 'unknown'}`
  return [
    `attention: ${subject}`,
    `state=${explanation.healthState ?? explanation.state}`,
    `issues=${(explanation.issueCodes ?? []).join(',') || 'none'}`,
    `nextAction=${explanation.nextAction ?? 'none'}`
  ].join(' | ')
}

function formatProviderLoopAttention(providerLoop) {
  return [
    `provider-loop attention: ${providerLoop.providerId}:${providerLoop.loopKind}`,
    `state=${providerLoop.state}`,
    `failedStep=${providerLoop.failedStep ?? 'none'}`,
    `nextAction=${providerLoop.nextAction ?? 'none'}`
  ].join(' | ')
}

function formatProviderLoopDecision(decision) {
  return [
    `provider-loop decision: ${decision.decisionType}`,
    `retry=${decision.allowsExplicitRetryAttempt}`,
    `executionPerformed=${decision.executionPerformed}`,
    `authorityGranted=${decision.authorityGranted}`,
    `path=${decision.decisionRef.path}`
  ].join(' | ')
}

function formatRoughCutReviewDecision(decision) {
  return [
    `rough-cut decision: ${decision.decisionType}`,
    `items=${decision.itemCount}`,
    `requestChanges=${decision.requestChanges}`,
    `deferred=${decision.deferred}`,
    `rendered=${decision.rendered}`,
    `productionReady=${decision.productionReady}`,
    `authorityGranted=${decision.authorityGranted}`,
    `path=${decision.decisionRef.path}`
  ].join(' | ')
}

function formatProductionCapsule(capsule) {
  return [
    `production capsule: ${capsule.assetPath ?? capsule.capsuleRef.id}`,
    `state=${capsule.state}`,
    `productionReady=${capsule.productionReady}`,
    `issues=${capsule.issueCodes.join(',') || 'none'}`,
    `nextAction=${capsule.nextAction}`,
    `path=${capsule.capsuleRef.path}`
  ].join(' | ')
}

function formatProductionBundle(bundle) {
  return [
    `production bundle: ${bundle.bundleRef.id}`,
    `state=${bundle.state}`,
    `capsules=${bundle.capsuleRefs}`,
    `productionReady=${bundle.productionReady}`,
    `issues=${bundle.issueCodes.join(',') || 'none'}`,
    `nextAction=${bundle.nextAction}`,
    `path=${bundle.bundleRef.path}`
  ].join(' | ')
}

function formatRoughCutCapsule(roughCut) {
  return [
    `rough cut: ${roughCut.roughCutRef.id}`,
    `state=${roughCut.state}`,
    `items=${roughCut.items}`,
    `rendered=${roughCut.rendered}`,
    `productionReady=${roughCut.productionReady}`,
    `issues=${roughCut.issueCodes.join(',') || 'none'}`,
    `nextAction=${roughCut.nextAction}`,
    `path=${roughCut.roughCutRef.path}`
  ].join(' | ')
}

function formatRenderExportCandidate(candidate) {
  return [
    `render/export candidate: ${candidate.candidateRef.id}`,
    `roughCut=${candidate.roughCutRef?.id ?? 'unknown'}`,
    `reviewed=${candidate.reviewed}`,
    `rendererSelected=${candidate.rendererSelected}`,
    `renderPerformed=${candidate.renderPerformed}`,
    `exportPerformed=${candidate.exportPerformed}`,
    `productionReady=${candidate.productionReady}`,
    `issues=${candidate.issueCodes.join(',') || 'none'}`,
    `path=${candidate.candidateRef.path}`
  ].join(' | ')
}

function formatProductionApprovalLaneSummary(lane) {
  return [
    `production approval: candidates=${lane.candidates}`,
    `decisions=${lane.localDecisions}`,
    `proposals=${lane.approvalProposals}`,
    `capsules=${lane.capsules}`,
    `bundles=${lane.bundles}`,
    `pendingAuthority=${lane.pendingAuthority}`,
    `productionReady=${lane.productionReady}`
  ].join(' | ')
}

function formatProductionApprovalLaneRow(row) {
  return [
    `production approval: ${row.path}`,
    `state=${row.laneState}`,
    `decision=${row.localDecisionState}`,
    `proposal=${row.approvalProposalState}`,
    `capsule=${row.capsuleState}`,
    `bundle=${row.bundleState}`,
    `authority=missing`,
    `issues=${row.issueCodes.join(',')}`,
    `nextAction=${row.nextAction}`
  ].join(' | ')
}

function filterCurrentHealthExplanations(explanations, productionApprovalLane) {
  const pathsWithCapsules = new Set(
    productionApprovalLane.rows
      .filter((row) => row.capsuleState === 'present')
      .map((row) => row.path)
      .filter(Boolean)
  )

  return explanations.filter((explanation) => {
    const issueCodes = explanation.issueCodes ?? []
    if (!issueCodes.includes('missing_production_asset_capsule')) return true
    return !pathsWithCapsules.has(explanation.path)
  })
}

async function readIndexableRecords(root) {
  const candidates = [
    ...(await findJsonFiles(root, 'records/approvals')),
    ...(await findJsonFiles(root, 'records/assets')),
    ...(await findJsonFiles(root, 'records/exports')),
    ...(await findJsonFiles(root, 'records/manifests')),
    ...(await findJsonFiles(root, 'records/provider-results')),
    ...(await findJsonFiles(root, 'records/production')),
    ...(await findJsonFiles(root, 'records/requests')),
    ...(await findJsonFiles(root, 'records/decisions')),
    ...(await findJsonFiles(root, 'records/rule-traces'))
  ].filter(isIndexableRecordPath)
  const entries = []

  for (const relativePath of candidates.sort()) {
    const record = await readOptionalRecord(root, relativePath)
    if (!record?.schema || !indexableSchemas.has(record.schema)) continue
    validateRequiredRecord(record)
    entries.push({ record, relativePath })
  }

  return entries
}

const indexableSchemas = new Set([
  artifactKinds.mediaEdgeInspectionPacketLocal,
  artifactKinds.mediaEdgeExportBundleLocal,
  artifactKinds.mediaEdgeCompatibilityBundleLocal,
  artifactKinds.mediaProjectHealthLocal,
  artifactKinds.mediaEdgeHandoffCandidateLocal,
  artifactKinds.mediaOperatorDecision,
  artifactKinds.mediaOperatorDecisionRequestLocal,
  artifactKinds.mediaApprovalProposalLocal,
  artifactKinds.mediaAssetDescriptor,
  artifactKinds.mediaProviderLoopStatusLocal,
  artifactKinds.mediaProductionAssetCapsuleLocal,
  artifactKinds.mediaProductionBundleLocal,
  artifactKinds.mediaRoughCutCapsuleLocal,
  artifactKinds.mediaRenderExportCandidateLocal,
  artifactKinds.mediaRuleResolutionTraceLocal
])

function summarizeProviderLoopStatus(record, relativePath) {
  return {
    statusRef: {
      ...makeRef('media-provider-loop-status', record.statusId, record.schema),
      path: relativePath,
      localOnly: true
    },
    providerId: record.providerId,
    loopKind: record.loopKind,
    state: record.state,
    failedStep: record.failedStep ?? null,
    completedSteps: record.completedSteps.length,
    nextAction: record.nextAction,
    needsOperatorAttention: record.state !== 'complete_review_only',
    operatorGuidanceOnly: true,
    localOnly: true,
    meshTruth: false,
    providerTruth: false,
    edgeCalled: false,
    meshPublished: false
  }
}

function summarizeProviderLoopDecision(record, relativePath) {
  return {
    decisionRef: {
      ...makeRef('media-operator-decision', record.decisionId, record.schema),
      path: relativePath,
      localOnly: true
    },
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

function summarizeRoughCutReviewDecision(record, relativePath) {
  return {
    decisionRef: {
      ...makeRef('media-operator-decision', record.decisionId, record.schema),
      path: relativePath,
      localOnly: true
    },
    subjectRef: record.subjectRef,
    decisionType: record.decisionType,
    createdAt: record.createdAt,
    itemCount: record.roughCutReview?.itemCount ?? 0,
    rendered: record.roughCutReview?.rendered === true,
    productionReady: record.roughCutReview?.productionReady === true,
    reviewAcknowledged: record.reviewAcknowledged === true,
    requestChanges: record.requestChanges === true,
    deferred: record.deferred === true,
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

function summarizeProductionCapsule(record, relativePath) {
  const issueCodes = record.productionPosture?.state === 'needs-approval-proposal'
    ? ['approval_proposal_missing']
    : (record.productionPosture?.blockers ?? []).filter((issue) => issue !== 'authority_not_granted')

  return {
    capsuleRef: {
      ...makeRef('media-production-asset-capsule', record.capsuleId, record.schema),
      path: relativePath,
      localOnly: true
    },
    assetPath: record.localRef?.path ?? record.subjectAssetRef?.path,
    state: record.productionPosture?.state ?? 'unknown',
    productionReady: record.productionReady === true,
    issueCodes,
    needsOperatorAttention: issueCodes.length > 0,
    nextAction: issueCodes.length > 0
      ? record.productionPosture?.nextAction
      : 'Route through the proper authority lane before production use.',
    approvalAuthority: false,
    publicationAuthorization: false,
    operatorGuidanceOnly: true,
    localOnly: true,
    meshTruth: false,
    providerTruth: false
  }
}

function summarizeProductionBundle(record, relativePath) {
  const issueCodes = record.productionPosture?.state === 'needs-capsules'
    ? ['production_capsules_missing']
    : (record.productionPosture?.blockers ?? []).filter((issue) => issue !== 'authority_not_granted')

  return {
    bundleRef: {
      ...makeRef('media-production-bundle', record.bundleId, record.schema),
      path: relativePath,
      localOnly: true
    },
    state: record.productionPosture?.state ?? 'unknown',
    capsuleRefs: record.capsuleRefs?.length ?? 0,
    assetRefs: record.assetRefs?.length ?? 0,
    contentRefs: record.contentRefs?.length ?? 0,
    productionReady: record.productionReady === true,
    createdAt: record.createdAt,
    issueCodes,
    needsOperatorAttention: issueCodes.length > 0,
    nextAction: issueCodes.length > 0
      ? record.productionPosture?.nextAction
      : 'Inspect bundled capsules and route approval proposals through the proper authority lane before production use.',
    approvalAuthority: false,
    publicationAuthorization: false,
    operatorGuidanceOnly: true,
    localOnly: true,
    meshTruth: false,
    providerTruth: false
  }
}

function summarizeRoughCutCapsule(record, relativePath, {
  latestDecision,
  latestProductionBundle
} = {}) {
  const staleProductionBundle = isRoughCutStaleForProductionBundle(record, latestProductionBundle)
  const issueCodes = roughCutIssueCodes(record, latestDecision, staleProductionBundle)

  return {
    roughCutRef: {
      ...makeRef('media-rough-cut-capsule', record.roughCutId, record.schema),
      path: relativePath,
      localOnly: true
    },
    state: record.assemblyPosture?.state ?? 'unknown',
    items: record.orderedItems?.length ?? 0,
    pendingAuthorityItems: record.assemblyPosture?.pendingAuthorityItems ?? 0,
    rendered: record.renderPosture?.rendered === true,
    reviewDecisionType: latestDecision?.decisionType ?? null,
    staleProductionBundle,
    productionReady: record.productionReady === true,
    issueCodes,
    needsOperatorAttention: issueCodes.length > 0,
    nextAction: roughCutNextAction(issueCodes),
    approvalAuthority: false,
    publicationAuthorization: false,
    operatorGuidanceOnly: true,
    localOnly: true,
    meshTruth: false,
    providerTruth: false
  }
}

function summarizeRenderExportCandidate(record, relativePath) {
  const issueCodes = []

  return {
    candidateRef: {
      ...makeRef('media-render-export-candidate', record.candidateId, record.schema),
      path: relativePath,
      localOnly: true
    },
    roughCutRef: record.sourceRoughCutRef ?? null,
    reviewDecisionRef: record.reviewDecisionRef ?? null,
    reviewed: record.reviewPosture?.reviewed === true,
    items: record.orderedItemRefs?.length ?? 0,
    rendererSelected: record.renderPosture?.rendererSelected === true,
    renderPerformed: record.renderPosture?.renderPerformed === true,
    exportPerformed: record.exportPosture?.exportPerformed === true,
    productionReady: record.productionReady === true,
    issueCodes,
    needsOperatorAttention: issueCodes.length > 0,
    nextAction: record.nextActions?.[0] ?? 'Choose a renderer/export adapter in a future lane before producing bytes.',
    approvalAuthority: false,
    publicationAuthorization: false,
    operatorGuidanceOnly: true,
    localOnly: true,
    meshTruth: false,
    providerTruth: false
  }
}

function latestRoughCutDecisionBySubject(decisions) {
  const output = new Map()
  for (const decision of decisions) {
    const subjectId = decision.subjectRef?.id
    if (!subjectId) continue
    const existing = output.get(subjectId)
    if (!existing || (decision.createdAt ?? '').localeCompare(existing.createdAt ?? '') > 0) {
      output.set(subjectId, decision)
    }
  }
  return output
}

function roughCutIssueCodes(record, latestDecision, staleProductionBundle) {
  if (record.assemblyPosture?.state === 'needs-production-items') return ['rough_cut_items_missing']
  if (staleProductionBundle) return ['rough_cut_stale_production_bundle']
  if (latestDecision?.decisionType === 'request_changes') return ['rough_cut_changes_requested']
  if (latestDecision?.decisionType === 'defer') return ['rough_cut_review_deferred']
  return []
}

function roughCutNextAction(issueCodes) {
  if (issueCodes.includes('rough_cut_items_missing')) {
    return 'Create production capsules and a production bundle before regenerating the rough-cut capsule.'
  }
  if (issueCodes.includes('rough_cut_stale_production_bundle')) {
    return 'Regenerate the rough-cut capsule from the current production bundle.'
  }
  if (issueCodes.includes('rough_cut_changes_requested')) {
    return 'Regenerate or revise the rough-cut capsule before authority handoff review.'
  }
  if (issueCodes.includes('rough_cut_review_deferred')) {
    return 'Resolve deferred rough-cut review before authority handoff review.'
  }
  return 'Review ordered rough-cut items locally; render/export/publication remain separate future work.'
}

function isRoughCutStaleForProductionBundle(record, latestProductionBundle) {
  if (!latestProductionBundle?.bundleRef?.id) return false
  const includesLatestBundle = (record.sourceRefs ?? []).some((ref) =>
    ref.schema === artifactKinds.mediaProductionBundleLocal &&
    ref.id === latestProductionBundle.bundleRef.id
  )
  if (includesLatestBundle) return false

  const latestBundleTime = Date.parse(latestProductionBundle.createdAt ?? '') || 0
  const roughCutTime = Date.parse(record.createdAt ?? '') || 0
  return latestBundleTime >= roughCutTime
}

async function findJsonFiles(root, relativeRoot) {
  assertSafeLocalPath(relativeRoot)
  const absoluteRoot = path.join(root, relativeRoot)
  const files = []

  try {
    await collectJsonFiles(absoluteRoot, relativeRoot, files)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }

  return files
}

async function collectJsonFiles(absoluteDir, relativeDir, files) {
  for (const entry of await readdir(absoluteDir, { withFileTypes: true })) {
    const relativePath = path.posix.join(relativeDir, entry.name)
    if (entry.isDirectory()) {
      await collectJsonFiles(path.join(absoluteDir, entry.name), relativePath, files)
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      assertSafeLocalPath(relativePath)
      files.push(relativePath)
    }
  }
}

function isIndexableRecordPath(relativePath) {
  if (!relativePath.startsWith('records/exports/bundles/')) return true
  return relativePath.endsWith('/bundle-manifest.local.json')
}

async function readOptionalRecord(root, relativePath) {
  try {
    return JSON.parse(await readFile(path.join(root, relativePath), 'utf8'))
  } catch {
    return null
  }
}

function toInspectionRef({ record, relativePath }) {
  return {
    ...makeRef(kindForSchema(record.schema), idForRecord(record), record.schema),
    path: relativePath,
    localOnly: true
  }
}

function inferProjectId(records, fallback) {
  return records.find((entry) => typeof entry.record.projectId === 'string')?.record.projectId ?? fallback
}

function newestPath(records) {
  return records
    .filter((entry) => typeof entry.record.createdAt === 'string')
    .sort((left, right) => right.record.createdAt.localeCompare(left.record.createdAt))
    .at(0)?.relativePath ?? null
}

function kindForSchema(schema) {
  return {
    [artifactKinds.mediaEdgeInspectionPacketLocal]: 'media-edge-inspection-packet',
    [artifactKinds.mediaEdgeExportBundleLocal]: 'media-edge-export-bundle',
    [artifactKinds.mediaEdgeCompatibilityBundleLocal]: 'media-edge-compatibility-bundle',
    [artifactKinds.mediaProjectHealthLocal]: 'media-project-health',
    [artifactKinds.mediaEdgeHandoffCandidateLocal]: 'media-edge-handoff-candidate',
    [artifactKinds.mediaOperatorDecision]: 'media-operator-decision',
    [artifactKinds.mediaOperatorDecisionRequestLocal]: 'media-operator-decision-request',
    [artifactKinds.mediaProviderLoopStatusLocal]: 'media-provider-loop-status',
    [artifactKinds.mediaProductionAssetCapsuleLocal]: 'media-production-asset-capsule',
    [artifactKinds.mediaProductionBundleLocal]: 'media-production-bundle',
    [artifactKinds.mediaRoughCutCapsuleLocal]: 'media-rough-cut-capsule',
    [artifactKinds.mediaRenderExportCandidateLocal]: 'media-render-export-candidate',
    [artifactKinds.mediaRuleResolutionTraceLocal]: 'media-rule-resolution-trace'
  }[schema] ?? schema
}

function idForRecord(record) {
  return record.packetId ??
    record.bundleId ??
    record.compatibilityBundleId ??
    record.healthId ??
    record.handoffCandidateId ??
    record.decisionId ??
    record.requestId ??
    record.statusId ??
    record.capsuleId ??
    record.roughCutId ??
    record.candidateId ??
    record.bundleId ??
    record.traceId
}

if (process.argv[1] === modulePath) {
  await writeOperatorPacketIndex(parseArgs(process.argv.slice(2)))
}
