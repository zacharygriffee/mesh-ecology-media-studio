import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { validateRequiredRecord } from '../contracts/schemas.js'
import { assertSafeLocalPath } from '../local/project-layout.js'

const modulePath = fileURLToPath(import.meta.url)

function parseArgs(argv) {
  const args = {
    projectDir: '.',
    packet: 'records/exports/local-run-edge-inspection-packet.local.json'
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]

    if (arg === '--project-dir') {
      args.projectDir = next
      i += 1
    } else if (arg === '--packet') {
      args.packet = next
      i += 1
    }
  }

  return args
}

export async function summarizeInspectionPacket({
  projectDir = '.',
  packet = 'records/exports/local-run-edge-inspection-packet.local.json'
} = {}) {
  assertSafeLocalPath(packet)

  const packetPath = path.join(path.resolve(projectDir), packet)
  const root = path.resolve(projectDir)
  const record = JSON.parse(await readFile(packetPath, 'utf8'))
  validateRequiredRecord(record, 'media.edge_inspection_packet.local.v1')

  const rows = [
    ['packetId', record.packetId],
    ['seam', record.seam],
    ['mode', record.mode],
    ['records', String(Object.keys(record.recordRefs).length)],
    ['artifacts', String(record.generatedArtifactRefs.length)],
    ['meshTruth', String(record.meshTruth)],
    ['providerTruth', String(record.providerTruth)],
    ['materializationProof', String(record.materializationProof)]
  ]

  const artifactRows = record.generatedArtifactRefs.map((artifact) => [
    artifact.id,
    artifact.contentType ?? 'unknown',
    artifact.path,
    artifact.byteRefPreview?.status ?? 'none'
  ])
  const schemaRows = Object.entries(countRecordSchemas(record.recordRefs))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([schema, count]) => [schema, String(count)])
  const familyRows = Object.entries(countRecordFamilies(record.recordRefs))
    .filter(([, count]) => count > 0)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([family, count]) => [family, String(count)])
  const readinessRows = await readinessPostureRows(root, record.recordRefs)
  const healthRows = await healthRowsForPacket(root, record.recordRefs)
  const healthAttentionRows = await healthAttentionRowsForPacket(root, record.recordRefs)
  const mediationRows = await mediationRowsForPacket(root, record.recordRefs)

  printTable(['field', 'value'], rows)
  if (familyRows.length > 0) {
    console.log('')
    printTable(['recordFamily', 'count'], familyRows)
  }

  if (schemaRows.length > 0) {
    console.log('')
    printTable(['recordSchema', 'count'], schemaRows)
  }

  if (readinessRows.length > 0) {
    console.log('')
    printTable(['readiness', 'state', 'subject', 'resourcePosture'], readinessRows)
  }

  if (healthRows.length > 0) {
    console.log('')
    printTable(['health', 'state', 'blockingIssues', 'assetResourceReady'], healthRows)
  }

  if (healthAttentionRows.length > 0) {
    console.log('')
    printTable(['subject', 'state', 'issues', 'nextAction'], healthAttentionRows)
  }

  if (mediationRows.length > 0) {
    console.log('')
    printTable(['operation', 'resolution', 'delivery', 'blockedClaims'], mediationRows)
  }

  if (artifactRows.length > 0) {
    console.log('')
    printTable(['artifact', 'contentType', 'path', 'bytePreview'], artifactRows)
  }

  return {
    packet: record,
    rows,
    familyRows,
    schemaRows,
    readinessRows,
    healthRows,
    healthAttentionRows,
    mediationRows,
    artifactRows
  }
}

async function readinessPostureRows(root, recordRefs) {
  const readinessRefs = Object.values(recordRefs)
    .filter((ref) => ref.schema === 'media.readiness.v1' && ref.path)
    .sort((left, right) => left.path.localeCompare(right.path))
  const rows = []

  for (const ref of readinessRefs) {
    assertSafeLocalPath(ref.path)
    const readiness = JSON.parse(await readFile(path.join(root, ref.path), 'utf8'))
    validateRequiredRecord(readiness, 'media.readiness.v1')
    const subject = readiness.subjectRef
      ? `${readiness.subjectRef.kind}:${readiness.subjectRef.id}`
      : 'unknown'
    const resourcePosture = readiness.resolvabilitySummary
      ? resourcePostureLabel(readiness.resolvabilitySummary)
      : 'not-declared'

    rows.push([
      readiness.readinessId,
      readiness.state,
      subject,
      resourcePosture
    ])
  }

  return rows
}

async function healthRowsForPacket(root, recordRefs) {
  const healthRefs = Object.values(recordRefs)
    .filter((ref) => ref.schema === 'media.project_health.local.v1' && ref.path)
    .sort((left, right) => left.path.localeCompare(right.path))
  const rows = []

  for (const ref of healthRefs) {
    assertSafeLocalPath(ref.path)
    const health = JSON.parse(await readFile(path.join(root, ref.path), 'utf8'))
    validateRequiredRecord(health, 'media.project_health.local.v1')
    rows.push([
      health.healthId,
      health.healthState,
      String(health.blockingIssues.length),
      String(health.assetResourceConsistency?.readyForEdgeInspection ?? false)
    ])
  }

  return rows
}

