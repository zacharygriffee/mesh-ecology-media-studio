import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { artifactKinds } from '../contracts/artifact-kinds.js'
import { makeRef, nowIso } from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import { writeJsonAtomic } from '../local/atomic-json.js'
import { assertSafeLocalPath } from '../local/project-layout.js'
import { readProjectRecords } from './project-status.js'

const modulePath = fileURLToPath(import.meta.url)
const defaultProjectDir = 'examples/venice-smoke'
const defaultOutput = 'records/exports/media-studio-inference-source-posture.local.json'
const truthStatus = 'not mesh truth; not distributed proof; not ratified shared state'

const sourceLaneOrder = Object.freeze([
  'operator_supplied',
  'studio_provider_adapter',
  'edge_agent_seat',
  'local_inference',
  'agent_bridge_byo_ai',
  'mesh_v0_2_pub_rat'
])
const canonicalProviderOwner = 'agent_bridge_byo_ai'
const studioRole = 'media_inference_frontier_evidence'
const generalLlmProviderFrontier = false
const providerFlexibilityPosture = Object.freeze({
  strategy: 'stable_common_envelope_with_provider_specific_config',
  lowestCommonDenominator: false,
  mediaSpecificFrontier: true,
  summary: 'Studio expects a stable common provider envelope plus provider-specific config blocks for media inference adapters.'
})

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

export async function writeInferenceSourcePosture({
  projectDir = defaultProjectDir,
  output = defaultOutput,
  print = false,
  quiet = false
} = {}) {
  assertSafeLocalPath(output)

  const root = path.resolve(projectDir)
  const records = await readProjectRecords(root)
  const projectId = inferProjectId(records, path.basename(root))
  const posture = createInferenceSourcePosture({
    projectId,
    records,
    createdAt: nowIso()
  })

  validateRequiredRecord(posture)
  await writeJsonAtomic(root, output, posture)

  if (print) {
    console.log(JSON.stringify(posture, null, 2))
  } else if (!quiet) {
    console.log(formatInferenceSourcePosture(posture, output))
  }

  return {
    posture,
    output
  }
}

export function createInferenceSourcePosture({
  projectId,
  records,
  createdAt = nowIso()
}) {
  const evidence = summarizeInferenceSourcePosture(records)
  const laneRefs = {
    studio_provider_adapter: evidence.veniceProviderAdapterEvidence.refs
  }
  const sourceLanes = sourceLaneOrder.map((lane) => createLane(lane, laneRefs[lane] ?? [], evidence))
  const evidencedLanes = sourceLanes.filter((lane) => lane.state === 'evidence_present').length
  const familyBuildoutAsks = createFamilyBuildoutAsks(evidence)
  const pendingFamilySeams = familyBuildoutAsks.filter((ask) => ask.status === 'needed').length

  return {
    schema: artifactKinds.mediaStudioInferenceSourcePostureLocal,
    postureId: `studio-inference-source-posture-${projectId}`,
    projectId,
    createdAt,
    mode: 'standalone-local',
    canonicalProviderOwner,
    studioRole,
    generalLlmProviderFrontier,
    providerFlexibilityPosture,
    sourceLanes,
    veniceProviderAdapterEvidence: evidence.veniceProviderAdapterEvidence,
    familyBuildoutAsks,
    summary: {
      sourceLanes: sourceLanes.length,
      evidencedLanes,
      studioProviderAdapterEvidence: evidence.veniceProviderAdapterEvidence.present,
      veniceEvidencePresent: evidence.veniceProviderAdapterEvidence.present,
      veniceGeneratedAssets: evidence.veniceProviderAdapterEvidence.generatedAssets,
      veniceProviderResults: evidence.veniceProviderAdapterEvidence.providerResults,
      veniceAdapterRuns: evidence.veniceProviderAdapterEvidence.adapterRuns,
      veniceProviderLoopStatuses: evidence.veniceProviderAdapterEvidence.providerLoopStatuses,
      inspectionOutputs: evidence.veniceProviderAdapterEvidence.inspectionPackets,
      pendingFamilySeams,
      canonicalProviderOwner,
      studioRole,
      generalLlmProviderFrontier,
      providerFlexibilityStrategy: providerFlexibilityPosture.strategy,
      providerLowestCommonDenominator: providerFlexibilityPosture.lowestCommonDenominator,
      mediaSpecificFrontier: providerFlexibilityPosture.mediaSpecificFrontier,
      localEvidenceOnly: true,
      seamProof: false,
      familySeamSuccess: false,
      providerTruth: false,
      meshTruth: false,
      edgeDispatch: false,
      productionReady: false
    },
    safeNextAction: evidence.veniceProviderAdapterEvidence.present
      ? 'Use this local inference-source posture as readiness evidence while Edge agent-seat and Agent Bridge/BYO-AI seams mature.'
      : 'Run npm run provider:venice:loop locally, then rerun npm run inference:source-posture; live Venice remains optional and gated.',
    warnings: [
      'Inference-source posture is local review evidence only.',
      'Venice evidence is Studio provider-adapter evidence, not provider truth or family seam proof.',
      'Studio is frontiering media-inference evidence only; Agent Bridge/BYO-AI remains the future canonical provider-normalization owner.',
      'Studio does not frontier general LLM or non-media provider provision.',
      'Edge agent seats, Agent Bridge/BYO-AI, Bytes, Causal, Layer, and mesh-v0-2 remain owning seams for their domains.',
      'This record does not call providers, dispatch Edge work, publish to mesh, materialize Bytes, claim Causal truth, or mark production readiness.'
    ],
    nonClaims: {
      providerTruth: false,
      meshTruth: false,
      edgeDispatch: false,
      edgeRuntimeVerified: false,
      productionReady: false,
      layerAdmission: false,
      bytesMaterialization: false,
      causalTruth: false,
      meshPublication: false,
      seamProof: false,
      familySeamSuccess: false,
      agentBridgeCanonicalized: false,
      generalLlmProviderFrontier: false,
      liveProviderCalledByPosture: false
    },
    operatorGuidanceOnly: true,
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    providerTruth: false,
    edgeDispatch: false,
    productionReady: false,
    localTruthLabel: 'local inference-source posture evidence',
    truthStatus
  }
}

