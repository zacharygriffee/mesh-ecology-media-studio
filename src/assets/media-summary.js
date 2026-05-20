import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { artifactKinds } from '../contracts/artifact-kinds.js'
import { writeProjectStatus, readProjectRecords } from '../seams/project-status.js'

const modulePath = fileURLToPath(import.meta.url)

function parseArgs(argv) {
  const args = {
    projectDir: 'examples/card-to-candidate',
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

export async function createMediaSummary({
  projectDir = 'examples/card-to-candidate'
} = {}) {
  const root = path.resolve(projectDir)
  const { status } = await writeProjectStatus({ projectDir, quiet: true })
  const records = await readProjectRecords(root)
  const assetRecords = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaAssetDescriptor)
    .map((entry) => entry.record)
  const derivativeRecords = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaDerivativeLocal)
    .map((entry) => entry.record)
  const mediaKinds = countBy(assetRecords, (record) => mediaKindForAsset(record))
  const placementClasses = countBy(assetRecords, (record) => record.localRef?.placementClass ?? 'unknown')
  const lifecycleStates = countBy(assetRecords, (record) => record.provenance?.lifecycle?.state ?? 'unknown')
  const derivativeKinds = countBy(derivativeRecords, (record) => record.derivativeKind ?? 'unknown')
  const generatedCandidates = summarizeGeneratedCandidates(assetRecords, records)
  const derivativeReadiness = status.mediaDerivativeReadiness
  const attentionRows = derivativeReadiness.assetExplanations
    .filter((entry) => entry.state !== 'ready-for-local-inspection')
    .map((entry) => ({
      subjectRef: entry.subjectRef,
      path: entry.path,
      mediaKind: entry.mediaKind,
      issueCodes: entry.issueCodes,
      nextAction: entry.nextAction,
      localOnly: true,
      operatorGuidanceOnly: true,
      nonClaims: entry.nonClaims
    }))

  return {
    schema: 'media.summary.local.v1',
    projectId: status.projectId,
    mode: 'standalone-local',
    assets: {
      total: assetRecords.length,
      byMediaKind: {
        image: mediaKinds.image ?? 0,
        video: mediaKinds.video ?? 0,
        audio: mediaKinds.audio ?? 0,
        unsupported: mediaKinds.unsupported ?? 0,
        unknown: mediaKinds.unknown ?? 0
      },
      byPlacementClass: placementClasses,
      byLifecycleState: lifecycleStates
    },
    metadataProbe: {
      unsupported: assetRecords.filter((record) => record.metadataProbe?.metadataProbeState === 'unsupported').length,
      unavailable: assetRecords.filter((record) => record.metadataProbe?.metadataProbeState === 'unavailable').length,
      failed: assetRecords.filter((record) => record.metadataProbe?.metadataProbeState === 'failed').length
    },
    derivativeReadiness: {
      readyAssets: derivativeReadiness.readyAssets,
      evaluatedAssets: derivativeReadiness.evaluatedAssets,
      attentionAssets: derivativeReadiness.attentionAssets,
      issueCodes: derivativeReadiness.issueCodes,
      attentionRows
    },
    derivatives: {
      total: derivativeRecords.length,
      byKind: {
        thumbnail: derivativeKinds.thumbnail ?? 0,
        proxy: derivativeKinds.proxy ?? 0,
        waveform: derivativeKinds.waveform ?? 0,
        unknown: derivativeKinds.unknown ?? 0
      }
    },
    generatedCandidates,
    identity: {
      assetIdPosture: 'compatibility descriptor id',
      contentId: 'byte sameness',
      situationPlacement: 'situated media role',
      derivativeIdentity: 'descriptor/situation/placement-specific',
      byteContent: status.assetResourceConsistency.bytePosture,
      resourceSituations: status.assetResourceConsistency.resourcePosture
    },
    localOnly: true,
    operatorGuidanceOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    providerTruth: false,
    byteAvailabilityProof: false,
    materializationProof: false,
    resourceAdmission: false,
    causalTruth: false,
    publicationAuthorization: false,
    edgeApproval: false
  }
}

export async function writeMediaSummary(options = {}) {
  const summary = await createMediaSummary(options)

  if (options.print) {
    console.log(JSON.stringify(summary, null, 2))
  } else {
    printMediaSummary(summary)
  }

  return summary
}

