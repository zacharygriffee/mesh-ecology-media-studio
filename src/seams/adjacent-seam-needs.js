import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { artifactKinds } from '../contracts/artifact-kinds.js'
import { makeRef, nowIso } from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import { isDiscoverableJsonPath, readJsonFileTolerant, writeJsonAtomic } from '../local/atomic-json.js'
import { assertSafeLocalPath } from '../local/project-layout.js'
import { summarizeLocalProofRehearsal } from './local-proof-summary.js'

const modulePath = fileURLToPath(import.meta.url)
const defaultProjectDir = 'examples/card-to-candidate'
const defaultOutput = 'records/exports/media-studio-adjacent-seam-needs.local.json'
const truthStatus = 'not mesh truth; not distributed proof; not ratified shared state'

const relevantSchemas = new Set([
  artifactKinds.mediaStudioLocalProofRehearsalLocal,
  artifactKinds.mediaOperatorPacketIndexLocal,
  artifactKinds.mediaEdgeCompatibilityBundleLocal,
  artifactKinds.mediaStudioSourcePressureAdapterCandidateLocal,
  artifactKinds.mediaStudioSourcePressureAdapterOperatorDecisionLocal,
  artifactKinds.mediaStudioSourcePressureObservationResultLocal,
  artifactKinds.mediaEdgePressureArtifactLocal,
  artifactKinds.mediaLayerPressureArtifactLocal,
  artifactKinds.mediaProductionAuthorityPrerequisitesLocal,
  artifactKinds.mediaAuthorityHandoffCandidateLocal,
  artifactKinds.mediaPublicationAuthorityRequestCandidateLocal,
  artifactKinds.mediaStudioAdjacentSeamNeedsPacketLocal
])

function parseArgs(argv) {
  const args = {
    projectDir: defaultProjectDir,
    output: defaultOutput,
    print: false,
    quiet: false
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
    } else if (arg === '--quiet') {
      args.quiet = true
    }
  }

  return args
}

export async function writeAdjacentSeamNeedsPacket({
  projectDir = defaultProjectDir,
  output = defaultOutput,
  createdAt = nowIso(),
  print = false,
  quiet = false
} = {}) {
  assertSafeLocalPath(output)

  const root = path.resolve(projectDir)
  const records = await readRelevantRecords(root)
  const packet = createAdjacentSeamNeedsPacket({
    projectId: inferProjectId(records, path.basename(root)),
    records,
    createdAt
  })

  validateRequiredRecord(packet)
  await writeJsonAtomic(root, output, packet)

  if (print) {
    console.log(JSON.stringify(packet, null, 2))
  } else if (!quiet) {
    console.log(formatAdjacentSeamNeedsPacket(packet, output))
    for (const row of packet.adjacentDiscussionRows) {
      console.log(formatAdjacentDiscussionRow(row))
    }
  }

  return {
    packet,
    output
  }
}

