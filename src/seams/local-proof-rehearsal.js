import { fileURLToPath } from 'node:url'

import { writeMediaSummary } from '../assets/media-summary.js'
import { artifactKinds } from '../contracts/artifact-kinds.js'
import { makeRef, nowIso } from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import { writeJsonAtomic } from '../local/atomic-json.js'
import { assertSafeLocalPath } from '../local/project-layout.js'
import { runLocalProductionOutput } from '../production/local-output-runner.js'
import { writeEdgeCompatibilityBundle } from './edge-compatibility-bundle.js'
import { inspectLocalRun } from './inspect-local-run.js'
import { writeOperatorPacketIndex } from './operator-packet-index.js'
import { writeProjectHealth } from './project-health.js'
import { writeStudioPressureArtifacts } from './studio-pressure-artifacts.js'

const modulePath = fileURLToPath(import.meta.url)
const defaultProjectDir = 'examples/card-to-candidate'
const defaultOutput = 'records/exports/media-studio-local-proof-rehearsal.local.json'
const truthStatus = 'not mesh truth; not distributed proof; not ratified shared state'
const approvedDecisionStatus = 'approved_bounded_studio_source_pressure_observation'
const routedObservationStatus = 'studio_source_pressure_routed_through_generic_layer_seam'

function parseArgs(argv) {
  const args = {
    projectDir: defaultProjectDir,
    output: defaultOutput,
    adapterDecision: 'approved',
    drill: false,
    disableFfmpeg: false,
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
    } else if (arg === '--adapter-decision') {
      args.adapterDecision = next
      i += 1
    } else if (arg === '--drill') {
      args.drill = true
    } else if (arg === '--disable-ffmpeg') {
      args.disableFfmpeg = true
    } else if (arg === '--print') {
      args.print = true
    } else if (arg === '--quiet') {
      args.quiet = true
    }
  }

  return args
}

