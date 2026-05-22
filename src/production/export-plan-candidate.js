import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { artifactKinds } from '../contracts/artifact-kinds.js'
import { makeRef, nowIso } from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import { assertSafeLocalPath } from '../local/project-layout.js'
import { writeJsonAtomic } from '../local/atomic-json.js'

const modulePath = fileURLToPath(import.meta.url)
const defaultProjectDir = 'examples/venice-smoke'
const defaultCandidate = 'records/production/media-export-candidate.local.json'
const defaultOutput = 'records/production/media-export-plan-candidate.local.json'
const truthStatus = 'not mesh truth; not distributed proof; not ratified shared state'

function parseArgs(argv) {
  const args = {
    projectDir: defaultProjectDir,
    candidate: defaultCandidate,
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
    } else if (arg === '--candidate') {
      args.candidate = next
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

export async function writeExportPlanCandidate({
  projectDir = defaultProjectDir,
  candidate = defaultCandidate,
  output = defaultOutput,
  print = false,
  quiet = false,
  createdAt = nowIso()
} = {}) {
  assertSafeLocalPath(candidate)
  assertSafeLocalPath(output)

  const root = path.resolve(projectDir)
  const exportCandidate = JSON.parse(await readFile(path.join(root, candidate), 'utf8'))
  validateRequiredRecord(exportCandidate, artifactKinds.mediaExportCandidateLocal)
  const plan = createExportPlanCandidate({
    exportCandidate,
    candidatePath: candidate,
    createdAt
  })

  await writeJsonAtomic(root, output, plan)

  if (print) {
    console.log(JSON.stringify(plan, null, 2))
  } else if (!quiet) {
    console.log(formatExportPlanSummary(plan, output))
    console.log('nonClaims: local-only dry-run export plan; no media bytes read; no export output; no publication authorization; productionReady=false')
  }

  return {
    plan,
    output
  }
}

export function createExportPlanCandidate({
  exportCandidate,
  candidatePath = defaultCandidate,
  createdAt = nowIso()
}) {
  if (exportCandidate.exportPerformed || exportCandidate.productionReady) {
    throw new Error('Export plan expects a candidate without export completion or production readiness')
  }

  const sourceExportCandidateRef = localRecordRef(
    'media-export-candidate',
    exportCandidate.exportCandidateId,
    exportCandidate.schema,
    candidatePath
  )
  const targetPath = `${exportCandidate.targetExport.outputPath}/${exportCandidate.exportCandidateId}`
  assertSafeLocalPath(targetPath)
  const sourceRefs = compactRefs([
    sourceExportCandidateRef,
    exportCandidate.sourceRoughCutRef,
    exportCandidate.reviewDecisionRef,
    exportCandidate.sourceRenderReceiptRef,
    exportCandidate.sourceRenderPlanRef,
    exportCandidate.sourceRenderExportCandidateRef,
    ...(exportCandidate.sourceRefs ?? [])
  ])

  const plan = {
    schema: artifactKinds.mediaExportPlanCandidateLocal,
    planId: `export-plan-candidate-${stableId([
      exportCandidate.projectId,
      exportCandidate.exportCandidateId,
      targetPath
    ].join('|'))}`,
    projectId: exportCandidate.projectId,
    mode: 'standalone-local',
    planKind: 'dry-run-export-plan-candidate',
    sourceExportCandidateRef,
    sourceRoughCutRef: exportCandidate.sourceRoughCutRef,
    reviewDecisionRef: exportCandidate.reviewDecisionRef,
    sourceRenderReceiptRef: exportCandidate.sourceRenderReceiptRef,
    orderedItems: exportCandidate.orderedItemRefs,
    targetOutputRef: {
      kind: 'local-export-output-candidate',
      id: `local-export-output:${exportCandidate.exportCandidateId}`,
      schema: 'media.local_ref.v1',
      path: targetPath,
      materialized: false,
      localOnly: true
    },
    planPosture: {
      refsResolved: true,
      targetOutputPathResolved: true,
      mediaBytesRead: false,
      outputBytesCreated: false,
      exportPerformed: false,
      deliveryCreated: false,
      publicationAuthorization: false,
      productionReady: false,
      localOnly: true,
      operatorGuidanceOnly: true
    },
    sourceRefs,
    nextActions: [
      'Choose an explicit export execution lane later if local delivery bytes should be created.',
      'Keep publication authorization and production readiness outside this dry-run plan.'
    ],
    createdAt,
    operatorGuidanceOnly: true,
    candidateOnly: true,
    productionReady: false,
    approvalAuthority: false,
    ratifierAuthority: false,
    publicationAuthorization: false,
    byteAvailabilityProof: false,
    materializationProof: false,
    resourceAdmission: false,
    causalTruth: false,
    edgeCalled: false,
    meshPublished: false,
    renderPerformed: false,
    exportPerformed: false,
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    localTruthLabel: 'local dry-run export plan candidate',
    truthStatus
  }

  validateRequiredRecord(plan)
  return plan
}

export function formatExportPlanSummary(plan, output = defaultOutput) {
  return [
    `export plan candidate: project=${plan.projectId}`,
    `exportCandidate=${plan.sourceExportCandidateRef.id}`,
    `items=${plan.orderedItems.length}`,
    `target=${plan.targetOutputRef.path}`,
    `bytesRead=${plan.planPosture.mediaBytesRead}`,
    `exportPerformed=${plan.exportPerformed}`,
    `productionReady=${plan.productionReady}`,
    `output=${output}`
  ].join(' | ')
}

function localRecordRef(kind, id, schema, relativePath) {
  return {
    ...makeRef(kind, id, schema),
    path: relativePath,
    localOnly: true
  }
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

function stableId(seed) {
  return createHash('sha256').update(seed).digest('hex').slice(0, 24)
}

if (process.argv[1] === modulePath) {
  await writeExportPlanCandidate(parseArgs(process.argv.slice(2)))
}