export function createAdjacentSeamNeedsPacket({
  projectId,
  records,
  createdAt = nowIso()
}) {
  const normalized = normalizeEntries(records)
  const proofSummary = latestOperatorProofSummary(normalized) ??
    latestEdgeProofSummary(normalized) ??
    summarizeLocalProofRehearsal(normalized)
  const latestProof = latestRecord(normalized, artifactKinds.mediaStudioLocalProofRehearsalLocal)
  const sourceRefs = collectSourceRefs(normalized)
  const declarationStatus = classifyDeclarationStatus(proofSummary)
  const spineDiscussion = declarationStatus === 'ready_for_spine_discussion'
    ? 'required'
    : declarationStatus === 'blocked_missing_proof'
      ? 'absent'
      : 'not-ready'
  const adjacentDiscussionRows = createAdjacentDiscussionRows({
    proofSummary,
    declarationStatus,
    sourceRefs
  })
  const adjacentReady = adjacentDiscussionRows.filter((row) => row.discussionStatus === 'ready_for_discussion').length
  const adjacentAttention = adjacentDiscussionRows.filter((row) => row.discussionStatus !== 'ready_for_discussion').length
  const safeNextAction = safeNextActionForDeclaration(declarationStatus, proofSummary)

  return {
    schema: artifactKinds.mediaStudioAdjacentSeamNeedsPacketLocal,
    needsPacketId: `studio-adjacent-seam-needs-${projectId}`,
    projectId,
    createdAt,
    mode: 'standalone-local',
    declarationStatus,
    spineDiscussion,
    sourceRefs,
    adjacentDiscussionRows,
    summary: {
      adjacentNeeds: adjacentDiscussionRows.length,
      adjacentReady,
      adjacentAttention,
      ownerRepos: adjacentDiscussionRows.map((row) => row.ownerRepo),
      proofState: proofSummary.latestProofState,
      proofFreshness: proofSummary.proofFreshness,
      proofDrill: proofSummary.drillStatus,
      adapterDecisionStatus: proofSummary.adapterDecisionStatus,
      observationStatus: proofSummary.observationStatus,
      localPackageState: proofSummary.localPackageState,
      swarmSeamState: proofSummary.swarmSeamState,
      latestProofRef: latestProof ? localRecordRef(latestProof) : null,
      spineDiscussion,
      operatorGuidanceOnly: true,
      localOnly: true,
      meshTruth: false
    },
    safeNextAction,
    warnings: [
      'Adjacent seam needs are discussion declarations only.',
      'Studio does not write Spine, Layer, Edge, Bytes, Causal, or other adjacent repos.',
      'This packet does not route work, grant authority, admit Layer refs, dispatch Edge work, materialize Bytes payloads, or claim Causal truth.'
    ],
    nonClaims: adjacentNonClaims(),
    operatorGuidanceOnly: true,
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    providerTruth: false,
    edgeRuntimeBuilt: false,
    edgeRuntimeVerified: false,
    localTruthLabel: 'local adjacent seam needs declaration',
    truthStatus
  }
}

export function summarizeAdjacentSeamNeeds(recordsOrSources = [], {
  proofSummary = null
} = {}) {
  const allEntries = normalizeEntries(recordsOrSources)
  const entries = allEntries
    .filter((entry) => entry.record.schema === artifactKinds.mediaStudioAdjacentSeamNeedsPacketLocal)
    .sort(sortNewestRecordFirst)
  const latest = entries[0]
  const packet = latest?.record
  const currentProofSummary = proofSummary ?? currentProofSummaryFromEntries(allEntries)
  const staleReasons = packet ? adjacentNeedsStaleReasons(packet, currentProofSummary) : []
  const needsFreshness = packet
    ? staleReasons.length > 0 ? 'stale' : 'fresh'
    : 'absent'
  const packetAdjacentNeeds = packet?.summary?.adjacentNeeds ?? packet?.adjacentDiscussionRows?.length ?? 0
  const packetAdjacentReady = packet?.summary?.adjacentReady ?? packet?.adjacentDiscussionRows?.filter((row) => row.discussionStatus === 'ready_for_discussion').length ?? 0
  const packetAdjacentAttention = packet?.summary?.adjacentAttention ?? packet?.adjacentDiscussionRows?.filter((row) => row.discussionStatus !== 'ready_for_discussion').length ?? 0
  const stale = needsFreshness === 'stale'
  const declarationStatus = stale ? 'local_attention' : packet?.declarationStatus ?? 'absent'
  const spineDiscussion = stale ? 'not-ready' : packet?.spineDiscussion ?? 'absent'

  return {
    summaryKind: 'studio-adjacent-seam-needs-summary',
    packets: entries.length,
    latestPacketRef: latest ? localRecordRef(latest) : null,
    declarationStatus,
    originalDeclarationStatus: packet?.declarationStatus ?? 'absent',
    spineDiscussion,
    originalSpineDiscussion: packet?.spineDiscussion ?? 'absent',
    needsFreshness,
    staleReasons,
    adjacentNeeds: packetAdjacentNeeds,
    adjacentReady: stale ? 0 : packetAdjacentReady,
    adjacentAttention: stale ? packetAdjacentNeeds : packetAdjacentAttention,
    ownerRepos: packet?.summary?.ownerRepos ?? [],
    safeNextAction: stale
      ? 'Run npm run seam:needs after refreshing local proof surfaces; the adjacent seam needs packet is stale.'
      : packet?.safeNextAction ?? 'Run npm run seam:needs after proof:local -- --drill to declare adjacent repo discussion needs.',
    attentionRows: packet && (declarationStatus !== 'ready_for_spine_discussion' || stale) ? 1 : 0,
    adjacentRepoWrite: false,
    layerAdmission: false,
    edgeDispatch: false,
    bytesMaterialization: false,
    causalTruth: false,
    localOnly: true,
    operatorGuidanceOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false
  }
}

