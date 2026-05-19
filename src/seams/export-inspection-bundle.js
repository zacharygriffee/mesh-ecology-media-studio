import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { artifactKinds } from '../contracts/artifact-kinds.js'
import { makeRef, nowIso } from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import { assertSafeLocalPath } from '../local/project-layout.js'

const modulePath = fileURLToPath(import.meta.url)
const defaultProjectDir = 'examples/card-to-candidate'
const defaultPacket = 'records/exports/local-run-edge-inspection-packet.local.json'

function parseArgs(argv) {
  const args = {
    projectDir: defaultProjectDir,
    packet: defaultPacket,
    outputDir: undefined,
    print: false
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
    } else if (arg === '--output-dir') {
      args.outputDir = next
      i += 1
    } else if (arg === '--print') {
      args.print = true
    }
  }

  return args
}

export async function exportInspectionBundle({
  projectDir = defaultProjectDir,
  packet = defaultPacket,
  outputDir,
  print = false
} = {}) {
  assertSafeLocalPath(packet)

  const root = path.resolve(projectDir)
  const inspectionPacket = JSON.parse(await readFile(path.join(root, packet), 'utf8'))
  validateRequiredRecord(inspectionPacket)

  const bundleId = `edge-export-bundle-${safeSegment(inspectionPacket.packetId)}`
  const bundleRoot = outputDir ?? `records/exports/bundles/${bundleId}`
  assertSafeLocalPath(bundleRoot)

  const includedRecordRefs = []
  const includedArtifactRefs = []
  const copiedRecords = new Set()
  const copiedArtifacts = new Set()

  const packetCopyPath = path.posix.join(bundleRoot, 'inspection-packet.local.json')
  await copyLocalFile(root, packet, packetCopyPath)
  copiedRecords.add(packet)
  includedRecordRefs.push(bundleRef('edge-inspection-packet', packet, packetCopyPath, inspectionPacket.schema))

  for (const ref of Object.values(inspectionPacket.recordRefs)) {
    if (!ref?.path || copiedRecords.has(ref.path)) continue
    const bundledPath = path.posix.join(bundleRoot, 'records', ref.path)
    await copyLocalFile(root, ref.path, bundledPath)
    copiedRecords.add(ref.path)
    includedRecordRefs.push(bundleRef(ref.kind, ref.path, bundledPath, ref.schema))
  }

  for (const ref of inspectionPacket.generatedArtifactRefs) {
    if (!ref?.path || copiedArtifacts.has(ref.path)) continue
    const bundledPath = path.posix.join(bundleRoot, 'artifacts', ref.path)
    await copyLocalFile(root, ref.path, bundledPath)
    copiedArtifacts.add(ref.path)
    includedArtifactRefs.push(bundleRef(ref.kind, ref.path, bundledPath, ref.schema))
  }

  const manifest = {
    schema: artifactKinds.mediaEdgeExportBundleLocal,
    bundleId,
    createdAt: nowIso(),
    mode: 'standalone-local',
    sourcePacketRef: {
      ...makeRef('media-edge-inspection-packet', inspectionPacket.packetId, inspectionPacket.schema),
      path: packet,
      localOnly: true
    },
    bundleRootRef: {
      ...makeRef('local-directory', bundleRoot, 'media.local_ref.v1'),
      path: bundleRoot,
      localOnly: true
    },
    includedRecordRefs,
    includedArtifactRefs,
    warnings: [
      'Local export bundle only; not Edge integration.',
      'Copied bytes are local cache copies, not byte availability proof.',
      'Bundle presence is not mesh truth, distributed proof, or ratifier authority.'
    ],
    operatorGuidanceOnly: true,
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    providerTruth: false,
    byteAvailabilityProof: false,
    materializationProof: false,
    publicationAuthorization: false,
    localTruthLabel: 'local cache',
    truthStatus: 'not mesh truth; not distributed proof; not ratified shared state'
  }

  validateRequiredRecord(manifest)

  const manifestPath = path.posix.join(bundleRoot, 'bundle-manifest.local.json')
  await writeJson(root, manifestPath, manifest)

  if (print) {
    console.log(JSON.stringify(manifest, null, 2))
  } else {
    console.log(`Wrote local inspection export bundle: ${bundleRoot}`)
  }

  return {
    manifest,
    bundleRoot,
    manifestPath
  }
}

async function copyLocalFile(root, from, to) {
  assertSafeLocalPath(from)
  assertSafeLocalPath(to)
  await mkdir(path.dirname(path.join(root, to)), { recursive: true })
  await cp(path.join(root, from), path.join(root, to), { force: true })
}

async function writeJson(root, relativePath, value) {
  assertSafeLocalPath(relativePath)
  const outputPath = path.join(root, relativePath)
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(value, null, 2)}\n`)
}

function bundleRef(kind, sourcePath, bundledPath, schema) {
  return {
    ...makeRef(kind, bundledPath, schema),
    path: bundledPath,
    sourcePath,
    localOnly: true
  }
}

function safeSegment(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]/g, '-')
}

if (process.argv[1] === modulePath) {
  await exportInspectionBundle(parseArgs(process.argv.slice(2)))
}
