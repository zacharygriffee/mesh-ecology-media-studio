import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { artifactKinds } from '../contracts/artifact-kinds.js'
import { makeRef, nowIso } from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import { assertSafeLocalPath } from '../local/project-layout.js'
import { writeJsonAtomic } from '../local/atomic-json.js'
import { readProjectRecords } from '../seams/project-status.js'
import { createProductionAuthorityPrerequisiteReport } from './authority-prerequisites.js'
import { createRoughCutCapsuleFromRecords } from './rough-cut-capsule.js'

const modulePath = fileURLToPath(import.meta.url)
const defaultProjectDir = 'examples/venice-smoke'
const defaultOutput = 'records/production/media-rough-cut-capsule.local.json'

function parseArgs(argv) {
  const args = {
    projectDir: defaultProjectDir,
    output: defaultOutput,
    reason: undefined,
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
    } else if (arg === '--reason') {
      args.reason = next
      i += 1
    } else if (arg === '--print') {
      args.print = true
    } else if (arg === '--quiet') {
      args.quiet = true
    }
  }

  return args
}

export async function writeRoughCutRevision({
  projectDir = defaultProjectDir,
  output = defaultOutput,
  reason,
  print = false,
  quiet = false,
  createdAt = nowIso()
} = {}) {
  assertSafeLocalPath(output)

  const root = path.resolve(projectDir)
  const records = await readProjectRecords(root)
  const requestChangesEntry = latestRoughCutRequestChanges(records)
  if (!requestChangesEntry) {
    throw new Error('Cannot revise rough cut: no local request_changes rough-cut decision found.')
  }

  const previousRoughCutEntry = findRoughCutEntry(records, requestChangesEntry.record.subjectRef?.id)
  if (!previousRoughCutEntry) {
    throw new Error(`Cannot revise rough cut: source rough cut ${requestChangesEntry.record.subjectRef?.id ?? 'unknown'} was not found.`)
  }

  const prerequisiteReport = await createProductionAuthorityPrerequisiteReport({ projectDir })
  const roughCut = createRoughCutRevisionFromRecords({
    records,
    prerequisiteReport,
    previousRoughCutEntry,
    requestChangesEntry,
    reason,
    createdAt
  })

  await writeJsonAtomic(root, output, roughCut)

  if (print) {
    console.log(JSON.stringify(roughCut, null, 2))
  } else if (!quiet) {
    console.log(formatRoughCutRevisionSummary(roughCut, output))
    console.log(`nextAction: ${roughCut.nextActions[0]}`)
    console.log('nonClaims: local-only; revision only; no render/export; no approval authority; no publication authorization; productionReady=false')
  }

  return {
    roughCut,
    output
  }
}

export function createRoughCutRevisionFromRecords({
  records,
  prerequisiteReport,
  previousRoughCutEntry,
  requestChangesEntry,
  reason,
  createdAt = nowIso()
}) {
  const roughCut = createRoughCutCapsuleFromRecords({
    records,
    prerequisiteReport,
    createdAt
  })
  const previousRoughCut = previousRoughCutEntry.record
  const requestChanges = requestChangesEntry.record
  const revisionSeed = [
    roughCut.roughCutId,
    previousRoughCut.roughCutId,
    requestChanges.decisionId,
    reason ?? requestChanges.reason ?? ''
  ].join('|')

  roughCut.roughCutId = `rough-cut-capsule-${stableId(revisionSeed)}`
  roughCut.revisionPosture = {
    revisionOfRef: localRecordRef('media-rough-cut-capsule', previousRoughCut.roughCutId, previousRoughCut.schema, previousRoughCutEntry.path),
    sourceChangeRequestRef: localRecordRef('media-operator-decision', requestChanges.decisionId, requestChanges.schema, requestChangesEntry.path),
    revisionReason: reason ?? requestChanges.reason ?? 'Local request_changes decision addressed by regenerating the rough-cut capsule.',
    addressedDecisionType: requestChanges.decisionType,
    changesAddressedLocally: true,
    rendered: false,
    productionReady: false,
    approvalAuthority: false,
    publicationAuthorization: false,
    localOnly: true,
    operatorGuidanceOnly: true
  }
  roughCut.sourceRefs = compactRefs([
    roughCut.revisionPosture.revisionOfRef,
    roughCut.revisionPosture.sourceChangeRequestRef,
    ...(roughCut.sourceRefs ?? [])
  ])
  roughCut.nextActions = [
    'Review the revised rough-cut capsule locally; rendering, export, publication, and authority remain separate future steps.',
    'Route approval through the proper authority lane only after local review posture is settled.'
  ]
  roughCut.notes = [
    ...(roughCut.notes ?? []),
    'This revision addresses a local request_changes decision by regenerating rough-cut refs only; it is not an edit render.'
  ]

  validateRequiredRecord(roughCut)
  return roughCut
}

export function formatRoughCutRevisionSummary(roughCut, output = defaultOutput) {
  return [
    `rough cut revision: project=${roughCut.projectId}`,
    `revisionOf=${roughCut.revisionPosture.revisionOfRef.id}`,
    `changeRequest=${roughCut.revisionPosture.sourceChangeRequestRef.id}`,
    `items=${roughCut.orderedItems.length}`,
    `rendered=${roughCut.renderPosture.rendered}`,
    `productionReady=${roughCut.productionReady}`,
    `output=${output}`
  ].join(' | ')
}

function latestRoughCutRequestChanges(records) {
  return records
    .filter((entry) => entry.record.schema === artifactKinds.mediaOperatorDecision)
    .filter((entry) => entry.record.roughCutReview)
    .filter((entry) => entry.record.decisionType === 'request_changes')
    .sort(compareRecordCreatedAt)[0]
}

function findRoughCutEntry(records, roughCutId) {
  if (!roughCutId) return undefined
  return records
    .filter((entry) => entry.record.schema === artifactKinds.mediaRoughCutCapsuleLocal)
    .find((entry) => entry.record.roughCutId === roughCutId)
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
  await writeRoughCutRevision(parseArgs(process.argv.slice(2)))
}
