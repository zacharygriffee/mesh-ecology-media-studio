import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  createByteReferencePreview,
  createEdgeInspectionPacket,
  makeRef
} from '../contracts/constructors.js'
import { artifactKinds } from '../contracts/artifact-kinds.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import { assertSafeLocalPath } from '../local/project-layout.js'
import { createMediaSummary } from '../assets/media-summary.js'
import { readProjectRecords } from './project-status.js'

const modulePath = fileURLToPath(import.meta.url)

const defaultProjectDir = 'examples/venice-smoke'
const outputRef = 'records/exports/venice-smoke-edge-inspection-packet.local.json'

const recordPaths = Object.freeze({
  manifest: 'records/manifests/venice-live-smoke-manifest.local.json',
  workPacket: 'records/work-packets/venice-live-smoke-work-packet.local.json',
  generationRequest: 'records/work-packets/venice-live-smoke-generation-request.local.json',
  providerResult: 'records/provider-results/venice-live-smoke-provider-result.local.json',
  adapterRun: 'records/provider-results/venice-live-smoke-adapter-run.local.json',
  assetDescriptor: 'records/assets/venice-live-smoke-asset-0.local.json',
  imageMetadata: 'records/assets/venice-live-smoke-image-metadata-0.local.json',
  reviewEvidence: 'records/evidence/venice-live-smoke-0-evidence.local.json',
  readiness: 'records/readiness/venice-live-smoke-0-readiness.local.json',
  operatorDecision: 'records/decisions/venice-live-smoke-0-decision.local.json'
})

