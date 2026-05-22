import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { artifactKinds } from '../contracts/artifact-kinds.js'
import { makeRef, nowIso } from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import { assertSafeLocalPath } from '../local/project-layout.js'
import { writeJsonAtomic } from '../local/atomic-json.js'
import { readProjectRecords } from '../seams/project-status.js'

const modulePath = fileURLToPath(import.meta.url)
const defaultProjectDir = 'examples/venice-smoke'
const defaultOutput = 'records/production/media-production-asset-capsule.local.json'
const truthStatus = 'not mesh truth; not distributed proof; not ratified shared state'

function parseArgs(argv) {
  const args = {
    projectDir: defaultProjectDir,
    assetRecord: undefined,
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
    } else if (arg === '--asset-record') {
      args.assetRecord = next
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

export async function writeProductionAssetCapsule({
  projectDir = defaultProjectDir,
  assetRecord,
  output = defaultOutput,
  print = false,
  quiet = false,
  createdAt = nowIso()
} = {}) {
  assertSafeLocalPath(output)
  if (assetRecord) assertSafeLocalPath(assetRecord)

  const root = path.resolve(projectDir)
  const records = await readProjectRecords(root)
  const capsule = createProductionAssetCapsuleFromRecords({
    records,
    assetRecord,
    createdAt
  })

  await writeJsonAtomic(root, output, capsule)

  if (print) {
    console.log(JSON.stringify(capsule, null, 2))
  } else if (!quiet) {
    console.log(formatProductionAssetCapsuleSummary(capsule, output))
    console.log(`nextAction: ${capsule.productionPosture.nextAction}`)
    console.log('nonClaims: local-only; no mesh truth; no provider truth; no byte/materialization proof; no resource admission; no approval authority')
  }

  return {
    capsule,
    output
  }
}

export function createProductionAssetCapsuleFromRecords({
  records,
  assetRecord,
  createdAt = nowIso()
}) {
  const assetEntry = selectAcceptedAsset(records, assetRecord)
  const asset = assetEntry.record
  const contentId = asset.contentId ?? contentIdFromHash(asset.hash)
  const assetDescriptorRef = {
    ...(asset.assetDescriptorRef ?? makeRef('media-asset-descriptor', asset.assetId, asset.schema)),
    path: assetEntry.path,
    localOnly: true
  }
  const subjectAssetRef = {
    ...makeRef('media-asset', asset.assetId, asset.schema),
    path: assetEntry.path,
    localOnly: true
  }
  const contentRef = makeRef('media-content', contentId, 'media.content_ref.local.v1')
  const derivativeRefs = derivativeRefsForAsset(records, asset)
  const byteDescriptorProposalRef = byteDescriptorProposalRefForContent(records, contentId)
  const resourceRefCandidateRef = resourceRefCandidateRefForAsset(records, asset)
  const localDecisionRef = localDecisionRefForAsset(records, asset)
  const approvalProposalRef = approvalProposalRefForAsset(records, asset)
  const providerLoopStatusRef = latestRefForSchema(records, artifactKinds.mediaProviderLoopStatusLocal, 'media-provider-loop-status')
  const providerResultRefs = refsForSchema(records, artifactKinds.mediaProviderResult, 'media-provider-result')
  const providerAdapterRunRefs = refsForSchema(records, artifactKinds.mediaProviderAdapterRunLocal, 'media-provider-adapter-run')

  const blockers = []
  if (!approvalProposalRef) blockers.push('approval_proposal_missing')
  blockers.push('authority_not_granted')

  const capsule = {
    schema: artifactKinds.mediaProductionAssetCapsuleLocal,
    capsuleId: `production-asset-capsule-${stableId([
      asset.projectId,
      contentId,
      assetDescriptorRef.id,
      asset.situationRef?.id,
      asset.placementRef?.id
    ].join('|'))}`,
    projectId: asset.projectId,
    capsuleKind: 'production-asset-candidate',
    subjectAssetRef,
    contentRef,
    assetDescriptorRef,
    situationRef: {
      ...asset.situationRef,
      localOnly: true
    },
    placementRef: {
      ...asset.placementRef,
      localOnly: true
    },
    localRef: asset.localRef,
    sourcePosture: {
      providerResultRefs,
      providerAdapterRunRefs,
      providerLoopStatusRef,
      providerTruth: false,
      localOnly: true
    },
    derivativePosture: {
      derivativeRefs,
      readyDerivativeKinds: derivativeRefs.map((ref) => ref.derivativeKind),
      localOnly: true,
      materializationProof: false
    },
    bytePosture: {
      contentId,
      byteDescriptorProposalRef,
      byteAvailabilityProof: false,
      materializationProof: false,
      localOnly: true
    },
    resourcePosture: {
      resourceRefCandidateRef,
      resourceAdmission: false,
      localOnly: true
    },
    reviewPosture: {
      localDecisionRef,
      approvalProposalRef,
      localDecisionOnly: true,
      approvalAuthority: false,
      ratifierAuthority: false,
      publicationAuthorization: false
    },
    productionPosture: {
      state: approvalProposalRef ? 'approval-proposed-review-only' : 'needs-approval-proposal',
      productionReady: false,
      blockers,
      nextAction: approvalProposalRef
        ? 'Route the approval proposal through the proper authority lane; this capsule does not grant production use.'
        : 'Run npm run approval:proposal for the accepted asset before production use.',
      localOnly: true,
      operatorGuidanceOnly: true
    },
    bundleRefs: compactRefs([
      subjectAssetRef,
      assetDescriptorRef,
      ...providerResultRefs,
      ...providerAdapterRunRefs,
      providerLoopStatusRef,
      ...derivativeRefs,
      byteDescriptorProposalRef,
      resourceRefCandidateRef,
      localDecisionRef,
      approvalProposalRef
    ]),
    notes: [
      'This capsule packages refs for local operator inspection only.',
      'It does not copy media bytes, publish to mesh, call Edge, grant approval, or prove availability.',
      'The accepted asset remains a production candidate until the proper authority lane acts.'
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
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    localTruthLabel: 'local production capsule',
    truthStatus
  }

  validateRequiredRecord(capsule)
  return capsule
}

export function formatProductionAssetCapsuleSummary(capsule, output = defaultOutput) {
  const byte = capsule.bytePosture.byteDescriptorProposalRef ? 'present' : 'missing'
  const resource = capsule.resourcePosture.resourceRefCandidateRef ? 'present' : 'missing'
  const approval = capsule.reviewPosture.approvalProposalRef ? 'proposed' : 'missing'

  return [
    `production asset capsule: project=${capsule.projectId}`,
    `asset=${capsule.localRef?.path ?? capsule.subjectAssetRef.id}`,
    `state=${capsule.productionPosture.state}`,
    `derivatives=${capsule.derivativePosture.derivativeRefs.length}`,
    `byte=${byte}`,
    `resource=${resource}`,
    `approval=${approval}`,
    `productionReady=${capsule.productionReady}`,
    `output=${output}`
  ].join(' | ')
}

function selectAcceptedAsset(records, assetRecord) {
  const assets = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaAssetDescriptor)
    .filter((entry) => entry.record.localRef?.placementClass === 'media-accepted' || entry.record.localRef?.path?.startsWith('media/accepted/'))

  if (assetRecord) {
    const selected = assets.find((entry) => entry.path === assetRecord)
    if (!selected) throw new Error(`Accepted asset record was not found: ${assetRecord}`)
    return selected
  }

  const selected = assets.sort(compareRecordCreatedAt)[0]
  if (!selected) throw new Error('Production asset capsule requires an accepted asset descriptor')
  return selected
}

function refsForSchema(records, schema, kind) {
  return records
    .filter((entry) => entry.record.schema === schema)
    .sort(compareRecordCreatedAt)
    .map((entry) => localRecordRef(kind, idForRecord(entry.record), entry.record.schema, entry.path))
}

function latestRefForSchema(records, schema, kind) {
  return refsForSchema(records, schema, kind)[0]
}

function derivativeRefsForAsset(records, asset) {
  return records
    .filter((entry) => entry.record.schema === artifactKinds.mediaDerivativeLocal)
    .filter((entry) => sameSituation(entry.record.sourceSituationRef, asset.situationRef))
    .filter((entry) => samePlacement(entry.record.sourcePlacementRef, asset.placementRef))
    .sort(compareRecordCreatedAt)
    .map((entry) => ({
      ...localRecordRef('media-derivative', entry.record.derivativeId, entry.record.schema, entry.path),
      derivativeKind: entry.record.derivativeKind,
      derivativeLocalRef: entry.record.derivativeLocalRef,
      materializationProof: false
    }))
}

function byteDescriptorProposalRefForContent(records, contentId) {
  const entry = records
    .filter((candidate) => candidate.record.schema === artifactKinds.mediaByteDescriptorProposalLocal)
    .find((candidate) => candidate.record.contentId === contentId)
  return entry ? localRecordRef('media-byte-descriptor-proposal', entry.record.byteDescriptorProposalId, entry.record.schema, entry.path) : undefined
}

function resourceRefCandidateRefForAsset(records, asset) {
  const entry = records
    .filter((candidate) => candidate.record.schema === artifactKinds.mediaLocalLayerResourceRefCandidateLocal)
    .find((candidate) =>
      sameSituation(candidate.record.sourceSituationRef, asset.situationRef) &&
      samePlacement(candidate.record.sourcePlacementRef, asset.placementRef)
    )
  return entry ? localRecordRef('media-local-layer-resource-ref-candidate', entry.record.resourceRefCandidateId, entry.record.schema, entry.path) : undefined
}

function localDecisionRefForAsset(records, asset) {
  const entry = records
    .filter((candidate) => candidate.record.schema === artifactKinds.mediaOperatorDecision)
    .filter((candidate) => candidate.record.subjectRef?.id === asset.assetId)
    .sort(compareRecordCreatedAt)[0]
  return entry ? localRecordRef('media-operator-decision', entry.record.decisionId, entry.record.schema, entry.path) : undefined
}

function approvalProposalRefForAsset(records, asset) {
  const entry = records
    .filter((candidate) => candidate.record.schema === artifactKinds.mediaApprovalProposalLocal)
    .filter((candidate) => candidate.record.subjectRef?.id === asset.assetId)
    .sort(compareRecordCreatedAt)[0]
  return entry ? localRecordRef('media-approval-proposal', entry.record.proposalId, entry.record.schema, entry.path) : undefined
}

function localRecordRef(kind, id, schema, relativePath) {
  return {
    ...makeRef(kind, id, schema),
    path: relativePath,
    localOnly: true
  }
}

function idForRecord(record) {
  return record.resultId ??
    record.adapterRunId ??
    record.statusId ??
    record.assetId ??
    record.derivativeId ??
    record.proposalId ??
    record.resourceRefCandidateId ??
    record.decisionId ??
    record.schema
}

function contentIdFromHash(hash) {
  if (typeof hash === 'string') return `sha256:${hash}`
  if (hash?.algorithm === 'sha256' && hash.value) return `sha256:${hash.value}`
  throw new Error('Production asset capsule requires contentId or sha256 hash')
}

function sameSituation(left, right) {
  if (!right?.id) return true
  return left?.id === right.id
}

function samePlacement(left, right) {
  if (!right?.id) return true
  return left?.id === right.id
}

function compactRefs(refs) {
  const output = []
  const seen = new Set()
  for (const ref of refs.filter(Boolean)) {
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

async function main() {
  const args = parseArgs(process.argv.slice(2))
  await writeProductionAssetCapsule(args)
}

if (process.argv[1] === modulePath) {
  await main()
}
