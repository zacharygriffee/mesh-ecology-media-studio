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

  printTable(['field', 'value'], rows)
  if (familyRows.length > 0) {
    console.log('')
    printTable(['recordFamily', 'count'], familyRows)
  }

  if (schemaRows.length > 0) {
    console.log('')
    printTable(['recordSchema', 'count'], schemaRows)
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
    artifactRows
  }
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
  if (schema.includes('byte_descriptor_proposal') || schema.includes('byte_reference')) return 'bytes'
  if (schema.includes('resource_ref_candidate')) return 'resources'
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
