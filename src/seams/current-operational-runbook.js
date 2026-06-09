import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { writeByteDescriptorProposals } from '../assets/byte-descriptor-proposal.js'
import { nowIso } from '../contracts/constructors.js'
import { runFirstWedge } from '../local/run-first-wedge.js'
import { writeLocalLayerResourceRefCandidates } from '../local/resource-ref-candidates.js'
import { writeProductionAssetCapsule } from '../production/asset-capsule.js'
import { writeProductionBundle } from '../production/bundle.js'
import { writeApprovalProposal } from '../review/approval-proposal.js'
import { writeAdjacentSeamNeedsPacket } from './adjacent-seam-needs.js'
import { inspectAdjacentSeamReadiness } from './adjacent-seam-readiness.js'
import { writeControlSurfaceProjection } from './control-surface-projection.js'
import { writeEdgeCompatibilityBundle } from './edge-compatibility-bundle.js'
import { inspectLocalRun } from './inspect-local-run.js'
import { runLocalProofRehearsal } from './local-proof-rehearsal.js'
import { writeOperatorPacketIndex } from './operator-packet-index.js'

const modulePath = fileURLToPath(import.meta.url)
const defaultProjectDir = 'examples/card-to-candidate'
const preparedCandidateFilename = 'current-operation-candidate.png'
const onePixelPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

