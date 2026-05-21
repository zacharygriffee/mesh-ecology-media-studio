import { fileURLToPath } from 'node:url'

import { createMediaSummary } from '../assets/media-summary.js'
import { writeProductionAssetCapsule } from '../production/asset-capsule.js'
import { writeProductionBundle } from '../production/bundle.js'
import { writeApprovalProposal } from '../review/approval-proposal.js'
import { writeControlSurfaceProjection } from '../seams/control-surface-projection.js'
import { writeEdgeCompatibilityBundle } from '../seams/edge-compatibility-bundle.js'
import { inspectVeniceSmoke } from '../seams/inspect-venice-smoke.js'
import { writeOperatorPacketIndex } from '../seams/operator-packet-index.js'
import { writeProjectHealth } from '../seams/project-health.js'
import { runVeniceOperationalLoop } from './venice-operational-loop.js'

const modulePath = fileURLToPath(import.meta.url)
const defaultProjectDir = 'examples/venice-smoke'
const acceptedDecisionPath = 'records/decisions/promoted-candidate-accepted-decision.local.json'
const acceptedAssetPath = 'records/assets/promoted-candidate-accepted.local.json'
const approvalOutput = 'records/approvals/promoted-candidate-accepted-approval-proposal.local.json'

function parseArgs(argv) {
  const args = {
    projectDir: defaultProjectDir,
    decision: 'accepted',
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
    } else if (arg === '--decision') {
      args.decision = next
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

export async function runVeniceProductionRehearsal({
  projectDir = defaultProjectDir,
  decision = 'accepted',
  liveProvider = false,
  verbose = false,
  print = false
} = {}) {
  if (decision !== 'accepted') {
    throw new Error('Venice production rehearsal currently requires --decision accepted')
  }

  const runStep = verbose ? (fn) => fn() : runQuiet
  const loop = await runStep(() => runVeniceOperationalLoop({
    projectDir,
    decision,
    liveProvider
  }))
  const approval = await runStep(() => writeApprovalProposal({
    projectDir,
    decision: acceptedDecisionPath,
    asset: acceptedAssetPath,
    output: approvalOutput
  }))
  const capsule = await runStep(() => writeProductionAssetCapsule({ projectDir, quiet: true }))
  const bundle = await runStep(() => writeProductionBundle({ projectDir, quiet: true }))
  const health = await runStep(() => writeProjectHealth({ projectDir }))
  const inspection = await runStep(() => inspectVeniceSmoke({ projectDir }))
  const controlSurface = await runStep(() => writeControlSurfaceProjection({ projectDir }))
  const operatorIndex = await runStep(() => writeOperatorPacketIndex({ projectDir }))
  const edgeCompatibility = await runStep(() => writeEdgeCompatibilityBundle({ projectDir }))
  const mediaSummary = await createMediaSummary({ projectDir })
  const lane = mediaSummary.productionApprovalLane
  const roughCutPosture = {
    total: mediaSummary.productionRoughCuts.total,
    reviewed: mediaSummary.productionRoughCuts.reviewed,
    changesRequested: mediaSummary.productionRoughCuts.changesRequested,
    deferred: mediaSummary.productionRoughCuts.deferred,
    attention: mediaSummary.productionRoughCuts.attentionRows.length,
    productionReady: false,
    localOnly: true,
    operatorGuidanceOnly: true
  }

  const rehearsal = {
    schema: 'media.venice_production_rehearsal.local.v1',
    projectId: mediaSummary.projectId,
    projectDir,
    state: lane.pendingAuthority > 0 ? 'complete_review_only_authority_missing' : 'complete_review_only',
    liveProviderCalled: loop.liveProviderCalled === true,
    providerLoopState: loop.state,
    approvalProposalRef: {
      kind: 'media-approval-proposal',
      id: approval.proposal.proposalId,
      schema: approval.proposal.schema,
      path: approval.output,
      localOnly: true
    },
    productionCapsuleRef: {
      kind: 'media-production-asset-capsule',
      id: capsule.capsule.capsuleId,
      schema: capsule.capsule.schema,
      path: capsule.output,
      localOnly: true
    },
    productionBundleRef: {
      kind: 'media-production-bundle',
      id: bundle.bundle.bundleId,
      schema: bundle.bundle.schema,
      path: bundle.output,
      localOnly: true
    },
    inspectionPacketRef: {
      kind: 'media-edge-inspection-packet',
      id: inspection.packet.packetId,
      schema: inspection.packet.schema,
      path: inspection.output,
      localOnly: true
    },
    controlSurfaceProjectionRef: {
      kind: 'media-control-surface-projection',
      id: controlSurface.projection.projectionId,
      schema: controlSurface.projection.schema,
      path: controlSurface.output,
      localOnly: true
    },
    operatorPacketIndexRef: {
      kind: 'media-operator-packet-index',
      id: operatorIndex.index.indexId,
      schema: operatorIndex.index.schema,
      path: operatorIndex.output,
      localOnly: true
    },
    edgeCompatibilityBundleRef: {
      kind: 'media-edge-compatibility-bundle',
      id: edgeCompatibility.bundle.bundleId,
      schema: edgeCompatibility.bundle.schema,
      path: edgeCompatibility.output,
      localOnly: true
    },
    healthState: health.health.healthState,
    productionApprovalLane: lane,
    roughCutPosture,
    safeNextAction: mediaSummary.safeNextAction,
    localOnly: true,
    operatorGuidanceOnly: true,
    meshTruth: false,
    providerTruth: false,
    edgeCalled: false,
    meshPublished: false,
    approvalAuthority: false,
    publicationAuthorization: false,
    byteAvailabilityProof: false,
    materializationProof: false,
    resourceAdmission: false
  }

  if (print) {
    console.log(JSON.stringify(rehearsal, null, 2))
  } else {
    console.log(formatVeniceProductionRehearsal(rehearsal))
    console.log(`safeNextAction: ${rehearsal.safeNextAction}`)
    console.log('nonClaims: local-only; no Edge call; no mesh truth; no byte/materialization proof; no resource admission; no approval authority')
  }

  return {
    rehearsal,
    loop,
    approval,
    capsule,
    bundle,
    health,
    inspection,
    controlSurface,
    operatorIndex,
    edgeCompatibility,
    mediaSummary
  }
}

export function formatVeniceProductionRehearsal(rehearsal) {
  const lane = rehearsal.productionApprovalLane
  return [
    `venice production rehearsal: state=${rehearsal.state}`,
    `project=${rehearsal.projectId}`,
    `liveProviderCalled=${rehearsal.liveProviderCalled}`,
    `providerLoop=${rehearsal.providerLoopState}`,
    `decisions=${lane.localDecisions}`,
    `proposals=${lane.approvalProposals}`,
    `capsules=${lane.capsules}`,
    `bundles=${lane.bundles}`,
    `roughCuts=${rehearsal.roughCutPosture?.total ?? 0}`,
    `roughCutReviewed=${rehearsal.roughCutPosture?.reviewed ?? 0}`,
    `pendingAuthority=${lane.pendingAuthority}`,
    `productionReady=${lane.productionReady}`
  ].join(' | ')
}

async function runQuiet(fn) {
  const originalLog = console.log
  console.log = () => {}
  try {
    return await fn()
  } finally {
    console.log = originalLog
  }
}

if (process.argv[1] === modulePath) {
  await runVeniceProductionRehearsal(parseArgs(process.argv.slice(2)))
}
