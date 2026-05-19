import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
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

const defaultProjectDir = 'examples/card-to-candidate'
const defaultManifest = 'records/manifests/media-local-run-manifest.local.json'
const defaultOutput = 'records/exports/local-run-edge-inspection-packet.local.json'
const extraInspectionRoots = Object.freeze([
  'records/evidence',
  'records/production'
])
const extraInspectionSchemas = new Set([
  'media.candidate_review.local.v1',
  'media.continuity_evidence.local.v1',
  'media.production_unit.v1',
  'media.reference_primitive.v1',
  'media.continuity_band.v1',
  'media.render_strategy.v1',
  'media.production_descriptor.local.v1'
])

function parseArgs(argv) {
  const args = {
    projectDir: defaultProjectDir,
    manifest: defaultManifest,
    output: defaultOutput,
    print: false
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]

    if (arg === '--project-dir') {
      args.projectDir = next
      i += 1
    } else if (arg === '--manifest') {
      args.manifest = next
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

export async function inspectLocalRun({
  projectDir = defaultProjectDir,
  manifest = defaultManifest,
  output = defaultOutput,
  print = false
} = {}) {
  assertSafeLocalPath(manifest)
  assertSafeLocalPath(output)

  const root = path.resolve(projectDir)
  const manifestRecord = await readRequiredJson(root, manifest)
  validateRequiredRecord(manifestRecord)

  const records = {}
  const recordRefs = {
    manifest: localRecordRef('media-local-run-manifest', manifest, manifestRecord.schema)
  }

  for (const ref of manifestRecord.generatedRecordRefs) {
    assertSafeLocalPath(ref.path)
    const rawRecord = await readRequiredJson(root, ref.path)
    const record = unwrapRecord(rawRecord, ref.kind)
    validateRequiredRecord(record, ref.kind)

    const name = nameForSchema(ref.kind, ref.path)
    records[name] = record
    recordRefs[name] = localRecordRef(kindForSchema(ref.kind), ref.path, ref.kind)
  }

  const extraRecords = await readExtraInspectionRecords(root)
  for (const extra of extraRecords) {
    const name = nameForSchema(extra.record.schema, extra.path)
    records[name] = extra.record
    recordRefs[name] = localRecordRef(kindForSchema(extra.record.schema), extra.path, extra.record.schema)
  }

  const generatedArtifactRefs = []
  for (const [name, record] of Object.entries(records)) {
    if (record.schema !== 'media.asset.descriptor.v1') continue

    const localRef = record.localRef
    if (!localRef?.path) {
      throw new Error(`Local run asset descriptor ${name} is missing localRef.path`)
    }

    await assertLocalFileExists(root, localRef.path)
    const assetRef = makeRef('media-asset', record.assetId, record.schema)
    generatedArtifactRefs.push({
      kind: 'media-generated-asset',
      id: record.assetId,
      schema: record.schema,
      path: localRef.path,
      hash: record.hash,
      contentType: record.contentType,
      byteRefPreview: createByteReferencePreview({
        sourceRef: assetRef,
        localRef,
        hash: record.hash,
        size: record.size,
        contentType: record.contentType
      }),
      localOnly: true
    })
  }

  const packet = createEdgeInspectionPacket({
    sourceRunRef: localRecordRef('media-local-run-manifest', manifest, manifestRecord.schema),
    recordRefs,
    artifactKinds: Array.from(new Set([
      manifestRecord.schema,
      ...Object.values(records).map((record) => record.schema),
      ...generatedArtifactRefs.map((ref) => ref.byteRefPreview?.schema).filter(Boolean),
      'media.edge_inspection_packet.local.v1'
    ])),
    generatedArtifactRefs,
    warnings: [
      'Local inspection packet only; not Edge integration.',
      'All refs are local paths and not mesh truth.',
      'Byte reference fields are previews only and not materialization proof.',
      'Local operator decisions are not ratifier authority.'
    ]
  })

  validateRequiredRecord(packet)

  const outputPath = path.join(root, output)
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(packet, null, 2)}\n`)

  if (print) {
    console.log(JSON.stringify(packet, null, 2))
  } else {
    console.log(`Wrote local run inspection packet: ${output}`)
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
      throw new Error(`Missing local run inspection record: ${relativePath}`)
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
      throw new Error(`Missing local run generated artifact: ${relativePath}`)
    }

    throw error
  }
}

function unwrapRecord(rawRecord, expectedSchema) {
  if (rawRecord.schema === expectedSchema) return rawRecord
  if (expectedSchema === 'media.provider_result.v1' && rawRecord.providerResult?.schema === expectedSchema) {
    return rawRecord.providerResult
  }

  return rawRecord
}

function nameForSchema(schema, relativePath) {
  const schemaNames = {
    'media.work_packet.v1': 'workPacket',
    'media.generation_request.v1': 'generationRequest',
    'media.provider_profile.v1': 'providerProfile',
    'media.provider_result.v1': 'providerResult',
    'media.asset.descriptor.v1': 'assetDescriptor',
    'media.evidence.v1': 'reviewEvidence',
    'media.readiness.v1': 'readiness',
    'media.operator_decision.v1': 'operatorDecision',
    'media.candidate_review.local.v1': `candidateReview:${path.basename(relativePath, '.json')}`,
    'media.continuity_evidence.local.v1': `continuityEvidence:${path.basename(relativePath, '.json')}`,
    'media.production_unit.v1': `productionUnit:${path.basename(relativePath, '.json')}`,
    'media.reference_primitive.v1': `referencePrimitive:${path.basename(relativePath, '.json')}`,
    'media.continuity_band.v1': `continuityBand:${path.basename(relativePath, '.json')}`,
    'media.render_strategy.v1': `renderStrategy:${path.basename(relativePath, '.json')}`,
    'media.production_descriptor.local.v1': `productionDescriptor:${path.basename(relativePath, '.json')}`
  }

  return schemaNames[schema] ?? path.basename(relativePath, '.json')
}

function kindForSchema(schema) {
  const schemaKinds = {
    'media.work_packet.v1': 'media-work-packet',
    'media.generation_request.v1': 'media-generation-request',
    'media.provider_profile.v1': 'media-provider-profile',
    'media.provider_result.v1': 'media-provider-result',
    'media.asset.descriptor.v1': 'media-asset',
    'media.evidence.v1': 'media-evidence',
    'media.readiness.v1': 'media-readiness',
    'media.operator_decision.v1': 'media-operator-decision',
    'media.candidate_review.local.v1': 'media-candidate-review',
    'media.continuity_evidence.local.v1': 'media-continuity-evidence',
    'media.production_unit.v1': 'media-production-unit',
    'media.reference_primitive.v1': 'media-reference-primitive',
    'media.continuity_band.v1': 'media-continuity-band',
    'media.render_strategy.v1': 'media-render-strategy',
    'media.production_descriptor.local.v1': 'media-production-descriptor'
  }

  return schemaKinds[schema] ?? schema
}

async function readExtraInspectionRecords(root) {
  const files = []
  for (const relativeRoot of extraInspectionRoots) {
    files.push(...await listJsonFiles(path.join(root, relativeRoot)))
  }

  const records = []

  for (const file of files) {
    const relativePath = path.relative(root, file).split(path.sep).join('/')
    const record = JSON.parse(await readFile(file, 'utf8'))
    if (!extraInspectionSchemas.has(record.schema)) continue
    validateRequiredRecord(record)
    records.push({ path: relativePath, record })
  }

  return records
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

function localRecordRef(kind, relativePath, schema) {
  return {
    ...makeRef(kind, relativePath, schema),
    path: relativePath,
    localOnly: true
  }
}

if (process.argv[1] === modulePath) {
  await inspectLocalRun(parseArgs(process.argv.slice(2)))
}