export async function readAdjacentSeamReadiness({
  projectDir = defaultProjectDir
} = {}) {
  const root = path.resolve(projectDir)
  const records = await readRelevantRecords(root)
  const proofSummary = currentProofSummaryFromEntries(normalizeEntries(records))
  const adjacentSeamNeedsSummary = summarizeAdjacentSeamNeeds(records, {
    proofSummary
  })

  return summarizeAdjacentSeamReadiness({
    projectId: inferProjectId(records, path.basename(root)),
    proofSummary,
    adjacentSeamNeedsSummary
  })
}

export function summarizeAdjacentSeamReadiness({
  projectId = 'unknown',
  proofSummary = null,
  adjacentSeamNeedsSummary = null
} = {}) {
  const adjacentSummary = adjacentSeamNeedsSummary ?? summarizeAdjacentSeamNeeds([], {
    proofSummary
  })
  const proofState = proofSummary?.latestProofState ?? 'absent'
  const proofFreshness = proofSummary?.proofFreshness ?? 'absent'
  const proofDrill = proofSummary?.drillStatus ?? 'absent'
  const proofDrillAttentionReasons = proofSummary?.drillAttentionReasons ?? []
  const proofReady = proofSummary &&
    proofSummary.proofs > 0 &&
    proofState === 'ready' &&
    proofFreshness === 'fresh' &&
    proofDrill === 'passed'
  const seamReady = adjacentSummary.packets > 0 &&
    adjacentSummary.needsFreshness === 'fresh' &&
    adjacentSummary.declarationStatus === 'ready_for_spine_discussion' &&
    adjacentSummary.spineDiscussion === 'required' &&
    adjacentSummary.adjacentNeeds > 0 &&
    adjacentSummary.adjacentReady === adjacentSummary.adjacentNeeds &&
    adjacentSummary.adjacentAttention === 0

  const readiness = classifyAdjacentSeamReadiness({
    proofSummary,
    proofReady,
    adjacentSummary,
    seamReady
  })

  return {
    summaryKind: 'studio-adjacent-seam-readiness',
    projectId,
    readiness,
    proofState,
    proofFreshness,
    proofDrill,
    proofDrillAttentionReasons,
    adjacentFreshness: adjacentSummary.needsFreshness,
    adjacentPackets: adjacentSummary.packets,
    adjacentNeeds: adjacentSummary.adjacentNeeds,
    adjacentReady: adjacentSummary.adjacentReady,
    adjacentAttention: adjacentSummary.adjacentAttention,
    declarationStatus: adjacentSummary.declarationStatus,
    spineDiscussion: adjacentSummary.spineDiscussion,
    staleReasons: adjacentSummary.staleReasons ?? [],
    safeNextAction: safeNextActionForReadiness({
      readiness,
      proofSummary,
      adjacentSummary
    }),
    attentionRows: readiness === 'ready_for_spine_discussion' ? 0 : 1,
    adjacentRepoWrite: false,
    layerAdmission: false,
    edgeDispatch: false,
    bytesMaterialization: false,
    causalTruth: false,
    swarmRuntimeActivated: false,
    localOnly: true,
    operatorGuidanceOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false
  }
}

function currentProofSummaryFromEntries(entries) {
  return latestOperatorProofSummary(entries) ??
    latestEdgeProofSummary(entries) ??
    summarizeLocalProofRehearsal(entries)
}