function parseArgs(argv) {
  const args = {
    projectDir: defaultProjectDir,
    output: outputRef,
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

export async function inspectVeniceSmoke({
  projectDir = defaultProjectDir,
  output = outputRef,
  print = false
} = {}) {
  assertSafeLocalPath(output)

  const root = path.resolve(projectDir)
  const records = {}

  for (const [name, relativePath] of Object.entries(recordPaths)) {
    assertSafeLocalPath(relativePath)
    const rawRecord = name === 'imageMetadata'
      ? await readOptionalJson(root, relativePath)
      : await readRequiredJson(root, relativePath)
    if (!rawRecord) continue
    records[name] = name === 'providerResult' ? rawRecord.providerResult : rawRecord
    validateRequiredRecord(records[name])
  }

  const assetLocalRef = records.assetDescriptor.localRef
  if (!assetLocalRef?.path) {
    throw new Error('Venice smoke asset descriptor is missing localRef.path')
  }

  await assertLocalFileExists(root, assetLocalRef.path)
  const assetRef = makeRef('media-asset', records.assetDescriptor.assetId, records.assetDescriptor.schema)
  const projectRecords = await readProjectRecords(root)
  const mediaSummary = await createMediaSummary({ projectDir })
  const promotedAssets = projectRecords
    .filter((entry) => entry.record.schema === artifactKinds.mediaAssetDescriptor)
    .filter((entry) => ['media-accepted', 'media-rejected'].includes(entry.record.localRef?.placementClass))
    .filter((entry) => entry.record.source?.sourceType === 'provider-result')
  const derivatives = projectRecords
    .filter((entry) => entry.record.schema === artifactKinds.mediaDerivativeLocal)
  const byteProposals = projectRecords
    .filter((entry) => entry.record.schema === artifactKinds.mediaByteDescriptorProposalLocal)
  const resourceCandidates = projectRecords
    .filter((entry) => entry.record.schema === artifactKinds.mediaLocalLayerResourceRefCandidateLocal)
  const productionCapsules = projectRecords
    .filter((entry) => entry.record.schema === artifactKinds.mediaProductionAssetCapsuleLocal)
  const productionBundles = projectRecords
    .filter((entry) => entry.record.schema === artifactKinds.mediaProductionBundleLocal)
  const optionalWarnings = []
  const promotedArtifactRefs = await optionalPromotedArtifactRefs({ root, promotedAssets, warnings: optionalWarnings })
  const derivativeArtifactRefs = await optionalDerivativeArtifactRefs({ root, derivatives, warnings: optionalWarnings })

  const packet = createEdgeInspectionPacket({
    sourceRunRef: localRecordRef('media-local-run-manifest', recordPaths.manifest, records.manifest.schema),
    recordRefs: {
      manifest: localRecordRef('media-local-run-manifest', recordPaths.manifest, records.manifest.schema),
      workPacket: localRecordRef('media-work-packet', recordPaths.workPacket, records.workPacket.schema),
      generationRequest: localRecordRef('media-generation-request', recordPaths.generationRequest, records.generationRequest.schema),
      providerResult: localRecordRef('media-provider-result', recordPaths.providerResult, records.providerResult.schema),
      adapterRun: localRecordRef('media-provider-adapter-run', recordPaths.adapterRun, records.adapterRun.schema),
      assetDescriptor: localRecordRef('media-asset', recordPaths.assetDescriptor, records.assetDescriptor.schema),
      ...(records.imageMetadata ? {
        imageMetadata: localRecordRef('media-image-metadata', recordPaths.imageMetadata, records.imageMetadata.schema)
      } : {}),
      reviewEvidence: localRecordRef('media-evidence', recordPaths.reviewEvidence, records.reviewEvidence.schema),
      readiness: localRecordRef('media-readiness', recordPaths.readiness, records.readiness.schema),
      operatorDecision: localRecordRef('media-operator-decision', recordPaths.operatorDecision, records.operatorDecision.schema),
      ...Object.fromEntries(productionCapsules.map((entry) => [
        `productionAssetCapsule:${path.basename(entry.path, '.json')}`,
        localRecordRef('media-production-asset-capsule', entry.path, entry.record.schema)
      ])),
      ...Object.fromEntries(productionBundles.map((entry) => [
        `productionBundle:${path.basename(entry.path, '.json')}`,
        localRecordRef('media-production-bundle', entry.path, entry.record.schema)
      ]))
    },
    artifactKinds: [
      records.manifest.schema,
      records.workPacket.schema,
      records.generationRequest.schema,
      records.providerResult.schema,
      records.adapterRun.schema,
      records.assetDescriptor.schema,
      records.imageMetadata?.schema,
      records.reviewEvidence.schema,
      records.readiness.schema,
      records.operatorDecision.schema,
      ...promotedAssets.map((entry) => entry.record.schema),
      ...derivatives.map((entry) => entry.record.schema),
      ...byteProposals.map((entry) => entry.record.schema),
      ...resourceCandidates.map((entry) => entry.record.schema),
      ...productionCapsules.map((entry) => entry.record.schema),
      ...productionBundles.map((entry) => entry.record.schema),
      'media.byte_reference.preview.local.v1',
      'media.edge_inspection_packet.local.v1'
    ].filter(Boolean),
    generatedArtifactRefs: [
      {
        kind: 'media-generated-asset',
        id: records.assetDescriptor.assetId,
        schema: records.assetDescriptor.schema,
        path: assetLocalRef.path,
        hash: records.assetDescriptor.hash,
        contentType: records.assetDescriptor.contentType,
        byteRefPreview: createByteReferencePreview({
          sourceRef: assetRef,
          localRef: assetLocalRef,
          hash: records.assetDescriptor.hash,
          size: records.assetDescriptor.size,
          contentType: records.assetDescriptor.contentType
        }),
        imageMetadataRef: records.imageMetadata
          ? localRecordRef('media-image-metadata', recordPaths.imageMetadata, records.imageMetadata.schema)
          : undefined,
        localOnly: true
      },
      ...promotedArtifactRefs,
      ...derivativeArtifactRefs
    ],
    warnings: [
      'Local inspection packet only; not Edge integration.',
      'All refs are local paths and not mesh truth.',
      'Local file existence and hash are not byte availability proof.',
      'Local operator decision is not ratifier authority.',
      ...optionalWarnings
    ]
  })
  packet.operationalSummary = createVeniceOperationalSummary(mediaSummary, {
    promotedAssets,
    derivatives,
    byteProposals,
    resourceCandidates,
    productionCapsules,
    productionBundles
  })

  validateRequiredRecord(packet)

  const outputPath = path.join(root, output)
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(packet, null, 2)}\n`)

  if (print) {
    console.log(JSON.stringify(packet, null, 2))
  } else {
    console.log(`Wrote Venice smoke inspection packet: ${output}`)
    printVeniceInspectionSummary(packet.operationalSummary)
  }

  return {
    packet,
    output
  }
}

async function readRequiredJson(root, relativePath) {
  try {
    return JSON.parse(await readFile(path.join(root, relativePath), 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Missing Venice smoke inspection record: ${relativePath}`)
    }

    throw error
  }
}

