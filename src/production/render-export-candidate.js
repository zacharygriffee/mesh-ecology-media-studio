import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { artifactKinds } from '../contracts/artifact-kinds.js'
import { makeRef, nowIso } from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import { assertSafeLocalPath } from '../local/project-layout.js'
import { readProjectRecords } from '../seams/project-status.js'

const modulePath = fileURLToPath(import.meta.url)
const defaultProjectDir = 'examples/venice-smoke'
const defaultRoughCut = 'records/production/media-rough-cut-capsule.local.json'
const defaultOutput = 'records/production/media-render-export-candidate.local.json'
const truthStatus = 'not mesh truth; not distributed proof; not ratified shared state'

function parseArgs(argv) {
  const args = {
    projectDir: defaultProjectDir,
    roughCut: defaultRoughCut,
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
    } else if (arg === '--rough-cut') {
      args.roughCut = next
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

export async function writeRenderExportCandidate({
  projectDir = defaultProjectDir,
  roughCut = defaultRoughCut,
  output = defaultOutput,
  print = false,
  quiet = false,
  createdAt = nowIso()
} = {}) {
  assertSafeLocalPath(roughCut)
  assertSafeLocalPath(output)

  const root = path.resolve(projectDir)
  const roughCutRecord = JSON.parse(await readFile(path.join(root, roughCut), 'utf8'))
  validateRequiredRecord(roughCutRecord, artifactKinds.mediaRoughCutCapsuleLocal)

  const records = await readProjectRecords(root)
  const candidate = createRenderExportCandidate({
    roughCut: roughCutRecord,
    roughCutPath: roughCut,
    records,
    createdAt
  })

  const outputPath = path.join(root, output)
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(candidate, null, 2)}\n`)

  if (print) {
    console.log(JSON.stringify(candidate, null, 2))
  } else if (!quiet) {
    console.log(formatRenderExportCandidateSummary(candidate, output))
    console.log(`nextAction: ${candidate.nextActions[0]}`)
    console.log('nonClaims: local-only; candidate only; no render performed; no export output; no approval authority; productionReady=false')
  }

  return {
    candidate,
    output
  }
}

export function createRenderExportCandidate({
  roughCut,
  roughCutPath = defaultRoughCut,
  records,
  createdAt = nowIso()
}) {
  const reviewDecisionEntry = latestRoughCutDecisionEntry(records, roughCut.roughCutId)
  const reviewDecision = reviewDecisionEntry?.record

  if (reviewDecision?.decisionType !== 'review_rough_cut') {
    const state = reviewDecision?.decisionType ?? 'missing'
    throw new Error(`Reviewed rough-cut decision required before creating a render/export candidate; latest rough-cut decision is ${state}`)
  }

  const sourceRoughCutRef = localRecordRef('media-rough-cut-capsule', roughCut.roughCutId, roughCut.schema, roughCutPath)
  const reviewDecisionRef = localRecordRef(
    'media-operator-decision',
    reviewDecision.decisionId,
    reviewDecision.schema,
    reviewDecisionEntry.path
  )
  const orderedItemRefs = (roughCut.orderedItems ?? []).map((item) => ({
    kind: 'media-rough-cut-item',
    id: item.itemId,
    schema: 'media.rough_cut_item.local.v1',
    order: item.order,
    acceptedAssetRef: item.acceptedAssetRef ?? null,
    productionAssetCapsuleRef: item.productionAssetCapsuleRef ?? null,
    localRef: item.localRef ?? null,
    localOnly: true
  }))
  const sourceRefs = compactRefs([
    sourceRoughCutRef,
    reviewDecisionRef,
    ...(roughCut.sourceRefs ?? [])
  ])

  const candidate = {
    schema: artifactKinds.mediaRenderExportCandidateLocal,
    candidateId: `render-export-candidate-${stableId([
      roughCut.projectId,
      roughCut.roughCutId,
      reviewDecision.decisionId,
      ...orderedItemRefs.map((item) => `${item.order}:${item.id}`)
    ].join('|'))}`,
    projectId: roughCut.projectId,
    mode: 'standalone-local',
    candidateKind: 'rough-cut-render-export-candidate',
    sourceRoughCutRef,
    reviewDecisionRef,
    orderedItemRefs,
    reviewPosture: {
      reviewed: true,
      decisionType: reviewDecision.decisionType,
      decisionId: reviewDecision.decisionId,
      requestChanges: false,
      deferred: false,
      localOnly: true,
      operatorGuidanceOnly: true
    },
    renderPosture: {
      renderIntent: 'local-review-render-candidate',
      rendererRequired: true,
      rendererSelected: false,
      renderPerformed: false,
      renderEngine: null,
      renderedOutputRef: null,
      localOnly: true,
      operatorGuidanceOnly: true
    },
    exportPosture: {
      exportIntent: 'local-review-export-candidate',
      exportFormat: null,
      exportPerformed: false,
      exportOutputRef: null,
      publicationAuthorization: false,
      localOnly: true,
      operatorGuidanceOnly: true
    },
    sourceRefs,
    nextActions: [
      'Choose a renderer/export adapter in a future lane before producing bytes.',
      'Keep authority, publication, and mesh publication separate from render/export preparation.'
    ],
    notes: [
      'This record identifies a reviewed rough cut as eligible for a future render/export operation candidate.',
      'It does not render media, create an export file, publish media, call Edge, or grant authority.'
    ],
    candidateOnly: true,
    operatorGuidanceOnly: true,
    productionReady: false,
    approvalAuthority: false,
    ratifierAuthority: false,
    publicationAuthorization: false,
    providerTruth: false,
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
    localTruthLabel: 'local render/export candidate',
    truthStatus,
    createdAt
  }

  validateRequiredRecord(candidate)
  return candidate
}

export function formatRenderExportCandidateSummary(candidate, output = defaultOutput) {
  return [
    `render/export candidate: project=${candidate.projectId}`,
    `roughCut=${candidate.sourceRoughCutRef.id}`,
    `items=${candidate.orderedItemRefs.length}`,
    `reviewed=${candidate.reviewPosture.reviewed}`,
    `renderPerformed=${candidate.renderPosture.renderPerformed}`,
    `exportPerformed=${candidate.exportPosture.exportPerformed}`,
    `productionReady=${candidate.productionReady}`,
    `output=${output}`
  ].join(' | ')
}

function latestRoughCutDecisionEntry(records, roughCutId) {
  return records
    .filter((entry) => entry.record.schema === artifactKinds.mediaOperatorDecision)
    .filter((entry) => entry.record.roughCutReview && entry.record.subjectRef?.id === roughCutId)
    .sort(compareRecordCreatedAt)[0]
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

function compareRecordCreatedAt(left, right) {
  const rightTime = Date.parse(right.record?.createdAt ?? '') || 0
  const leftTime = Date.parse(left.record?.createdAt ?? '') || 0
  if (rightTime !== leftTime) return rightTime - leftTime
  return left.path.localeCompare(right.path)
}

function stableId(seed) {
  return createHash('sha256').update(seed).digest('hex').slice(0, 24)
}

if (process.argv[1] === modulePath) {
  await writeRenderExportCandidate(parseArgs(process.argv.slice(2)))
}
