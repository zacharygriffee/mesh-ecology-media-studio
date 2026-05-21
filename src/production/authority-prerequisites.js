import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { artifactKinds } from '../contracts/artifact-kinds.js'
import { readProjectRecords } from '../seams/project-status.js'

const modulePath = fileURLToPath(import.meta.url)
const defaultProjectDir = 'examples/venice-smoke'

function parseArgs(argv) {
  const args = {
    projectDir: defaultProjectDir,
    print: false
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]

    if (arg === '--project-dir') {
      args.projectDir = next
      i += 1
    } else if (arg === '--print') {
      args.print = true
    }
  }

  return args
}

export async function createProductionAuthorityPrerequisiteReport({
  projectDir = defaultProjectDir
} = {}) {
  const root = path.resolve(projectDir)
  const records = await readProjectRecords(root)
  const assetRecords = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaAssetDescriptor)
    .map((entry) => entry.record)
  const candidates = assetRecords
    .filter((asset) =>
      asset.localRef?.placementClass === 'media-accepted' &&
      asset.source?.sourceType === 'provider-result' &&
      isProductionAsset(asset)
    )
  const rows = candidates.map((asset) => summarizeCandidateAuthorityPrerequisites(asset, records))
  const projectId = rows[0]?.projectId ??
    records.find((entry) => typeof entry.record.projectId === 'string')?.record.projectId ??
    path.basename(root)

  return {
    schema: 'media.production_authority_prerequisites.summary.local.v1',
    projectId,
    mode: 'standalone-local',
    candidates: rows.length,
    localPackageComplete: rows.filter((row) => row.localPackageState === 'local-package-complete-authority-missing').length,
    missingLocalPrerequisites: rows.filter((row) => row.missingLocalPrerequisites.length > 0).length,
    pendingAuthority: rows.filter((row) => row.authorityState === 'authority-missing').length,
    productionReady: 0,
    rows,
    futureAuthorityRequirements: [
      'authority-bearing approval or ratification artifact',
      'explicit publication or production authorization scope',
      'review of local proposal evidence and capsule or bundle refs',
      'no reliance on local proposal, local decision, capsule, or bundle as authority'
    ],
    localOnly: true,
    operatorGuidanceOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    approvalAuthority: false,
    ratifierAuthority: false,
    publicationAuthorization: false,
    providerTruth: false,
    byteAvailabilityProof: false,
    materializationProof: false,
    resourceAdmission: false,
    causalTruth: false,
    edgeApproval: false
  }
}

export async function writeProductionAuthorityPrerequisiteReport(options = {}) {
  const report = await createProductionAuthorityPrerequisiteReport(options)

  if (options.print) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    printProductionAuthorityPrerequisiteReport(report)
  }

  return report
}

function summarizeCandidateAuthorityPrerequisites(asset, records) {
  const localDecision = latestRecord(records, artifactKinds.mediaOperatorDecision, (record) =>
    record.subjectRef?.id === asset.assetId
  )
  const approvalProposal = latestRecord(records, artifactKinds.mediaApprovalProposalLocal, (record) =>
    record.subjectRef?.id === asset.assetId
  )
  const capsule = latestRecord(records, artifactKinds.mediaProductionAssetCapsuleLocal, (record) =>
    [record.subjectAssetRef?.id, record.assetDescriptorRef?.id, record.subjectAssetRef?.path, record.localRef?.path]
      .filter(Boolean)
      .some((key) => [asset.assetId, asset.assetDescriptorRef?.id, asset.assetDescriptorRef?.path, asset.localRef?.path].includes(key))
  )
  const bundle = latestRecord(records, artifactKinds.mediaProductionBundleLocal, (record) =>
    (record.assetRefs ?? []).some((ref) =>
      [ref.id, ref.path].filter(Boolean).some((key) => [asset.assetId, asset.localRef?.path].includes(key))
    )
  )
  const byteProposal = latestRecord(records, artifactKinds.mediaByteDescriptorProposalLocal, (record) =>
    record.contentId === asset.contentId
  )
  const resourceCandidate = latestRecord(records, artifactKinds.mediaLocalLayerResourceRefCandidateLocal, (record) =>
    sameRef(record.sourceSituationRef, asset.situationRef) &&
    sameRef(record.sourcePlacementRef, asset.placementRef)
  )
  const derivativeRecords = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaDerivativeLocal)
    .filter((entry) =>
      sameRef(entry.record.sourceSituationRef, asset.situationRef) &&
      sameRef(entry.record.sourcePlacementRef, asset.placementRef)
    )
    .map((entry) => entry.record)
  const missingLocalPrerequisites = [
    localDecision ? null : 'local_decision_missing',
    approvalProposal ? null : 'approval_proposal_missing',
    approvalProposal && hasSituatedApprovalRefs(approvalProposal) ? null : 'situated_approval_refs_missing',
    capsule ? null : 'production_capsule_missing',
    bundle ? null : 'production_bundle_missing',
    byteProposal ? null : 'byte_descriptor_proposal_missing',
    resourceCandidate ? null : 'resource_ref_candidate_missing'
  ].filter(Boolean)

  return {
    projectId: asset.projectId,
    assetId: asset.assetId,
    path: asset.localRef?.path,
    contentId: asset.contentId,
    situationRef: asset.situationRef,
    placementRef: asset.placementRef,
    localDecision: localDecision ? refForRecord('media-operator-decision', localDecision) : null,
    approvalProposal: approvalProposal ? refForRecord('media-approval-proposal', approvalProposal) : null,
    approvalProposalIdentity: approvalProposal
      ? {
          subjectRef: approvalProposal.subjectRef ?? null,
          subjectAssetDescriptorRef: approvalProposal.subjectAssetDescriptorRef ?? null,
          subjectContentRef: approvalProposal.subjectContentRef ?? null,
          subjectSituationRef: approvalProposal.subjectSituationRef ?? null,
          subjectPlacementRef: approvalProposal.subjectPlacementRef ?? null,
          situatedRefsPresent: hasSituatedApprovalRefs(approvalProposal)
        }
      : null,
    productionCapsule: capsule ? refForRecord('media-production-asset-capsule', capsule) : null,
    productionBundle: bundle ? refForRecord('media-production-bundle', bundle) : null,
    byteDescriptorProposal: byteProposal ? refForRecord('media-byte-descriptor-proposal', byteProposal) : null,
    resourceRefCandidate: resourceCandidate ? refForRecord('media-local-layer-resource-ref-candidate', resourceCandidate) : null,
    derivativeKinds: Array.from(new Set(derivativeRecords.map((record) => record.derivativeKind).filter(Boolean))).sort(),
    missingLocalPrerequisites,
    localPackageState: missingLocalPrerequisites.length === 0
      ? 'local-package-complete-authority-missing'
      : 'local-package-incomplete',
    authorityState: 'authority-missing',
    safeNextAction: missingLocalPrerequisites.length > 0
      ? nextActionForMissingPrerequisite(missingLocalPrerequisites[0])
      : 'Route the local proposal and production bundle through a future authority lane; do not treat local records as authorization.',
    productionReady: false,
    localOnly: true,
    operatorGuidanceOnly: true,
    approvalAuthority: false,
    ratifierAuthority: false,
    publicationAuthorization: false,
    byteAvailabilityProof: false,
    materializationProof: false,
    resourceAdmission: false,
    meshTruth: false,
    providerTruth: false
  }
}