export async function runLocalProofRehearsal({
  projectDir = defaultProjectDir,
  output = defaultOutput,
  adapterDecision = 'approved',
  drill = false,
  disableFfmpeg = false,
  createdAt = nowIso(),
  print = false,
  quiet = false
} = {}) {
  assertSafeLocalPath(output)

  if (!['approved', 'rejected'].includes(adapterDecision)) {
    throw new Error('adapter decision must be approved or rejected')
  }

  const steps = []
  const stepTime = createStepClock(createdAt)
  const runStep = (step, fn) => recordStep(steps, step, () => withQuietConsole(fn))

  const productionOutput = await runStep('production-local-output', () =>
    runLocalProductionOutput({
      projectDir,
      disableFfmpeg,
      quiet: true,
      createdAt: stepTime()
    })
  )
  const pressure = await runStep('pressure-studio-adapter-chain', () =>
    writeStudioPressureArtifacts({
      projectDir,
      adapterChain: true,
      adapterDecision,
      quiet: true,
      createdAt: stepTime()
    })
  )
  const mediaSummary = await runStep('media-summary', () =>
    writeMediaSummary({ projectDir })
  )
  const health = await runStep('health-summary', () =>
    writeProjectHealth({ projectDir, summary: true })
  )
  let inspection = await runStep('inspect-local-run', () =>
    inspectLocalRun({ projectDir })
  )
  let operatorIndex = await runStep('operator-index', () =>
    writeOperatorPacketIndex({ projectDir, quiet: true })
  )
  let edgeCompatibility = await runStep('edge-compatibility-bundle', () =>
    writeEdgeCompatibilityBundle({ projectDir, quiet: true })
  )

  const index = operatorIndex.index
  const localPackagePosture = index.localPackagePosture ?? productionOutput.localPackagePosture
  const swarmSeamPosture = index.swarmSeamPosture ?? pressure.swarmSeamPosture
  const studioSourcePressureAdapterSummary = index.studioSourcePressureAdapterSummary ??
    mediaSummary.studioSourcePressureAdapterSummary
  const proofState = proofStateFor({
    localPackagePosture,
    swarmSeamPosture,
    studioSourcePressureAdapterSummary
  })
  const safeNextAction = proofState === 'ready'
    ? swarmSeamPosture.safeNextAction
    : safeNextActionForAttention({
      localPackagePosture,
      swarmSeamPosture,
      studioSourcePressureAdapterSummary
    })
  const projectId = mediaSummary.projectId ?? productionOutput.projectId

  const proof = {
    schema: artifactKinds.mediaStudioLocalProofRehearsalLocal,
    proofRehearsalId: `studio-local-proof-rehearsal-${projectId}`,
    projectId,
    createdAt,
    mode: 'standalone-local',
    proofState,
    steps,
    refs: {
      localOutput: {
        summary: productionOutput.summary,
        refs: productionOutput.refs,
        localOnly: true
      },
      edgePressureArtifactRef: localRef(
        'media-edge-pressure-artifact',
        pressure.edgePressureArtifact.pressureArtifactId,
        pressure.edgePressureArtifact.schema,
        pressure.outputs.edgeOutput
      ),
      layerPressureArtifactRef: localRef(
        'media-layer-pressure-artifact',
        pressure.layerPressureArtifact.pressureArtifactId,
        pressure.layerPressureArtifact.schema,
        pressure.outputs.layerOutput
      ),
      adapterCandidateRef: pressure.adapter.outputs.adapterCandidateOutput
        ? localRef(
          'media-studio-source-pressure-adapter-candidate',
          pressure.adapter.candidate.adapterCandidateId,
          pressure.adapter.candidate.schema,
          pressure.adapter.outputs.adapterCandidateOutput
        )
        : null,
      adapterDecisionRef: pressure.adapter.outputs.adapterDecisionOutput
        ? localRef(
          'media-studio-source-pressure-adapter-operator-decision',
          pressure.adapter.operatorDecision.decisionId,
          pressure.adapter.operatorDecision.schema,
          pressure.adapter.outputs.adapterDecisionOutput
        )
        : null,
      adapterObservationRef: pressure.adapter.outputs.adapterObservationOutput
        ? localRef(
          'media-studio-source-pressure-observation-result',
          pressure.adapter.observationResult.observationId,
          pressure.adapter.observationResult.schema,
          pressure.adapter.outputs.adapterObservationOutput
        )
        : null,
      healthRef: localRef(
        'media-project-health',
        health.health.healthId,
        health.health.schema,
        health.output
      ),
      inspectionPacketRef: localRef(
        'media-edge-inspection-packet',
        inspection.packet.packetId,
        inspection.packet.schema,
        inspection.output
      ),
      operatorPacketIndexRef: localRef(
        'media-operator-packet-index',
        index.indexId,
        index.schema,
        operatorIndex.output
      ),
      edgeCompatibilityBundleRef: localRef(
        'media-edge-compatibility-bundle',
        edgeCompatibility.bundle.compatibilityBundleId,
        edgeCompatibility.bundle.schema,
        edgeCompatibility.output
      )
    },
    summary: {
      proofState,
      localPackageState: localPackagePosture.packageState,
      latestLocalPackageReviewPosture: localPackagePosture.latestReviewPosture,
      localPackageIntegrityPosture: localPackagePosture.integrityPosture,
      swarmSeamState: swarmSeamPosture.state,
      adapterDecisionStatus: studioSourcePressureAdapterSummary.latestDecisionStatus,
      observationStatus: studioSourcePressureAdapterSummary.observationStatus,
      productionReady: 0,
      publicationAuthorization: false,
      edgeDispatch: false,
      layerAdmission: false,
      swarmProof: false,
      activation: false,
      safeNextAction
    },
    localPackagePosture,
    swarmSeamPosture,
    studioSourcePressureAdapterSummary,
    safeNextAction,
    warnings: [
      'Studio local proof rehearsal is local review evidence only.',
      'It does not activate family swarm runtime, call Edge, admit Layer refs, publish mesh state, or grant authority.'
    ],
    nonClaims: proofNonClaims(),
    operatorGuidanceOnly: true,
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    providerTruth: false,
    edgeRuntimeBuilt: false,
    edgeRuntimeVerified: false,
    localTruthLabel: 'local proof rehearsal',
    truthStatus
  }

  validateRequiredRecord(proof)
  await writeJsonAtomic(projectDir, output, proof)

  inspection = await runStep('surface-inspect-local-run', () =>
    inspectLocalRun({ projectDir })
  )
  operatorIndex = await runStep('surface-operator-index', () =>
    writeOperatorPacketIndex({ projectDir, quiet: true })
  )
  edgeCompatibility = await runStep('surface-edge-compatibility-bundle', () =>
    writeEdgeCompatibilityBundle({ projectDir, quiet: true })
  )
  proof.surfaceRefs = {
    inspectionPacketRef: localRef(
      'media-edge-inspection-packet',
      inspection.packet.packetId,
      inspection.packet.schema,
      inspection.output
    ),
    operatorPacketIndexRef: localRef(
      'media-operator-packet-index',
      operatorIndex.index.indexId,
      operatorIndex.index.schema,
      operatorIndex.output
    ),
    edgeCompatibilityBundleRef: localRef(
      'media-edge-compatibility-bundle',
      edgeCompatibility.bundle.compatibilityBundleId,
      edgeCompatibility.bundle.schema,
      edgeCompatibility.output
    )
  }
  proof.summary.surfaced = true
  proof.summary.surfaceInspectionPacket = inspection.output
  proof.summary.surfaceOperatorIndex = operatorIndex.output
  proof.summary.surfaceEdgeCompatibilityBundle = edgeCompatibility.output

  if (drill) {
    proof.drillSummary = createLocalProofDrillSummary({
      proof,
      inspection,
      operatorIndex,
      edgeCompatibility
    })
    proof.summary.drillStatus = proof.drillSummary.drillStatus
    proof.summary.drillChecks = proof.drillSummary.checks
    proof.summary.drillAttention = proof.drillSummary.attentionChecks
    proof.summary.drillNextAction = proof.drillSummary.safeNextAction
    proof.safeNextAction = proof.drillSummary.drillStatus === 'attention'
      ? proof.drillSummary.safeNextAction
      : proof.safeNextAction

    validateRequiredRecord(proof)
    await writeJsonAtomic(projectDir, output, proof)

    inspection = await runStep('drill-surface-inspect-local-run', () =>
      inspectLocalRun({ projectDir })
    )
    operatorIndex = await runStep('drill-surface-operator-index', () =>
      writeOperatorPacketIndex({ projectDir, quiet: true })
    )
    edgeCompatibility = await runStep('drill-surface-edge-compatibility-bundle', () =>
      writeEdgeCompatibilityBundle({ projectDir, quiet: true })
    )
  } else {
    proof.summary.drillStatus = 'skipped'
    proof.summary.drillChecks = 0
    proof.summary.drillAttention = 0
    proof.summary.drillNextAction = 'Run npm run proof:local -- --drill to create local proof drill evidence.'
  }

  validateRequiredRecord(proof)
  await writeJsonAtomic(projectDir, output, proof)

  if (print) {
    console.log(JSON.stringify(proof, null, 2))
  } else if (!quiet) {
    console.log(formatLocalProofRehearsal(proof, output))
    console.log('nonClaims: local-only proof rehearsal; no Edge dispatch; no Layer admission; no publication authorization; swarmProof=false; activation=false')
  }

  return {
    proof,
    output,
    productionOutput,
    pressure,
    mediaSummary,
    health,
    inspection,
    operatorIndex,
    edgeCompatibility
  }
}

