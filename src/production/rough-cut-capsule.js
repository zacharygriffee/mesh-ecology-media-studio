import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { artifactKinds } from '../contracts/artifact-kinds.js'
import { makeRef, nowIso } from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import { assertSafeLocalPath } from '../local/project-layout.js'
import { readProjectRecords } from '../seams/project-status.js'
import { createProductionAuthorityPrerequisiteReport } from './authority-prerequisites.js'

const modulePath = fileURLToPath(import.meta.url)
const defaultProjectDir = 'examples/venice-smoke'
const defaultOutput = 'records/production/media-rough-cut-capsule.local.json'
const truthStatus = 'not mesh truth; not distributed proof; not ratified shared state'

function parseArgs(argv) {
  const args = {
    projectDir: defaultProjectDir,
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

export async function writeRoughCutCapsule({
  projectDir = defaultProjectDir,
  output = defaultOutput,
  print = false,
  quiet = false,
  createdAt = nowIso()
} = {}) {
  assertSafeLocalPath(output)

  const root = path.resolve(projectDir)
  const records = await readProjectRecords(root)
  const prerequisiteReport = await createProductionAuthorityPrerequisiteReport({ projectDir })
  const roughCut = createRoughCutCapsuleFromRecords({
    records,
    prerequisiteReport,
    createdAt
  })

  const outputPath = path.join(root, output)
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(roughCut, null, 2)}\n`)

  if (print) {
    console.log(JSON.stringify(roughCut, null, 2))
  } else if (!quiet) {
    console.log(formatRoughCutCapsuleSummary(roughCut, output))
    console.log(`nextAction: ${roughCut.nextActions[0]}`)
    console.log('nonClaims: local-only; no render/export; no approval authority; no publication authorization; productionReady=false')
  }

  return {
    roughCut,
    output
  }
}

export function createRoughCutCapsuleFromRecords({
  records,
  prerequisiteReport,
  createdAt = nowIso()
}) {
  const projectId = prerequisiteReport.projectId ??
    records.find((entry) => typeof entry.record.projectId === 'string')?.record.projectId ??
    'unknown-project'
  const prerequisiteRows = [...(prerequisiteReport.rows ?? [])]
    .sort((left, right) => (left.path ?? '').localeCompare(right.path ?? ''))
  const orderedItems = prerequisiteRows.map((row, index) => createOrderedItem({
    row,
    records,
    order: index + 1
  }))
  const productionBundleRefs = refsForSchema(records, artifactKinds.mediaProductionBundleLocal, 'media-production-bundle')
  const productionCapsuleRefs = refsForSchema(records, artifactKinds.mediaProductionAssetCapsuleLocal, 'media-production-asset-capsule')
  const approvalProposalRefs = refsForSchema(records, artifactKinds.mediaApprovalProposalLocal, 'media-approval-proposal')
  const authorityHandoffCandidateRefs = refsForSchema(records, artifactKinds.mediaAuthorityHandoffCandidateLocal, 'media-authority-handoff-candidate')
  const sourceRefs = compactRefs([
    ...productionBundleRefs,
    ...productionCapsuleRefs,
    ...approvalProposalRefs,
    ...authorityHandoffCandidateRefs,
    ...orderedItems.flatMap((item) => [
      item.acceptedAssetRef,
      item.productionAssetCapsuleRef,
      item.productionBundleRef,
      item.approvalProposalRef,
      item.localDecisionRef,
      item.byteDescriptorProposalRef,
      item.resourceRefCandidateRef,
      ...item.derivativeRefs
    ])
  ])
  const missingLocalPrerequisiteItems = orderedItems.filter((item) => item.prerequisitePosture.missingLocalPrerequisites.length > 0).length
  const pendingAuthorityItems = orderedItems.filter((item) => item.prerequisitePosture.authorityState === 'authority-missing').length

  const roughCut = {
    schema: artifactKinds.mediaRoughCutCapsuleLocal,
    roughCutId: `rough-cut-capsule-${stableId([
      projectId,
      ...orderedItems.map((item) => `${item.order}:${item.acceptedAssetRef?.path ?? item.itemId}:${item.productionAssetCapsuleRef?.id ?? ''}`)
    ].join('|'))}`,
    projectId,
    roughCutKind: 'ordered-production-review-cut',
    mode: 'standalone-local',
    orderedItems,
    sourceRefs,
    assemblyPosture: {
      state: orderedItems.length > 0 ? 'review-only-rough-cut' : 'needs-production-items',
      itemCount: orderedItems.length,
      missingLocalPrerequisiteItems,
      pendingAuthorityItems,
      productionReady: false,
      rendered: false,
      exportRendered: false,
      localOnly: true,
      operatorGuidanceOnly: true
    },
    renderPosture: {
      rendered: false,
      renderEngine: null,
      renderedOutputRef: null,
      exportRef: null,
      timelineEngine: false,
      publicationAuthorization: false,
      localOnly: true
    },
    nextActions: orderedItems.length > 0
      ? [
          'Review the ordered accepted production items locally; rendering, export, publication, and authority remain separate future steps.',
          'Resolve missing local prerequisites and route approval through the proper authority lane before production use.'
        ]
      : [
          'Create accepted production asset capsules and a production bundle before creating a useful rough-cut capsule.'
        ],
    notes: [
      'This rough-cut capsule is an ordered local review package over existing production refs.',
      'It does not render a timeline, export media, publish to mesh, call Edge, grant approval, or prove availability.',
      'Timing fields are order-only until a real edit graph or renderer is introduced.'
    ],
    createdAt,
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
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    localTruthLabel: 'local rough-cut capsule',
    truthStatus
  }

  validateRequiredRecord(roughCut)
  return roughCut
}

export function formatRoughCutCapsuleSummary(roughCut, output = defaultOutput) {
  return [
    `rough cut capsule: project=${roughCut.projectId}`,
    `items=${roughCut.orderedItems.length}`,
    `bundles=${countRefsBySchema(roughCut.sourceRefs, artifactKinds.mediaProductionBundleLocal)}`,
    `capsules=${countRefsBySchema(roughCut.sourceRefs, artifactKinds.mediaProductionAssetCapsuleLocal)}`,
    `authorityPending=${roughCut.assemblyPosture.pendingAuthorityItems}`,
    `rendered=${roughCut.renderPosture.rendered}`,
    `productionReady=${roughCut.productionReady}`,
    `output=${output}`
  ].join(' | ')
}

function createOrderedItem({ row, records, order }) {
  const assetEntry = findRecordEntry(records, artifactKinds.mediaAssetDescriptor, row.assetId)
  const capsuleEntry = findRecordEntry(records, artifactKinds.mediaProductionAssetCapsuleLocal, row.productionCapsule?.id)
  const bundleEntry = findRecordEntry(records, artifactKinds.mediaProductionBundleLocal, row.productionBundle?.id)
  const proposalEntry = findRecordEntry(records, artifactKinds.mediaApprovalProposalLocal, row.approvalProposal?.id)
  const decisionEntry = findRecordEntry(records, artifactKinds.mediaOperatorDecision, row.localDecision?.id)
  const byteEntry = findRecordEntry(records, artifactKinds.mediaByteDescriptorProposalLocal, row.byteDescriptorProposal?.id)
  const resourceEntry = findRecordEntry(records, artifactKinds.mediaLocalLayerResourceRefCandidateLocal, row.resourceRefCandidate?.id)
  const derivativeRefs = derivativeRefsForRow(records, row)

  return {
    itemId: `rough-cut-item-${stableId([
      row.projectId,
      row.path,
      row.contentId,
      row.situationRef?.id,
      row.placementRef?.id,
      row.productionCapsule?.id
    ].join('|'))}`,
    order,
    trackKind: 'primary-review',
    timingPosture: 'order-only-no-render-timing',
    startOffsetMs: null,
    durationMs: null,
    acceptedAssetRef: assetEntry
      ? localRecordRef('media-asset', assetEntry.record.assetId, assetEntry.record.schema, assetEntry.path)
      : {
          ...makeRef('media-asset', row.assetId, artifactKinds.mediaAssetDescriptor),
          path: row.path,
          localOnly: true
        },
    contentRef: {
      ...makeRef('media-content', row.contentId, 'media.content_ref.local.v1'),
      localOnly: true
    },
    situationRef: localizeRef(row.situationRef),
    placementRef: localizeRef(row.placementRef),
    localRef: {
      path: row.path,
      localOnly: true
    },
    productionAssetCapsuleRef: capsuleEntry
      ? localRecordRef('media-production-asset-capsule', capsuleEntry.record.capsuleId, capsuleEntry.record.schema, capsuleEntry.path)
      : null,
    productionBundleRef: bundleEntry
      ? localRecordRef('media-production-bundle', bundleEntry.record.bundleId, bundleEntry.record.schema, bundleEntry.path)
      : null,
    approvalProposalRef: proposalEntry
      ? localRecordRef('media-approval-proposal', proposalEntry.record.proposalId, proposalEntry.record.schema, proposalEntry.path)
      : null,
    localDecisionRef: decisionEntry
      ? localRecordRef('media-operator-decision', decisionEntry.record.decisionId, decisionEntry.record.schema, decisionEntry.path)
      : null,
    byteDescriptorProposalRef: byteEntry
      ? localRecordRef('media-byte-descriptor-proposal', byteEntry.record.byteDescriptorProposalId, byteEntry.record.schema, byteEntry.path)
      : null,
    resourceRefCandidateRef: resourceEntry
      ? localRecordRef('media-local-layer-resource-ref-candidate', resourceEntry.record.resourceRefCandidateId, resourceEntry.record.schema, resourceEntry.path)
      : null,
    derivativeRefs,
    prerequisitePosture: {
      localPackageState: row.localPackageState,
      authorityState: row.authorityState,
      missingLocalPrerequisites: row.missingLocalPrerequisites,
      derivativeKinds: row.derivativeKinds,
      productionReady: false,
      approvalAuthority: false,
      publicationAuthorization: false,
      localOnly: true,
      operatorGuidanceOnly: true
    },
    nonClaims: {
      rendered: false,
      productionReady: false,
      approvalAuthority: false,
      publicationAuthorization: false,
      materializationProof: false,
      resourceAdmission: false,
      meshTruth: false,
      causalTruth: false
    },
    localOnly: true
  }
}

function refsForSchema(records, schema, kind) {
  return records
    .filter((entry) => entry.record.schema === schema)
    .sort(compareRecordCreatedAt)
    .map((entry) => localRecordRef(kind, idForRecord(entry.record), entry.record.schema, entry.path))
}

function derivativeRefsForRow(records, row) {
  return records
    .filter((entry) => entry.record.schema === artifactKinds.mediaDerivativeLocal)
    .filter((entry) =>
      sameRef(entry.record.sourceSituationRef, row.situationRef) &&
      sameRef(entry.record.sourcePlacementRef, row.placementRef)
    )
    .sort(compareRecordCreatedAt)
    .map((entry) => ({
      ...localRecordRef('media-derivative', entry.record.derivativeId, entry.record.schema, entry.path),
      derivativeKind: entry.record.derivativeKind,
      derivativeLocalRef: entry.record.derivativeLocalRef,
      materializationProof: false
    }))
}

function findRecordEntry(records, schema, id) {
  if (!id) return undefined
  return records
    .filter((entry) => entry.record.schema === schema)
    .filter((entry) => idForRecord(entry.record) === id)
    .sort(compareRecordCreatedAt)[0]
}

function localRecordRef(kind, id, schema, relativePath) {
  return {
    ...makeRef(kind, id, schema),
    path: relativePath,
    localOnly: true
  }
}

function localizeRef(ref) {
  if (!ref?.id) return null
  return {
    ...ref,
    localOnly: true
  }
}

function idForRecord(record) {
  return record.handoffCandidateId ??
    record.bundleId ??
    record.capsuleId ??
    record.proposalId ??
    record.decisionId ??
    record.assetId ??
    record.byteDescriptorProposalId ??
    record.resourceRefCandidateId ??
    record.derivativeId ??
    record.schema
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

function countRefsBySchema(refs, schema) {
  return refs.filter((ref) => ref.schema === schema).length
}

function sameRef(left, right) {
  if (!left?.id || !right?.id) return false
  return left.id === right.id
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
  await writeRoughCutCapsule(parseArgs(process.argv.slice(2)))
}