export function summarizeInferenceSourcePosture(records = []) {
  const entries = normalizeEntries(records)
  const veniceEntries = entries.filter((entry) => isVeniceEvidence(entry.record))
  const veniceRefs = compactRefs(veniceEntries.map(toLocalRecordRef))
  const providerProfiles = veniceEntries.filter((entry) => entry.record.schema === artifactKinds.mediaProviderProfile)
  const adapterRuns = veniceEntries.filter((entry) => entry.record.schema === artifactKinds.mediaProviderAdapterRunLocal)
  const providerResults = veniceEntries.filter((entry) => entry.record.schema === artifactKinds.mediaProviderResult)
  const generatedAssets = veniceEntries.filter((entry) =>
    entry.record.schema === artifactKinds.mediaAssetDescriptor &&
    entry.record.localRef?.placementClass === 'media-generated'
  )
  const reviewDecisions = veniceEntries.filter((entry) => entry.record.schema === artifactKinds.mediaOperatorDecision)
  const providerLoopStatuses = veniceEntries.filter((entry) => entry.record.schema === artifactKinds.mediaProviderLoopStatusLocal)
  const providerRunLedgers = veniceEntries.filter((entry) => entry.record.schema === artifactKinds.mediaProviderRunLedgerLocal)
  const inspectionPackets = entries.filter((entry) =>
    entry.record.schema === artifactKinds.mediaEdgeInspectionPacketLocal &&
    JSON.stringify(entry.record).includes('venice')
  )
  const inspectionRefs = compactRefs(inspectionPackets.map(toLocalRecordRef))
  const refs = compactRefs([...veniceRefs, ...inspectionRefs])
  const latestLoopStatus = [...providerLoopStatuses]
    .sort((left, right) => (right.record.createdAt ?? '').localeCompare(left.record.createdAt ?? ''))[0]?.record

  return {
    inferenceSourcePostures: entries.filter((entry) => entry.record.schema === artifactKinds.mediaStudioInferenceSourcePostureLocal).length,
    latestInferenceSourcePosture: latestPostureSummary(entries),
    canonicalProviderOwner,
    studioRole,
    generalLlmProviderFrontier,
    providerFlexibilityPosture,
    veniceProviderAdapterEvidence: {
      present: refs.length > 0,
      providerId: 'venice',
      providerProfiles: providerProfiles.length,
      adapterRuns: adapterRuns.length,
      providerResults: providerResults.length,
      generatedAssets: generatedAssets.length,
      reviewDecisions: reviewDecisions.length,
      providerLoopStatuses: providerLoopStatuses.length,
      providerRunLedgers: providerRunLedgers.length,
      inspectionPackets: inspectionPackets.length,
      latestLoopState: latestLoopStatus?.state ?? 'absent',
      latestLoopLiveProviderCalled: latestLoopStatus?.liveProviderCalled === true,
      refs,
      providerTruth: false,
      meshTruth: false,
      edgeDispatch: false,
      productionReady: false,
      localOnly: true,
      operatorGuidanceOnly: true
    }
  }
}