function classifyAdjacentSeamReadiness({
  proofSummary,
  proofReady,
  adjacentSummary,
  seamReady
}) {
  if (!proofSummary || proofSummary.proofs === 0 || proofSummary.latestProofState === 'absent') {
    return 'blocked_missing_proof'
  }
  if (!proofReady) return 'local_proof_attention'
  if (adjacentSummary.packets === 0) return 'missing_adjacent_seam_needs'
  if (adjacentSummary.needsFreshness === 'stale') return 'stale_adjacent_seam_needs'
  if (!seamReady) return 'adjacent_seam_attention'
  return 'ready_for_spine_discussion'
}

function safeNextActionForReadiness({
  readiness,
  proofSummary,
  adjacentSummary
}) {
  if (readiness === 'ready_for_spine_discussion') {
    return 'Discuss these adjacent seam needs with the operator and Spine repo agent before any adjacent repo implementation.'
  }
  if (readiness === 'blocked_missing_proof') {
    return 'Run npm run proof:local -- --drill before declaring adjacent seam readiness.'
  }
  if (readiness === 'local_proof_attention') {
    return proofSummary?.safeNextAction ??
      'Resolve local proof attention, then rerun npm run proof:local -- --drill and npm run seam:needs.'
  }
  if (readiness === 'missing_adjacent_seam_needs') {
    return 'Run npm run seam:needs after a fresh proof:local -- --drill before Spine discussion.'
  }
  return adjacentSummary?.safeNextAction ??
    'Refresh adjacent seam needs after local proof posture changes.'
}

function adjacentNeedsStaleReasons(packet, proofSummary) {
  const reasons = []
  if (!proofSummary || proofSummary.proofs === 0 || proofSummary.latestProofState === 'absent') {
    reasons.push('local_proof_absent')
    return reasons
  }

  const summary = packet.summary ?? {}
  const comparisons = [
    ['proof_state_changed', summary.proofState, proofSummary.latestProofState],
    ['proof_freshness_changed', summary.proofFreshness, proofSummary.proofFreshness],
    ['proof_drill_changed', summary.proofDrill, proofSummary.drillStatus],
    ['adapter_decision_changed', summary.adapterDecisionStatus, proofSummary.adapterDecisionStatus],
    ['observation_status_changed', summary.observationStatus, proofSummary.observationStatus],
    ['local_package_changed', summary.localPackageState, proofSummary.localPackageState],
    ['swarm_seam_changed', summary.swarmSeamState, proofSummary.swarmSeamState]
  ]

  for (const [reason, recorded, current] of comparisons) {
    if (recorded && current && recorded !== current) {
      reasons.push(reason)
    }
  }

  const recordedProofId = summary.latestProofRef?.id
  const currentProofId = proofSummary.latestProofRef?.id
  if (recordedProofId && currentProofId && recordedProofId !== currentProofId) {
    reasons.push('local_proof_ref_changed')
  }

  return reasons
}

function classifyDeclarationStatus(proofSummary) {
  if (!proofSummary || proofSummary.proofs === 0 || proofSummary.latestProofState === 'absent') {
    return 'blocked_missing_proof'
  }
  if (proofSummary.latestProofState !== 'ready') return 'local_attention'
  if (proofSummary.proofFreshness !== 'fresh') return 'local_attention'
  if (proofSummary.drillStatus !== 'passed') return 'local_attention'
  if (proofSummary.swarmSeamState !== 'ready_for_review_only_swarm_pressure') return 'local_attention'
  return 'ready_for_spine_discussion'
}

function safeNextActionForDeclaration(declarationStatus, proofSummary) {
  if (declarationStatus === 'ready_for_spine_discussion') {
    return 'Discuss these adjacent seam needs with the operator and Spine repo agent before any adjacent repo implementation.'
  }
  if (declarationStatus === 'blocked_missing_proof') {
    return 'Run npm run proof:local -- --drill before declaring adjacent seam needs.'
  }
  return proofSummary?.safeNextAction ??
    'Resolve local proof attention, then rerun npm run proof:local -- --drill and npm run seam:needs.'
}

