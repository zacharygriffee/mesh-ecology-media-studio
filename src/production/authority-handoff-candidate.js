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
const defaultOutput = 'records/production/media-authority-handoff-candidate.local.json'
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

export async function writeAuthorityHandoffCandidate({
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
  const candidate = createAuthorityHandoffCandidateFromRecords({
    records,
    prerequisiteReport,
    createdAt
  })

  const outputPath = path.join(root, output)
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(candidate, null, 2)}\n`)

  if (print) {
    console.log(JSON.stringify(candidate, null, 2))
  } else if (!quiet) {
    console.log(formatAuthorityHandoffCandidateSummary(candidate, output))
    console.log(`nextAction: ${candidate.nextActions[0]}`)
    console.log('nonClaims: local-only; no mesh truth; no approval authority; no ratifier authority; no publication authorization; productionReady=false')
  }

  return {
    candidate,
    output
  }
}

export function createAuthorityHandoffCandidateFromRecords({
  records,
  prerequisiteReport,
  createdAt = nowIso()
}) {
  const projectId = prerequisiteReport.projectId ??
    records.find((entry) => typeof entry.record.projectId === 'string')?.record.projectId ??
    'unknown-project'
  const productionBundleRefs = refsForSchema(records, artifactKinds.mediaProductionBundleLocal, 'media-production-bundle')
  const productionCapsuleRefs = refsForSchema(records, artifactKinds.mediaProductionAssetCapsuleLocal, 'media-production-asset-capsule')
  const approvalProposalRefs = refsForSchema(records, artifactKinds.mediaApprovalProposalLocal, 'media-approval-proposal')
  const localDecisionRefs = refsForSchema(records, artifactKinds.mediaOperatorDecision, 'media-operator-decision')
  const acceptedAssetRefs = refsForAcceptedAssets(records)
  const byteDescriptorProposalRefs = refsForSchema(records, artifactKinds.mediaByteDescriptorProposalLocal, 'media-byte-descriptor-proposal')
  const resourceRefCandidateRefs = refsForSchema(records, artifactKinds.mediaLocalLayerResourceRefCandidateLocal, 'media-local-layer-resource-ref-candidate')
  const derivativeRefs = refsForSchema(records, artifactKinds.mediaDerivativeLocal, 'media-derivative')
  const inspectionPacketRefs = refsForSchema(records, artifactKinds.mediaEdgeInspectionPacketLocal, 'media-edge-inspection-packet')
  const compatibilityBundleRefs = refsForSchema(records, artifactKinds.mediaEdgeCompatibilityBundleLocal, 'media-edge-compatibility-bundle')
  const acceptedCandidateRows = prerequisiteReport.rows.map((row) => ({
    acceptedAssetPath: row.path,
    assetId: row.assetId,
    contentId: row.contentId,
    situationRef: row.situationRef,
    placementRef: row.placementRef,
    localPackageState: row.localPackageState,
    authorityState: row.authorityState,
    missingLocalPrerequisites: row.missingLocalPrerequisites,
    approvalProposalIdentity: row.approvalProposalIdentity,
    derivativeKinds: row.derivativeKinds,
    productionReady: false,
    approvalAuthority: false,
    publicationAuthorization: false,
    localOnly: true
  }))
  const sourceRefs = compactRefs([
    ...productionBundleRefs,
    ...productionCapsuleRefs,
    ...approvalProposalRefs,
    ...localDecisionRefs,
    ...acceptedAssetRefs,
    ...byteDescriptorProposalRefs,
    ...resourceRefCandidateRefs,
    ...derivativeRefs,
    ...inspectionPacketRefs,
    ...compatibilityBundleRefs
  ])
  const prerequisiteSummary = {
    schema: prerequisiteReport.schema,
    candidates: prerequisiteReport.candidates,
    localPackageComplete: prerequisiteReport.localPackageComplete,
    missingLocalPrerequisites: prerequisiteReport.missingLocalPrerequisites,
    pendingAuthority: prerequisiteReport.pendingAuthority,
    productionReady: prerequisiteReport.productionReady,
    operatorGuidanceOnly: true,
    localOnly: true
  }

  const candidate = {
    schema: artifactKinds.mediaAuthorityHandoffCandidateLocal,
    handoffCandidateId: `authority-handoff-candidate-${stableId([
      projectId,
      ...productionBundleRefs.map((ref) => ref.id),
      ...approvalProposalRefs.map((ref) => ref.id),
      ...productionCapsuleRefs.map((ref) => ref.id)
    ].join('|'))}`,
    projectId,
    handoffKind: 'production-authority-review-candidate',
    mode: 'standalone-local',
    targetAuthorityLane: 'future-authority-lane',
    prerequisiteSummary,
    authorityReviewInputs: [
      {
        inputKind: 'production-bundle',
        refs: productionBundleRefs,
        required: true,
        present: productionBundleRefs.length > 0,
        localOnly: true
      },
      {
        inputKind: 'approval-proposal',
        refs: approvalProposalRefs,
        required: true,
        present: approvalProposalRefs.length > 0,
        localOnly: true
      },
      {
        inputKind: 'production-asset-capsule',
        refs: productionCapsuleRefs,
        required: true,
        present: productionCapsuleRefs.length > 0,
        localOnly: true
      },
      {
        inputKind: 'situated-identity',
        refs: acceptedCandidateRows.map((row) => ({
          kind: 'media-situated-accepted-candidate',
          id: row.situationRef?.id ?? row.acceptedAssetPath,
          schema: 'media.situation_ref.v1',
          path: row.acceptedAssetPath,
          contentId: row.contentId,
          placementRef: row.placementRef,
          localOnly: true
        })),
        required: true,
        present: acceptedCandidateRows.every((row) => row.situationRef?.id && row.placementRef?.id),
        localOnly: true
      },
      {
        inputKind: 'local-prerequisite-state',
        refs: [],
        required: true,
        present: prerequisiteReport.localPackageComplete === prerequisiteReport.candidates,
        embeddedSummaryOnly: true,
        localOnly: true
      }
    ],
    acceptedCandidateRows,
    sourceRefs,
    authorityGaps: [
      'approval_authority_missing',
      'ratifier_authority_missing',
      'publication_authorization_missing',
      'production_ready_false',
      'mesh_publication_missing'
    ],
    nextActions: [
      'Submit this candidate to a future authority lane that can review the local proposal, capsule, bundle, situated identity refs, and prerequisite gaps.',
      'Do not treat this handoff candidate as approval, ratification, publication authorization, or production readiness.'
    ],
    notes: [
      'This record packages local refs for future authority review only.',
      'It does not implement the authority lane and does not grant production use.',
      'Local proposal, capsule, bundle, inspection, and prerequisite records remain non-authoritative.'
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
    localTruthLabel: 'local authority handoff candidate',
    truthStatus
  }

  validateRequiredRecord(candidate)
  return candidate
}

export function formatAuthorityHandoffCandidateSummary(candidate, output = defaultOutput) {
  return [
    `authority handoff candidate: project=${candidate.projectId}`,
    `candidates=${candidate.prerequisiteSummary.candidates}`,
    `localPackageComplete=${candidate.prerequisiteSummary.localPackageComplete}`,
    `pendingAuthority=${candidate.prerequisiteSummary.pendingAuthority}`,
    `bundles=${candidate.authorityReviewInputs.find((input) => input.inputKind === 'production-bundle')?.refs.length ?? 0}`,
    `proposals=${candidate.authorityReviewInputs.find((input) => input.inputKind === 'approval-proposal')?.refs.length ?? 0}`,
    `capsules=${candidate.authorityReviewInputs.find((input) => input.inputKind === 'production-asset-capsule')?.refs.length ?? 0}`,
    `authorityGaps=${candidate.authorityGaps.length}`,
    `productionReady=${candidate.productionReady}`,
    `output=${output}`
  ].join(' | ')
}

function refsForSchema(records, schema, kind) {
  return records
    .filter((entry) => entry.record.schema === schema)
    .sort(compareRecordCreatedAt)
    .map((entry) => localRecordRef(kind, idForRecord(entry.record), entry.record.schema, entry.path))
}

function refsForAcceptedAssets(records) {
  return records
    .filter((entry) => entry.record.schema === artifactKinds.mediaAssetDescriptor)
    .filter((entry) => entry.record.localRef?.placementClass === 'media-accepted')
    .sort(compareRecordCreatedAt)
    .map((entry) => ({
      ...localRecordRef('media-asset', entry.record.assetId, entry.record.schema, entry.path),
      contentId: entry.record.contentId,
      localRef: entry.record.localRef,
      situationRef: entry.record.situationRef,
      placementRef: entry.record.placementRef
    }))
}

function localRecordRef(kind, id, schema, relativePath) {
  return {
    ...makeRef(kind, id, schema),
    path: relativePath,
    localOnly: true
  }
}

function idForRecord(record) {
  return record.bundleId ??
    record.capsuleId ??
    record.proposalId ??
    record.decisionId ??
    record.assetId ??
    record.byteDescriptorProposalId ??
    record.resourceRefCandidateId ??
    record.derivativeId ??
    record.packetId ??
    record.schema
}

function compactRefs(refs) {
  const output = []
  const seen = new Set()
  for (const ref of refs.filter((candidate) => candidate?.id && candidate?.path)) {
    const key = `${ref.schema}:${ref.id}:${ref.path}`
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
  await writeAuthorityHandoffCandidate(parseArgs(process.argv.slice(2)))
}