function printMediaSummary(summary) {
  console.log([
    `media summary: project=${summary.projectId}`,
    `assets=${summary.assets.total}`,
    `images=${summary.assets.byMediaKind.image}`,
    `videos=${summary.assets.byMediaKind.video}`,
    `audio=${summary.assets.byMediaKind.audio}`,
    `unsupported=${summary.assets.byMediaKind.unsupported}`
  ].join(' | '))
  console.log([
    `derivatives: ready=${summary.derivativeReadiness.readyAssets}/${summary.derivativeReadiness.evaluatedAssets}`,
    `attention=${summary.derivativeReadiness.attentionAssets}`,
    `thumbnail=${summary.derivatives.byKind.thumbnail}`,
    `proxy=${summary.derivatives.byKind.proxy}`,
    `waveform=${summary.derivatives.byKind.waveform}`
  ].join(' | '))
  console.log([
    `metadata: unsupported=${summary.metadataProbe.unsupported}`,
    `unavailable=${summary.metadataProbe.unavailable}`,
    `failed=${summary.metadataProbe.failed}`
  ].join(' | '))
  console.log([
    `generated candidates: total=${summary.generatedCandidates.total}`,
    `reviewed=${summary.generatedCandidates.reviewed}`,
    `pending=${summary.generatedCandidates.pendingReview}`,
    `promotedAccepted=${summary.generatedCandidates.promotedAccepted}`,
    `promotedRejected=${summary.generatedCandidates.promotedRejected}`
  ].join(' | '))
  console.log([
    `identity: byteContent=${summary.identity.byteContent.coveredContentIds}/${summary.identity.byteContent.expectedContentIds}`,
    `resourceSituations=${summary.identity.resourceSituations.coveredSituationPlacements}/${summary.identity.resourceSituations.expectedSituationPlacements}`
  ].join(' | '))

  for (const row of summary.derivativeReadiness.attentionRows) {
    console.log(`attention: ${row.path} | issues=${row.issueCodes.join(',')} | nextAction=${row.nextAction}`)
  }
  for (const row of summary.generatedCandidates.attentionRows) {
    console.log(`generated candidate: ${row.path} | issues=${row.issueCodes.join(',')} | nextAction=${row.nextAction}`)
  }

  console.log('nonClaims: local-only; no mesh truth; no byte/materialization proof; no resource admission')
}

function summarizeGeneratedCandidates(assetRecords, records) {
  const generated = assetRecords.filter((record) =>
    record.localRef?.placementClass === 'media-generated' &&
    record.source?.sourceType === 'provider-result'
  )
  const providerPromotions = assetRecords.filter((record) =>
    ['media-accepted', 'media-rejected'].includes(record.localRef?.placementClass) &&
    record.source?.sourceType === 'provider-result'
  )
  const decisionsByAssetId = new Map()

  for (const entry of records) {
    const record = entry.record
    if (record.schema !== artifactKinds.mediaOperatorDecision) continue
    const subjectId = record.subjectRef?.id
    if (!subjectId) continue
    const decisions = decisionsByAssetId.get(subjectId) ?? []
    decisions.push(record)
    decisionsByAssetId.set(subjectId, decisions)
  }

  const rows = generated.map((asset) => {
    const decisions = decisionsByAssetId.get(asset.assetId) ?? []
    const decisionTypes = Array.from(new Set(decisions.map((decision) => decision.decisionType).filter(Boolean))).sort()
    const reviewed = decisions.length > 0

    return {
      assetId: asset.assetId,
      path: asset.localRef?.path,
      contentId: asset.contentId,
      situationRef: asset.situationRef,
      placementRef: asset.placementRef,
      reviewState: reviewed ? 'reviewed-locally' : 'needs-local-review',
      decisionTypes,
      issueCodes: reviewed ? [] : ['missing_local_review'],
      nextAction: reviewed
        ? 'Promote accepted or rejected generated candidate when placement should change.'
        : 'Run npm run review:candidates or promote the generated candidate with an explicit local decision.',
      localOnly: true,
      operatorGuidanceOnly: true,
      meshTruth: false,
      providerTruth: false,
      publicationAuthorization: false
    }
  })
  const attentionRows = rows.filter((row) => row.issueCodes.length > 0)

  return {
    total: generated.length,
    reviewed: rows.length - attentionRows.length,
    pendingReview: attentionRows.length,
    acceptedDecisions: rows.filter((row) => row.decisionTypes.includes('accept')).length,
    rejectedDecisions: rows.filter((row) => row.decisionTypes.includes('reject')).length,
    promotedAccepted: providerPromotions.filter((record) => record.localRef?.placementClass === 'media-accepted').length,
    promotedRejected: providerPromotions.filter((record) => record.localRef?.placementClass === 'media-rejected').length,
    rows,
    attentionRows,
    localOnly: true,
    operatorGuidanceOnly: true,
    meshTruth: false,
    providerTruth: false,
    publicationAuthorization: false
  }
}

function countBy(records, classifier) {
  const counts = {}

  for (const record of records) {
    const key = classifier(record)
    counts[key] = (counts[key] ?? 0) + 1
  }

  return counts
}

function mediaKindForAsset(record) {
  return record.metadataProbe?.mediaKind ??
    (record.contentType?.startsWith('image/')
      ? 'image'
      : record.contentType?.startsWith('video/')
        ? 'video'
        : record.contentType?.startsWith('audio/')
          ? 'audio'
          : 'unsupported')
}

if (process.argv[1] === modulePath) {
  await writeMediaSummary(parseArgs(process.argv.slice(2)))
}