export function formatInferenceSourcePostureFields(summary) {
  const posture = summary?.latestInferenceSourcePosture
  const venice = summary?.veniceProviderAdapterEvidence ?? summary

  return [
    `inferenceSourcePostures=${summary?.inferenceSourcePostures ?? (posture ? 1 : 0)}`,
    `inferenceSource=${posture?.state ?? (venice?.present ? 'local_evidence_present' : 'not_evidenced')}`,
    `veniceEvidence=${venice?.present === true}`,
    `veniceAssets=${venice?.generatedAssets ?? posture?.veniceGeneratedAssets ?? 0}`,
    `familySeams=${posture?.pendingFamilySeams ?? 0}`,
    `agentBridgeCanonical=${(posture?.canonicalProviderOwner ?? summary?.canonicalProviderOwner) === canonicalProviderOwner}`,
    `studioFrontier=${posture?.studioRole ?? summary?.studioRole ?? studioRole}`,
    `llmFrontier=${posture?.generalLlmProviderFrontier ?? summary?.generalLlmProviderFrontier ?? false}`,
    `providerFlex=${posture?.providerFlexibilityStrategy ?? summary?.providerFlexibilityPosture?.strategy ?? providerFlexibilityPosture.strategy}`,
    'providerTruth=false',
    'meshTruth=false',
    'edgeDispatch=false',
    'productionReady=false'
  ].join(' | ')
}

function createLane(lane, evidenceRefs, evidence) {
  const hasEvidence = evidenceRefs.length > 0
  const futureSeam = ['edge_agent_seat', 'agent_bridge_byo_ai', 'mesh_v0_2_pub_rat'].includes(lane)

  return {
    lane,
    state: hasEvidence ? 'evidence_present' : futureSeam ? 'family_seam_needed' : 'not_evidenced',
    providerId: lane === 'studio_provider_adapter' && hasEvidence ? 'venice' : null,
    evidenceRefs,
    localOnly: true,
    operatorGuidanceOnly: true,
    providerTruth: false,
    meshTruth: false,
    edgeDispatch: false,
    productionReady: false,
    nextAction: laneNextAction(lane, hasEvidence, evidence)
  }
}

function laneNextAction(lane, hasEvidence) {
  if (lane === 'studio_provider_adapter') {
    return hasEvidence
      ? 'Review local Venice provider-adapter evidence as readiness evidence only.'
      : 'Run npm run provider:venice:loop, then write inference-source posture.'
  }

  if (lane === 'operator_supplied') {
    return 'Attach operator-supplied references when a project needs human-owned source material.'
  }

  if (lane === 'local_inference') {
    return 'Declare a local inference adapter when Studio has a bounded local model lane.'
  }

  if (lane === 'edge_agent_seat') {
    return 'Coordinate Edge agent-seat dispatch seam before treating this lane as operational.'
  }

  if (lane === 'agent_bridge_byo_ai') {
    return 'Coordinate Agent Bridge/BYO-AI provider normalization before treating this lane as operational.'
  }

  return 'Coordinate mesh-v0-2 pub/rat source lane before treating this lane as operational.'
}

