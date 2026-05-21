import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { artifactKinds } from '../contracts/artifact-kinds.js'
import { nowIso } from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import { assertSafeLocalPath } from '../local/project-layout.js'
import { writeEdgeReadinessGuidance } from './edge-readiness-guidance.js'
import { readProjectRecords, writeProjectStatus } from './project-status.js'
import { validateProductionRecordsInProject } from '../production/validate-production-records.js'

const modulePath = fileURLToPath(import.meta.url)
const defaultProjectDir = 'examples/card-to-candidate'
const defaultOutput = 'records/manifests/media-project-health.local.json'
const truthStatus = 'not mesh truth; not distributed proof; not ratified shared state'

function parseArgs(argv) {
  const args = {
    projectDir: defaultProjectDir,
    output: defaultOutput,
    print: false,
    summary: false
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
    } else if (arg === '--summary') {
      args.summary = true
    }
  }

  return args
}

export async function writeProjectHealth({
  projectDir = defaultProjectDir,
  output = defaultOutput,
  print = false,
  summary = false
} = {}) {
  assertSafeLocalPath(output)
  const root = path.resolve(projectDir)
  const statusResult = await writeProjectStatus({ projectDir, quiet: summary })
  const readinessResult = await writeEdgeReadinessGuidance({ projectDir, quiet: summary })
  const productionValidation = await validateProductionRecordsInProject({ projectDir, quiet: summary })
  const records = await readProjectRecords(root)
  const projectId = statusResult.status.projectId
  const blockingIssues = []
  const assetHealthExplanations = (statusResult.status.assetResourceConsistency.assetExplanations ?? [])
    .filter((entry) => entry.state !== 'ready-for-local-inspection')
  const derivativeHealthExplanations = (statusResult.status.mediaDerivativeReadiness?.assetExplanations ?? [])
    .filter((entry) => entry.state !== 'ready-for-local-inspection')
  const productionHealthExplanations = buildProductionHealthExplanations(productionValidation)
  const productionCapsuleHealthExplanations = buildProductionCapsuleHealthExplanations(records)
  const productionRoughCutHealthExplanations = buildProductionRoughCutHealthExplanations(records)
  const renderExportCandidateSummary = summarizeRenderExportCandidates(records)

  if (statusResult.status.assetResourceConsistency.readyForEdgeInspection !== true) {
    blockingIssues.push('asset-resource-consistency-not-ready')
  }

  if (!['ready', 'complete'].includes(readinessResult.readiness.state)) {
    blockingIssues.push(`edge-readiness-${readinessResult.readiness.state}`)
  }

  if (productionValidation.valid !== true) {
    blockingIssues.push('production-graph-invalid')
  }

  if (productionValidation.freshness?.fresh === false) {
    blockingIssues.push('production-freshness-stale')
  }

  if (productionCapsuleHealthExplanations.length > 0) {
    blockingIssues.push('production-capsule-attention')
  }

  if (productionRoughCutHealthExplanations.length > 0) {
    blockingIssues.push('production-rough-cut-attention')
  }

  const health = {
    schema: artifactKinds.mediaProjectHealthLocal,
    healthId: `project-health-${projectId}`,
    projectId,
    createdAt: nowIso(),
    mode: 'standalone-local',
    healthState: blockingIssues.length === 0 ? 'ready-for-local-inspection' : 'needs-local-attention',
    blockingIssues,
    statusRef: {
      kind: 'media-project-status',
      id: statusResult.status.statusId,
      schema: statusResult.status.schema,
      path: statusResult.output,
      localOnly: true
    },
    readinessRef: {
      kind: 'media-readiness',
      id: readinessResult.readiness.readinessId,
      schema: readinessResult.readiness.schema,
      path: readinessResult.output,
      localOnly: true
    },
    assetResourceConsistency: statusResult.status.assetResourceConsistency,
    mediaDerivativeReadiness: statusResult.status.mediaDerivativeReadiness,
    assetHealthExplanations,
    derivativeHealthExplanations,
    edgeReadinessState: readinessResult.readiness.state,
    productionValidation: {
      valid: productionValidation.valid,
      count: productionValidation.count,
      freshness: productionValidation.freshness,
      localOnly: true
    },
    productionHealthExplanations,
    productionCapsuleHealthExplanations,
    productionRoughCutHealthExplanations,
    renderExportCandidateSummary,
    operatorHealthExplanations: [
      ...assetHealthExplanations,
      ...derivativeHealthExplanations,
      ...productionHealthExplanations,
      ...productionCapsuleHealthExplanations,
      ...productionRoughCutHealthExplanations
    ],
    operatorGuidanceOnly: true,
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    providerTruth: false,
    byteAvailabilityProof: false,
    materializationProof: false,
    edgeRuntimeVerified: false,
    localTruthLabel: 'local cache',
    truthStatus
  }

  validateProjectHealth(health)
  validateRequiredRecord(health, artifactKinds.mediaProjectHealthLocal)

  const outputPath = path.join(root, output)
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(health, null, 2)}\n`)

  if (print) {
    console.log(JSON.stringify(health, null, 2))
  } else if (summary) {
    printHealthSummary(health, output)
  } else {
    console.log(`project health: ${output}`)
    console.log(`healthState: ${health.healthState}`)
    console.log(`blockingIssues: ${health.blockingIssues.length}`)
  }

  return {
    health,
    output
  }
}

function printHealthSummary(health, output) {
  console.log(`project health: ${output}`)
  console.log(`healthState: ${health.healthState}`)
  console.log(`edgeReadinessState: ${health.edgeReadinessState}`)
  console.log(`assetResourceReady: ${health.assetResourceConsistency.readyForEdgeInspection}`)
  console.log(`assetResourceWarnings: ${health.assetResourceConsistency.warningCount}`)
  console.log(`staleByteDescriptorProposals: ${health.assetResourceConsistency.staleByteDescriptorProposalIds.length}`)
  console.log(`staleResourceCandidates: ${health.assetResourceConsistency.staleResourceCandidateIds.length}`)
  console.log(`derivativeReadiness: ${health.mediaDerivativeReadiness?.readyAssets ?? 0}/${health.mediaDerivativeReadiness?.evaluatedAssets ?? 0}`)
  console.log(`derivativeAttention: ${health.mediaDerivativeReadiness?.attentionAssets ?? 0}`)
  console.log(`productionCapsuleAttention: ${health.productionCapsuleHealthExplanations?.length ?? 0}`)
  console.log(`productionRoughCutAttention: ${health.productionRoughCutHealthExplanations?.length ?? 0}`)
  console.log([
    `renderExportCandidates: total=${health.renderExportCandidateSummary?.total ?? 0}`,
    `reviewed=${health.renderExportCandidateSummary?.reviewed ?? 0}`,
    `rendererSelected=${health.renderExportCandidateSummary?.rendererSelected ?? 0}`,
    `renderPerformed=${health.renderExportCandidateSummary?.renderPerformed ?? 0}`,
    `exportPerformed=${health.renderExportCandidateSummary?.exportPerformed ?? 0}`,
    `productionReady=${health.renderExportCandidateSummary?.productionReady ?? 0}`
  ].join(' | '))
  for (const explanation of health.operatorHealthExplanations ?? []) {
    console.log(formatHealthExplanation(explanation))
  }
  console.log(`productionGraphValid: ${health.productionValidation.valid}`)
  console.log(`staleProductionDescriptors: ${health.productionValidation.freshness?.staleDescriptorIds?.length ?? 0}`)
  console.log(`blockingIssues: ${health.blockingIssues.length}`)
}

function formatHealthExplanation(explanation) {
  const subject = explanation.path ?? `${explanation.subjectKind}:${explanation.subjectRef?.id ?? 'unknown'}`
  return [
    `${explanation.subjectKind}: ${subject}`,
    `state=${explanation.healthState ?? explanation.state}`,
    `issues=${(explanation.issueCodes ?? []).join(',') || 'none'}`,
    `nextAction=${explanation.nextAction ?? 'none'}`
  ].join(' | ')
}

function buildProductionHealthExplanations(productionValidation) {
  const freshness = productionValidation.freshness ?? {}
  const recordsByDescriptorId = new Map((productionValidation.records ?? [])
    .filter((record) => record.schema === artifactKinds.mediaProductionDescriptorLocal)
    .map((record) => [record.descriptorId, record]))
  const descriptorIds = Array.from(new Set([
    ...(freshness.staleDescriptorIds ?? []),
    ...(freshness.parentMismatchDescriptorIds ?? []),
    ...(freshness.missingUnitDescriptorIds ?? [])
  ])).sort()

  return descriptorIds.map((descriptorId) => {
    const descriptor = recordsByDescriptorId.get(descriptorId)
    const issueCodes = [
      freshness.staleDescriptorIds?.includes(descriptorId) ? 'stale_production_descriptor' : null,
      freshness.parentMismatchDescriptorIds?.includes(descriptorId) ? 'production_descriptor_parent_mismatch' : null,
      freshness.missingUnitDescriptorIds?.includes(descriptorId) ? 'production_descriptor_missing_unit' : null
    ].filter(Boolean)

    return {
      subjectKind: 'media-production-descriptor',
      subjectRef: {
        kind: 'media-production-descriptor',
        id: descriptorId,
        schema: descriptor?.schema ?? artifactKinds.mediaProductionDescriptorLocal
      },
      healthState: 'needs-local-attention',
      issueCodes,
      summary: `${descriptorId} needs local production descriptor attention: ${issueCodes.join(', ')}.`,
      nextAction: 'Regenerate production descriptors from current production units.',
      sourceRefs: [
        descriptor
          ? {
              kind: 'media-production-descriptor',
              id: descriptorId,
              schema: descriptor.schema,
              localOnly: true
            }
          : {
              kind: 'media-production-descriptor',
              id: descriptorId,
              schema: artifactKinds.mediaProductionDescriptorLocal,
              localOnly: true
            }
      ],
      nonClaims: healthNonClaims(),
      localOnly: true,
      meshTruth: false,
      distributedProof: false,
      ratifiedSharedState: false,
      byteAvailabilityProof: false,
      materializationProof: false,
      providerTruth: false,
      resourceAdmission: false
    }
  })
}

function buildProductionCapsuleHealthExplanations(records) {
  const acceptedProviderAssets = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaAssetDescriptor)
    .filter((entry) => entry.record.localRef?.placementClass === 'media-accepted')
    .filter((entry) => entry.record.source?.sourceType === 'provider-result')
    .filter((entry) => isProductionCapsuleEligibleAsset(entry.record))
  const capsules = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaProductionAssetCapsuleLocal)
    .map((entry) => ({ ...entry.record, recordPath: entry.path }))
  const capsulesBySubjectPath = new Map()

  for (const capsule of capsules) {
    for (const key of [capsule.subjectAssetRef?.path, capsule.localRef?.path].filter(Boolean)) {
      if (!capsulesBySubjectPath.has(key)) capsulesBySubjectPath.set(key, capsule)
    }
  }

  const missingCapsules = acceptedProviderAssets
    .filter((entry) => !capsulesBySubjectPath.has(entry.record.assetDescriptorRef?.path ?? entry.record.localRef?.path))
    .map((entry) => productionCapsuleExplanation({
      asset: entry.record,
      assetRecordPath: entry.path,
      issueCodes: ['missing_production_asset_capsule'],
      summary: `Accepted generated asset ${entry.record.localRef?.path ?? entry.record.assetId} is missing a local production asset capsule.`,
      nextAction: 'Run npm run production:capsule for the accepted generated asset.'
    }))

  const capsuleAttention = capsules
    .filter((capsule) => capsule.productionPosture?.state === 'needs-approval-proposal')
    .map((capsule) => productionCapsuleExplanation({
      capsule,
      issueCodes: ['approval_proposal_missing'],
      summary: `Production asset capsule ${capsule.capsuleId} is missing a local approval proposal ref.`,
      nextAction: 'Run npm run approval:proposal, then regenerate the production capsule.'
    }))

  return [
    ...missingCapsules,
    ...capsuleAttention
  ]
}

function buildProductionRoughCutHealthExplanations(records) {
  const productionBundles = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaProductionBundleLocal)
    .map((entry) => ({ ...entry.record, recordPath: entry.path }))
    .sort(compareCreatedAtDescending)
  const latestProductionBundle = productionBundles[0]
  const roughCuts = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaRoughCutCapsuleLocal)
    .map((entry) => ({ ...entry.record, recordPath: entry.path }))
  const reviewDecisionsBySubject = new Map()
  for (const entry of records) {
    if (entry.record.schema !== artifactKinds.mediaOperatorDecision) continue
    if (!entry.record.roughCutReview || !entry.record.subjectRef?.id) continue
    const decisions = reviewDecisionsBySubject.get(entry.record.subjectRef.id) ?? []
    decisions.push({ ...entry.record, recordPath: entry.path })
    reviewDecisionsBySubject.set(entry.record.subjectRef.id, decisions)
  }
  const roughCutAttention = roughCuts
    .map((roughCut) => {
      const decisions = (reviewDecisionsBySubject.get(roughCut.roughCutId) ?? [])
        .sort(compareCreatedAtDescending)
      const latestDecision = decisions[0]

      if (roughCut.assemblyPosture?.state === 'needs-production-items') {
        return productionRoughCutExplanation({
          roughCut,
          issueCodes: ['rough_cut_items_missing'],
          summary: `Rough-cut capsule ${roughCut.roughCutId} has no ordered production items.`,
          nextAction: 'Create production capsules and a production bundle, then regenerate the rough-cut capsule.'
        })
      }

      if (isRoughCutStaleForProductionBundle(roughCut, latestProductionBundle)) {
        return productionRoughCutExplanation({
          roughCut,
          issueCodes: ['rough_cut_stale_production_bundle'],
          summary: `Rough-cut capsule ${roughCut.roughCutId} does not reference the latest production bundle.`,
          nextAction: 'Regenerate the rough-cut capsule from the current production bundle.',
          sourceRefs: roughCutSourceRefs({
            roughCut,
            latestBundle: latestProductionBundle
          })
        })
      }

      if (latestDecision?.decisionType === 'request_changes') {
        return productionRoughCutExplanation({
          roughCut,
          issueCodes: ['rough_cut_changes_requested'],
          summary: `Rough-cut capsule ${roughCut.roughCutId} has a local request-changes decision.`,
          nextAction: 'Regenerate or revise the rough-cut capsule before authority handoff review.',
          sourceRefs: roughCutSourceRefs({ roughCut, latestDecision })
        })
      }

      if (latestDecision?.decisionType === 'defer') {
        return productionRoughCutExplanation({
          roughCut,
          issueCodes: ['rough_cut_review_deferred'],
          summary: `Rough-cut capsule ${roughCut.roughCutId} has deferred local review.`,
          nextAction: 'Resolve deferred rough-cut review before authority handoff review.',
          sourceRefs: roughCutSourceRefs({ roughCut, latestDecision })
        })
      }

      return null
    })
    .filter(Boolean)

  return [
    ...roughCutAttention
  ]
}

function summarizeRenderExportCandidates(records) {
  const rows = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaRenderExportCandidateLocal)
    .map((entry) => ({
      candidateId: entry.record.candidateId,
      candidatePath: entry.path,
      roughCutId: entry.record.sourceRoughCutRef?.id ?? null,
      reviewed: entry.record.reviewPosture?.reviewed === true,
      rendererSelected: entry.record.renderPosture?.rendererSelected === true,
      renderPerformed: entry.record.renderPosture?.renderPerformed === true,
      exportPerformed: entry.record.exportPosture?.exportPerformed === true,
      productionReady: entry.record.productionReady === true,
      localOnly: true,
      operatorGuidanceOnly: true
    }))

  return {
    total: rows.length,
    reviewed: rows.filter((row) => row.reviewed).length,
    rendererSelected: rows.filter((row) => row.rendererSelected).length,
    renderPerformed: rows.filter((row) => row.renderPerformed).length,
    exportPerformed: rows.filter((row) => row.exportPerformed).length,
    productionReady: rows.filter((row) => row.productionReady).length,
    rows,
    localOnly: true,
    operatorGuidanceOnly: true,
    meshTruth: false,
    publicationAuthorization: false
  }
}

function roughCutSourceRefs({ roughCut, latestDecision, latestBundle }) {
  return [
    {
      kind: 'media-rough-cut-capsule',
      id: roughCut.roughCutId,
      schema: roughCut.schema,
      path: roughCut.recordPath,
      localOnly: true
    },
    latestDecision ? {
      kind: 'media-operator-decision',
      id: latestDecision.decisionId,
      schema: latestDecision.schema,
      path: latestDecision.recordPath,
      localOnly: true
    } : null,
    latestBundle ? {
      kind: 'media-production-bundle',
      id: latestBundle.bundleId,
      schema: latestBundle.schema,
      path: latestBundle.recordPath,
      localOnly: true
    } : null
  ].filter(Boolean)
}

function compareCreatedAtDescending(left, right) {
  const rightTime = Date.parse(right.createdAt ?? '') || 0
  const leftTime = Date.parse(left.createdAt ?? '') || 0
  if (rightTime !== leftTime) return rightTime - leftTime
  return (right.recordPath ?? '').localeCompare(left.recordPath ?? '')
}

function isRoughCutStaleForProductionBundle(roughCut, latestProductionBundle) {
  if (!latestProductionBundle?.bundleId) return false
  const includesLatestBundle = (roughCut.sourceRefs ?? []).some((ref) =>
    ref.schema === artifactKinds.mediaProductionBundleLocal &&
    ref.id === latestProductionBundle.bundleId
  )
  if (includesLatestBundle) return false

  const latestBundleTime = Date.parse(latestProductionBundle.createdAt ?? '') || 0
  const roughCutTime = Date.parse(roughCut.createdAt ?? '') || 0
  return latestBundleTime >= roughCutTime
}

function isProductionCapsuleEligibleAsset(asset) {
  const mediaKind = asset.metadataProbe?.mediaKind
  if (['image', 'video', 'audio'].includes(mediaKind)) return true

  const contentType = asset.contentType ?? asset.localRef?.contentType
  return ['image/', 'video/', 'audio/'].some((prefix) => contentType?.startsWith(prefix))
}

function productionCapsuleExplanation({
  asset,
  assetRecordPath,
  capsule,
  issueCodes,
  summary,
  nextAction
}) {
  const subjectRef = capsule
    ? {
        kind: 'media-production-asset-capsule',
        id: capsule.capsuleId,
        schema: artifactKinds.mediaProductionAssetCapsuleLocal
      }
    : {
        kind: 'media-asset',
        id: asset.assetId,
        schema: asset.schema
      }
  const sourceRefs = capsule
    ? [
        {
          kind: 'media-production-asset-capsule',
          id: capsule.capsuleId,
          schema: capsule.schema,
          path: capsule.recordPath,
          localOnly: true
        }
      ]
    : [
        {
          kind: 'media-asset-descriptor',
          id: asset.assetId,
          schema: asset.schema,
          path: assetRecordPath,
          localOnly: true
        }
      ]

  return {
    subjectKind: 'media-production-asset-capsule',
    subjectRef,
    path: capsule?.localRef?.path ?? capsule?.subjectAssetRef?.path ?? asset?.localRef?.path,
    healthState: 'needs-local-attention',
    issueCodes,
    summary,
    nextAction,
    sourceRefs,
    nonClaims: healthNonClaims(),
    localOnly: true,
    operatorGuidanceOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    byteAvailabilityProof: false,
    materializationProof: false,
    providerTruth: false,
    resourceAdmission: false,
    approvalAuthority: false,
    publicationAuthorization: false
  }
}

function productionRoughCutExplanation({
  roughCut,
  issueCodes,
  summary,
  nextAction,
  sourceRefs
}) {
  return {
    subjectKind: 'media-rough-cut-capsule',
    subjectRef: {
      kind: 'media-rough-cut-capsule',
      id: roughCut?.roughCutId ?? 'missing',
      schema: artifactKinds.mediaRoughCutCapsuleLocal
    },
    path: roughCut?.recordPath,
    healthState: 'needs-local-attention',
    issueCodes,
    summary,
    nextAction,
    sourceRefs: sourceRefs ?? [
      {
        kind: 'media-rough-cut-capsule',
        id: roughCut.roughCutId,
        schema: roughCut.schema,
        path: roughCut.recordPath,
        localOnly: true
      }
    ],
    nonClaims: healthNonClaims(),
    localOnly: true,
    operatorGuidanceOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    byteAvailabilityProof: false,
    materializationProof: false,
    providerTruth: false,
    resourceAdmission: false,
    approvalAuthority: false,
    publicationAuthorization: false
  }
}

function healthNonClaims() {
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
    edgeApproval: false
  }
}

function validateProjectHealth(health) {
  if (health.schema !== artifactKinds.mediaProjectHealthLocal) {
    throw new Error('Project health must use media.project_health.local.v1')
  }

  for (const field of ['healthId', 'projectId', 'createdAt', 'mode', 'healthState']) {
    if (!health[field]) {
      throw new Error(`Project health is missing ${field}`)
    }
  }

  if (!Array.isArray(health.blockingIssues)) {
    throw new Error('Project health blockingIssues must be an array')
  }

  for (const ref of [health.statusRef, health.readinessRef]) {
    validateRequiredRecord({
      schema: 'media.local_ref.v1',
      refKind: ref.kind,
      placementClass: 'record-manifest',
      path: ref.path,
      localOnly: true,
      meshTruth: false,
      distributedProof: false,
      ratifiedSharedState: false
    }, 'media.local_ref.v1')
  }

  for (const flag of [
    'meshTruth',
    'distributedProof',
    'ratifiedSharedState',
    'providerTruth',
    'byteAvailabilityProof',
    'materializationProof',
    'edgeRuntimeVerified'
  ]) {
    if (health[flag] !== false) {
      throw new Error(`Project health must set ${flag}=false`)
    }
  }

  if (health.localOnly !== true || health.operatorGuidanceOnly !== true) {
    throw new Error('Project health must remain local operator guidance')
  }

  return true
}

if (process.argv[1] === modulePath) {
  await writeProjectHealth(parseArgs(process.argv.slice(2)))
}
