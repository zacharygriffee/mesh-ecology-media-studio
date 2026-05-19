import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  createByteReferencePreview,
  createEdgeInspectionPacket,
  makeRef
} from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import { assertSafeLocalPath } from '../local/project-layout.js'

const modulePath = fileURLToPath(import.meta.url)

const defaultProjectDir = 'examples/venice-smoke'
const outputRef = 'records/exports/venice-smoke-edge-inspection-packet.local.json'

const recordPaths = Object.freeze({
  manifest: 'records/manifests/venice-live-smoke-manifest.local.json',
  workPacket: 'records/work-packets/venice-live-smoke-work-packet.local.json',
  generationRequest: 'records/work-packets/venice-live-smoke-generation-request.local.json',
  providerResult: 'records/provider-results/venice-live-smoke-provider-result.local.json',
  assetDescriptor: 'records/assets/venice-live-smoke-asset-0.local.json',
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
    const rawRecord = await readRequiredJson(root, relativePath)
    records[name] = name === 'providerResult' ? rawRecord.providerResult : rawRecord
    validateRequiredRecord(records[name])
  }

  const assetLocalRef = records.assetDescriptor.localRef
  if (!assetLocalRef?.path) {
    throw new Error('Venice smoke asset descriptor is missing localRef.path')
  }

  await assertLocalFileExists(root, assetLocalRef.path)
  const assetRef = makeRef('media-asset', records.assetDescriptor.assetId, records.assetDescriptor.schema)

  const packet = createEdgeInspectionPacket({
    sourceRunRef: localRecordRef('media-local-run-manifest', recordPaths.manifest, records.manifest.schema),
    recordRefs: {
      manifest: localRecordRef('media-local-run-manifest', recordPaths.manifest, records.manifest.schema),
      workPacket: localRecordRef('media-work-packet', recordPaths.workPacket, records.workPacket.schema),
      generationRequest: localRecordRef('media-generation-request', recordPaths.generationRequest, records.generationRequest.schema),
      providerResult: localRecordRef('media-provider-result', recordPaths.providerResult, records.providerResult.schema),
      assetDescriptor: localRecordRef('media-asset', recordPaths.assetDescriptor, records.assetDescriptor.schema),
      reviewEvidence: localRecordRef('media-evidence', recordPaths.reviewEvidence, records.reviewEvidence.schema),
      readiness: localRecordRef('media-readiness', recordPaths.readiness, records.readiness.schema),
      operatorDecision: localRecordRef('media-operator-decision', recordPaths.operatorDecision, records.operatorDecision.schema)
    },
    artifactKinds: [
      records.manifest.schema,
      records.workPacket.schema,
      records.generationRequest.schema,
      records.providerResult.schema,
      records.assetDescriptor.schema,
      records.reviewEvidence.schema,
      records.readiness.schema,
      records.operatorDecision.schema,
      'media.byte_reference.preview.local.v1',
      'media.edge_inspection_packet.local.v1'
    ],
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
        localOnly: true
      }
    ],
    warnings: [
      'Local inspection packet only; not Edge integration.',
      'All refs are local paths and not mesh truth.',
      'Local file existence and hash are not byte availability proof.',
      'Local operator decision is not ratifier authority.'
    ]
  })

  validateRequiredRecord(packet)

  const outputPath = path.join(root, output)
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(packet, null, 2)}\n`)

  if (print) {
    console.log(JSON.stringify(packet, null, 2))
  } else {
    console.log(`Wrote Venice smoke inspection packet: ${output}`)
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
