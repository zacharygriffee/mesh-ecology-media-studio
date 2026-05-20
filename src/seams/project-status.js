import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { artifactKinds } from '../contracts/artifact-kinds.js'
import { makeRef, nowIso } from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import { assertSafeLocalPath } from '../local/project-layout.js'

const modulePath = fileURLToPath(import.meta.url)
const defaultOutput = 'records/manifests/media-project-status.local.json'
const truthStatus = 'not mesh truth; not distributed proof; not ratified shared state'

function parseArgs(argv) {
  const args = {
    projectDir: 'examples/card-to-candidate',
    output: defaultOutput,
    print: false
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
    }
  }

  return args
}

export async function writeProjectStatus({
  projectDir = 'examples/card-to-candidate',
  output = defaultOutput,
  print = false,
  quiet = false
} = {}) {
  assertSafeLocalPath(output)
  const root = path.resolve(projectDir)
  const records = await readProjectRecords(root)
  const card = records.find((entry) => entry.record.schema === artifactKinds.mediaCard)?.record ??
    await readOptionalCard(root)
  const projectId = card?.projectId ?? path.basename(root)
  const counts = countRecords(records)
  const latestRefs = latestRecordRefs(records)
  const assetResourceConsistency = summarizeAssetResourceConsistency(records)
  const warnings = [
    'Project status is a local snapshot only.',
    'Counts and refs are not mesh truth, provider truth, byte proof, or ratifier authority.'
  ]

  if (assetResourceConsistency.readyForEdgeInspection === false) {
    warnings.push('Some accepted/reference assets are missing content-keyed byte posture or situation/placement resource-ref candidate alignment.')
  }

  const status = {
    schema: artifactKinds.mediaProjectStatusLocal,
    statusId: `project-status-${projectId}`,
    projectId,
    createdAt: nowIso(),
    mode: 'standalone-local',
    counts,
    latestRefs,
    assetResourceConsistency,
    warnings,
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    providerTruth: false,
    byteAvailabilityProof: false,
    materializationProof: false,
    localTruthLabel: 'local cache',
    truthStatus
  }

  validateRequiredRecord(status)

  const outputPath = path.join(root, output)
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(status, null, 2)}\n`)

  if (print) {
    console.log(JSON.stringify(status, null, 2))
  } else if (!quiet) {
    console.log(formatProjectStatusSummary(status, output))
    for (const asset of assetResourceConsistency.assetExplanations.filter((entry) => entry.state !== 'ready-for-local-inspection')) {
      console.log(`asset attention: ${asset.assetId} | reason=${asset.reasons[0]}`)
    }
  }

  return {
    status,
    output
  }
}

function formatProjectStatusSummary(status, output) {
  const nonZeroCounts = Object.entries(status.counts)
    .filter(([, count]) => count > 0)
    .map(([name, count]) => `${name}=${count}`)
    .join(',') || 'none'
  const consistency = status.assetResourceConsistency
  const bytePosture = `${consistency.bytePosture?.coveredContentIds ?? 0}/${consistency.bytePosture?.expectedContentIds ?? 0}`
  const resourcePosture = `${consistency.resourcePosture?.coveredSituationPlacements ?? 0}/${consistency.resourcePosture?.expectedSituationPlacements ?? 0}`

  return [
    `project status: ${status.projectId}`,
    `assetReady=${status.assetResourceConsistency.readyForEdgeInspection}`,
    `assetWarnings=${status.assetResourceConsistency.warningCount}`,
    `byteContent=${bytePosture}`,
    `resourceSituations=${resourcePosture}`,
    `records=${nonZeroCounts}`,
    `output=${output}`
  ].join(' | ')
}

function summarizeAssetResourceConsistency(records) {
  const acceptedOrReferenceAssets = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaAssetDescriptor)
    .filter((entry) => isAcceptedOrReferenceAsset(entry.record))
  const byteProposalByAssetId = indexByteDescriptorProposalsByAssetId(records
    .filter((entry) => entry.record.schema === artifactKinds.mediaByteDescriptorProposalLocal)
    .map((entry) => entry.record))
  const byteProposalByContentId = indexByteDescriptorProposalsByContentId(records
    .filter((entry) => entry.record.schema === artifactKinds.mediaByteDescriptorProposalLocal)
    .map((entry) => entry.record))
  const resourceCandidateRecords = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaLocalLayerResourceRefCandidateLocal)
    .map((entry) => entry.record)
  const resourceCandidateBySubject = indexResourceCandidatesBySubject(resourceCandidateRecords)
  const resourceCandidateByAssetId = new Map(resourceCandidateRecords.map((record) => [record.sourceRef.id, record]))
  const missingByteDescriptorProposalAssetIds = []
  const missingByteDescriptorProposalContentIds = new Set()
  const missingResourceRefCandidateAssetIds = []
  const missingResourceRefCandidateSubjectRefs = new Set()
  const unresolvedResourceCandidateIds = []
  const alignedResourceCandidateIds = []
  const staleByteDescriptorProposalIds = []
  const staleResourceCandidateIds = []
  const assetExplanations = []
  const expectedContentIds = new Set()
  const expectedResourceSubjectRefs = new Set()
  const coveredContentIds = new Set()
  const coveredResourceSubjectRefs = new Set()

  for (const entry of acceptedOrReferenceAssets) {
    const assetId = entry.record.assetId
    const contentId = contentIdForRecord(entry.record)
    const resourceSubjectRef = resourceSubjectKeyForAsset(entry.record)
    expectedContentIds.add(contentId)
    expectedResourceSubjectRefs.add(resourceSubjectRef)
    const byteProposal = byteProposalByAssetId.get(assetId)
    const resourceCandidate = resourceCandidateBySubject.get(resourceSubjectRef) ??
      resourceCandidateByAssetId.get(assetId)
    const reasons = []
    const nextActions = []
    const issueCodes = []

    if (!byteProposal) {
      missingByteDescriptorProposalAssetIds.push(assetId)
      missingByteDescriptorProposalContentIds.add(contentId)
      issueCodes.push('missing_byte_descriptor_proposal')
      reasons.push('missing byte descriptor proposal')
      nextActions.push('Run npm run bytes:proposal for this project.')
    } else if (!byteProposalMatchesAsset(byteProposal, entry.record)) {
      staleByteDescriptorProposalIds.push(byteProposal.byteDescriptorProposalId)
      issueCodes.push('stale_byte_descriptor_proposal')
      reasons.push('stale byte descriptor proposal')
      nextActions.push('Regenerate byte descriptor proposals after asset changes.')
    } else {
      coveredContentIds.add(contentId)
    }

    if (!resourceCandidate) {
      missingResourceRefCandidateAssetIds.push(assetId)
      missingResourceRefCandidateSubjectRefs.add(resourceSubjectRef)
      issueCodes.push('missing_resource_ref_candidate')
      reasons.push('missing resource-ref candidate')
      nextActions.push('Run npm run resource:refs after byte proposals exist.')
    } else if (resourceCandidate.byteDescriptorAlignment?.status === 'aligned') {
      if (resourceCandidateMatchesAsset(resourceCandidate, entry.record)) {
        alignedResourceCandidateIds.push(resourceCandidate.resourceRefCandidateId)
        coveredResourceSubjectRefs.add(resourceSubjectRef)
      } else {
        staleResourceCandidateIds.push(resourceCandidate.resourceRefCandidateId)
        issueCodes.push('stale_resource_ref_candidate')
        reasons.push('stale resource-ref candidate')
        nextActions.push('Regenerate resource-ref candidates after asset changes.')
      }
    } else {
      unresolvedResourceCandidateIds.push(resourceCandidate.resourceRefCandidateId)
      issueCodes.push('unresolved_resource_ref_candidate')
      reasons.push(`resource-ref candidate alignment is ${resourceCandidate.byteDescriptorAlignment?.status ?? 'unknown'}`)
      nextActions.push('Resolve byte proposal/resource candidate alignment before handoff.')
    }

    if (isAcceptedAsset(entry.record) && !byteProposal && !resourceCandidate) {
      issueCodes.push('accepted_asset_without_byte_resource_posture')
      reasons.push('accepted asset has no byte/resource posture')
    }

    const healthState = reasons.length === 0 ? 'ready-for-local-inspection' : 'needs-local-attention'
    assetExplanations.push({
      subjectKind: 'media-asset',
      subjectRef: makeRef('media-asset', assetId, artifactKinds.mediaAssetDescriptor),
      assetId,
      contentId,
      situationRef: entry.record.situationRef,
      placementRef: entry.record.placementRef,
      resourceSubjectRef,
      path: entry.record.localRef?.path ?? entry.path,
      placementClass: entry.record.localRef?.placementClass ?? 'unknown',
      bytePosture: bytePostureFor({ contentId, byteProposal, issueCodes }),
      resourcePosture: resourcePostureFor({ resourceSubjectRef, resourceCandidate, issueCodes }),
      state: healthState,
      healthState,
      issueCodes,
      reasons: reasons.length === 0 ? ['asset has aligned byte proposal and resource-ref candidate'] : reasons,
      nextActions: Array.from(new Set(nextActions)),
      nextAction: nextAssetAction(issueCodes),
      summary: assetHealthSummary({
        assetId,
        path: entry.record.localRef?.path ?? entry.path,
        issueCodes
      }),
      sourceRefs: assetHealthSourceRefs({
        assetEntry: entry,
        byteProposal,
        resourceCandidate
      }),
      nonClaims: healthNonClaims({
        resourceAdmission: false,
        providerTruth: false
      }),
      localOnly: true,
      meshTruth: false,
      distributedProof: false,
      ratifiedSharedState: false,
      providerTruth: false,
      byteAvailabilityProof: false,
      materializationProof: false,
      resourceAdmission: false
    })
  }

  const warningCount = missingByteDescriptorProposalAssetIds.length +
    missingResourceRefCandidateAssetIds.length +
    unresolvedResourceCandidateIds.length +
    staleByteDescriptorProposalIds.length +
    staleResourceCandidateIds.length

  return {
    acceptedOrReferenceAssets: acceptedOrReferenceAssets.length,
    byteDescriptorProposalCoverage: coveredContentIds.size,
    byteDescriptorProposalRecords: byteProposalByContentId.size,
    byteDescriptorAssetCoverage: byteProposalByAssetId.size,
    resourceRefCandidateCoverage: coveredResourceSubjectRefs.size,
    resourceRefCandidateRecords: resourceCandidateBySubject.size,
    expectedContentIds: Array.from(expectedContentIds).sort(),
    expectedResourceSubjectRefs: Array.from(expectedResourceSubjectRefs).sort(),
    bytePosture: {
      keyKind: 'contentId',
      expectedContentIds: expectedContentIds.size,
      coveredContentIds: coveredContentIds.size,
      missingContentIds: Array.from(missingByteDescriptorProposalContentIds).sort(),
      staleProposalIds: staleByteDescriptorProposalIds,
      localOnly: true,
      byteAvailabilityProof: false,
      materializationProof: false
    },
    resourcePosture: {
      keyKind: 'assetDescriptorRef+situationRef+placementRef',
      expectedSituationPlacements: expectedResourceSubjectRefs.size,
      coveredSituationPlacements: coveredResourceSubjectRefs.size,
      missingSubjectRefs: Array.from(missingResourceRefCandidateSubjectRefs).sort(),
      unresolvedCandidateIds: unresolvedResourceCandidateIds,
      staleCandidateIds: staleResourceCandidateIds,
      localOnly: true,
      resourceAdmission: false,
      materializationProof: false
    },
    alignedResourceCandidateIds,
    missingByteDescriptorProposalAssetIds,
    missingByteDescriptorProposalContentIds: Array.from(missingByteDescriptorProposalContentIds).sort(),
    missingResourceRefCandidateAssetIds,
    missingResourceRefCandidateSubjectRefs: Array.from(missingResourceRefCandidateSubjectRefs).sort(),
    unresolvedResourceCandidateIds,
    staleByteDescriptorProposalIds,
    staleResourceCandidateIds,
    assetExplanations,
    readyForEdgeInspection: acceptedOrReferenceAssets.length > 0 && warningCount === 0,
    warningCount,
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    byteAvailabilityProof: false,
    materializationProof: false
  }
}

function assetHealthSummary({ assetId, path, issueCodes }) {
  if (issueCodes.length === 0) {
    return `${assetId} has current content-keyed byte posture and situation/placement resource posture for inspection.`
  }

  return `${path} needs local attention: ${issueCodes.join(', ')}.`
}

function bytePostureFor({ contentId, byteProposal, issueCodes }) {
  return {
    keyKind: 'contentId',
    contentId,
    state: issueCodes.includes('missing_byte_descriptor_proposal')
      ? 'missing'
      : issueCodes.includes('stale_byte_descriptor_proposal')
        ? 'stale'
        : 'covered',
    byteDescriptorProposalRef: byteProposal
      ? makeRef('media-byte-descriptor-proposal', byteProposal.byteDescriptorProposalId, byteProposal.schema)
      : null,
    byteAvailabilityProof: false,
    materializationProof: false,
    localOnly: true
  }
}

function resourcePostureFor({ resourceSubjectRef, resourceCandidate, issueCodes }) {
  return {
    keyKind: 'assetDescriptorRef+situationRef+placementRef',
    resourceSubjectRef,
    state: issueCodes.includes('missing_resource_ref_candidate')
      ? 'missing'
      : issueCodes.includes('stale_resource_ref_candidate')
        ? 'stale'
        : issueCodes.includes('unresolved_resource_ref_candidate')
          ? 'unresolved'
          : 'covered',
    resourceRefCandidateRef: resourceCandidate
      ? makeRef('media-local-layer-resource-ref-candidate', resourceCandidate.resourceRefCandidateId, resourceCandidate.schema)
      : null,
    resourceAdmission: false,
    materializationProof: false,
    localOnly: true
  }
}

function nextAssetAction(issueCodes) {
  if (issueCodes.includes('missing_byte_descriptor_proposal') && issueCodes.includes('missing_resource_ref_candidate')) {
    return 'Run npm run bytes:proposal, then npm run resource:refs.'
  }

  if (issueCodes.includes('missing_byte_descriptor_proposal') || issueCodes.includes('stale_byte_descriptor_proposal')) {
    return 'Run npm run bytes:proposal.'
  }

  if (issueCodes.includes('missing_resource_ref_candidate') || issueCodes.includes('stale_resource_ref_candidate') || issueCodes.includes('unresolved_resource_ref_candidate')) {
    return 'Run npm run resource:refs after byte proposals are current.'
  }

  return 'No local asset health action needed.'
}

function assetHealthSourceRefs({ assetEntry, byteProposal, resourceCandidate }) {
  return [
    {
      ...makeRef('media-asset-descriptor', assetEntry.record.assetId, assetEntry.record.schema),
      path: assetEntry.path,
      localOnly: true
    },
    byteProposal
      ? {
          ...makeRef('media-byte-descriptor-proposal', byteProposal.byteDescriptorProposalId, byteProposal.schema),
          localOnly: true
        }
      : null,
    resourceCandidate
      ? {
          ...makeRef('media-local-layer-resource-ref-candidate', resourceCandidate.resourceRefCandidateId, resourceCandidate.schema),
          localOnly: true
        }
      : null
  ].filter(Boolean)
}

function healthNonClaims(extra = {}) {
  return {
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    byteAvailabilityProof: false,
    materializationProof: false,
    resourceAdmission: false,
    providerTruth: false,
    causalTruth: false,
    publicationAuthorization: false,
    edgeApproval: false,
    ...extra
  }
}

function byteProposalMatchesAsset(byteProposal, assetDescriptor) {
  return contentIdForRecord(byteProposal) === contentIdForRecord(assetDescriptor) &&
    JSON.stringify(byteProposal.hash ?? null) === JSON.stringify(assetDescriptor.hash ?? null) &&
    JSON.stringify(byteProposal.proposedByteDescriptor?.digest ?? null) === JSON.stringify(assetDescriptor.hash ?? null) &&
    byteProposalIncludesAsset(byteProposal, assetDescriptor.assetId)
}

function resourceCandidateMatchesAsset(resourceCandidate, assetDescriptor) {
  return contentIdForRecord(resourceCandidate) === contentIdForRecord(assetDescriptor) &&
    JSON.stringify(resourceCandidate.proposedResourceRef?.hash ?? null) === JSON.stringify(assetDescriptor.hash ?? null) &&
    resourceCandidateIncludesAssetDescriptor(resourceCandidate, assetDescriptor) &&
    resourceCandidateIncludesSituation(resourceCandidate, assetDescriptor) &&
    resourceCandidateIncludesPlacement(resourceCandidate, assetDescriptor) &&
    JSON.stringify(resourceCandidate.proposedResourceRef?.localRef ?? null) === JSON.stringify(assetDescriptor.localRef ?? null)
}

function isAcceptedOrReferenceAsset(record) {
  const placementClass = record.localRef?.placementClass
  const localPath = record.localRef?.path
  return placementClass === 'media-accepted' ||
    placementClass === 'media-reference' ||
    localPath?.startsWith('media/accepted/') ||
    localPath?.startsWith('media/references/')
}

function isAcceptedAsset(record) {
  const placementClass = record.localRef?.placementClass
  const localPath = record.localRef?.path
  return placementClass === 'media-accepted' || localPath?.startsWith('media/accepted/')
}

function indexByteDescriptorProposalsByAssetId(records) {
  const index = new Map()

  for (const record of records) {
    for (const ref of assetRefsForByteProposal(record)) {
      if (!index.has(ref.id)) index.set(ref.id, record)
    }
  }

  return index
}

function indexByteDescriptorProposalsByContentId(records) {
  const index = new Map()

  for (const record of records) {
    const contentId = contentIdForRecord(record)
    if (contentId && !index.has(contentId)) index.set(contentId, record)
  }

  return index
}

function assetRefsForByteProposal(record) {
  if (Array.isArray(record.sourceAssetRefs) && record.sourceAssetRefs.length > 0) {
    return record.sourceAssetRefs
  }

  return record.sourceAssetRef ? [record.sourceAssetRef] : []
}

function byteProposalIncludesAsset(byteProposal, assetId) {
  return assetRefsForByteProposal(byteProposal).some((ref) => ref.id === assetId)
}

function contentIdForRecord(record) {
  return record.contentId ?? (record.hash?.algorithm === 'sha256' ? `sha256:${record.hash.value}` : undefined)
}

function indexResourceCandidatesBySubject(records) {
  const index = new Map()

  for (const record of records) {
    const key = resourceSubjectKeyForCandidate(record)
    if (key && !index.has(key)) index.set(key, record)
  }

  return index
}

function resourceSubjectKeyForAsset(assetDescriptor) {
  return [
    contentIdForRecord(assetDescriptor),
    assetDescriptor.assetDescriptorRef?.id ?? assetDescriptor.assetId,
    assetDescriptor.situationRef?.id ?? 'missing-situation',
    assetDescriptor.placementRef?.id ?? 'missing-placement',
    assetDescriptor.placementRef?.path ?? assetDescriptor.localRef?.path ?? 'missing-path'
  ].join('|')
}

function resourceSubjectKeyForCandidate(resourceCandidate) {
  const proposed = resourceCandidate.proposedResourceRef ?? {}

  return [
    contentIdForRecord(resourceCandidate) ?? proposed.contentId,
    resourceCandidate.sourceAssetDescriptorRef?.id ?? proposed.assetDescriptorRef?.id ?? resourceCandidate.sourceRef?.id,
    resourceCandidate.sourceSituationRef?.id ?? proposed.situationRef?.id ?? 'missing-situation',
    resourceCandidate.sourcePlacementRef?.id ?? proposed.placementRef?.id ?? 'missing-placement',
    resourceCandidate.sourcePlacementRef?.path ?? proposed.placementRef?.path ?? proposed.localRef?.path ?? 'missing-path'
  ].join('|')
}

function resourceCandidateIncludesAssetDescriptor(resourceCandidate, assetDescriptor) {
  const assetDescriptorId = assetDescriptor.assetDescriptorRef?.id ?? assetDescriptor.assetId
  const candidateAssetDescriptorId = resourceCandidate.sourceAssetDescriptorRef?.id ??
    resourceCandidate.proposedResourceRef?.assetDescriptorRef?.id ??
    resourceCandidate.sourceRef?.id
  return candidateAssetDescriptorId === assetDescriptorId
}

function resourceCandidateIncludesSituation(resourceCandidate, assetDescriptor) {
  if (!assetDescriptor.situationRef?.id) return true
  return (resourceCandidate.sourceSituationRef?.id ?? resourceCandidate.proposedResourceRef?.situationRef?.id) === assetDescriptor.situationRef.id
}

function resourceCandidateIncludesPlacement(resourceCandidate, assetDescriptor) {
  if (!assetDescriptor.placementRef?.id) return true
  return (resourceCandidate.sourcePlacementRef?.id ?? resourceCandidate.proposedResourceRef?.placementRef?.id) === assetDescriptor.placementRef.id
}

async function readProjectRecords(root) {
  const files = [
    ...await listJsonFiles(path.join(root, 'cards')),
    ...await listJsonFiles(path.join(root, 'records'))
  ]
  const records = []

  for (const file of files) {
    const relativePath = path.relative(root, file).split(path.sep).join('/')
    if (relativePath.startsWith('records/exports/bundles/')) continue
    const raw = JSON.parse(await readFile(file, 'utf8'))
    const record = raw.providerResult?.schema === artifactKinds.mediaProviderResult ? raw.providerResult : raw
    if (!record.schema) continue
    try {
      validateRequiredRecord(record)
    } catch (error) {
      if (relativePath.startsWith('records/exports/')) continue
      throw error
    }
    records.push({
      path: relativePath,
      record
    })
  }

  return records
}

async function readOptionalCard(root) {
  try {
    return JSON.parse(await readFile(path.join(root, 'cards', 'card.json'), 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return undefined
    throw error
  }
}

function countRecords(records) {
  const bySchema = (schema) => records.filter((entry) => entry.record.schema === schema).length
  const assetRecords = records.filter((entry) => entry.record.schema === artifactKinds.mediaAssetDescriptor)

  return {
    cards: bySchema(artifactKinds.mediaCard),
    references: assetRecords.filter((entry) => entry.record.localRef?.placementClass === 'media-reference').length,
    providerResults: bySchema(artifactKinds.mediaProviderResult),
    adapterRuns: bySchema(artifactKinds.mediaProviderAdapterRunLocal),
    assets: assetRecords.length,
    reviewEvidence: records.filter((entry) => entry.record.schema === artifactKinds.mediaEvidence && entry.record.evidenceKind === 'local-review').length,
    candidateReviews: bySchema(artifactKinds.mediaCandidateReviewLocal),
    continuityEvidence: bySchema(artifactKinds.mediaContinuityEvidenceLocal),
    productionUnits: bySchema(artifactKinds.mediaProductionUnit),
    referencePrimitives: bySchema(artifactKinds.mediaReferencePrimitive),
    continuityBands: bySchema(artifactKinds.mediaContinuityBand),
    renderStrategies: bySchema(artifactKinds.mediaRenderStrategy),
    productionDescriptors: bySchema(artifactKinds.mediaProductionDescriptorLocal),
    approvalProposals: bySchema(artifactKinds.mediaApprovalProposalLocal),
    byteDescriptorProposals: bySchema(artifactKinds.mediaByteDescriptorProposalLocal),
    resourceRefCandidates: bySchema(artifactKinds.mediaLocalLayerResourceRefCandidateLocal),
    decisions: bySchema(artifactKinds.mediaOperatorDecision),
    manifests: bySchema(artifactKinds.mediaLocalRunManifest),
    inspectionPackets: bySchema(artifactKinds.mediaEdgeInspectionPacketLocal),
    exportBundles: bySchema(artifactKinds.mediaEdgeExportBundleLocal),
    providerLedgers: bySchema(artifactKinds.mediaProviderRunLedgerLocal)
  }
}

function latestRecordRefs(records) {
  const refs = {}

  for (const entry of records) {
    const schema = entry.record.schema
    refs[schema] = {
      ...makeRef(schema, entry.path, schema),
      path: entry.path,
      localOnly: true
    }
  }

  return refs
}

async function listJsonFiles(root) {
  let dirents
  try {
    dirents = await readdir(root, { withFileTypes: true })
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }

  const files = []

  for (const dirent of dirents) {
    const fullPath = path.join(root, dirent.name)
    if (dirent.isDirectory()) {
      files.push(...await listJsonFiles(fullPath))
    } else if (dirent.isFile() && dirent.name.endsWith('.json')) {
      files.push(fullPath)
    }
  }

  return files.sort()
}

if (process.argv[1] === modulePath) {
  await writeProjectStatus(parseArgs(process.argv.slice(2)))
}