function createFamilyBuildoutAsks(evidence) {
  const sourceRefs = evidence.veniceProviderAdapterEvidence.refs
  return [
    familyAsk({
      askId: 'edge-agent-seat-dispatch-needed',
      ownerRepo: 'mesh-ecology-edge',
      seam: 'edge-agent-seat-dispatch',
      summary: 'Edge agent-seat dispatch is needed before Studio can initiate specialized media inference seats with flexible provider config through the runtime seam.',
      sourceRefs
    }),
    familyAsk({
      askId: 'agent-bridge-byo-ai-provider-normalization-needed',
      ownerRepo: 'agent-bridge-byo-ai-planned',
      seam: 'provider-normalization',
      summary: 'Agent Bridge/BYO-AI should become canonical provider normalization for media inference adapters, shaped by Studio frontier evidence for image, video, audio, and local inference.',
      sourceRefs
    }),
    familyAsk({
      askId: 'bytes-materialization-posture-needed',
      ownerRepo: 'mesh-ecology-bytes',
      seam: 'byte-materialization',
      summary: 'Bytes materialization posture is needed before generated media bytes, large outputs, previews, proxies, or export payloads can become family-owned durable byte evidence.',
      sourceRefs
    }),
    familyAsk({
      askId: 'causal-continuity-review-needed',
      ownerRepo: 'causal-substrate',
      seam: 'continuity-review',
      summary: 'Causal continuity review is needed before character identity, shot lineage, generated media lineage, or accepted sequence evidence can be treated as continuity truth.',
      sourceRefs
    }),
    familyAsk({
      askId: 'layer-source-review-needed',
      ownerRepo: 'mesh-ecology-layer',
      seam: 'layer-source-pressure-review',
      summary: 'Layer generic source review is needed before Studio local media-inference source evidence can be evaluated as a Layer-facing handoff.',
      sourceRefs
    }),
    familyAsk({
      askId: 'mesh-v0-2-pub-rat-source-lane-needed',
      ownerRepo: 'mesh-v0-2',
      seam: 'pub-rat-source-lane',
      summary: 'mesh-v0-2 pub/rat media source lanes are needed before mesh ecology can answer media source work in plurality.',
      sourceRefs
    })
  ]
}

function familyAsk({ askId, ownerRepo, seam, summary, sourceRefs }) {
  return {
    askId,
    ownerRepo,
    seam,
    status: 'needed',
    summary,
    sourceRefs,
    canonicalProviderOwner,
    studioRole,
    providerFlexibilityStrategy: providerFlexibilityPosture.strategy,
    coordinationPressureOnly: true,
    adjacentRepoWrite: false,
    edgeDispatch: false,
    layerAdmission: false,
    bytesMaterialization: false,
    causalTruth: false,
    meshPublication: false,
    productionReady: false,
    localOnly: true,
    operatorGuidanceOnly: true
  }
}

function latestPostureSummary(entries) {
  const posture = entries
    .filter((entry) => entry.record.schema === artifactKinds.mediaStudioInferenceSourcePostureLocal)
    .sort((left, right) => (right.record.createdAt ?? '').localeCompare(left.record.createdAt ?? ''))[0]

  if (!posture) return null

  return {
    postureRef: toLocalRecordRef(posture),
    state: posture.record.summary?.studioProviderAdapterEvidence === true
      ? 'local_evidence_present'
      : 'not_evidenced',
    sourceLanes: posture.record.summary?.sourceLanes ?? posture.record.sourceLanes?.length ?? 0,
    evidencedLanes: posture.record.summary?.evidencedLanes ?? 0,
    veniceEvidencePresent: posture.record.summary?.veniceEvidencePresent === true,
    veniceGeneratedAssets: posture.record.summary?.veniceGeneratedAssets ?? 0,
    pendingFamilySeams: posture.record.summary?.pendingFamilySeams ?? 0,
    canonicalProviderOwner: posture.record.canonicalProviderOwner ?? posture.record.summary?.canonicalProviderOwner ?? canonicalProviderOwner,
    studioRole: posture.record.studioRole ?? posture.record.summary?.studioRole ?? studioRole,
    generalLlmProviderFrontier: posture.record.generalLlmProviderFrontier ?? posture.record.summary?.generalLlmProviderFrontier ?? false,
    providerFlexibilityStrategy: posture.record.providerFlexibilityPosture?.strategy ??
      posture.record.summary?.providerFlexibilityStrategy ??
      providerFlexibilityPosture.strategy,
    providerLowestCommonDenominator: posture.record.providerFlexibilityPosture?.lowestCommonDenominator ??
      posture.record.summary?.providerLowestCommonDenominator ??
      false,
    mediaSpecificFrontier: posture.record.providerFlexibilityPosture?.mediaSpecificFrontier ??
      posture.record.summary?.mediaSpecificFrontier ??
      true,
    safeNextAction: posture.record.safeNextAction,
    providerTruth: false,
    meshTruth: false,
    edgeDispatch: false,
    productionReady: false,
    localOnly: true,
    operatorGuidanceOnly: true
  }
}