export function formatLocalProofRehearsal(proof, output = defaultOutput) {
  return [
    `studio local proof: project=${proof.projectId}`,
    `proof=${proof.proofState}`,
    `drill=${proof.summary.drillStatus ?? 'skipped'}`,
    `drillChecks=${proof.summary.drillChecks ?? 0}`,
    `drillAttention=${proof.summary.drillAttention ?? 0}`,
    `localPackage=${proof.localPackagePosture.packageState}`,
    `swarmSeam=${proof.swarmSeamPosture.state}`,
    `adapter=${proof.studioSourcePressureAdapterSummary.latestDecisionStatus}`,
    `observation=${proof.studioSourcePressureAdapterSummary.observationStatus}`,
    'swarmProof=false',
    'activation=false',
    `surfaced=${proof.summary.surfaced === true}`,
    `nextAction=${proof.safeNextAction}`,
    `output=${output}`
  ].join(' | ')
}

export function createLocalProofDrillSummary({
  proof,
  inspection,
  operatorIndex,
  edgeCompatibility
}) {
  const rows = []
  const operatorSummary = operatorIndex?.index?.localProofRehearsalSummary ?? {}
  const operatorIndexSummary = operatorIndex?.index?.summary ?? {}
  const edgeSummary = edgeCompatibility?.bundle?.localProofRehearsalSummary ?? {}
  const edgeAdapterSummary = edgeCompatibility?.bundle?.studioSourcePressureAdapterSummary ?? {}
  const expectedObservationCount = proof.refs.adapterObservationRef ? 1 : 0

  addCheck(rows, {
    check: 'inspection-artifact-kind',
    passed: inspection?.packet?.artifactKinds?.includes(artifactKinds.mediaStudioLocalProofRehearsalLocal),
    issueCode: 'proof_missing_from_inspection_artifact_kinds',
    expected: artifactKinds.mediaStudioLocalProofRehearsalLocal,
    actual: (inspection?.packet?.artifactKinds ?? []).join(',')
  })
  addCheck(rows, {
    check: 'inspection-record-ref',
    passed: Object.values(inspection?.packet?.recordRefs ?? {}).some((ref) =>
      ref.schema === artifactKinds.mediaStudioLocalProofRehearsalLocal
    ),
    issueCode: 'proof_missing_from_inspection_record_refs',
    expected: artifactKinds.mediaStudioLocalProofRehearsalLocal,
    actual: Object.values(inspection?.packet?.recordRefs ?? {}).map((ref) => ref.schema).join(',')
  })
  addEqualCheck(rows, 'operator-proof-state', proof.proofState, operatorSummary.latestProofState)
  addEqualCheck(rows, 'operator-proof-freshness', 'fresh', operatorSummary.proofFreshness)
  addEqualCheck(rows, 'operator-local-package', proof.localPackagePosture.packageState, operatorSummary.localPackageState)
  addEqualCheck(rows, 'operator-swarm-seam', proof.swarmSeamPosture.state, operatorSummary.swarmSeamState)
  addEqualCheck(rows, 'operator-adapter-decision', proof.studioSourcePressureAdapterSummary.latestDecisionStatus, operatorSummary.adapterDecisionStatus)
  addEqualCheck(rows, 'operator-observation', proof.studioSourcePressureAdapterSummary.observationStatus, operatorSummary.observationStatus)
  addEqualCheck(rows, 'operator-target-envelope', proof.studioSourcePressureAdapterSummary.targetGenericEnvelope, operatorSummary.targetGenericEnvelope)
  addEqualCheck(rows, 'operator-proof-next-action', proof.safeNextAction, operatorSummary.safeNextAction)
  addEqualCheck(rows, 'edge-proof-state', proof.proofState, edgeSummary.latestProofState)
  addEqualCheck(rows, 'edge-proof-freshness', 'fresh', edgeSummary.proofFreshness)
  addEqualCheck(rows, 'edge-local-package', proof.localPackagePosture.packageState, edgeSummary.localPackageState)
  addEqualCheck(rows, 'edge-swarm-seam', proof.swarmSeamPosture.state, edgeSummary.swarmSeamState)
  addEqualCheck(rows, 'edge-adapter-decision', proof.studioSourcePressureAdapterSummary.latestDecisionStatus, edgeSummary.adapterDecisionStatus)
  addEqualCheck(rows, 'edge-observation', proof.studioSourcePressureAdapterSummary.observationStatus, edgeSummary.observationStatus)
  addEqualCheck(rows, 'edge-target-envelope', proof.studioSourcePressureAdapterSummary.targetGenericEnvelope, edgeSummary.targetGenericEnvelope)
  addEqualCheck(rows, 'edge-proof-next-action', proof.safeNextAction, edgeSummary.safeNextAction)
  addEqualCheck(rows, 'operator-adapter-candidates', 1, operatorIndexSummary.studioSourcePressureAdapterCandidates ?? 0)
  addEqualCheck(rows, 'operator-adapter-decisions', 1, operatorIndexSummary.studioSourcePressureAdapterDecisions ?? 0)
  addEqualCheck(rows, 'operator-adapter-observations', expectedObservationCount, operatorIndexSummary.studioSourcePressureObservations ?? 0)
  addEqualCheck(rows, 'edge-adapter-candidates', 1, edgeAdapterSummary.candidates ?? 0)
  addEqualCheck(rows, 'edge-adapter-decisions', 1, edgeAdapterSummary.decisions ?? 0)
  addEqualCheck(rows, 'edge-adapter-observations', expectedObservationCount, edgeAdapterSummary.observations ?? 0)
  addFalseCheck(rows, 'proof-edge-dispatch', proof.nonClaims?.edgeDispatch)
  addFalseCheck(rows, 'proof-edge-queue-action', proof.nonClaims?.edgeQueueAction)
  addFalseCheck(rows, 'proof-layer-admission', proof.nonClaims?.layerAdmission)
  addFalseCheck(rows, 'proof-durable-append', proof.nonClaims?.durableAppend)
  addFalseCheck(rows, 'proof-publication-authorization', proof.nonClaims?.publicationAuthorization)
  addFalseCheck(rows, 'proof-production-ready', proof.nonClaims?.productionReady)
  addFalseCheck(rows, 'proof-public-swarm-proof', proof.nonClaims?.publicSwarmProof)
  addFalseCheck(rows, 'proof-swarm-runtime-activated', proof.nonClaims?.swarmRuntimeActivated)
  addFalseCheck(rows, 'proof-mesh-truth', proof.nonClaims?.meshTruth)
  addFalseCheck(rows, 'operator-swarm-proof', operatorIndexSummary.swarmProof)
  addFalseCheck(rows, 'operator-swarm-activation', operatorIndexSummary.swarmActivation)
  addFalseCheck(rows, 'operator-proof-edge-dispatch', operatorSummary.edgeDispatch)
  addFalseCheck(rows, 'operator-proof-layer-admission', operatorSummary.layerAdmission)
  addFalseCheck(rows, 'edge-proof-edge-dispatch', edgeSummary.edgeDispatch)
  addFalseCheck(rows, 'edge-proof-layer-admission', edgeSummary.layerAdmission)

  const attentionRows = rows.filter((row) => row.status === 'attention')
  const drillStatus = attentionRows.length > 0 ? 'attention' : 'passed'
  const safeNextAction = drillStatus === 'attention'
    ? 'Run npm run proof:local -- --drill to refresh local proof rehearsal evidence and drill surfaces.'
    : 'Local proof drill passed; carry Studio evidence to future family swarm-seam review only.'

  return {
    summaryKind: 'studio-local-proof-drill-summary',
    drillStatus,
    checks: rows.length,
    passedChecks: rows.length - attentionRows.length,
    attentionChecks: attentionRows.length,
    rows,
    attentionRows,
    safeNextAction,
    publicSwarmProof: false,
    swarmRuntimeActivated: false,
    edgeDispatch: false,
    layerAdmission: false,
    publicationAuthorization: false,
    productionReady: false,
    localOnly: true,
    operatorGuidanceOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false
  }
}