function createAdjacentDiscussionRows({
  proofSummary,
  declarationStatus,
  sourceRefs
}) {
  const baseStatus = declarationStatus === 'ready_for_spine_discussion'
    ? 'ready_for_discussion'
    : declarationStatus
  const allEvidence = sourceRefs.filter((ref) => [
    artifactKinds.mediaStudioLocalProofRehearsalLocal,
    artifactKinds.mediaOperatorPacketIndexLocal,
    artifactKinds.mediaEdgeCompatibilityBundleLocal,
    artifactKinds.mediaStudioSourcePressureAdapterCandidateLocal,
    artifactKinds.mediaStudioSourcePressureAdapterOperatorDecisionLocal,
    artifactKinds.mediaStudioSourcePressureObservationResultLocal,
    artifactKinds.mediaEdgePressureArtifactLocal,
    artifactKinds.mediaLayerPressureArtifactLocal
  ].includes(ref.schema))

  return [
    adjacentRow({
      ownerRepo: 'mesh-ecology-spine',
      discussionKind: 'family-routing-review',
      requestedReview: 'Review Studio local proof and adjacent seam needs before routing any family work.',
      discussionStatus: baseStatus,
      evidenceRefs: allEvidence,
      stopConditions: [
        'Stop before routing implementation without operator approval.',
        'Stop before treating Studio local proof as family authority.',
        'Stop before adjacent repo mutation.'
      ],
      nextAction: declarationStatus === 'ready_for_spine_discussion'
        ? 'Discuss with the operator and Spine repo agent.'
        : safeNextActionForDeclaration(declarationStatus, proofSummary)
    }),
    adjacentRow({
      ownerRepo: 'mesh-ecology-layer',
      discussionKind: 'generic-layer-source-pressure-review',
      requestedReview: 'Check whether Studio source-pressure and local proof evidence is sufficient for generic Layer review visibility.',
      discussionStatus: baseStatus,
      evidenceRefs: allEvidence.filter((ref) => [
        artifactKinds.mediaLayerPressureArtifactLocal,
        artifactKinds.mediaStudioSourcePressureAdapterCandidateLocal,
        artifactKinds.mediaStudioSourcePressureAdapterOperatorDecisionLocal,
        artifactKinds.mediaStudioSourcePressureObservationResultLocal,
        artifactKinds.mediaStudioLocalProofRehearsalLocal
      ].includes(ref.schema)),
      stopConditions: [
        'Stop before Layer admission.',
        'Stop before durable append or accepted continuity.',
        'Stop before creating a Studio-specific Layer API.'
      ],
      nextAction: 'Keep Layer review generic and route any implementation through Spine discussion.'
    }),
    adjacentRow({
      ownerRepo: 'mesh-ecology-edge',
      discussionKind: 'operator-visibility-review',
      requestedReview: 'Check whether Studio operator and Edge-compatible surfaces are enough for read-only Edge review.',
      discussionStatus: baseStatus,
      evidenceRefs: allEvidence.filter((ref) => [
        artifactKinds.mediaEdgePressureArtifactLocal,
        artifactKinds.mediaOperatorPacketIndexLocal,
        artifactKinds.mediaEdgeCompatibilityBundleLocal,
        artifactKinds.mediaStudioLocalProofRehearsalLocal
      ].includes(ref.schema)),
      stopConditions: [
        'Stop before Edge queue action.',
        'Stop before dispatch or runtime verification.',
        'Stop before treating Edge review as Layer or Studio authority.'
      ],
      nextAction: 'Keep Edge consumption read-only unless Spine routes a separate bounded Edge packet.'
    }),
    adjacentRow({
      ownerRepo: 'mesh-ecology-bytes',
      discussionKind: 'byte-materialization-boundary-review',
      requestedReview: 'Check whether Studio local byte/resource evidence is sufficient as candidate-only materialization posture.',
      discussionStatus: baseStatus,
      evidenceRefs: allEvidence.filter((ref) => [
        artifactKinds.mediaStudioLocalProofRehearsalLocal,
        artifactKinds.mediaOperatorPacketIndexLocal,
        artifactKinds.mediaEdgeCompatibilityBundleLocal
      ].includes(ref.schema)),
      stopConditions: [
        'Stop before Bytes payload fetch.',
        'Stop before materialization or availability proof.',
        'Stop before inferring payload validity from visibility.'
      ],
      nextAction: 'Discuss Bytes/resource boundaries before any materialization-facing change.'
    }),
    adjacentRow({
      ownerRepo: 'causal-substrate',
      discussionKind: 'causal-truth-boundary-review',
      requestedReview: 'Check whether Studio evidence needs causal-shaped review without becoming Causal truth.',
      discussionStatus: baseStatus,
      evidenceRefs: allEvidence.filter((ref) => [
        artifactKinds.mediaStudioLocalProofRehearsalLocal,
        artifactKinds.mediaOperatorPacketIndexLocal,
        artifactKinds.mediaEdgeCompatibilityBundleLocal
      ].includes(ref.schema)),
      stopConditions: [
        'Stop before causal truth.',
        'Stop before accepted continuity or ratification.',
        'Stop before treating review evidence as canonical history.'
      ],
      nextAction: 'Discuss Causal boundaries only after Spine confirms the adjacent need.'
    })
  ]
}