function printProductionAuthorityPrerequisiteReport(report) {
  console.log([
    `production authority prerequisites: project=${report.projectId}`,
    `candidates=${report.candidates}`,
    `localPackageComplete=${report.localPackageComplete}`,
    `missingLocalPrerequisites=${report.missingLocalPrerequisites}`,
    `pendingAuthority=${report.pendingAuthority}`,
    `productionReady=${report.productionReady}`
  ].join(' | '))

  for (const row of report.rows) {
    console.log([
      `authority-prereq: ${row.path}`,
      `localPackage=${row.localPackageState}`,
      `authority=${row.authorityState}`,
      `missing=${row.missingLocalPrerequisites.join(',') || 'none'}`,
      `proposalSituatedRefs=${row.approvalProposalIdentity?.situatedRefsPresent === true}`,
      `derivatives=${row.derivativeKinds.join(',') || 'none'}`,
      `nextAction=${row.safeNextAction}`
    ].join(' | '))
  }

  console.log('nonClaims: local-only; no mesh truth; no approval authority; no publication authorization; no byte/materialization proof; no resource admission')
}

function latestRecord(records, schema, predicate) {
  return records
    .filter((entry) => entry.record.schema === schema)
    .filter((entry) => predicate(entry.record))
    .sort((left, right) => (Date.parse(right.record.createdAt ?? '') || 0) - (Date.parse(left.record.createdAt ?? '') || 0))[0]?.record
}

function refForRecord(kind, record) {
  return {
    kind,
    id: idForRecord(record),
    schema: record.schema,
    localOnly: true
  }
}

function idForRecord(record) {
  return record.decisionId ??
    record.proposalId ??
    record.capsuleId ??
    record.bundleId ??
    record.byteDescriptorProposalId ??
    record.resourceRefCandidateId ??
    record.assetId
}

function hasSituatedApprovalRefs(proposal) {
  return Boolean(
    proposal.subjectAssetDescriptorRef?.id &&
    proposal.subjectContentRef?.id &&
    proposal.subjectSituationRef?.id &&
    proposal.subjectPlacementRef?.id
  )
}

function nextActionForMissingPrerequisite(issueCode) {
  if (issueCode === 'local_decision_missing') return 'Record an explicit local decision for the accepted provider asset.'
  if (issueCode === 'approval_proposal_missing') return 'Run npm run approval:proposal for the accepted provider asset.'
  if (issueCode === 'situated_approval_refs_missing') return 'Regenerate the approval proposal so it includes situated asset refs.'
  if (issueCode === 'production_capsule_missing') return 'Run npm run production:capsule for the accepted provider asset.'
  if (issueCode === 'production_bundle_missing') return 'Run npm run production:bundle to group production capsules.'
  if (issueCode === 'byte_descriptor_proposal_missing') return 'Run npm run bytes:proposal for content-keyed byte posture.'
  if (issueCode === 'resource_ref_candidate_missing') return 'Run npm run resource:refs for situation-specific resource posture.'
  return 'Inspect local production prerequisites before authority review.'
}

function sameRef(left, right) {
  if (!left?.id || !right?.id) return false
  return left.id === right.id
}

function isProductionAsset(asset) {
  const mediaKind = asset.metadataProbe?.mediaKind
  if (['image', 'video', 'audio'].includes(mediaKind)) return true
  const contentType = asset.contentType ?? asset.localRef?.contentType
  return ['image/', 'video/', 'audio/'].some((prefix) => contentType?.startsWith(prefix))
}

if (process.argv[1] === modulePath) {
  await writeProductionAuthorityPrerequisiteReport(parseArgs(process.argv.slice(2)))
}
