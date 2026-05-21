import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { artifactKinds } from '../contracts/artifact-kinds.js'
import { makeRef, nowIso } from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import { assertSafeLocalPath } from '../local/project-layout.js'

const modulePath = fileURLToPath(import.meta.url)
const defaultProjectDir = 'examples/card-to-candidate'
const defaultOutput = 'records/exports/media-edge-compatibility-bundle.local.json'
const truthStatus = 'not mesh truth; not distributed proof; not ratified shared state'

const edgeDoctrineRefs = Object.freeze([
  '../mesh-ecology-edge/docs/app-facing-seams.md',
  '../mesh-ecology-edge/docs/operator-interface-and-extraction-posture.md',
  '../mesh-ecology-edge/docs/transport-phaseout-classification.md',
  '../mesh-ecology-spine/docs/device-surface-rulebook-alignment.md',
  '../mesh-ecology-spine/docs/device-dependent-scaffold-audit.md'
])

const sourceRecordPaths = Object.freeze({
  localRunManifest: 'records/manifests/media-local-run-manifest.local.json',
  inspectionPacket: 'records/exports/local-run-edge-inspection-packet.local.json',
  controlSurfaceProjection: 'records/exports/media-control-surface-projection.local.json',
  projectStatus: 'records/manifests/media-project-status.local.json',
  projectHealth: 'records/manifests/media-project-health.local.json',
  edgeReadinessGuidance: 'records/readiness/media-edge-inspection-readiness.local.json',
  providerRunLedger: 'records/provider-results/media-provider-run-ledger.local.json'
})
const inspectionPacketFallbackPaths = Object.freeze([
  'records/exports/venice-smoke-edge-inspection-packet.local.json'
])
const optionalSourceRecordPaths = Object.freeze({
  approvalProposal: 'records/approvals/media-approval-proposal.local.json',
  operatorPacketIndex: 'records/exports/media-operator-packet-index.local.json',
  edgeHandoffCandidate: 'records/exports/media-edge-handoff-candidate.local.json',
  operatorDecisionRequest: 'records/requests/media-operator-decision-request.local.json'
})
const optionalSourceRoots = Object.freeze([
  'records/approvals',
  'records/bytes',
  'records/resources',
  'records/rule-traces'
])
const optionalSourceSchemas = new Set([
  artifactKinds.mediaApprovalProposalLocal,
  artifactKinds.mediaByteDescriptorProposalLocal,
  artifactKinds.mediaLocalLayerResourceRefCandidateLocal,
  artifactKinds.mediaOperationCandidateLocal,
  artifactKinds.mediaRuleResolutionTraceLocal
])
const productionSourceSchemas = new Set([
  artifactKinds.mediaProductionUnit,
  artifactKinds.mediaReferencePrimitive,
  artifactKinds.mediaContinuityBand,
  artifactKinds.mediaRenderStrategy,
  artifactKinds.mediaProductionDescriptorLocal,
  artifactKinds.mediaProductionAssetCapsuleLocal,
  artifactKinds.mediaProductionBundleLocal,
  artifactKinds.mediaRoughCutCapsuleLocal
])

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