function adjacentRow({
  ownerRepo,
  discussionKind,
  requestedReview,
  discussionStatus,
  evidenceRefs,
  stopConditions,
  nextAction
}) {
  return {
    ownerRepo,
    discussionKind,
    requestedReview,
    discussionStatus,
    evidenceRefs,
    stopConditions,
    nextAction,
    nonClaims: adjacentNonClaims(),
    localOnly: true,
    operatorGuidanceOnly: true,
    meshTruth: false
  }
}

function latestOperatorProofSummary(entries) {
  return latestRecord(entries, artifactKinds.mediaOperatorPacketIndexLocal)?.record.localProofRehearsalSummary ?? null
}

function latestEdgeProofSummary(entries) {
  return latestRecord(entries, artifactKinds.mediaEdgeCompatibilityBundleLocal)?.record.localProofRehearsalSummary ?? null
}

async function readRelevantRecords(root) {
  const files = await listJsonFiles(path.join(root, 'records'))
  const records = []

  for (const file of files) {
    const relativePath = path.relative(root, file).split(path.sep).join('/')
    if (!isDiscoverableJsonPath(relativePath)) continue
    const readResult = await readJsonFileTolerant(root, relativePath)
    if (!readResult.ok) continue
    const record = readResult.value
    if (!record?.schema || !relevantSchemas.has(record.schema)) continue
    validateRequiredRecord(record)
    records.push({ record, relativePath })
  }

  return records
}

async function listJsonFiles(dir) {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }

  const files = []
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await listJsonFiles(fullPath))
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(fullPath)
    }
  }
  return files
}

function collectSourceRefs(entries) {
  const sourceSchemas = new Set([...relevantSchemas].filter((schema) =>
    schema !== artifactKinds.mediaStudioAdjacentSeamNeedsPacketLocal
  ))
  return compactRefs(entries
    .filter((entry) => sourceSchemas.has(entry.record.schema))
    .map(localRecordRef))
}