function addEqualCheck(rows, check, expected, actual) {
  addCheck(rows, {
    check,
    passed: expected === actual,
    issueCode: `${check.replaceAll('-', '_')}_mismatch`,
    expected,
    actual
  })
}

function addFalseCheck(rows, check, actual) {
  addCheck(rows, {
    check,
    passed: actual === false,
    issueCode: `${check.replaceAll('-', '_')}_overclaim`,
    expected: false,
    actual
  })
}

function addCheck(rows, {
  check,
  passed,
  issueCode,
  expected,
  actual
}) {
  rows.push({
    check,
    status: passed ? 'passed' : 'attention',
    issueCode: passed ? null : issueCode,
    expected,
    actual,
    nextAction: passed
      ? 'No local proof drill action required.'
      : 'Run npm run proof:local -- --drill to refresh local proof rehearsal evidence and drill surfaces.',
    localOnly: true,
    operatorGuidanceOnly: true
  })
}

function proofStateFor({
  localPackagePosture,
  swarmSeamPosture,
  studioSourcePressureAdapterSummary
}) {
  if (localPackagePosture.packageState !== 'complete_review_only_authority_missing') return 'attention'
  if (swarmSeamPosture.state !== 'ready_for_review_only_swarm_pressure') return 'attention'
  if (studioSourcePressureAdapterSummary.latestDecisionStatus !== approvedDecisionStatus) return 'attention'
  if (studioSourcePressureAdapterSummary.observationStatus !== routedObservationStatus) return 'attention'
  return 'ready'
}