async function healthAttentionRowsForPacket(root, recordRefs) {
  const healthRefs = Object.values(recordRefs)
    .filter((ref) => ref.schema === 'media.project_health.local.v1' && ref.path)
    .sort((left, right) => left.path.localeCompare(right.path))
  const rows = []

  for (const ref of healthRefs) {
    assertSafeLocalPath(ref.path)
    const health = JSON.parse(await readFile(path.join(root, ref.path), 'utf8'))
    validateRequiredRecord(health, 'media.project_health.local.v1')
    for (const explanation of health.operatorHealthExplanations ?? []) {
      if ((explanation.healthState ?? explanation.state) === 'ready-for-local-inspection') continue
      rows.push([
        explanation.path ?? `${explanation.subjectKind}:${explanation.subjectRef?.id ?? 'unknown'}`,
        explanation.healthState ?? explanation.state,
        (explanation.issueCodes ?? []).join(',') || 'none',
        explanation.nextAction ?? 'none'
      ])
    }
  }

  return rows
}

async function mediationRowsForPacket(root, recordRefs) {
  const traceRefs = Object.values(recordRefs)
    .filter((ref) => ref.schema === 'media.rule_resolution_trace.local.v1' && ref.path)
    .sort((left, right) => left.path.localeCompare(right.path))
  const rows = []

  for (const ref of traceRefs) {
    assertSafeLocalPath(ref.path)
    const trace = JSON.parse(await readFile(path.join(root, ref.path), 'utf8'))
    validateRequiredRecord(trace, 'media.rule_resolution_trace.local.v1')
    rows.push([
      trace.operationRef?.id ?? 'unknown',
      trace.resolutionMode,
      trace.deliveryMode,
      trace.blockedClaims.join(',')
    ])
  }

  return rows
}

function resourcePostureLabel(summary) {
  const missingByte = summary.bytePosture?.missingContentIds?.length ??
    summary.missingByteDescriptorProposalContentIds?.length ??
    summary.missingByteDescriptorProposalAssetIds?.length ??
    0
  const missingResource = summary.resourcePosture?.missingSubjectRefs?.length ??
    summary.missingResourceRefCandidateSubjectRefs?.length ??
    summary.missingResourceRefCandidateAssetIds?.length ??
    0
  const unresolved = summary.unresolvedResourceCandidateIds?.length ?? 0
  const staleByte = summary.staleByteDescriptorProposalIds?.length ?? 0
  const staleResource = summary.staleResourceCandidateIds?.length ?? 0
  const byteCoverage = summary.bytePosture
    ? `byte-content:${summary.bytePosture.coveredContentIds}/${summary.bytePosture.expectedContentIds}`
    : null
  const resourceCoverage = summary.resourcePosture
    ? `resource-situations:${summary.resourcePosture.coveredSituationPlacements}/${summary.resourcePosture.expectedSituationPlacements}`
    : null

  if (missingByte === 0 && missingResource === 0 && unresolved === 0 && staleByte === 0 && staleResource === 0) {
    return [
      `${summary.currentCategory ?? 'unknown'}->${summary.targetCategory ?? 'unknown'} aligned`,
      byteCoverage,
      resourceCoverage
    ].filter(Boolean).join(' ')
  }

  return [
    byteCoverage,
    resourceCoverage,
    `missing-byte-content:${missingByte}`,
    `missing-resource-situations:${missingResource}`,
    `unresolved:${unresolved}`,
    `stale-byte:${staleByte}`,
    `stale-resource:${staleResource}`
  ].filter(Boolean).join(' ')
}

function countRecordSchemas(recordRefs) {
  const counts = {}

  for (const ref of Object.values(recordRefs)) {
    const schema = ref.schema ?? 'unknown'
    counts[schema] = (counts[schema] ?? 0) + 1
  }

  return counts
}

function countRecordFamilies(recordRefs) {
  const counts = {
    approvals: 0,
    assets: 0,
    bytes: 0,
    continuity: 0,
    production: 0,
    provider: 0,
    resources: 0,
    review: 0,
    wedge: 0
  }

  for (const ref of Object.values(recordRefs)) {
    const schema = ref.schema ?? ''
    const family = familyForSchema(schema)
    counts[family] = (counts[family] ?? 0) + 1
  }

  return counts
}

function familyForSchema(schema) {
  if (schema.includes('approval_proposal')) return 'approvals'
  if (schema.includes('operation_candidate') || schema.includes('rule_resolution_trace')) return 'mediation'
  if (schema.includes('operator_decision_request')) return 'requests'
  if (schema.includes('byte_descriptor_proposal') || schema.includes('byte_reference')) return 'bytes'
  if (schema.includes('edge_handoff_candidate') || schema.includes('operator_packet_index')) return 'handoff'
  if (schema.includes('resource_ref_candidate')) return 'resources'
  if (schema.includes('project_health')) return 'health'
  if (schema.includes('production_') || schema.includes('reference_primitive') || schema.includes('continuity_band') || schema.includes('render_strategy')) return 'production'
  if (schema.includes('continuity_evidence')) return 'continuity'
  if (schema.includes('candidate_review') || schema === 'media.evidence.v1' || schema === 'media.operator_decision.v1') return 'review'
  if (schema.includes('provider_') || schema.includes('generation_request')) return 'provider'
  if (schema.includes('asset.descriptor')) return 'assets'
  return 'wedge'
}

function printTable(headers, rows) {
  const widths = headers.map((header, index) => Math.max(
    header.length,
    ...rows.map((row) => String(row[index] ?? '').length)
  ))
  const formatRow = (row) => row.map((value, index) => String(value ?? '').padEnd(widths[index])).join('  ')

  console.log(formatRow(headers))
  console.log(widths.map((width) => '-'.repeat(width)).join('  '))
  for (const row of rows) {
    console.log(formatRow(row))
  }
}

if (process.argv[1] === modulePath) {
  await summarizeInspectionPacket(parseArgs(process.argv.slice(2)))
}
