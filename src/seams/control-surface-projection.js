import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { artifactKinds } from '../contracts/artifact-kinds.js'
import { makeRef, nowIso } from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import { assertSafeLocalPath } from '../local/project-layout.js'
import { writeJsonAtomic } from '../local/atomic-json.js'

const modulePath = fileURLToPath(import.meta.url)
const defaultProjectDir = 'examples/card-to-candidate'
const defaultOutput = 'records/exports/media-control-surface-projection.local.json'
const truthStatus = 'not mesh truth; not distributed proof; not ratified shared state'

const packsDoctrineRefs = Object.freeze([
  '../mesh-ecology-packs/docs/surface-first-doctrine.md',
  '../mesh-ecology-packs/docs/adjacent-control-plane-conventions.md',
  '../mesh-ecology-packs/docs/adjacent-control-plane-observation-contract.md',
  '../mesh-ecology-packs/docs/control-plane-information-architecture.md',
  '../mesh-ecology-packs/docs/mesh-native-interaction-model.md',
  '../mesh-ecology-packs/docs/media-intent-map.md',
  '../mesh-ecology-packs/docs/media-contract.json'
])

const knownObservationPaths = Object.freeze({
  localRunManifest: 'records/manifests/media-local-run-manifest.local.json',
  inspectionPacket: 'records/exports/local-run-edge-inspection-packet.local.json',
  exportBundle: 'records/exports/bundles/edge-export-bundle-local-run-inspection/bundle-manifest.local.json',
  providerRunLedger: 'records/provider-results/media-provider-run-ledger.local.json',
  projectStatus: 'records/manifests/media-project-status.local.json'
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

export async function writeControlSurfaceProjection({
  projectDir = defaultProjectDir,
  output = defaultOutput,
  print = false
} = {}) {
  assertSafeLocalPath(output)

  const root = path.resolve(projectDir)
  const card = await readOptionalJson(root, 'cards/card.json')
  const observationRefs = await collectObservationRefs(root)
  const projectId = card?.projectId ??
    await projectIdFromObservation(root, observationRefs) ??
    path.basename(root)

  const projection = {
    schema: artifactKinds.mediaControlSurfaceProjectionLocal,
    projectionId: `control-surface-projection-${projectId}`,
    projectId,
    createdAt: nowIso(),
    mode: 'standalone-local',
    packsDoctrineRefs: packsDoctrineRefs.map((docPath) => ({
      kind: 'read-only-adjacent-doctrine',
      path: docPath,
      owner: 'mesh-ecology-packs'
    })),
    posture: {
      controlPlaneOwner: 'mesh-ecology-packs',
      domainOwner: 'media-studio',
      preferredLane: 'readonly observer',
      authorityPosture: 'observer',
      readonlyFirst: true,
      writableWorkerRequired: false,
      authorityInitializationRequired: false,
      writerManagementRequired: false,
      rendererOwnsPresentationOnly: true
    },
    planes: [
      {
        plane: 'presentation',
        posture: 'renderer owns presentation only',
        views: ['topology', 'concerns', 'actors', 'evidence'],
        localPersistence: false,
        authoritySurface: false
      },
      {
        plane: 'operational',
        posture: 'readonly observer first',
        views: ['actions', 'approvals', 'evidence'],
        localActionsOnly: true,
        writesMesh: false
      },
      {
        plane: 'authoring',
        posture: 'deferred until explicit authority and persistence lane exists',
        enabled: false,
        localPersistenceRequiresExplicitRecord: true
      }
    ],
    views: [
      {
        view: 'evidence',
        consumes: ['inspectionPacket', 'localRunManifest', 'candidateReview', 'continuityEvidence'],
        stableLocalRecords: true
      },
      {
        view: 'actions',
        consumes: ['projectStatus', 'providerRunLedger'],
        actionPosture: 'local command preview only'
      },
      {
        view: 'approvals',
        consumes: ['candidateReview', 'local operator decisions'],
        ratifierAuthority: false
      },
      {
        view: 'actors',
        consumes: ['future organism descriptors'],
        activeActors: false
      },
      {
        view: 'topology',
        consumes: ['future concern/discovery observation refs'],
        meshTopologyTruth: false
      },
      {
        view: 'concerns',
        consumes: ['future Edge or mesh concern refs'],
        concernAuthority: false
      }
    ],
    actions: [
      localAction('inspect-local-run', 'inspect:local-run', 'media-edge-operator-seam'),
      localAction('export-inspection-bundle', 'export:inspection-bundle', 'media-edge-operator-seam'),
      localAction('status-project', 'status:project', 'media-readiness-guidance-seam'),
      localAction('review-candidates', 'review:candidates', 'media-operator-decision-seam'),
      localAction('continuity-draft', 'continuity:draft', 'media-causal-evidence-seam'),
      localAction('inspect-provider-runs', 'inspect:provider-runs', 'media-work-packet-seam')
    ],
    observationRefs,
    warnings: [
      'Control-surface projection is local semantic alignment only; it is not UI.',
      'This record does not implement Edge integration, surface.request, surface.response, or surface.event.',
      'Presentation/rendering remains deferred; renderer contracts are not defined here.',
      'Readonly observer is the only control-plane posture claimed for this phase.',
      'Local records remain non-authoritative and do not become mesh truth, provider truth, ratifier authority, or byte proof.'
    ],
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    providerTruth: false,
    authoritySurface: false,
    rendererContract: false,
    localTruthLabel: 'local cache',
    truthStatus
  }

  validateRequiredRecord(projection)

  await writeJsonAtomic(root, output, projection)

  if (print) {
    console.log(JSON.stringify(projection, null, 2))
  } else {
    console.log(`control surface projection: ${output}`)
    console.log(`posture: ${projection.posture.preferredLane}`)
    console.log(`planes: ${projection.planes.map((plane) => plane.plane).join(', ')}`)
  }

  return {
    projection,
    output
  }
}

async function collectObservationRefs(root) {
  const refs = {}

  for (const [name, relativePath] of Object.entries(knownObservationPaths)) {
    const record = await readOptionalJson(root, relativePath)
    if (!record?.schema) continue

    const unwrapped = record.providerResult?.schema === artifactKinds.mediaProviderResult
      ? record.providerResult
      : record
    validateRequiredRecord(unwrapped)
    refs[name] = localRecordRef(kindForSchema(unwrapped.schema), idForRecord(unwrapped), relativePath, unwrapped.schema)
  }

  const evidenceRefs = await collectEvidenceObservationRefs(root)
  if (evidenceRefs.candidateReviews.length > 0) refs.candidateReviews = evidenceRefs.candidateReviews
  if (evidenceRefs.continuityEvidence.length > 0) refs.continuityEvidence = evidenceRefs.continuityEvidence
  const exportBundles = await collectExportBundleRefs(root)
  if (exportBundles.length > 0) refs.exportBundles = exportBundles

  return refs
}

async function collectExportBundleRefs(root) {
  const refs = []
  const files = (await listJsonFiles(path.join(root, 'records', 'exports', 'bundles')))
    .filter((filePath) => path.basename(filePath) === 'bundle-manifest.local.json')

  for (const filePath of files) {
    const relativePath = path.relative(root, filePath).split(path.sep).join('/')
    const record = await readOptionalJson(root, relativePath)
    if (record?.schema !== artifactKinds.mediaEdgeExportBundleLocal) continue
    validateRequiredRecord(record)
    refs.push(localRecordRef(kindForSchema(record.schema), idForRecord(record), relativePath, record.schema))
  }

  return refs
}

async function collectEvidenceObservationRefs(root) {
  const refs = {
    candidateReviews: [],
    continuityEvidence: []
  }
  const files = await listJsonFiles(path.join(root, 'records', 'evidence'))

  for (const filePath of files) {
    const relativePath = path.relative(root, filePath).split(path.sep).join('/')
    const record = await readOptionalJson(root, relativePath)
    if (!record?.schema) continue
    if (![artifactKinds.mediaCandidateReviewLocal, artifactKinds.mediaContinuityEvidenceLocal].includes(record.schema)) continue

    validateRequiredRecord(record)
    const ref = localRecordRef(kindForSchema(record.schema), idForRecord(record), relativePath, record.schema)
    if (record.schema === artifactKinds.mediaCandidateReviewLocal) refs.candidateReviews.push(ref)
    if (record.schema === artifactKinds.mediaContinuityEvidenceLocal) refs.continuityEvidence.push(ref)
  }

  return refs
}

async function projectIdFromObservation(root, observationRefs) {
  for (const ref of Object.values(observationRefs)) {
    const firstRef = Array.isArray(ref) ? ref[0] : ref
    if (!firstRef?.path) continue
    const record = await readOptionalJson(root, firstRef.path)
    const unwrapped = record?.providerResult?.schema === artifactKinds.mediaProviderResult
      ? record.providerResult
      : record
    if (unwrapped?.projectId) return unwrapped.projectId
  }

  return undefined
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

function localAction(actionId, command, seam) {
  return {
    actionId,
    command,
    seam,
    surfaceActionPreview: true,
    surfaceRequest: false,
    writesMesh: false,
    localOnly: true,
    authorityRequiredBeforeMeshWrite: true
  }
}

function localRecordRef(kind, id, relativePath, schema) {
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
    [artifactKinds.mediaEdgeExportBundleLocal]: 'media-edge-export-bundle',
    [artifactKinds.mediaProviderRunLedgerLocal]: 'media-provider-run-ledger',
    [artifactKinds.mediaProjectStatusLocal]: 'media-project-status',
    [artifactKinds.mediaCandidateReviewLocal]: 'media-candidate-review',
    [artifactKinds.mediaContinuityEvidenceLocal]: 'media-continuity-evidence'
  }

  return schemaKinds[schema] ?? schema
}

function idForRecord(record) {
  return record.runId ??
    record.packetId ??
    record.bundleId ??
    record.ledgerId ??
    record.statusId ??
    record.candidateReviewId ??
    record.continuityEvidenceId ??
    record.projectionId ??
    record.schema
}

if (process.argv[1] === modulePath) {
  await writeControlSurfaceProjection(parseArgs(process.argv.slice(2)))
}