function parseArgs(argv) {
  const args = {
    projectDir: defaultProjectDir,
    adapterDecision: 'approved',
    prepareLocalFixture: false,
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
    } else if (arg === '--adapter-decision') {
      args.adapterDecision = next
      i += 1
    } else if (arg === '--prepare-local-fixture') {
      args.prepareLocalFixture = true
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

export async function runCurrentOperationalRunbook({
  projectDir = defaultProjectDir,
  adapterDecision = 'approved',
  prepareLocalFixture = false,
  disableFfmpeg = false,
  createdAt = nowIso(),
  print = false,
  quiet = false
} = {}) {
  const preparation = prepareLocalFixture
    ? await prepareLocalOperationFixture({ projectDir })
    : null
  const proof = await runLocalProofRehearsal({
    projectDir,
    adapterDecision,
    drill: true,
    disableFfmpeg,
    createdAt,
    quiet: true
  })
  const adjacentNeeds = await writeAdjacentSeamNeedsPacket({
    projectDir,
    createdAt,
    quiet: true
  })
  const readiness = await inspectAdjacentSeamReadiness({
    projectDir,
    quiet: true
  })
  const operatorIndex = await writeOperatorPacketIndex({
    projectDir,
    quiet: true
  })
  const edgeCompatibility = await writeEdgeCompatibilityBundle({
    projectDir,
    quiet: true
  })

  const operation = createCurrentOperationalRunbookSummary({
    projectDir,
    createdAt,
    proof,
    preparation,
    adjacentNeeds,
    readiness,
    operatorIndex,
    edgeCompatibility
  })

  if (print) {
    console.log(JSON.stringify(operation, null, 2))
  } else if (!quiet) {
    console.log(formatCurrentOperationalRunbook(operation))
  }

  return {
    operation,
    preparation,
    proof,
    adjacentNeeds,
    readiness,
    operatorIndex,
    edgeCompatibility
  }
}

export function createCurrentOperationalRunbookSummary({
  projectDir,
  createdAt,
  proof,
  preparation,
  adjacentNeeds,
  readiness,
  operatorIndex,
  edgeCompatibility
}) {
  const proofRecord = proof.proof
  const readinessRecord = readiness.readiness
  const operatorProof = operatorIndex.index.localProofRehearsalSummary
  const edgeProof = edgeCompatibility.bundle.localProofRehearsalSummary
  const complete = proofRecord.proofState === 'ready' &&
    proofRecord.summary.drillStatus === 'passed' &&
    readinessRecord.readiness === 'ready_for_spine_discussion' &&
    operatorProof.latestProofState === 'ready' &&
    operatorProof.drillStatus === 'passed' &&
    edgeProof.latestProofState === 'ready' &&
    edgeProof.drillStatus === 'passed'

  return {
    summaryKind: 'studio-current-operational-runbook',
    projectId: proofRecord.projectId,
    projectDir,
    createdAt,
    preparedLocalFixture: preparation !== null,
    operationState: complete ? 'ready_for_spine_discussion' : 'local_attention',
    proofState: proofRecord.proofState,
    proofFreshness: operatorProof.proofFreshness,
    proofDrill: proofRecord.summary.drillStatus,
    drillAttention: proofRecord.summary.drillAttention ?? 0,
    localPackageState: proofRecord.localPackagePosture.packageState,
    swarmSeamState: proofRecord.swarmSeamPosture.state,
    adapterDecisionStatus: proofRecord.studioSourcePressureAdapterSummary.latestDecisionStatus,
    observationStatus: proofRecord.studioSourcePressureAdapterSummary.observationStatus,
    adjacentDeclaration: adjacentNeeds.packet.declarationStatus,
    spineDiscussion: adjacentNeeds.packet.spineDiscussion,
    adjacentReadiness: readinessRecord.readiness,
    adjacentFreshness: readinessRecord.adjacentFreshness,
    adjacentNeeds: readinessRecord.adjacentNeeds,
    adjacentReady: readinessRecord.adjacentReady,
    adjacentAttention: readinessRecord.adjacentAttention,
    operatorProofState: operatorProof.latestProofState,
    operatorProofDrill: operatorProof.drillStatus,
    edgeProofState: edgeProof.latestProofState,
    edgeProofDrill: edgeProof.drillStatus,
    safeNextAction: readinessRecord.safeNextAction,
    outputs: {
      preparation: preparation
        ? {
          generatedCandidate: `media/generated/${preparedCandidateFilename}`,
          firstWedge: 'records/manifests/media-local-run-manifest.local.json',
          inspectionPacket: preparation.inspection.output,
          controlSurfaceProjection: preparation.controlSurface.output,
          byteDescriptorProposals: preparation.byteDescriptorProposals.proposals.map((entry) => entry.output),
          resourceRefCandidates: preparation.resourceRefCandidates.candidates.map((entry) => entry.output),
          approvalProposal: preparation.approval.output,
          productionCapsule: preparation.productionCapsule.output,
          productionBundle: preparation.productionBundle.output
        }
        : null,
      proof: proof.output,
      adjacentNeeds: adjacentNeeds.output,
      operatorIndex: operatorIndex.output,
      edgeCompatibility: edgeCompatibility.output
    },
    adjacentRepoWrite: false,
    layerAdmission: false,
    edgeDispatch: false,
    publicationAuthorization: false,
    productionReady: false,
    swarmRuntimeActivated: false,
    localOnly: true,
    operatorGuidanceOnly: true
  }
}

export function formatCurrentOperationalRunbook(operation) {
  return [
    `studio current operation: project=${operation.projectId}`,
    `operation=${operation.operationState}`,
    `preparedLocalFixture=${operation.preparedLocalFixture}`,
    `proof=${operation.proofState}`,
    `proofFreshness=${operation.proofFreshness}`,
    `proofDrill=${operation.proofDrill}`,
    `localPackage=${operation.localPackageState}`,
    `swarmSeam=${operation.swarmSeamState}`,
    `adapter=${operation.adapterDecisionStatus}`,
    `observation=${operation.observationStatus}`,
    `adjacentDeclaration=${operation.adjacentDeclaration}`,
    `spineDiscussion=${operation.spineDiscussion}`,
    `spineReadiness=${operation.adjacentReadiness}`,
    `adjacentFreshness=${operation.adjacentFreshness}`,
    `adjacentReady=${operation.adjacentReady}`,
    `adjacentAttention=${operation.adjacentAttention}`,
    'adjacentRepoWrite=false',
    'layerAdmission=false',
    'edgeDispatch=false',
    'publicationAuthorization=false',
    'productionReady=false',
    'swarmRuntimeActivated=false',
    `nextAction=${operation.safeNextAction}`
  ].join(' | ')
}

async function prepareLocalOperationFixture({ projectDir }) {
  await writePreparedImageCandidate({ projectDir })
  const firstWedge = await withQuietConsole(() => runFirstWedge({
    projectDir,
    candidateFilename: preparedCandidateFilename,
    decision: 'accepted',
    operatorRef: 'operator-test'
  }))
  const inspection = await withQuietConsole(() => inspectLocalRun({ projectDir }))
  const controlSurface = await withQuietConsole(() => writeControlSurfaceProjection({ projectDir }))
  const byteDescriptorProposals = await writeByteDescriptorProposals({ projectDir, quiet: true })
  const resourceRefCandidates = await writeLocalLayerResourceRefCandidates({ projectDir, quiet: true })
  const approval = await withQuietConsole(() => writeApprovalProposal({ projectDir }))
  const productionCapsule = await writeProductionAssetCapsule({ projectDir, quiet: true })
  const productionBundle = await writeProductionBundle({ projectDir, quiet: true })

  return {
    firstWedge,
    inspection,
    controlSurface,
    byteDescriptorProposals,
    resourceRefCandidates,
    approval,
    productionCapsule,
    productionBundle,
    localOnly: true,
    operatorGuidanceOnly: true
  }
}

async function writePreparedImageCandidate({ projectDir }) {
  const candidatePath = path.join(
    path.resolve(projectDir),
    'media',
    'generated',
    preparedCandidateFilename
  )
  await mkdir(path.dirname(candidatePath), { recursive: true })
  await writeFile(candidatePath, Buffer.from(onePixelPngBase64, 'base64'))
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

if (process.argv[1] === modulePath) {
  await runCurrentOperationalRunbook(parseArgs(process.argv.slice(2)))
}
