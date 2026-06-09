import { access, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { writeByteDescriptorProposals } from '../assets/byte-descriptor-proposal.js'
import { artifactKinds } from '../contracts/artifact-kinds.js'
import { nowIso } from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import { writeJsonAtomic } from '../local/atomic-json.js'
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
import { writeCrossProjectOperatorIndex } from './cross-project-operator-index.js'

const modulePath = fileURLToPath(import.meta.url)
const defaultProjectDir = 'examples/card-to-candidate'
const defaultOutput = 'records/exports/media-current-operational-runbook.local.json'
const preparedCandidateFilename = 'current-operation-candidate.png'
const onePixelPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

function parseArgs(argv) {
  const args = {
    projectDir: defaultProjectDir,
    output: defaultOutput,
    adapterDecision: 'approved',
    prepareLocalFixture: false,
    crossProjectIndex: false,
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
    } else if (arg === '--prepare-local-fixture') {
      args.prepareLocalFixture = true
    } else if (arg === '--cross-project-index') {
      args.crossProjectIndex = true
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
  output = defaultOutput,
  adapterDecision = 'approved',
  prepareLocalFixture = false,
  crossProjectIndex = false,
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
  let operatorIndex = await writeOperatorPacketIndex({
    projectDir,
    quiet: true
  })
  let edgeCompatibility = await writeEdgeCompatibilityBundle({
    projectDir,
    quiet: true
  })
  let crossProject = crossProjectIndex
    ? await writeCurrentOperationCrossProjectIndex({
      projectDir,
      proof,
      adjacentNeeds,
      operatorIndex,
      createdAt
    })
    : null

  const operation = createCurrentOperationalRunbookSummary({
    projectDir,
    createdAt,
    proof,
    preparation,
    adjacentNeeds,
    readiness,
    operatorIndex,
    edgeCompatibility,
    crossProject,
    output
  })

  await writeJsonAtomic(path.resolve(projectDir), output, operation)
  const refreshedInspection = await refreshInspectionIfPresent({ projectDir })
  if (preparation && refreshedInspection) {
    preparation.inspection = refreshedInspection
  }
  if (refreshedInspection) {
    operation.inspectionRefreshed = true
    operation.outputs.inspectionPacket = refreshedInspection.output
  }
  const refreshedControlSurface = await withQuietConsole(() => writeControlSurfaceProjection({ projectDir }))
  if (preparation && refreshedControlSurface) {
    preparation.controlSurface = refreshedControlSurface
  }
  operation.controlSurfaceRefreshed = true
  operation.outputs.controlSurfaceProjection = refreshedControlSurface.output
  operatorIndex = await writeOperatorPacketIndex({
    projectDir,
    quiet: true
  })
  edgeCompatibility = await writeEdgeCompatibilityBundle({
    projectDir,
    quiet: true
  })
  if (crossProjectIndex) {
    crossProject = await writeCurrentOperationCrossProjectIndex({
      projectDir,
      proof,
      adjacentNeeds,
      operatorIndex,
      createdAt
    })
    operation.crossProjectSummary = {
      projects: crossProject.index.summary.projects,
      localProofReady: crossProject.index.summary.localProofReady,
      adjacentReady: crossProject.index.summary.adjacentReady,
      spineReady: crossProject.index.summary.spineReadinessReady,
      swarmReady: crossProject.index.summary.swarmReady,
      currentOperations: crossProject.index.summary.currentOperations,
      currentOperationReady: crossProject.index.summary.currentOperationReady,
      currentOperationCrossProjectIndexed: crossProject.index.summary.currentOperationCrossProjectIndexed,
      swarmProof: false,
      activation: false,
      localOnly: true,
      operatorGuidanceOnly: true
    }
  }
  operation.surfaceFreshness = createCurrentOperationSurfaceFreshness({
    operation,
    inspection: refreshedInspection,
    controlSurface: refreshedControlSurface,
    operatorIndex,
    edgeCompatibility,
    crossProject
  })
  await writeJsonAtomic(path.resolve(projectDir), output, operation)

  if (print) {
    console.log(JSON.stringify(operation, null, 2))
  } else if (!quiet) {
    console.log(formatCurrentOperationalRunbook(operation))
  }

  return {
    operation,
    output,
    preparation,
    inspection: refreshedInspection,
    controlSurface: refreshedControlSurface,
    proof,
    adjacentNeeds,
    readiness,
    operatorIndex,
    edgeCompatibility,
    crossProject
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
  edgeCompatibility,
  crossProject,
  output = defaultOutput
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
    adjacentFamilyAskSummary: createAdjacentFamilyAskSummary(adjacentNeeds),
    operatorProofState: operatorProof.latestProofState,
    operatorProofDrill: operatorProof.drillStatus,
    edgeProofState: edgeProof.latestProofState,
    edgeProofDrill: edgeProof.drillStatus,
    crossProjectIndexed: crossProject !== null,
    inspectionRefreshed: false,
    controlSurfaceRefreshed: false,
    surfaceFreshness: {
      state: 'pending',
      checks: [],
      issueCodes: [],
      localOnly: true,
      operatorGuidanceOnly: true
    },
    crossProjectSummary: crossProject
      ? {
        projects: crossProject.index.summary.projects,
        localProofReady: crossProject.index.summary.localProofReady,
        adjacentReady: crossProject.index.summary.adjacentReady,
        spineReady: crossProject.index.summary.spineReadinessReady,
        swarmReady: crossProject.index.summary.swarmReady,
        currentOperations: crossProject.index.summary.currentOperations ?? 0,
        currentOperationReady: crossProject.index.summary.currentOperationReady ?? 0,
        currentOperationCrossProjectIndexed: crossProject.index.summary.currentOperationCrossProjectIndexed ?? 0,
        swarmProof: false,
        activation: false,
        localOnly: true,
        operatorGuidanceOnly: true
      }
      : null,
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
      edgeCompatibility: edgeCompatibility.output,
      inspectionPacket: preparation?.inspection.output ?? null,
      controlSurfaceProjection: preparation?.controlSurface.output ?? null,
      crossProjectInputList: crossProject?.inputListOutput ?? null,
      crossProjectIndex: crossProject?.output ?? null,
      currentOperationSummary: output
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
    `familyAsks=${operation.adjacentFamilyAskSummary?.adjacentNeeds ?? 0}`,
    `familyAsksReady=${operation.adjacentFamilyAskSummary?.adjacentReady ?? 0}`,
    `crossProjectIndexed=${operation.crossProjectIndexed}`,
    `crossProjectLocalProofReady=${operation.crossProjectSummary?.localProofReady ?? 0}`,
    `crossProjectSpineReady=${operation.crossProjectSummary?.spineReady ?? 0}`,
    `crossProjectCurrentOperations=${operation.crossProjectSummary?.currentOperations ?? 0}`,
    `inspectionRefreshed=${operation.inspectionRefreshed}`,
    `inspectionPacket=${operation.outputs.inspectionPacket ?? 'absent'}`,
    `controlSurfaceRefreshed=${operation.controlSurfaceRefreshed}`,
    `controlSurface=${operation.outputs.controlSurfaceProjection ?? 'absent'}`,
    `surfaceFreshness=${operation.surfaceFreshness?.state ?? 'unknown'}`,
    `surfaceFreshnessIssues=${operation.surfaceFreshness?.issueCodes?.join(',') || 'none'}`,
    `output=${operation.outputs.currentOperationSummary}`,
    'adjacentRepoWrite=false',
    'layerAdmission=false',
    'edgeDispatch=false',
    'publicationAuthorization=false',
    'productionReady=false',
    'swarmRuntimeActivated=false',
    `nextAction=${operation.safeNextAction}`
  ].join(' | ')
}

function createAdjacentFamilyAskSummary(adjacentNeeds) {
  const packet = adjacentNeeds.packet
  const rows = packet.adjacentDiscussionRows ?? []

  return {
    state: packet.declarationStatus === 'ready_for_spine_discussion'
      ? 'ready_for_spine_discussion'
      : 'local_attention',
    spineDiscussion: packet.spineDiscussion,
    packetPath: adjacentNeeds.output,
    adjacentNeeds: rows.length,
    adjacentReady: rows.filter((row) => row.discussionStatus === 'ready_for_discussion').length,
    adjacentAttention: rows.filter((row) => row.discussionStatus !== 'ready_for_discussion').length,
    ownerRepos: rows.map((row) => row.ownerRepo),
    discussionKinds: rows.map((row) => row.discussionKind),
    askRows: rows.map((row) => ({
      ownerRepo: row.ownerRepo,
      discussionKind: row.discussionKind,
      discussionStatus: row.discussionStatus,
      evidenceRefs: row.evidenceRefs?.length ?? 0,
      stopConditions: row.stopConditions?.length ?? 0,
      nextAction: row.nextAction,
      localOnly: true,
      operatorGuidanceOnly: true
    })),
    safeNextAction: packet.safeNextAction,
    adjacentRepoWrite: false,
    layerAdmission: false,
    edgeDispatch: false,
    bytesMaterialization: false,
    causalTruth: false,
    swarmRuntimeActivated: false,
    localOnly: true,
    operatorGuidanceOnly: true
  }
}

function createCurrentOperationSurfaceFreshness({
  operation,
  inspection,
  controlSurface,
  operatorIndex,
  edgeCompatibility,
  crossProject
}) {
  const expectedPath = operation.outputs.currentOperationSummary
  const expectedSchema = operation.summaryKind
  const checks = [
    currentOperationRefCheck({
      surface: 'inspectionPacket',
      required: true,
      ref: inspection?.packet?.recordRefs?.currentOperationSummary,
      expectedPath,
      expectedSchema
    }),
    currentOperationRefCheck({
      surface: 'controlSurface',
      required: true,
      ref: controlSurface?.projection?.observationRefs?.currentOperationSummary,
      expectedPath,
      expectedSchema
    }),
    currentOperationRefCheck({
      surface: 'operatorIndex',
      required: true,
      ref: operatorIndex?.index?.currentOperationSummaryRefs?.[0],
      expectedPath,
      expectedSchema
    }),
    currentOperationRefCheck({
      surface: 'edgeCompatibility',
      required: true,
      ref: edgeCompatibility?.bundle?.currentOperationSummary?.ref,
      expectedPath,
      expectedSchema
    }),
    currentOperationCrossProjectCheck({
      operation,
      crossProject,
      operatorIndex,
      expectedPath
    })
  ]
  const issueCodes = checks
    .filter((check) => check.state === 'attention')
    .map((check) => check.issueCode)

  return {
    state: issueCodes.length === 0 ? 'fresh' : 'attention',
    currentOperationSummaryPath: expectedPath,
    checks,
    issueCodes,
    refreshedSurfaces: checks.filter((check) => check.state === 'fresh').length,
    expectedSurfaces: checks.filter((check) => check.state !== 'not_requested').length,
    safeNextAction: issueCodes.length === 0
      ? 'Keep this current operation package ready for Spine discussion; no runtime activation is claimed.'
      : 'Rerun npm run operation:studio so refreshed local surfaces point at the current operation summary.',
    localOnly: true,
    operatorGuidanceOnly: true
  }
}

function currentOperationCrossProjectCheck({
  operation,
  crossProject,
  operatorIndex,
  expectedPath
}) {
  if (operation.crossProjectIndexed !== true) {
    return {
      surface: 'crossProjectIndex',
      state: 'not_requested',
      expectedPath,
      actualPath: null,
      localOnly: true
    }
  }

  const projectSummary = crossProject?.index?.projectSummaries?.[0]?.currentOperationSummary
  const sourceRef = projectSummary?.sourceRef
  const sourcePathMatches = sourceRef?.path === operatorIndex?.output ||
    sourceRef?.path?.endsWith(`/${operatorIndex?.output}`)
  const fresh = (crossProject?.index?.summary?.currentOperations ?? 0) > 0 &&
    projectSummary?.operationState === operation.operationState &&
    projectSummary?.path === expectedPath &&
    sourcePathMatches &&
    sourceRef?.localOnly !== false

  return {
    surface: 'crossProjectIndex',
    state: fresh ? 'fresh' : 'attention',
    issueCode: fresh ? null : 'crossProjectIndex_current_operation_ref_mismatch',
    expectedPath,
    actualPath: projectSummary?.path ?? null,
    sourcePath: sourceRef?.path ?? null,
    expectedSourcePath: operatorIndex?.output ?? null,
    currentOperations: crossProject?.index?.summary?.currentOperations ?? 0,
    currentOperationReady: crossProject?.index?.summary?.currentOperationReady ?? 0,
    currentOperationAttention: crossProject?.index?.summary?.currentOperationAttention ?? 0,
    localOnly: sourceRef?.localOnly !== false
  }
}

function currentOperationRefCheck({
  surface,
  required,
  ref,
  expectedPath,
  expectedSchema
}) {
  if (!required) {
    return {
      surface,
      state: 'not_requested',
      expectedPath,
      actualPath: ref?.path ?? null,
      localOnly: true
    }
  }

  const pathMatches = ref?.path === expectedPath || ref?.path?.endsWith(`/${expectedPath}`)
  const schemaMatches = ref?.schema === expectedSchema
  const localOnly = ref?.localOnly !== false
  const fresh = pathMatches && schemaMatches && localOnly

  return {
    surface,
    state: fresh ? 'fresh' : 'attention',
    issueCode: fresh ? null : `${surface}_current_operation_ref_mismatch`,
    expectedPath,
    actualPath: ref?.path ?? null,
    expectedSchema,
    actualSchema: ref?.schema ?? null,
    localOnly
  }
}

async function writeCurrentOperationCrossProjectIndex({
  projectDir,
  proof,
  adjacentNeeds,
  operatorIndex,
  createdAt
}) {
  const projectRoot = path.resolve(projectDir)
  const baseDir = path.dirname(projectRoot)
  const rootPath = path.basename(projectRoot)
  const inputListProjectPath = 'records/exports/media-current-operation-cross-project-input-list.local.json'
  const outputProjectPath = 'records/exports/media-current-operation-cross-project-index.local.json'
  const inputListOutput = path.posix.join(rootPath, inputListProjectPath)
  const output = path.posix.join(rootPath, outputProjectPath)
  const projectId = proof.proof.projectId
  const inputList = createCurrentOperationCrossProjectInputList({
    projectId,
    rootPath,
    healthRef: proof.proof.refs.healthRef,
    operatorIndex,
    adjacentNeeds,
    createdAt
  })

  validateRequiredRecord(inputList, artifactKinds.mediaCrossProjectInspectionInputListLocal)
  await writeJsonAtomic(baseDir, inputListOutput, inputList)

  const crossProject = await withQuietConsole(() => writeCrossProjectOperatorIndex({
    baseDir,
    inputList: inputListOutput,
    output
  }))

  return {
    ...crossProject,
    inputList,
    inputListOutput: inputListProjectPath,
    output: outputProjectPath,
    localOnly: true,
    operatorGuidanceOnly: true
  }
}

function createCurrentOperationCrossProjectInputList({
  projectId,
  rootPath,
  healthRef,
  operatorIndex,
  adjacentNeeds,
  createdAt
}) {
  return {
    schema: artifactKinds.mediaCrossProjectInspectionInputListLocal,
    inputListId: `current-operation-${projectId}`,
    createdAt,
    mode: 'standalone-local',
    projects: [
      {
        projectId,
        label: 'Current Studio operation',
        rootRef: {
          kind: 'local-directory',
          id: projectId,
          schema: 'media.local_ref.v1',
          path: rootPath,
          localOnly: true
        },
        artifactRefs: {
          projectHealth: {
            ...healthRef,
            localOnly: true
          },
          operatorPacketIndex: {
            kind: 'media-operator-packet-index',
            id: operatorIndex.index.indexId,
            schema: operatorIndex.index.schema,
            path: operatorIndex.output,
            localOnly: true
          },
          adjacentSeamNeeds: {
            kind: 'media-studio-adjacent-seam-needs-packet',
            id: adjacentNeeds.packet.needsPacketId,
            schema: adjacentNeeds.packet.schema,
            path: adjacentNeeds.output,
            localOnly: true
          }
        }
      }
    ],
    warnings: [
      'Current Studio operation input list is a local explicit project scan.',
      'It does not discover projects, write adjacent repos, call Edge, or activate swarm runtime.'
    ],
    operatorGuidanceOnly: true,
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    providerTruth: false,
    edgeRuntimeBuilt: false,
    edgeRuntimeVerified: false,
    localTruthLabel: 'local draft',
    truthStatus: 'not mesh truth; not distributed proof; not ratified shared state'
  }
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

async function refreshInspectionIfPresent({ projectDir }) {
  const projectRoot = path.resolve(projectDir)
  const manifestPath = path.join(projectRoot, 'records', 'manifests', 'media-local-run-manifest.local.json')

  try {
    await access(manifestPath)
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }

  return withQuietConsole(() => inspectLocalRun({ projectDir }))
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
