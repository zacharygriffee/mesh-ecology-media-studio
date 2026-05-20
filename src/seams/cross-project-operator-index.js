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

  const index = {
    schema: artifactKinds.mediaCrossProjectOperatorIndexLocal,
    indexId: `cross-project-operator-index-${inputListRecord.inputListId}`,
    createdAt: nowIso(),
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
    }
  }

  return {
    index,
    output
  }
}

function formatCrossProjectSummary(index, output) {
  const summary = index.summary
  return [
    `cross-project operator index: projects=${summary.projects}`,
    `ready=${summary.readyForEdgeInspection}`,
    `attention=${summary.needsLocalAttention}`,
    `unknown=${summary.unknownHandoffState}`,
    `missingArtifacts=${summary.missingArtifacts}`,
    `output=${output}`
  ].join(' | ')
}

function attentionRows(projectSummaries) {
  return projectSummaries.filter((project) => (
    project.handoffState !== 'ready-for-edge-inspection' ||
    project.blockingIssues.length > 0 ||
    project.warnings.length > 0
  ))
}

async function summarizeProject(root, projectInput) {
  const projectRoot = path.join(root, projectInput.rootRef.path)
  const refs = {}
  const loaded = {}
  const warnings = []

  for (const [name, ref] of Object.entries(projectInput.artifactRefs)) {
    const record = await readOptionalRecord(projectRoot, ref.path)

    if (!record) {
      warnings.push(`Missing artifact ref: ${name}`)
      continue
    }

    validateRequiredRecord(record, ref.schema)
    refs[name] = localRef(ref.kind, idForRecord(record) ?? ref.id, ref.schema, path.posix.join(projectInput.rootRef.path, ref.path))
    loaded[name] = record
  }

  const health = loaded.projectHealth
  const handoff = loaded.handoffCandidate
  const decisionRequest = loaded.operatorDecisionRequest
  const blockingIssues = health?.blockingIssues ?? []
  const nextActions = Array.from(new Set([
    ...(handoff?.readinessDiagnosis?.nextActions ?? []),
    ...(decisionRequest?.nextActions ?? [])
  ]))

  return {
    projectId: projectInput.projectId,
    label: projectInput.label ?? projectInput.projectId,
    rootRef: projectInput.rootRef,
    refs,
    healthState: health?.healthState ?? 'unknown',
    handoffState: handoff?.handoffState ?? 'unknown',
    requestKind: decisionRequest?.requestKind ?? 'none',
    blockingIssues,
    nextActions,
    warnings,
    operatorGuidanceOnly: true,
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    edgeRuntimeBuilt: false,
    edgeRuntimeVerified: false
  }
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

function summarizeProjects(projectSummaries) {
  const needsLocalAttention = projectSummaries.filter((project) => project.handoffState === 'needs-local-attention').length
  const readyForEdgeInspection = projectSummaries.filter((project) => project.handoffState === 'ready-for-edge-inspection').length
  const missingArtifacts = projectSummaries.reduce((sum, project) => sum + project.warnings.length, 0)

  return {
    projects: projectSummaries.length,
    readyForEdgeInspection,
    needsLocalAttention,
    unknownHandoffState: projectSummaries.length - readyForEdgeInspection - needsLocalAttention,
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
    record.packetId ??
    record.bundleId
}

if (process.argv[1] === modulePath) {
  await writeCrossProjectOperatorIndex(parseArgs(process.argv.slice(2)))
}
