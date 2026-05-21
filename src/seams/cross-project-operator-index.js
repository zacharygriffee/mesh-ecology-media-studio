import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { artifactKinds } from '../contracts/artifact-kinds.js'
import { makeRef, nowIso } from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import { assertSafeLocalPath } from '../local/project-layout.js'

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
    console.log(formatCrossProjectSummary(index, output))
    for (const project of attentionRows(index.projectSummaries)) {
      console.log(`attention: ${project.label} | handoff=${project.handoffState} | blockers=${project.blockingIssues.length} | warnings=${project.warnings.length}`)
      if (project.providerLoopStatus?.needsOperatorAttention) {
        console.log(`  provider-loop: ${project.providerLoopStatus.providerId}:${project.providerLoopStatus.loopKind} | state=${project.providerLoopStatus.state} | failedStep=${project.providerLoopStatus.failedStep ?? 'none'} | nextAction=${project.providerLoopStatus.nextAction}`)
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
    `missingArtifacts=${summary.missingArtifacts}`,
    `output=${output}`
  ].join(' | ')
}

function attentionRows(projectSummaries) {
  return projectSummaries.filter((project) => (
    project.handoffState !== 'ready-for-edge-inspection' ||
    project.providerLoopStatus?.needsOperatorAttention === true ||
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
  const providerLoopStatus = loaded.providerLoopStatus
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
    blockingIssues,
    nextActions,
    warnings,
    missingArtifactRefs,
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

  return summary
}

async function readOptionalRecord(projectRoot, relativePath) {
  assertSafeLocalPath(relativePath)

  try {
    return JSON.parse(await readFile(path.join(projectRoot, relativePath), 'utf8'))
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    return null
  }
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

  if (name === 'providerLoopStatus') {
    return 'Run npm run provider:venice:loop or inspect the provider loop output for the project.'
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
  return {
    ref,
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

function summarizeProjects(projectSummaries) {
  const needsLocalAttention = projectSummaries.filter((project) => project.handoffState === 'needs-local-attention').length
  const readyForEdgeInspection = projectSummaries.filter((project) => project.handoffState === 'ready-for-edge-inspection').length
  const missingArtifacts = projectSummaries.reduce((sum, project) => sum + project.warnings.length, 0)
  const providerLoopStatuses = projectSummaries.filter((project) => project.providerLoopStatus).length
  const providerLoopsWithAttention = projectSummaries.filter((project) => project.providerLoopStatus?.needsOperatorAttention).length
  const attentionRows = projectSummaries.filter((project) => (
    project.handoffState === 'needs-local-attention' ||
    project.providerLoopStatus?.needsOperatorAttention === true ||
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
    record.indexId ??
    record.statusId ??
    record.packetId ??
    record.bundleId
}

if (process.argv[1] === modulePath) {
  await writeCrossProjectOperatorIndex(parseArgs(process.argv.slice(2)))
}
