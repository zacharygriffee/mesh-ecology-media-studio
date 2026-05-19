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

  printTable(['field', 'value'], rows)
  if (artifactRows.length > 0) {
    console.log('')
    printTable(['artifact', 'contentType', 'path', 'bytePreview'], artifactRows)
  }

  return {
    packet: record,
    rows,
    artifactRows
  }
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