function safeNextActionForAttention({
  localPackagePosture,
  swarmSeamPosture,
  studioSourcePressureAdapterSummary
}) {
  if (localPackagePosture.packageState !== 'complete_review_only_authority_missing') {
    return localPackagePosture.safeNextAction
  }
  if (studioSourcePressureAdapterSummary.latestDecisionStatus !== approvedDecisionStatus ||
      studioSourcePressureAdapterSummary.observationStatus !== routedObservationStatus) {
    return swarmSeamPosture.safeNextAction
  }
  return swarmSeamPosture.safeNextAction ?? 'Inspect Studio local proof rehearsal attention state.'
}

async function recordStep(steps, step, fn) {
  const result = await fn()
  steps.push({
    step,
    state: 'completed',
    localOnly: true,
    authorityGranted: false,
    productionReady: false
  })
  return result
}

async function withQuietConsole(fn) {
  const originalLog = console.log
  console.log = () => {}
  try {
    return await fn()
  } finally {
    console.log = originalLog
  }
}

function localRef(kind, id, schema, relativePath) {
  return {
    ...makeRef(kind, id, schema),
    path: relativePath,
    localOnly: true
  }
}

function proofNonClaims() {
  return {
    localOnly: true,
    operatorGuidanceOnly: true,
    approvalAuthority: false,
    ratifierAuthority: false,
    publicationAuthorization: false,
    productionReady: false,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    providerTruth: false,
    edgeQueueAction: false,
    edgeDispatch: false,
    edgeRuntimeVerified: false,
    edgeAuthority: false,
    layerAdmission: false,
    durableAppend: false,
    acceptedContinuity: false,
    productionStorageSelection: false,
    publicSwarmProof: false,
    swarmRuntimeActivated: false,
    activation: false,
    byteAvailabilityProof: false,
    materializationProof: false,
    resourceAdmission: false,
    causalTruth: false,
    meshPublication: false,
    autoExecute: false
  }
}

function createStepClock(start) {
  const startTime = Date.parse(start)
  let offset = 0
  return () => {
    if (!Number.isFinite(startTime)) return nowIso()
    const value = new Date(startTime + offset).toISOString()
    offset += 1000
    return value
  }
}

if (process.argv[1] === modulePath) {
  await runLocalProofRehearsal(parseArgs(process.argv.slice(2)))
}
