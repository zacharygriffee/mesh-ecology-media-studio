import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createEdgeInspectionPacket, makeRef } from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import { assertSafeLocalPath } from '../local/project-layout.js'

const modulePath = fileURLToPath(import.meta.url)

const defaultProjectDir = 'examples/venice-smoke'
const defaultOutput = 'records/exports/provider-failure-edge-inspection-packet.local.json'

const defaultRecordPaths = Object.freeze({
  workPacket: 'records/work-packets/venice-live-smoke-work-packet.local.json',
  generationRequest: 'records/work-packets/venice-live-smoke-generation-request.local.json',
  providerResult: 'records/provider-results/venice-live-smoke-provider-result.local.json',
  adapterRun: 'records/provider-results/venice-live-smoke-adapter-run.local.json',
  failureEvidence: 'records/evidence/venice-live-smoke-provider-failure-evidence.local.json'
})

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

export async function inspectProviderFailure({
  projectDir = defaultProjectDir,
  output = defaultOutput,
  recordPaths = defaultRecordPaths,
  print = false
} = {}) {
  assertSafeLocalPath(output)

  const root = path.resolve(projectDir)
  const rawProviderResult = await readRequiredJson(root, recordPaths.providerResult)
  const providerResult = rawProviderResult.providerResult ?? rawProviderResult
  const workPacket = await readRequiredJson(root, recordPaths.workPacket)
  const generationRequest = await readRequiredJson(root, recordPaths.generationRequest)
  const adapterRun = await readRequiredJson(root, recordPaths.adapterRun)
  const failureEvidence = await readRequiredJson(root, recordPaths.failureEvidence)

  validateRequiredRecord(workPacket)
  validateRequiredRecord(generationRequest)
  validateRequiredRecord(providerResult, 'media.provider_result.v1')
  validateRequiredRecord(adapterRun)
  validateRequiredRecord(failureEvidence)

  if (providerResult.status !== 'failed') {
    throw new Error(`Provider failure inspection requires failed provider result, received ${providerResult.status}`)
  }

  const packet = createEdgeInspectionPacket({
    packetId: `provider-failure-${providerResult.resultId}`,
    sourceRunRef: localRecordRef('media-provider-result', recordPaths.providerResult, providerResult.schema),
    recordRefs: {
      workPacket: localRecordRef('media-work-packet', recordPaths.workPacket, workPacket.schema),
      generationRequest: localRecordRef('media-generation-request', recordPaths.generationRequest, generationRequest.schema),
      providerResult: localRecordRef('media-provider-result', recordPaths.providerResult, providerResult.schema),
      adapterRun: localRecordRef('media-provider-adapter-run', recordPaths.adapterRun, adapterRun.schema),
      failureEvidence: localRecordRef('media-evidence', recordPaths.failureEvidence, failureEvidence.schema)
    },
    artifactKinds: [
      workPacket.schema,
      generationRequest.schema,
      providerResult.schema,
      adapterRun.schema,
      failureEvidence.schema,
      'media.edge_inspection_packet.local.v1'
    ],
    generatedArtifactRefs: [],
    warnings: [
      'Provider failure inspection packet only; not Edge integration.',
      'Failed provider result is not provider truth, mesh truth, or distributed proof.',
      'No generated asset or review decision is implied by this packet.'
    ]
  })

  validateRequiredRecord(packet)

  const outputPath = path.join(root, output)
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(packet, null, 2)}\n`)

  if (print) {
    console.log(JSON.stringify(packet, null, 2))
  } else {
    console.log(`Wrote provider failure inspection packet: ${output}`)
  }

  return {
    packet,
    output
  }
}

async function readRequiredJson(root, relativePath) {
  assertSafeLocalPath(relativePath)

  try {
    return JSON.parse(await readFile(path.join(root, relativePath), 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Missing provider failure inspection record: ${relativePath}`)
    }

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
  await inspectProviderFailure(parseArgs(process.argv.slice(2)))
}
