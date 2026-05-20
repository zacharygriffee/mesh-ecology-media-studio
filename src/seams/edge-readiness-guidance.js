import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { artifactKinds } from '../contracts/artifact-kinds.js'
import { createReadiness, makeRef } from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import { assertSafeLocalPath } from '../local/project-layout.js'

const modulePath = fileURLToPath(import.meta.url)
const defaultProjectDir = 'examples/card-to-candidate'
const defaultOutput = 'records/readiness/media-edge-inspection-readiness.local.json'
const eligiblePlacementClasses = new Set(['media-accepted', 'media-reference'])

function parseArgs(argv) {
  const args = {
    projectDir: defaultProjectDir,
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

export async function writeEdgeReadinessGuidance({
  projectDir = defaultProjectDir,
  output = defaultOutput,
  print = false,
  quiet = false
} = {}) {
  assertSafeLocalPath(output)
  const root = path.resolve(projectDir)
  const records = await readRecords(root)
  const projectId = projectIdFor(records, root)
  const acceptedOrReferenceAssets = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaAssetDescriptor)
    .filter((entry) => isEligibleAsset(entry.record))
  const byteDescriptorProposals = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaByteDescriptorProposalLocal)
  const resourceRefCandidates = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaLocalLayerResourceRefCandidateLocal)
  const byteProposalByAssetId = indexByteDescriptorProposalsByAssetId(byteDescriptorProposals)
  const byteProposalByContentId = indexByteDescriptorProposalsByContentId(byteDescriptorProposals)
  const resourceCandidateBySubject = indexResourceCandidatesBySubject(resourceRefCandidates)
  const resourceCandidateByAssetId = new Map(resourceRefCandidates.map((entry) => [entry.record.sourceRef.id, entry]))
  const missingByteDescriptorProposalAssetIds = []
  const missingByteDescriptorProposalContentIds = new Set()
  const missingResourceRefCandidateAssetIds = []
  const missingResourceRefCandidateSubjectRefs = new Set()
  const unresolvedResourceCandidateIds = []
  const staleByteDescriptorProposalIds = []
  const staleResourceCandidateIds = []
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
    const byteProposalEntry = byteProposalByAssetId.get(assetId)
    if (!byteProposalEntry) {
      missingByteDescriptorProposalAssetIds.push(assetId)
      missingByteDescriptorProposalContentIds.add(contentId)
    } else if (!byteProposalMatchesAsset(byteProposalEntry.record, entry.record)) {
      staleByteDescriptorProposalIds.push(byteProposalEntry.record.byteDescriptorProposalId)
    } else {
      coveredContentIds.add(contentId)
    }

    const resourceCandidateEntry = resourceCandidateBySubject.get(resourceSubjectRef) ??
      resourceCandidateByAssetId.get(assetId)
    if (!resourceCandidateEntry) {
      missingResourceRefCandidateAssetIds.push(assetId)
      missingResourceRefCandidateSubjectRefs.add(resourceSubjectRef)
    } else if (resourceCandidateEntry.record.byteDescriptorAlignment?.status !== 'aligned') {
      unresolvedResourceCandidateIds.push(resourceCandidateEntry.record.resourceRefCandidateId)
    } else if (!resourceCandidateMatchesAsset(resourceCandidateEntry.record, entry.record)) {
      staleResourceCandidateIds.push(resourceCandidateEntry.record.resourceRefCandidateId)
    } else {
      coveredResourceSubjectRefs.add(resourceSubjectRef)
    }
  }

  const state = readinessState({
    acceptedOrReferenceAssets,
    expectedContentIds,
    expectedResourceSubjectRefs,
    byteProposalByContentId,
    resourceCandidateBySubject,
    missingByteDescriptorProposalAssetIds,
    missingByteDescriptorProposalContentIds,
    missingResourceRefCandidateAssetIds,
    missingResourceRefCandidateSubjectRefs,
    unresolvedResourceCandidateIds,
    staleByteDescriptorProposalIds,
    staleResourceCandidateIds
  })
  const reasons = readinessReasons({
    acceptedOrReferenceAssets,
    missingByteDescriptorProposalContentIds,
    missingResourceRefCandidateSubjectRefs,
    missingByteDescriptorProposalAssetIds,
    missingResourceRefCandidateAssetIds,
    unresolvedResourceCandidateIds,
    staleByteDescriptorProposalIds,
    staleResourceCandidateIds
  })
  const nextActions = readinessNextActions({
    missingByteDescriptorProposalAssetIds,
    missingResourceRefCandidateAssetIds,
    unresolvedResourceCandidateIds,
    staleByteDescriptorProposalIds,
    staleResourceCandidateIds
  })
  const readiness = createReadiness({
    subjectRef: makeRef('media-project', projectId, 'media.project.local'),
    state,
    reasons,
    nextActions
  })
  readiness.readinessId = `readiness-edge-inspection-${projectId}`
  readiness.resolvabilitySummary = {
    acceptedOrReferenceAssets: acceptedOrReferenceAssets.length,
    byteDescriptorProposals: byteDescriptorProposals.length,
    resourceRefCandidates: resourceRefCandidates.length,
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
    missingByteDescriptorProposalAssetIds,
    missingByteDescriptorProposalContentIds: Array.from(missingByteDescriptorProposalContentIds).sort(),
    missingResourceRefCandidateAssetIds,
    missingResourceRefCandidateSubjectRefs: Array.from(missingResourceRefCandidateSubjectRefs).sort(),
    unresolvedResourceCandidateIds,
    staleByteDescriptorProposalIds,
    staleResourceCandidateIds,
    currentCategory: 'device_dependent_scaffold',
    targetCategory: 'local_layer_resource_ref',
    localJsonIsScaffold: true,
    edgeRuntimeRequired: false
  }
  readiness.edgeInspectionGuidance = {
    seam: 'media-edge-operator-seam',
    edgeRequired: false,
    operatorGuidanceOnly: true,
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false
  }

  validateRequiredRecord(readiness)

  const outputPath = path.join(root, output)
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(readiness, null, 2)}\n`)

  if (print) {
    console.log(JSON.stringify(readiness, null, 2))
  } else if (!quiet) {
    console.log(`edge readiness guidance: ${output}`)
    console.log(`state: ${readiness.state}`)
  }

  return {
    readiness,
    output
  }
}

async function readRecords(root) {
  const files = [
    ...await listJsonFiles(path.join(root, 'cards')),
    ...await listJsonFiles(path.join(root, 'records'))
  ]
  const entries = []

  for (const file of files) {
    const relativePath = path.relative(root, file).split(path.sep).join('/')
    if (relativePath.startsWith('records/exports/bundles/')) continue
    const record = JSON.parse(await readFile(file, 'utf8'))
    if (!record.schema) continue
    try {
      validateRequiredRecord(record)
    } catch (error) {
      if (relativePath.startsWith('records/exports/')) continue
      throw error
    }
    entries.push({
      path: relativePath,
      record
    })
  }

  return entries
}

function projectIdFor(records, root) {
  return records.find((entry) => entry.record.projectId)?.record.projectId ?? path.basename(root)
}

function isEligibleAsset(record) {
  const placementClass = record.localRef?.placementClass
  const localPath = record.localRef?.path
  return eligiblePlacementClasses.has(placementClass) ||
    localPath?.startsWith('media/accepted/') ||
    localPath?.startsWith('media/references/')
}

function readinessState({
  acceptedOrReferenceAssets,
  missingByteDescriptorProposalAssetIds,
  missingResourceRefCandidateAssetIds,
  unresolvedResourceCandidateIds,
  staleByteDescriptorProposalIds,
  staleResourceCandidateIds
}) {
  if (acceptedOrReferenceAssets.length === 0) return 'blocked'
  if (
    missingByteDescriptorProposalAssetIds.length === 0 &&
    missingResourceRefCandidateAssetIds.length === 0 &&
    unresolvedResourceCandidateIds.length === 0 &&
    staleByteDescriptorProposalIds.length === 0 &&
    staleResourceCandidateIds.length === 0
  ) {
    return 'ready'
  }

  return 'caution'
}

function readinessReasons({
  acceptedOrReferenceAssets,
  missingByteDescriptorProposalContentIds,
  missingResourceRefCandidateSubjectRefs,
  missingByteDescriptorProposalAssetIds,
  missingResourceRefCandidateAssetIds,
  unresolvedResourceCandidateIds,
  staleByteDescriptorProposalIds,
  staleResourceCandidateIds
}) {
  const reasons = [
    'Edge inspection readiness is local operator guidance only.',
    'Local JSON records and file paths remain device-dependent scaffold until promoted by a future local layer.'
  ]

  if (acceptedOrReferenceAssets.length === 0) {
    reasons.push('No accepted or reference asset descriptors were found for Edge inspection.')
  }

  if (missingByteDescriptorProposalAssetIds.length > 0) {
    reasons.push(`${missingByteDescriptorProposalContentIds.size ?? missingByteDescriptorProposalContentIds.length} content ids are missing byte descriptor proposals.`)
  }

  if (missingResourceRefCandidateAssetIds.length > 0) {
    reasons.push(`${missingResourceRefCandidateSubjectRefs.size ?? missingResourceRefCandidateSubjectRefs.length} situation/placement resource subjects are missing resource-ref candidates.`)
  }

  if (unresolvedResourceCandidateIds.length > 0) {
    reasons.push(`${unresolvedResourceCandidateIds.length} resource-ref candidates are missing byte descriptor alignment.`)
  }

  if (staleByteDescriptorProposalIds.length > 0) {
    reasons.push(`${staleByteDescriptorProposalIds.length} byte descriptor proposals do not match current asset content/hash refs.`)
  }

  if (staleResourceCandidateIds.length > 0) {
    reasons.push(`${staleResourceCandidateIds.length} resource-ref candidates do not match current asset hash/localRef.`)
  }

  if (reasons.length === 2) {
    reasons.push('Accepted/reference assets have content-keyed byte posture and situation/placement resource posture for later Edge inspection.')
  }

  return reasons
}

function readinessNextActions({
  missingByteDescriptorProposalAssetIds,
  missingResourceRefCandidateAssetIds,
  unresolvedResourceCandidateIds,
  staleByteDescriptorProposalIds,
  staleResourceCandidateIds
}) {
  const actions = []

  if (missingByteDescriptorProposalAssetIds.length > 0 || unresolvedResourceCandidateIds.length > 0 || staleByteDescriptorProposalIds.length > 0 || staleResourceCandidateIds.length > 0) {
    actions.push('Run npm run bytes:proposal to refresh contentId-keyed byte posture before treating resource refs as aligned candidates.')
  }

  if (missingResourceRefCandidateAssetIds.length > 0 || unresolvedResourceCandidateIds.length > 0 || staleResourceCandidateIds.length > 0) {
    actions.push('Run npm run resource:refs to refresh situation/placement resource candidates after byte descriptor proposals are current.')
  }

  if (actions.length === 0) {
    actions.push('Export or inspect local records when Edge review is needed; do not claim Edge runtime verification.')
  }

  actions.push('Keep mesh publication, ratifier authority, and materialization proof deferred to their proper lanes.')
  return actions
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

function indexByteDescriptorProposalsByAssetId(entries) {
  const index = new Map()

  for (const entry of entries) {
    for (const ref of assetRefsForByteProposal(entry.record)) {
      if (!index.has(ref.id)) index.set(ref.id, entry)
    }
  }

  return index
}

function indexByteDescriptorProposalsByContentId(entries) {
  const index = new Map()

  for (const entry of entries) {
    const contentId = contentIdForRecord(entry.record)
    if (contentId && !index.has(contentId)) index.set(contentId, entry)
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

function indexResourceCandidatesBySubject(entries) {
  const index = new Map()

  for (const entry of entries) {
    const key = resourceSubjectKeyForCandidate(entry.record)
    if (key && !index.has(key)) index.set(key, entry)
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
  await writeEdgeReadinessGuidance(parseArgs(process.argv.slice(2)))
}
