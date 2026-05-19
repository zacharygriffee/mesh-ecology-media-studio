import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { nowIso } from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import { assertSafeLocalPath } from '../local/project-layout.js'
import { writeEdgeReadinessGuidance } from './edge-readiness-guidance.js'
import { writeProjectStatus } from './project-status.js'
import { validateProductionRecordsInProject } from '../production/validate-production-records.js'

const modulePath = fileURLToPath(import.meta.url)
const defaultProjectDir = 'examples/card-to-candidate'
const defaultOutput = 'records/manifests/media-project-health.local.json'
const truthStatus = 'not mesh truth; not distributed proof; not ratified shared state'

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

export async function writeProjectHealth({
  projectDir = defaultProjectDir,
  output = defaultOutput,
  print = false
} = {}) {
  assertSafeLocalPath(output)
  const root = path.resolve(projectDir)
  const statusResult = await writeProjectStatus({ projectDir })
  const readinessResult = await writeEdgeReadinessGuidance({ projectDir })
  const productionValidation = await validateProductionRecordsInProject({ projectDir })
  const projectId = statusResult.status.projectId
  const blockingIssues = []

  if (statusResult.status.assetResourceConsistency.readyForEdgeInspection !== true) {
    blockingIssues.push('asset-resource-consistency-not-ready')
  }

  if (!['ready', 'complete'].includes(readinessResult.readiness.state)) {
    blockingIssues.push(`edge-readiness-${readinessResult.readiness.state}`)
  }

  if (productionValidation.valid !== true) {
    blockingIssues.push('production-graph-invalid')
  }

  const health = {
    schema: 'media.project_health.local.v1',
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
    edgeReadinessState: readinessResult.readiness.state,
    productionValidation: {
      valid: productionValidation.valid,
      count: productionValidation.count,
      localOnly: true
    },
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

  const outputPath = path.join(root, output)
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(health, null, 2)}\n`)

  if (print) {
    console.log(JSON.stringify(health, null, 2))
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

function validateProjectHealth(health) {
  if (health.schema !== 'media.project_health.local.v1') {
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
