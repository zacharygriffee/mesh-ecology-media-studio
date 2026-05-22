import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { artifactKinds } from '../contracts/artifact-kinds.js'
import { makeRef, nowIso } from '../contracts/constructors.js'
import { createMediaOperationCandidate } from '../contracts/operation-candidates.js'
import { resolveMediaOperationCandidate } from '../contracts/rule-resolution.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import { assertSafeLocalPath } from '../local/project-layout.js'
import { writeJsonAtomic } from '../local/atomic-json.js'
import { readProjectRecords } from '../seams/project-status.js'
import { evaluateRenderExportCandidateFreshness } from './render-export-candidate.js'

const modulePath = fileURLToPath(import.meta.url)
const defaultProjectDir = 'examples/venice-smoke'
const defaultCandidate = 'records/production/media-render-export-candidate.local.json'
const defaultOutputDir = 'records/rule-traces'

function parseArgs(argv) {
  const args = {
    projectDir: defaultProjectDir,
    candidate: defaultCandidate,
    outputDir: defaultOutputDir,
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
    } else if (arg === '--output-dir') {
      args.outputDir = next
      i += 1
    } else if (arg === '--print') {
      args.print = true
    } else if (arg === '--quiet') {
      args.quiet = true
    }
  }

  return args
}

export async function writeRenderExportMediation({
  projectDir = defaultProjectDir,
  candidate = defaultCandidate,
  outputDir = defaultOutputDir,
  print = false,
  quiet = false,
  createdAt = nowIso()
} = {}) {
  assertSafeLocalPath(candidate)
  assertSafeLocalPath(outputDir)

  const root = path.resolve(projectDir)
  const candidateRecord = JSON.parse(await readFile(path.join(root, candidate), 'utf8'))
  validateRequiredRecord(candidateRecord, artifactKinds.mediaRenderExportCandidateLocal)
  const records = await readProjectRecords(root)
  const operationCandidate = createRenderExportOperationCandidate({
    renderExportCandidate: candidateRecord,
    candidatePath: candidate,
    records,
    createdAt
  })
  const trace = resolveMediaOperationCandidate(operationCandidate, { createdAt })

  const operationOutput = path.join(outputDir, `${operationCandidate.operationId}.local.json`)
  const traceOutput = path.join(outputDir, `${trace.traceId}.local.json`)
  await writeJsonAtomic(root, operationOutput, operationCandidate)
  await writeJsonAtomic(root, traceOutput, trace)

  if (print) {
    console.log(JSON.stringify({ operationCandidate, trace }, null, 2))
  } else if (!quiet) {
    console.log(formatRenderExportMediationSummary({ operationCandidate, trace, outputDir }))
    console.log('nonClaims: local-only; mediation only; no render execution; no export output; no authority; productionReady=false')
  }

  return {
    operationCandidate,
    trace,
    operationOutput,
    traceOutput
  }
}

export function createRenderExportOperationCandidate({
  renderExportCandidate,
  candidatePath = defaultCandidate,
  records = [],
  createdAt = nowIso()
}) {
  const freshness = evaluateRenderExportCandidateFreshness({ candidate: renderExportCandidate, records })
  const subjectRef = {
    ...makeRef('media-render-export-candidate', renderExportCandidate.candidateId, renderExportCandidate.schema),
    path: candidatePath,
    localOnly: true
  }
  return createMediaOperationCandidate({
    operationId: `operation-render-export-preparation-${stableId([
      renderExportCandidate.projectId,
      renderExportCandidate.candidateId,
      freshness.state
    ].join('|'))}`,
    projectId: renderExportCandidate.projectId,
    artifactClass: 'media.export',
    operationClass: 'prepare_render_export',
    subjectRef,
    scopeDelta: 'export_artifact',
    riskTier: 'medium',
    reversibility: 'partially_reversible',
    authorityBoundary: 'operator_boundary',
    evidenceRequirement: 'operator_decision_required',
    requestedBy: 'local-operator',
    sourceRefs: compactRefs([
      subjectRef,
      renderExportCandidate.sourceRoughCutRef,
      renderExportCandidate.reviewDecisionRef,
      ...(renderExportCandidate.sourceRefs ?? [])
    ]),
    createdAt
  })
}

export function formatRenderExportMediationSummary({ operationCandidate, trace, outputDir = defaultOutputDir }) {
  return [
    `render/export mediation: project=${operationCandidate.projectId}`,
    `operation=${operationCandidate.operationId}`,
    `resolution=${trace.resolutionMode}`,
    `delivery=${trace.deliveryMode}`,
    `renderPerformed=false`,
    `exportPerformed=false`,
    `productionReady=false`,
    `output=${outputDir}`
  ].join(' | ')
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
  await writeRenderExportMediation(parseArgs(process.argv.slice(2)))
}
