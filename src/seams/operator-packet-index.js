import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { artifactKinds } from '../contracts/artifact-kinds.js'
import { makeRef, nowIso } from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import { assertSafeLocalPath } from '../local/project-layout.js'

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
  const providerLoopStatusRefs = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaProviderLoopStatusLocal)
    .map(toInspectionRef)
  const productionCapsuleRefs = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaProductionAssetCapsuleLocal)
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
  const productionCapsules = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaProductionAssetCapsuleLocal)
    .map((entry) => summarizeProductionCapsule(entry.record, entry.relativePath))
  const readinessStates = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaProjectHealthLocal)
    .map((entry) => entry.record.healthState)
  const operatorHealthExplanations = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaProjectHealthLocal)
    .flatMap((entry) => entry.record.operatorHealthExplanations ?? [])
    .filter((entry) => (entry.healthState ?? entry.state) !== 'ready-for-local-inspection')

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
    providerLoopStatusRefs,
    productionCapsuleRefs,
    mediationRefs,
    providerLoopStatuses,
    providerLoopDecisions,
    productionCapsules,
    operatorHealthExplanations,
    summary: {
      packets: packetRefs.length,
      bundles: bundleRefs.length,
      healthRecords: healthRefs.length,
      handoffCandidates: handoffCandidateRefs.length,
      operatorDecisionRequests: operatorDecisionRequestRefs.length,
      operatorDecisions: operatorDecisionRefs.length,
      providerLoopDecisions: providerLoopDecisions.length,
      providerLoopRetryDecisions: providerLoopDecisions.filter((decision) => decision.allowsExplicitRetryAttempt).length,
      providerLoopStatuses: providerLoopStatusRefs.length,
      providerLoopsWithAttention: providerLoopStatuses.filter((status) => status.needsOperatorAttention).length,
      productionCapsules: productionCapsuleRefs.length,
      productionCapsulesNeedingAttention: productionCapsules.filter((capsule) => capsule.needsOperatorAttention).length,
      ruleResolutionTraces: mediationRefs.length,
      readyHealthRecords: readinessStates.filter((state) => state === 'ready-for-local-inspection').length,
      needsAttentionHealthRecords: readinessStates.filter((state) => state === 'needs-local-attention').length,
      operatorHealthExplanations: operatorHealthExplanations.length,
      attentionRows: operatorHealthExplanations.length +
        providerLoopStatuses.filter((status) => status.needsOperatorAttention).length +
        productionCapsules.filter((capsule) => capsule.needsOperatorAttention).length,
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
    for (const capsule of index.productionCapsules) {
      console.log(formatProductionCapsule(capsule))
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
    `providerLoops=${summary.providerLoopStatuses ?? 0}`,
    `providerLoopDecisions=${summary.providerLoopDecisions ?? 0}`,
    `productionCapsules=${summary.productionCapsules ?? 0}`,
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

async function readIndexableRecords(root) {
  const candidates = [
    ...(await findJsonFiles(root, 'records/exports')),
    ...(await findJsonFiles(root, 'records/manifests')),
    ...(await findJsonFiles(root, 'records/provider-results')),
    ...(await findJsonFiles(root, 'records/production')),
    ...(await findJsonFiles(root, 'records/requests')),
    ...(await findJsonFiles(root, 'records/decisions')),
    ...(await findJsonFiles(root, 'records/rule-traces'))
  ]
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
  artifactKinds.mediaProviderLoopStatusLocal,
  artifactKinds.mediaProductionAssetCapsuleLocal,
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
    record.traceId
}

if (process.argv[1] === modulePath) {
  await writeOperatorPacketIndex(parseArgs(process.argv.slice(2)))
}
