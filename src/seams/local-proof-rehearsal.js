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
