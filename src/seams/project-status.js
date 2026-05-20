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
    warnings.push('Some accepted/reference assets are missing byte proposals or resource-ref candidate alignment.')
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
    console.log(`project status: ${output}`)
    for (const [name, count] of Object.entries(counts)) {
      console.log(`${name}: ${count}`)
    }
    console.log(`assetResourceReady: ${assetResourceConsistency.readyForEdgeInspection}`)
    console.log(`assetResourceWarnings: ${assetResourceConsistency.warningCount}`)
  }

  return {
    status,
    output
  }
}

function summarizeAssetResourceConsistency(records) {
  const acceptedOrReferenceAssets = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaAssetDescriptor)
    .filter((entry) => isAcceptedOrReferenceAsset(entry.record))
  const byteProposalByAssetId = new Map(records
    .filter((entry) => entry.record.schema === artifactKinds.mediaByteDescriptorProposalLocal)
    .map((entry) => [entry.record.sourceAssetRef.id, entry.record]))
  const resourceCandidateByAssetId = new Map(records
    .filter((entry) => entry.record.schema === artifactKinds.mediaLocalLayerResourceRefCandidateLocal)
    .map((entry) => [entry.record.sourceRef.id, entry.record]))
  const missingByteDescriptorProposalAssetIds = []
  const missingResourceRefCandidateAssetIds = []
  const unresolvedResourceCandidateIds = []
  const alignedResourceCandidateIds = []
  const staleByteDescriptorProposalIds = []
  const staleResourceCandidateIds = []
  const assetExplanations = []

  for (const entry of acceptedOrReferenceAssets) {
    const assetId = entry.record.assetId
    const byteProposal = byteProposalByAssetId.get(assetId)
    const resourceCandidate = resourceCandidateByAssetId.get(assetId)
    const reasons = []
    const nextActions = []

    if (!byteProposal) {
      missingByteDescriptorProposalAssetIds.push(assetId)
      reasons.push('missing byte descriptor proposal')
      nextActions.push('Run npm run bytes:proposal for this project.')
    } else if (!byteProposalMatchesAsset(byteProposal, entry.record)) {
      staleByteDescriptorProposalIds.push(byteProposal.byteDescriptorProposalId)
      reasons.push('stale byte descriptor proposal')
      nextActions.push('Regenerate byte descriptor proposals after asset changes.')
    }

    if (!resourceCandidate) {
      missingResourceRefCandidateAssetIds.push(assetId)
      reasons.push('missing resource-ref candidate')
      nextActions.push('Run npm run resource:refs after byte proposals exist.')
    } else if (resourceCandidate.byteDescriptorAlignment?.status === 'aligned') {
      if (resourceCandidateMatchesAsset(resourceCandidate, entry.record)) {
        alignedResourceCandidateIds.push(resourceCandidate.resourceRefCandidateId)
      } else {
        staleResourceCandidateIds.push(resourceCandidate.resourceRefCandidateId)
        reasons.push('stale resource-ref candidate')
        nextActions.push('Regenerate resource-ref candidates after asset changes.')
      }
    } else {
      unresolvedResourceCandidateIds.push(resourceCandidate.resourceRefCandidateId)
      reasons.push(`resource-ref candidate alignment is ${resourceCandidate.byteDescriptorAlignment?.status ?? 'unknown'}`)
      nextActions.push('Resolve byte proposal/resource candidate alignment before handoff.')
    }

    assetExplanations.push({
      assetId,
      path: entry.record.localRef?.path ?? entry.path,
      placementClass: entry.record.localRef?.placementClass ?? 'unknown',
      state: reasons.length === 0 ? 'ready-for-local-inspection' : 'needs-local-attention',
      reasons: reasons.length === 0 ? ['asset has aligned byte proposal and resource-ref candidate'] : reasons,
      nextActions: Array.from(new Set(nextActions)),
      localOnly: true,
      meshTruth: false,
      distributedProof: false,
      ratifiedSharedState: false,
      byteAvailabilityProof: false,
      materializationProof: false
    })
  }

  const warningCount = missingByteDescriptorProposalAssetIds.length +
    missingResourceRefCandidateAssetIds.length +
    unresolvedResourceCandidateIds.length +
    staleByteDescriptorProposalIds.length +
    staleResourceCandidateIds.length

  return {
    acceptedOrReferenceAssets: acceptedOrReferenceAssets.length,
    byteDescriptorProposalCoverage: byteProposalByAssetId.size,
    resourceRefCandidateCoverage: resourceCandidateByAssetId.size,
    alignedResourceCandidateIds,
    missingByteDescriptorProposalAssetIds,
    missingResourceRefCandidateAssetIds,
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

function byteProposalMatchesAsset(byteProposal, assetDescriptor) {
  return JSON.stringify(byteProposal.hash ?? null) === JSON.stringify(assetDescriptor.hash ?? null) &&
    JSON.stringify(byteProposal.localRef ?? null) === JSON.stringify(assetDescriptor.localRef ?? null) &&
    JSON.stringify(byteProposal.proposedByteDescriptor?.digest ?? null) === JSON.stringify(assetDescriptor.hash ?? null) &&
    JSON.stringify(byteProposal.proposedByteDescriptor?.localRef ?? null) === JSON.stringify(assetDescriptor.localRef ?? null)
}

function resourceCandidateMatchesAsset(resourceCandidate, assetDescriptor) {
  return JSON.stringify(resourceCandidate.proposedResourceRef?.hash ?? null) === JSON.stringify(assetDescriptor.hash ?? null) &&
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
