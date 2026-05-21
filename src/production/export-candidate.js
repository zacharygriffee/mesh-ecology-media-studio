import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { artifactKinds } from '../contracts/artifact-kinds.js'
import { makeRef, nowIso } from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import { assertSafeLocalPath } from '../local/project-layout.js'
import { readProjectRecords } from '../seams/project-status.js'
import { summarizeRenderReceipts } from './render-receipts.js'

const modulePath = fileURLToPath(import.meta.url)
const defaultProjectDir = 'examples/venice-smoke'
const defaultRoughCut = 'records/production/media-rough-cut-capsule.local.json'
const defaultOutput = 'records/production/media-export-candidate.local.json'
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

export async function writeExportCandidate({
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
  const candidate = createExportCandidate({
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
    console.log(formatExportCandidateSummary(candidate, output))
    console.log(`nextAction: ${candidate.nextActions[0]}`)
    console.log('nonClaims: local-only; candidate only; no export performed; no delivery created; no publication authorization; productionReady=false')
  }

  return {
    candidate,
    output
  }
}

export function createExportCandidate({
  roughCut,
  roughCutPath = defaultRoughCut,
  records,
  createdAt = nowIso()
}) {
  const reviewDecisionEntry = latestRoughCutDecisionEntry(records, roughCut.roughCutId)
  const reviewDecision = reviewDecisionEntry?.record
  if (reviewDecision?.decisionType !== 'review_rough_cut') {
    const state = reviewDecision?.decisionType ?? 'missing'
    throw new Error(`Reviewed rough-cut decision required before creating an export candidate; latest rough-cut decision is ${state}`)
  }

  const sourceRoughCutRef = localRecordRef('media-rough-cut-capsule', roughCut.roughCutId, roughCut.schema, roughCutPath)
  const reviewDecisionRef = localRecordRef('media-operator-decision', reviewDecision.decisionId, reviewDecision.schema, reviewDecisionEntry.path)
  const renderReceipt = summarizeRenderReceipts(records).rows
    .filter((row) => row.sourceRoughCutRef?.id === roughCut.roughCutId)
    .filter((row) => row.freshnessState === 'fresh')
    .at(0)
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
    renderReceipt?.receiptRef,
    renderReceipt?.sourceRenderExportCandidateRef,
    renderReceipt?.sourceRenderPlanRef,
    ...(roughCut.sourceRefs ?? [])
  ])

  const candidate = {
    schema: artifactKinds.mediaExportCandidateLocal,
    exportCandidateId: `export-candidate-${stableId([
      roughCut.projectId,
      roughCut.roughCutId,
      reviewDecision.decisionId,
      renderReceipt?.renderReceiptId ?? 'no-render-receipt',
      ...orderedItemRefs.map((item) => `${item.order}:${item.id}`)
    ].join('|'))}`,
    projectId: roughCut.projectId,
    mode: 'standalone-local',
    candidateKind: 'reviewed-rough-cut-export-candidate',
    sourceRoughCutRef,
    reviewDecisionRef,
    sourceRenderReceiptRef: renderReceipt?.receiptRef ?? null,
    sourceRenderExportCandidateRef: renderReceipt?.sourceRenderExportCandidateRef ?? null,
    sourceRenderPlanRef: renderReceipt?.sourceRenderPlanRef ?? null,
    orderedItemRefs,
    reviewPosture: {
      reviewed: true,
      decisionType: reviewDecision.decisionType,
      decisionId: reviewDecision.decisionId,
      localOnly: true,
      operatorGuidanceOnly: true
    },
    renderReceiptPosture: {
      present: Boolean(renderReceipt),
      freshnessState: renderReceipt?.freshnessState ?? 'missing',
      renderPerformed: renderReceipt?.renderPerformed === true,
      exportPerformed: false,
      productionReady: false,
      localPreviewEvidenceOnly: true,
      localOnly: true,
      operatorGuidanceOnly: true
    },
    targetExport: {
      formatId: 'local-review-package',
      formatSelected: false,
      deliveryClass: 'local-export-candidate',
      outputPath: 'media/exports/delivery-candidates',
      packageCreated: false,
      publicationTarget: null,
      localOnly: true
    },
    exportPosture: {
      exportIntent: 'local-review-delivery-candidate',
      exportPlanned: true,
      exportPerformed: false,
      deliveryCreated: false,
      publicationAuthorization: false,
      localOnly: true,
      operatorGuidanceOnly: true
    },
    sourceRefs,
    nextActions: [
      'Create a dry-run export plan to resolve refs and intended output placement only.',
      'Do not create export bytes or publish without a future authority lane.'
    ],
    notes: [
      'This record identifies a reviewed rough cut as a candidate for future export planning.',
      'It does not create export bytes, delivery packages, publication targets, or authority.'
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
    localTruthLabel: 'local export candidate',
    truthStatus,
    createdAt
  }

  validateRequiredRecord(candidate)
  return candidate
}

export function formatExportCandidateSummary(candidate, output = defaultOutput) {
  return [
    `export candidate: project=${candidate.projectId}`,
    `roughCut=${candidate.sourceRoughCutRef.id}`,
    `items=${candidate.orderedItemRefs.length}`,
    `renderReceipt=${candidate.sourceRenderReceiptRef?.id ?? 'none'}`,
    `exportPerformed=${candidate.exportPerformed}`,
    `productionReady=${candidate.productionReady}`,
    `output=${output}`
  ].join(' | ')
}

function latestRoughCutDecisionEntry(records, roughCutId) {
  return records
    .filter((entry) => entry.record.schema === artifactKinds.mediaOperatorDecision)
    .filter((entry) => entry.record.roughCutReview && entry.record.subjectRef?.id === roughCutId)
    .sort((left, right) => {
      const rightTime = Date.parse(right.record.createdAt ?? '') || 0
      const leftTime = Date.parse(left.record.createdAt ?? '') || 0
      if (rightTime !== leftTime) return rightTime - leftTime
      return left.path.localeCompare(right.path)
    })[0]
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
  await writeExportCandidate(parseArgs(process.argv.slice(2)))
}