function isVeniceEvidence(record) {
  if (record.providerId === 'venice') return true
  if (record.provider?.providerId === 'venice') return true
  if (record.adapterFixture === 'venice') return true
  if (record.source?.providerId === 'venice') return true
  if (record.source?.adapterFixture === 'venice') return true
  if (record.localRef?.path?.includes('venice')) return true
  if (record.localRef?.path?.includes('provider-smoke')) return true
  if (record.source?.providerResultRef?.path?.includes('venice')) return true
  if (record.source?.providerResultRef?.id?.includes('venice')) return true
  if (record.providerResultRef?.path?.includes('venice')) return true
  if (record.subjectRef?.id?.includes('venice')) return true
  return false
}

function normalizeEntries(records) {
  if (Array.isArray(records)) {
    return records
      .filter((entry) => entry?.record?.schema)
      .map((entry) => ({
        record: entry.record,
        relativePath: entry.relativePath ?? entry.path ?? null
      }))
  }

  return []
}

function toLocalRecordRef(entry) {
  return {
    ...makeRef(kindForSchema(entry.record.schema), idForRecord(entry.record), entry.record.schema),
    path: entry.relativePath,
    localOnly: true
  }
}

function compactRefs(refs) {
  const output = []
  const seen = new Set()
  for (const ref of refs.filter((candidate) => candidate?.id && candidate?.path)) {
    const key = `${ref.schema}:${ref.id}:${ref.path}`
    if (seen.has(key)) continue
    seen.add(key)
    output.push(ref)
  }
  return output
}

function kindForSchema(schema) {
  return {
    [artifactKinds.mediaProviderProfile]: 'media-provider-profile',
    [artifactKinds.mediaProviderAdapterRunLocal]: 'media-provider-adapter-run',
    [artifactKinds.mediaProviderResult]: 'media-provider-result',
    [artifactKinds.mediaAssetDescriptor]: 'media-asset-descriptor',
    [artifactKinds.mediaOperatorDecision]: 'media-operator-decision',
    [artifactKinds.mediaProviderLoopStatusLocal]: 'media-provider-loop-status',
    [artifactKinds.mediaProviderRunLedgerLocal]: 'media-provider-run-ledger',
    [artifactKinds.mediaEdgeInspectionPacketLocal]: 'media-edge-inspection-packet',
    [artifactKinds.mediaStudioInferenceSourcePostureLocal]: 'media-studio-inference-source-posture'
  }[schema] ?? schema
}

function idForRecord(record) {
  return record.providerId ??
    record.adapterRunId ??
    record.resultId ??
    record.assetId ??
    record.decisionId ??
    record.statusId ??
    record.ledgerId ??
    record.packetId ??
    record.postureId ??
    record.schema
}

function inferProjectId(records, fallback) {
  return records.find((entry) => typeof entry.record.projectId === 'string')?.record.projectId ?? fallback
}

function formatInferenceSourcePosture(posture, output) {
  return [
    `inference source posture: lanes=${posture.summary.sourceLanes}`,
    `evidenced=${posture.summary.evidencedLanes}`,
    `veniceEvidence=${posture.summary.veniceEvidencePresent}`,
    `veniceAssets=${posture.summary.veniceGeneratedAssets}`,
    `familySeams=${posture.summary.pendingFamilySeams}`,
    `nextAction=${posture.safeNextAction}`,
    'providerTruth=false',
    'meshTruth=false',
    'edgeDispatch=false',
    'productionReady=false',
    `output=${output}`
  ].join(' | ')
}

if (process.argv[1] === modulePath) {
  await writeInferenceSourcePosture(parseArgs(process.argv.slice(2)))
}
