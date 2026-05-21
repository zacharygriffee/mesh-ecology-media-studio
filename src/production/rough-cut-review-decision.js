import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { artifactKinds } from '../contracts/artifact-kinds.js'
import { makeRef, nowIso } from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import { assertSafeLocalPath } from '../local/project-layout.js'

const modulePath = fileURLToPath(import.meta.url)
const defaultProjectDir = 'examples/venice-smoke'
const defaultRoughCut = 'records/production/media-rough-cut-capsule.local.json'
const defaultOutput = 'records/decisions/media-rough-cut-review-decision.local.json'
const truthStatus = 'not mesh truth; not distributed proof; not ratified shared state'

function parseArgs(argv) {
  const args = {
    projectDir: defaultProjectDir,
    roughCut: defaultRoughCut,
    decision: 'review_rough_cut',
    operatorRef: 'local-operator',
    reason: undefined,
    output: defaultOutput,
    print: false
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
    } else if (arg === '--decision') {
      args.decision = next
      i += 1
    } else if (arg === '--operator-ref') {
      args.operatorRef = next
      i += 1
    } else if (arg === '--reason') {
      args.reason = next
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

export async function writeRoughCutReviewDecision({
  projectDir = defaultProjectDir,
  roughCut = defaultRoughCut,
  decision = 'review_rough_cut',
  operatorRef = 'local-operator',
  reason,
  output = defaultOutput,
  print = false,
  createdAt = nowIso()
} = {}) {
  assertSafeLocalPath(roughCut)
  assertSafeLocalPath(output)

  const root = path.resolve(projectDir)
  const roughCutRecord = JSON.parse(await readFile(path.join(root, roughCut), 'utf8'))
  validateRequiredRecord(roughCutRecord, artifactKinds.mediaRoughCutCapsuleLocal)

  const operatorDecision = createRoughCutReviewDecision({
    roughCut: roughCutRecord,
    roughCutPath: roughCut,
    decision,
    operatorRef,
    reason,
    createdAt
  })

  const outputPath = path.join(root, output)
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(operatorDecision, null, 2)}\n`)

  if (print) {
    console.log(JSON.stringify(operatorDecision, null, 2))
  } else {
    console.log(formatRoughCutReviewDecisionSummary(operatorDecision, output))
    console.log(`nextAction: ${operatorDecision.nextAction}`)
    console.log('nonClaims: local-only; review only; no render/export; no approval authority; no publication authorization; productionReady=false')
  }

  return {
    decision: operatorDecision,
    output
  }
}

export function createRoughCutReviewDecision({
  roughCut,
  roughCutPath = defaultRoughCut,
  decision = 'review_rough_cut',
  operatorRef = 'local-operator',
  reason,
  createdAt = nowIso()
}) {
  if (!['review_rough_cut', 'request_changes', 'defer'].includes(decision)) {
    throw new Error(`Unsupported rough-cut local review decision: ${decision}`)
  }

  const reviewed = decision === 'review_rough_cut'
  const requestChanges = decision === 'request_changes'
  const deferred = decision === 'defer'
  const sourceRefs = compactRefs([
    {
      ...makeRef('media-rough-cut-capsule', roughCut.roughCutId, roughCut.schema),
      path: roughCutPath,
      localOnly: true
    },
    ...(roughCut.sourceRefs ?? [])
  ])

  const operatorDecision = {
    schema: artifactKinds.mediaOperatorDecision,
    decisionId: `decision-rough-cut-${roughCut.roughCutId}-${decision}`,
    projectId: roughCut.projectId,
    subjectRef: makeRef('media-rough-cut-capsule', roughCut.roughCutId, roughCut.schema),
    decisionType: decision,
    operatorRef,
    reason: reason ?? roughCutReviewReason(decision),
    evidenceRefs: sourceRefs,
    sourceRoughCutRef: sourceRefs[0],
    roughCutReview: {
      roughCutId: roughCut.roughCutId,
      roughCutKind: roughCut.roughCutKind,
      itemCount: roughCut.orderedItems?.length ?? 0,
      assemblyState: roughCut.assemblyPosture?.state ?? 'unknown',
      rendered: roughCut.renderPosture?.rendered === true,
      productionReady: false,
      reviewAcknowledged: reviewed,
      requestChanges,
      deferred,
      localOnly: true,
      operatorGuidanceOnly: true
    },
    reviewAcknowledged: reviewed,
    requestChanges,
    deferred,
    nextAction: roughCutReviewNextAction(decision),
    localDecisionOnly: true,
    operatorGuidanceOnly: true,
    executionPerformed: false,
    authorityGranted: false,
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
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    localTruthLabel: 'local decision',
    truthStatus,
    createdAt
  }

  validateRequiredRecord(operatorDecision)
  return operatorDecision
}

export function formatRoughCutReviewDecisionSummary(decision, output = defaultOutput) {
  return [
    `rough cut review decision: ${decision.decisionType}`,
    `subject=${decision.subjectRef.id}`,
    `items=${decision.roughCutReview.itemCount}`,
    `rendered=${decision.roughCutReview.rendered}`,
    `productionReady=${decision.roughCutReview.productionReady}`,
    `authorityGranted=${decision.authorityGranted}`,
    `output=${output}`
  ].join(' | ')
}

function roughCutReviewReason(decision) {
  if (decision === 'review_rough_cut') return 'Operator locally reviewed the rough-cut capsule ordering for inspection only.'
  if (decision === 'request_changes') return 'Operator locally requested changes to the rough-cut capsule ordering.'
  return 'Operator deferred local rough-cut capsule review.'
}

function roughCutReviewNextAction(decision) {
  if (decision === 'review_rough_cut') {
    return 'Keep the rough cut in local reviewed posture; rendering, export, publication, and authority remain separate future steps.'
  }

  if (decision === 'request_changes') {
    return 'Regenerate the rough-cut capsule after local production item ordering changes.'
  }

  return 'Leave the rough-cut capsule deferred; no render, export, or authority was granted.'
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

if (process.argv[1] === modulePath) {
  await writeRoughCutReviewDecision(parseArgs(process.argv.slice(2)))
}