function compactRefs(refs) {
  const output = []
  const seen = new Set()
  for (const ref of refs.filter((candidate) => candidate?.id)) {
    const key = `${ref.schema}:${ref.id}:${ref.path ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    output.push(ref)
  }
  return output
}

function normalizeEntries(recordsOrSources = []) {
  const rawEntries = Array.isArray(recordsOrSources)
    ? recordsOrSources
    : Object.values(recordsOrSources ?? {})

  return rawEntries
    .map((entry) => ({
      record: entry.record ?? entry,
      relativePath: entry.relativePath ?? entry.path ?? entry.record?.path ?? null
    }))
    .filter((entry) => entry.record && typeof entry.record.schema === 'string')
}

function latestRecord(entries, schema) {
  return entries
    .filter((entry) => entry.record.schema === schema)
    .sort(sortNewestRecordFirst)[0]
}

function localRecordRef(entry) {
  const ref = makeRef(kindForSchema(entry.record.schema), idForRecord(entry.record), entry.record.schema)
  if (entry.relativePath) ref.path = entry.relativePath
  return {
    ...ref,
    localOnly: true
  }
}

function kindForSchema(schema) {
  return {
    [artifactKinds.mediaStudioLocalProofRehearsalLocal]: 'media-studio-local-proof-rehearsal',
    [artifactKinds.mediaOperatorPacketIndexLocal]: 'media-operator-packet-index',
    [artifactKinds.mediaEdgeCompatibilityBundleLocal]: 'media-edge-compatibility-bundle',
    [artifactKinds.mediaStudioSourcePressureAdapterCandidateLocal]: 'media-studio-source-pressure-adapter-candidate',
    [artifactKinds.mediaStudioSourcePressureAdapterOperatorDecisionLocal]: 'media-studio-source-pressure-adapter-operator-decision',
    [artifactKinds.mediaStudioSourcePressureObservationResultLocal]: 'media-studio-source-pressure-observation-result',
    [artifactKinds.mediaEdgePressureArtifactLocal]: 'media-edge-pressure-artifact',
    [artifactKinds.mediaLayerPressureArtifactLocal]: 'media-layer-pressure-artifact',
    [artifactKinds.mediaProductionAuthorityPrerequisitesLocal]: 'media-production-authority-prerequisites',
    [artifactKinds.mediaAuthorityHandoffCandidateLocal]: 'media-authority-handoff-candidate',
    [artifactKinds.mediaPublicationAuthorityRequestCandidateLocal]: 'media-publication-authority-request-candidate',
    [artifactKinds.mediaStudioAdjacentSeamNeedsPacketLocal]: 'media-studio-adjacent-seam-needs'
  }[schema] ?? schema
}

function idForRecord(record) {
  return record.needsPacketId ??
    record.proofRehearsalId ??
    record.indexId ??
    record.compatibilityBundleId ??
    record.adapterCandidateId ??
    record.decisionId ??
    record.observationId ??
    record.pressureArtifactId ??
    record.reportId ??
    record.handoffCandidateId ??
    record.requestCandidateId ??
    record.schema
}

function inferProjectId(records, fallback) {
  return records.find((entry) => entry.record.projectId)?.record.projectId ?? fallback
}

function sortNewestRecordFirst(left, right) {
  const rightTime = Date.parse(right.record.createdAt ?? '') || 0
  const leftTime = Date.parse(left.record.createdAt ?? '') || 0
  if (rightTime !== leftTime) return rightTime - leftTime
  return (right.relativePath ?? '').localeCompare(left.relativePath ?? '')
}

function adjacentNonClaims() {
  return {
    adjacentRepoWrite: false,
    layerAdmission: false,
    durableAppend: false,
    edgeQueueAction: false,
    edgeDispatch: false,
    edgeRuntimeVerified: false,
    bytesMaterialization: false,
    bytesPayloadValidity: false,
    causalTruth: false,
    acceptedContinuity: false,
    resultAcceptance: false,
    storageSelection: false,
    publicationAuthorization: false,
    productionReady: false,
    swarmRuntimeActivated: false,
    meshTruth: false
  }
}

function formatAdjacentSeamNeedsPacket(packet, output) {
  return [
    `studio adjacent seam needs: project=${packet.projectId}`,
    `declaration=${packet.declarationStatus}`,
    `spineDiscussion=${packet.spineDiscussion}`,
    `adjacentNeeds=${packet.summary.adjacentNeeds}`,
    `adjacentReady=${packet.summary.adjacentReady}`,
    `adjacentAttention=${packet.summary.adjacentAttention}`,
    'adjacentRepoWrite=false',
    'layerAdmission=false',
    'edgeDispatch=false',
    'bytesMaterialization=false',
    'causalTruth=false',
    `nextAction=${packet.safeNextAction}`,
    `output=${output}`
  ].join(' | ')
}

function formatAdjacentDiscussionRow(row) {
  return [
    `adjacent need: ${row.ownerRepo}`,
    `kind=${row.discussionKind}`,
    `status=${row.discussionStatus}`,
    `evidence=${row.evidenceRefs.length}`,
    `nextAction=${row.nextAction}`
  ].join(' | ')
}

if (process.argv[1] === modulePath) {
  await writeAdjacentSeamNeedsPacket(parseArgs(process.argv.slice(2)))
}