export async function writeEdgeCompatibilityBundle({
  projectDir = defaultProjectDir,
  output = defaultOutput,
  print = false
} = {}) {
  assertSafeLocalPath(output)

  const root = path.resolve(projectDir)
  const card = await readOptionalJson(root, 'cards/card.json')
  const sources = await readSourceRecords(root)
  const projectId = card?.projectId ??
    sources.controlSurfaceProjection?.record.projectId ??
    sources.localRunManifest?.record.inputCardRef?.id ??
    path.basename(root)
  const studioSourceRefs = Object.values(sources).map(({ record, relativePath }) => localRecordRef({
    kind: kindForSchema(record.schema),
    id: idForRecord(record),
    schema: record.schema,
    relativePath
  }))
  const readinessResourceSummary = createReadinessResourceSummary({ sources })
  const createdAt = nowIso()
  const reviewEvidence = createStudioEdgeReviewEvidence({
    projectId,
    sourceRefs: studioSourceRefs,
    readinessResourceSummary,
    createdAt
  })
  const sourceRefStrings = studioSourceRefs.map((ref) => `${ref.kind}:${ref.id}`)
  const workPacketCandidate = createEdgeWorkPacketCandidate({
    projectId,
    sourceRefStrings,
    createdAt
  })
  const evidenceImportCandidate = createEdgeEvidenceImportCandidate({
    projectId,
    reviewEvidence,
    workPacketCandidate,
    sourceRefStrings,
    createdAt
  })
  const readinessViewCandidate = createEdgeReadinessViewCandidate({
    projectId,
    workPacketCandidate,
    evidenceImportCandidate,
    readinessResourceSummary,
    sourceRefStrings,
    createdAt
  })
  const returnSurfaceCandidate = createEdgeReturnSurfaceCandidate({
    projectId,
    readinessViewCandidate,
    workPacketCandidate,
    evidenceImportCandidate,
    sourceRefStrings,
    createdAt
  })

  const bundle = {
    schema: artifactKinds.mediaEdgeCompatibilityBundleLocal,
    compatibilityBundleId: `edge-compatibility-${projectId}`,
    projectId,
    createdAt,
    mode: 'standalone-local',
    targetRepo: 'mesh-ecology-media-studio',
    targetSurface: 'media-edge-operator-seam',
    edgeDoctrineRefs: edgeDoctrineRefs.map((docPath) => ({
      kind: doctrineKindForPath(docPath),
      path: docPath,
      owner: doctrineOwnerForPath(docPath)
    })),
    studioSourceRefs,
    edgeShapeTargets: [
      edgeShapeTarget('edge_cross_project_work_packet', 'edge_cross_project_work_packet.v1'),
      edgeShapeTarget('edge_cross_project_evidence_import', 'edge_cross_project_evidence_import.v1'),
      edgeShapeTarget('edge_cross_project_readiness_view', 'edge_cross_project_readiness_view.v1'),
      edgeShapeTarget('edge_operator_return_surface', 'edge_operator_return_surface.v1'),
      edgeShapeTarget('edge_operator_decision', 'edge_operator_decision.v1')
    ],
    readinessResourceSummary,
    studioReviewEvidence: reviewEvidence,
    edgeWorkPacketCandidate: workPacketCandidate,
    edgeEvidenceImportCandidate: evidenceImportCandidate,
    edgeReadinessViewCandidate: readinessViewCandidate,
    edgeReturnSurfaceCandidate: returnSurfaceCandidate,
    warnings: [
      'Compatibility bundle is Studio-built, not Edge-built.',
      'Edge shape candidates target documented Edge review artifacts but are not Edge runtime verification.',
      'No Edge process, REPL command, browser endpoint, repo mutation, live discovery, mesh publication, scheduler, or runner is called.',
      'Operator decisions remain review-only records; this bundle does not authorize execution or publication.'
    ],
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    providerTruth: false,
    edgeRuntimeBuilt: false,
    edgeRuntimeVerified: false,
    localTruthLabel: 'local cache',
    truthStatus
  }

  validateRequiredRecord(bundle)

  const outputPath = path.join(root, output)
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(bundle, null, 2)}\n`)

  if (print) {
    console.log(JSON.stringify(bundle, null, 2))
  } else {
    console.log(`edge compatibility bundle: ${output}`)
    console.log(`edge targets: ${bundle.edgeShapeTargets.map((target) => target.edgeArtifactKind).join(', ')}`)
  }

  return {
    bundle,
    output
  }
}

function doctrineKindForPath(docPath) {
  return docPath.includes('../mesh-ecology-spine/')
    ? 'read-only-adjacent-spine-doctrine'
    : 'read-only-adjacent-edge-doctrine'
}

function doctrineOwnerForPath(docPath) {
  return docPath.includes('../mesh-ecology-spine/')
    ? 'mesh-ecology-spine'
    : 'mesh-ecology-edge'
}

async function readSourceRecords(root) {
  const sources = {}

  for (const [name, relativePath] of Object.entries(sourceRecordPaths)) {
    const record = await readOptionalJson(root, relativePath)
    if (!record?.schema) continue
    validateRequiredRecord(record)
    sources[name] = { record, relativePath }
  }

  if (!sources.inspectionPacket) {
    for (const relativePath of inspectionPacketFallbackPaths) {
      const record = await readOptionalJson(root, relativePath)
      if (!record?.schema) continue
      validateRequiredRecord(record)
      sources.inspectionPacket = { record, relativePath }
      break
    }
  }

  for (const [name, relativePath] of Object.entries(optionalSourceRecordPaths)) {
    const record = await readOptionalJson(root, relativePath)
    if (!record?.schema) continue
    validateRequiredRecord(record)
    sources[name] = { record, relativePath }
  }

  for (const source of await readProductionSources(root)) {
    sources[`production:${source.relativePath}`] = source
  }

  for (const source of await readOptionalSourceRecords(root)) {
    sources[`optional:${source.relativePath}`] = source
  }

  for (const required of ['inspectionPacket', 'controlSurfaceProjection']) {
    if (!sources[required]) {
      const expected = required === 'inspectionPacket'
        ? [sourceRecordPaths.inspectionPacket, ...inspectionPacketFallbackPaths].join(' or ')
        : sourceRecordPaths[required]
      throw new Error(`Edge compatibility bundle requires ${expected}`)
    }
  }

  return sources
}

function createStudioEdgeReviewEvidence({ projectId, sourceRefs, readinessResourceSummary, createdAt }) {
  const reviewEvidence = {
    schema: artifactKinds.mediaEdgeReviewEvidenceLocal,
    edgeReviewEvidenceId: `media-studio-edge-review-${projectId}`,
    projectId,
    createdAt,
    artifactKind: 'media_studio_edge_review_evidence',
    schemaVersion: 'media_studio_edge_review_evidence.v1',
    reviewStatus: 'ready_for_operator_review',
    edgeReadinessHint: 'ready_for_operator_review',
    edgeImportClassification: {
      projectId,
      targetRepo: 'mesh-ecology-media-studio',
      targetSurface: 'media-edge-operator-seam',
      evidenceKind: 'media_studio_edge_review_evidence',
      edgeExpectedEvidenceKind: 'media_studio_edge_review_evidence',
      classificationOnly: true,
      edgeOwnsSchema: false
    },
    sourceRefs,
    sourceArtifactRefs: sourceRefs.map((ref) => `${ref.kind}:${ref.id}`),
    readinessResourceSummary,
    summary: 'Studio local inspection artifacts are ready for Edge-style operator review as local evidence only.',
    reasonCodes: [
      'studio_local_wedge_complete',
      'edge_inspection_packet_present',
      'control_surface_projection_present',
      'edge_runtime_not_called'
    ],
    reviewOnly: true,
    evidenceOnly: true,
    operatorGuidanceOnly: true,
    readinessIsOperatorGuidanceOnly: true,
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    providerTruth: false,
    edgeRuntimeBuilt: false,
    edgeRuntimeVerified: false,
    localTruthLabel: 'local evidence',
    truthStatus
  }

  validateRequiredRecord(reviewEvidence)
  return reviewEvidence
}

function createEdgeWorkPacketCandidate({ projectId, sourceRefStrings, createdAt }) {
  return edgeCandidate({
    edgeArtifactKind: 'edge_cross_project_work_packet',
    edgeSchemaVersion: 'edge_cross_project_work_packet.v1',
    packetId: `edge-cross-project-work-packet:${projectId}:media-edge-operator-seam`,
    createdAt,
    packetMode: 'bounded_project_handoff',
    packetState: 'ready_for_operator_export',
    targetProjectId: projectId,
    targetRepo: 'mesh-ecology-media-studio',
    targetSurface: 'media-edge-operator-seam',
    workTitle: 'Review Studio media local inspection bundle',
    workScope: 'Inspect Studio local media records, evidence, readiness, provider lineage, and control-surface projection without executing provider or Edge work.',
    workIntent: 'Prepare operator-readable Edge handoff posture for media-studio local outputs.',
    operatorReason: 'Edge may later organize operator attention around Studio media work while Studio keeps media semantics.',
    sourceArtifactRefs: sourceRefStrings,
    expectedProjectEvidence: {
      evidenceKind: 'media_studio_edge_review_evidence',
      projectOwnsSchema: true,
      edgeOwnsSchema: false,
      reviewOnly: true,
      operatorGuidanceOnly: true
    },
    edgeAuthorityBoundary: 'Edge drafts review packets and imports returned evidence as review-only.',
    projectAuthorityBoundary: 'Studio owns media semantics, records, local evidence, and truth boundaries.',
    stopConditions: [
      'Stop before UI implementation.',
      'Stop before Edge runtime calls.',
      'Stop before mesh publication or ratifier authority.'
    ],
    validation: {
      packetState: 'ready_for_operator_export',
      validationIsReviewOnly: true,
      sourceRefCount: sourceRefStrings.length
    }
  })
}

function createEdgeEvidenceImportCandidate({ projectId, reviewEvidence, workPacketCandidate, sourceRefStrings, createdAt }) {
  return edgeCandidate({
    edgeArtifactKind: 'edge_cross_project_evidence_import',
    edgeSchemaVersion: 'edge_cross_project_evidence_import.v1',
    importId: `edge-cross-project-evidence-import:${reviewEvidence.edgeReviewEvidenceId}`,
    createdAt,
    sourceArtifactRef: `media_studio_edge_review_evidence:${reviewEvidence.edgeReviewEvidenceId}`,
    sourceArtifactKind: reviewEvidence.artifactKind,
    sourceSchema: reviewEvidence.schema,
    sourceSchemaVersion: reviewEvidence.schemaVersion,
    sourceProjectId: projectId,
    sourceRepo: 'mesh-ecology-media-studio',
    sourceSurface: 'media-edge-operator-seam',
    workPacketRef: workPacketCandidate.packetId,
    sourceWorkPacketRef: workPacketCandidate.packetId,
    sourceArtifactRefs: sourceRefStrings,
    projectReviewStatus: reviewEvidence.reviewStatus,
    edgeReadinessEffect: 'ready_for_operator_review',
    evidenceLabel: 'Studio media Edge review evidence',
    reasonCodes: reviewEvidence.reasonCodes,
    classification: reviewEvidence.edgeImportClassification,
    validation: {
      importStatus: 'candidate_only',
      validationIsReviewOnly: true
    }
  })
}

function createEdgeReadinessViewCandidate({ projectId, workPacketCandidate, evidenceImportCandidate, readinessResourceSummary, sourceRefStrings, createdAt }) {
  return edgeCandidate({
    edgeArtifactKind: 'edge_cross_project_readiness_view',
    edgeSchemaVersion: 'edge_cross_project_readiness_view.v1',
    viewId: `edge-cross-project-readiness-view:${projectId}:media-edge-operator-seam`,
    createdAt,
    viewState: 'ready_for_consumer_review',
    sourceArtifactRefs: sourceRefStrings,
    includedArtifactKinds: [
      workPacketCandidate.edgeArtifactKind,
      evidenceImportCandidate.edgeArtifactKind,
      'media.edge_inspection_packet.local.v1',
      'media.control_surface_projection.local.v1'
    ],
    sourceWorkPacketRefs: [workPacketCandidate.packetId],
    sourceEvidenceImportRefs: [evidenceImportCandidate.importId],
    readinessSummary: {
      state: 'ready_for_operator_review',
      operatorGuidanceOnly: true,
      studioReadinessState: readinessResourceSummary.edgeReadinessState,
      assetResourceReady: readinessResourceSummary.assetResourceReady,
      assetResourceWarnings: readinessResourceSummary.assetResourceWarnings,
      staleByteDescriptorProposalIds: readinessResourceSummary.staleByteDescriptorProposalIds,
      staleResourceCandidateIds: readinessResourceSummary.staleResourceCandidateIds
    },
    consumerLabels: {
      view: 'Studio media readiness view candidate',
      posture: 'Read-only projection and inspection',
      readiness: 'Operator guidance only'
    },
    validation: {
      viewState: 'ready_for_consumer_review',
      validationIsReviewOnly: true
    }
  })
}

function createReadinessResourceSummary({ sources }) {
  const projectStatus = sources.projectStatus?.record
  const edgeReadiness = sources.edgeReadinessGuidance?.record
  const consistency = projectStatus?.assetResourceConsistency
  const resolvability = edgeReadiness?.resolvabilitySummary

  return {
    summaryKind: 'studio-readiness-resource-summary',
    projectStatusRef: sources.projectStatus ? sources.projectStatus.relativePath : null,
    edgeReadinessRef: sources.edgeReadinessGuidance ? sources.edgeReadinessGuidance.relativePath : null,
    edgeReadinessState: edgeReadiness?.state ?? 'not-recorded',
    assetResourceReady: consistency?.readyForEdgeInspection ?? false,
    assetResourceWarnings: consistency?.warningCount ?? null,
    acceptedOrReferenceAssets: consistency?.acceptedOrReferenceAssets ?? resolvability?.acceptedOrReferenceAssets ?? 0,
    byteDescriptorProposalCoverage: consistency?.byteDescriptorProposalCoverage ?? resolvability?.byteDescriptorProposals ?? 0,
    resourceRefCandidateCoverage: consistency?.resourceRefCandidateCoverage ?? resolvability?.resourceRefCandidates ?? 0,
    bytePosture: consistency?.bytePosture ?? resolvability?.bytePosture ?? null,
    resourcePosture: consistency?.resourcePosture ?? resolvability?.resourcePosture ?? null,
    missingByteDescriptorProposalAssetIds: consistency?.missingByteDescriptorProposalAssetIds ?? resolvability?.missingByteDescriptorProposalAssetIds ?? [],
    missingByteDescriptorProposalContentIds: consistency?.missingByteDescriptorProposalContentIds ?? resolvability?.missingByteDescriptorProposalContentIds ?? [],
    missingResourceRefCandidateAssetIds: consistency?.missingResourceRefCandidateAssetIds ?? resolvability?.missingResourceRefCandidateAssetIds ?? [],
    missingResourceRefCandidateSubjectRefs: consistency?.missingResourceRefCandidateSubjectRefs ?? resolvability?.missingResourceRefCandidateSubjectRefs ?? [],
    unresolvedResourceCandidateIds: consistency?.unresolvedResourceCandidateIds ?? resolvability?.unresolvedResourceCandidateIds ?? [],
    staleResourceCandidateIds: consistency?.staleResourceCandidateIds ?? resolvability?.staleResourceCandidateIds ?? [],
    staleByteDescriptorProposalIds: consistency?.staleByteDescriptorProposalIds ?? resolvability?.staleByteDescriptorProposalIds ?? [],
    operatorGuidanceOnly: true,
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    edgeRuntimeVerified: false
  }
}

function createEdgeReturnSurfaceCandidate({ projectId, readinessViewCandidate, workPacketCandidate, evidenceImportCandidate, sourceRefStrings, createdAt }) {
  return edgeCandidate({
    edgeArtifactKind: 'edge_operator_return_surface',
    edgeSchemaVersion: 'edge_operator_return_surface.v1',
    surfaceId: `edge-operator-return-surface:${projectId}:media-edge-operator-seam`,
    createdAt,
    surfaceState: 'ready_for_operator_review',
    sourceArtifactRefs: sourceRefStrings,
    sourceReadinessViewRef: readinessViewCandidate.viewId,
    sourceWorkPacketRefs: [workPacketCandidate.packetId],
    sourceEvidenceImportRefs: [evidenceImportCandidate.importId],
    currentStateSummary: {
      state: 'ready_for_operator_review',
      summary: 'Studio media local artifacts can be inspected by an operator-facing surface.'
    },
    readyForOperatorReviewSummary: {
      count: 1,
      refs: [evidenceImportCandidate.importId]
    },
    blockedSummary: {
      count: 0,
      refs: []
    },
    waitingSummary: {
      count: 0,
      refs: []
    },
    nextSafeMoves: [
      {
        moveId: `inspect-studio-media-${projectId}`,
        moveType: 'inspect_artifact',
        sourceRefs: sourceRefStrings,
        reasonCodes: ['review_studio_media_local_outputs'],
        requiresOperatorAction: true,
        moveIsRecommendationOnly: true,
        command: null,
        todo: null,
        job: null,
        executionAuthorized: false,
        repoMutationAuthorized: false,
        schedulerAuthorized: false,
        runnerAuthorized: false
      },
      {
        moveId: `plan-studio-media-next-phase-${projectId}`,
        moveType: 'plan_next_phase',
        sourceRefs: [workPacketCandidate.packetId],
        reasonCodes: ['continue_without_ui'],
        requiresOperatorAction: true,
        moveIsRecommendationOnly: true,
        command: null,
        todo: null,
        job: null,
        executionAuthorized: false,
        repoMutationAuthorized: false,
        schedulerAuthorized: false,
        runnerAuthorized: false
      }
    ],
    doctrineSummary: {
      reviewOnly: true,
      operatorGuidanceOnly: true,
      noExecution: true,
      noMeshPublication: true
    },
    validation: {
      surfaceState: 'ready_for_operator_review',
      validationIsReviewOnly: true
    }
  })
}

function edgeCandidate(fields) {
  return {
    ...fields,
    reviewOnly: true,
    evidenceOnly: fields.evidenceOnly ?? true,
    operatorGuidanceOnly: true,
    readinessIsOperatorGuidanceOnly: true,
    externalRunnerPosture: 'external_runner_only',
    edgeRuntimeBuilt: false,
    edgeRuntimeVerified: false,
    command: null,
    todo: null,
    job: null,
    executionAuthorized: false,
    schedulerAuthorized: false,
    runnerAuthorized: false,
    repoMutationAuthorized: false,
    meshPublicationAuthorized: false,
    projectTruthInferred: false,
    domainTruthInferred: false,
    meshTruthInferred: false
  }
}

function edgeShapeTarget(edgeArtifactKind, edgeSchemaVersion) {
  return {
    edgeArtifactKind,
    edgeSchemaVersion,
    targetOnly: true,
    edgeRuntimeBuilt: false,
    edgeRuntimeVerified: false
  }
}

async function readOptionalJson(root, relativePath) {
  assertSafeLocalPath(relativePath)

  try {
    return JSON.parse(await readFile(path.join(root, relativePath), 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return undefined
    throw error
  }
}

function localRecordRef({ kind, id, schema, relativePath }) {
  assertSafeLocalPath(relativePath)

  return {
    ...makeRef(kind, id, schema),
    path: relativePath,
    localOnly: true
  }
}

function kindForSchema(schema) {
  const schemaKinds = {
    [artifactKinds.mediaLocalRunManifest]: 'media-local-run-manifest',
    [artifactKinds.mediaEdgeInspectionPacketLocal]: 'media-edge-inspection-packet',
    [artifactKinds.mediaControlSurfaceProjectionLocal]: 'media-control-surface-projection',
    [artifactKinds.mediaProjectStatusLocal]: 'media-project-status',
    [artifactKinds.mediaProjectHealthLocal]: 'media-project-health',
    [artifactKinds.mediaOperatorPacketIndexLocal]: 'media-operator-packet-index',
    [artifactKinds.mediaEdgeHandoffCandidateLocal]: 'media-edge-handoff-candidate',
    [artifactKinds.mediaOperatorDecisionRequestLocal]: 'media-operator-decision-request',
    [artifactKinds.mediaReadiness]: 'media-readiness',
    [artifactKinds.mediaProviderRunLedgerLocal]: 'media-provider-run-ledger',
    [artifactKinds.mediaProductionUnit]: 'media-production-unit',
    [artifactKinds.mediaReferencePrimitive]: 'media-reference-primitive',
    [artifactKinds.mediaContinuityBand]: 'media-continuity-band',
    [artifactKinds.mediaRenderStrategy]: 'media-render-strategy',
    [artifactKinds.mediaProductionDescriptorLocal]: 'media-production-descriptor',
    [artifactKinds.mediaProductionAssetCapsuleLocal]: 'media-production-asset-capsule',
    [artifactKinds.mediaProductionBundleLocal]: 'media-production-bundle',
    [artifactKinds.mediaRoughCutCapsuleLocal]: 'media-rough-cut-capsule',
    [artifactKinds.mediaApprovalProposalLocal]: 'media-approval-proposal',
    [artifactKinds.mediaByteDescriptorProposalLocal]: 'media-byte-descriptor-proposal',
    [artifactKinds.mediaLocalLayerResourceRefCandidateLocal]: 'media-local-layer-resource-ref-candidate',
    [artifactKinds.mediaOperationCandidateLocal]: 'media-operation-candidate',
    [artifactKinds.mediaRuleResolutionTraceLocal]: 'media-rule-resolution-trace'
  }

  return schemaKinds[schema] ?? schema
}

function idForRecord(record) {
  return record.runId ??
    record.packetId ??
    record.projectionId ??
    record.statusId ??
    record.healthId ??
    record.indexId ??
    record.handoffCandidateId ??
    record.requestId ??
    record.readinessId ??
    record.ledgerId ??
    record.productionUnitId ??
    record.primitiveId ??
    record.bandId ??
    record.strategyId ??
    record.descriptorId ??
    record.capsuleId ??
    record.bundleId ??
    record.roughCutId ??
    record.proposalId ??
    record.byteDescriptorProposalId ??
    record.resourceRefCandidateId ??
    record.operationId ??
    record.traceId ??
    record.schema
}

async function readProductionSources(root) {
  const files = await listJsonFiles(path.join(root, 'records', 'production'))
  const sources = []

  for (const file of files) {
    const relativePath = path.relative(root, file).split(path.sep).join('/')
    const record = JSON.parse(await readFile(file, 'utf8'))
    if (!productionSourceSchemas.has(record.schema)) continue
    validateRequiredRecord(record)
    sources.push({ record, relativePath })
  }

  return sources
}

async function readOptionalSourceRecords(root) {
  const files = []
  for (const relativeRoot of optionalSourceRoots) {
    files.push(...await listJsonFiles(path.join(root, relativeRoot)))
  }

  const sources = []
  for (const file of files) {
    const relativePath = path.relative(root, file).split(path.sep).join('/')
    const record = JSON.parse(await readFile(file, 'utf8'))
    if (!optionalSourceSchemas.has(record.schema)) continue
    validateRequiredRecord(record)
    sources.push({ record, relativePath })
  }

  return sources
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
  await writeEdgeCompatibilityBundle(parseArgs(process.argv.slice(2)))
}