async function readOptionalJson(root, relativePath) {
  try {
    return JSON.parse(await readFile(path.join(root, relativePath), 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return undefined
    throw error
  }
}

async function optionalPromotedArtifactRefs({ root, promotedAssets, warnings }) {
  const refs = []

  for (const entry of promotedAssets) {
    const asset = entry.record
    if (!asset.localRef?.path || !await localFileExists(root, asset.localRef.path)) {
      warnings.push(`Promoted asset local file was not found for inspection: ${asset.localRef?.path ?? entry.path}`)
      continue
    }
    const assetRef = makeRef('media-asset', asset.assetId, asset.schema)
    refs.push({
      kind: 'media-promoted-asset',
      id: asset.assetId,
      schema: asset.schema,
      path: asset.localRef.path,
      placementClass: asset.localRef.placementClass,
      lifecycleState: asset.provenance?.lifecycle?.state,
      hash: asset.hash,
      contentType: asset.contentType,
      byteRefPreview: createByteReferencePreview({
        sourceRef: assetRef,
        localRef: asset.localRef,
        hash: asset.hash,
        size: asset.size,
        contentType: asset.contentType
      }),
      localOnly: true,
      meshTruth: false,
      byteAvailabilityProof: false,
      materializationProof: false,
      resourceAdmission: false
    })
  }

  return refs
}

async function optionalDerivativeArtifactRefs({ root, derivatives, warnings }) {
  const refs = []

  for (const entry of derivatives) {
    const derivative = entry.record
    const localRef = derivative.derivativeLocalRef
    if (!localRef?.path || !await localFileExists(root, localRef.path)) {
      warnings.push(`Derivative local file was not found for inspection: ${localRef?.path ?? entry.path}`)
      continue
    }
    refs.push({
      kind: 'media-derivative',
      id: derivative.derivativeId,
      schema: derivative.schema,
      derivativeKind: derivative.derivativeKind,
      path: localRef.path,
      sourceLocalRef: derivative.sourceLocalRef,
      derivativeSubjectRef: derivative.derivativeSubjectRef,
      localOnly: true,
      meshTruth: false,
      byteAvailabilityProof: false,
      materializationProof: false,
      resourceAdmission: false
    })
  }

  return refs
}

function createVeniceOperationalSummary(mediaSummary, {
  promotedAssets,
  derivatives,
  byteProposals,
  resourceCandidates,
  productionCapsules,
  productionBundles
}) {
  return {
    summaryKind: 'venice-smoke-operational-summary',
    projectId: mediaSummary.projectId,
    generatedCandidates: mediaSummary.generatedCandidates,
    derivativeReadiness: {
      readyAssets: mediaSummary.derivativeReadiness.readyAssets,
      evaluatedAssets: mediaSummary.derivativeReadiness.evaluatedAssets,
      attentionAssets: mediaSummary.derivativeReadiness.attentionAssets,
      issueCodes: mediaSummary.derivativeReadiness.issueCodes
    },
    derivatives: mediaSummary.derivatives,
    identity: {
      byteContent: mediaSummary.identity.byteContent,
      resourceSituations: mediaSummary.identity.resourceSituations
    },
    recordCounts: {
      promotedAssets: promotedAssets.length,
      derivatives: derivatives.length,
      byteDescriptorProposals: byteProposals.length,
      resourceRefCandidates: resourceCandidates.length,
      productionAssetCapsules: productionCapsules.length,
      productionBundles: productionBundles.length
    },
    recordRefs: {
      promotedAssets: promotedAssets.map((entry) => localRecordRef('media-asset', entry.path, entry.record.schema)),
      derivatives: derivatives.map((entry) => localRecordRef('media-derivative', entry.path, entry.record.schema)),
      byteDescriptorProposals: byteProposals.map((entry) => localRecordRef('media-byte-descriptor-proposal', entry.path, entry.record.schema)),
      resourceRefCandidates: resourceCandidates.map((entry) => localRecordRef('media-resource-ref-candidate', entry.path, entry.record.schema)),
      productionAssetCapsules: productionCapsules.map((entry) => localRecordRef('media-production-asset-capsule', entry.path, entry.record.schema)),
      productionBundles: productionBundles.map((entry) => localRecordRef('media-production-bundle', entry.path, entry.record.schema))
    },
    localOnly: true,
    operatorGuidanceOnly: true,
    meshTruth: false,
    providerTruth: false,
    byteAvailabilityProof: false,
    materializationProof: false,
    resourceAdmission: false,
    publicationAuthorization: false
  }
}

function printVeniceInspectionSummary(summary) {
  console.log([
    `venice smoke summary: generated=${summary.generatedCandidates.total}`,
    `reviewed=${summary.generatedCandidates.reviewed}`,
    `promotedAccepted=${summary.generatedCandidates.promotedAccepted}`,
    `promotedRejected=${summary.generatedCandidates.promotedRejected}`,
    `derivatives=${summary.derivativeReadiness.readyAssets}/${summary.derivativeReadiness.evaluatedAssets}`,
    `byteContent=${summary.identity.byteContent.coveredContentIds}/${summary.identity.byteContent.expectedContentIds}`,
    `resourceSituations=${summary.identity.resourceSituations.coveredSituationPlacements}/${summary.identity.resourceSituations.expectedSituationPlacements}`
  ].join(' | '))
  console.log('nonClaims: local-only; no Edge call; no mesh truth; no byte/materialization proof; no resource admission')
}

async function assertLocalFileExists(root, relativePath) {
  assertSafeLocalPath(relativePath)

  try {
    await access(path.join(root, relativePath))
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Missing Venice smoke generated artifact: ${relativePath}`)
    }

    throw error
  }
}

async function localFileExists(root, relativePath) {
  assertSafeLocalPath(relativePath)

  try {
    await access(path.join(root, relativePath))
    return true
  } catch (error) {
    if (error.code === 'ENOENT') return false
    throw error
  }
}

function localRecordRef(kind, relativePath, schema) {
  return {
    ...makeRef(kind, relativePath, schema),
    path: relativePath,
    localOnly: true
  }
}

if (process.argv[1] === modulePath) {
  await inspectVeniceSmoke(parseArgs(process.argv.slice(2)))
}
