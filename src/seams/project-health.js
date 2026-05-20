import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { artifactKinds } from '../contracts/artifact-kinds.js'
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
    print: false,
    summary: false
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
    } else if (arg === '--summary') {
      args.summary = true
    }
  }

  return args
}

export async function writeProjectHealth({
  projectDir = defaultProjectDir,
  output = defaultOutput,
  print = false,
  summary = false
} = {}) {
  assertSafeLocalPath(output)
  const root = path.resolve(projectDir)
  const statusResult = await writeProjectStatus({ projectDir, quiet: summary })
  const readinessResult = await writeEdgeReadinessGuidance({ projectDir, quiet: summary })
  const productionValidation = await validateProductionRecordsInProject({ projectDir, quiet: summary })
  const projectId = statusResult.status.projectId
  const blockingIssues = []
  const assetHealthExplanations = (statusResult.status.assetResourceConsistency.assetExplanations ?? [])
    .filter((entry) => entry.state !== 'ready-for-local-inspection')
  const derivativeHealthExplanations = (statusResult.status.mediaDerivativeReadiness?.assetExplanations ?? [])
    .filter((entry) => entry.state !== 'ready-for-local-inspection')
  const productionHealthExplanations = buildProductionHealthExplanations(productionValidation)

  if (statusResult.status.assetResourceConsistency.readyForEdgeInspection !== true) {
    blockingIssues.push('asset-resource-consistency-not-ready')
  }

  if (!['ready', 'complete'].includes(readinessResult.readiness.state)) {
    blockingIssues.push(`edge-readiness-${readinessResult.readiness.state}`)
  }

  if (productionValidation.valid !== true) {
    blockingIssues.push('production-graph-invalid')
  }

  if (productionValidation.freshness?.fresh === false) {
    blockingIssues.push('production-freshness-stale')
  }

  const health = {
    schema: artifactKinds.mediaProjectHealthLocal,
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
    mediaDerivativeReadiness: statusResult.status.mediaDerivativeReadiness,
    assetHealthExplanations,
    derivativeHealthExplanations,
    edgeReadinessState: readinessResult.readiness.state,
    productionValidation: {
      valid: productionValidation.valid,
      count: productionValidation.count,
      freshness: productionValidation.freshness,
      localOnly: true
    },
    productionHealthExplanations,
    operatorHealthExplanations: [
      ...assetHealthExplanations,
      ...derivativeHealthExplanations,
      ...productionHealthExplanations
    ],
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
  validateRequiredRecord(health, artifactKinds.mediaProjectHealthLocal)

  const outputPath = path.join(root, output)
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(health, null, 2)}\n`)

  if (print) {
    console.log(JSON.stringify(health, null, 2))
  } else if (summary) {
    printHealthSummary(health, output)
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

function printHealthSummary(health, output) {
  console.log(`project health: ${output}`)
  console.log(`healthState: ${health.healthState}`)
  console.log(`edgeReadinessState: ${health.edgeReadinessState}`)
  console.log(`assetResourceReady: ${health.assetResourceConsistency.readyForEdgeInspection}`)
  console.log(`assetResourceWarnings: ${health.assetResourceConsistency.warningCount}`)
  console.log(`staleByteDescriptorProposals: ${health.assetResourceConsistency.staleByteDescriptorProposalIds.length}`)
  console.log(`staleResourceCandidates: ${health.assetResourceConsistency.staleResourceCandidateIds.length}`)
  for (const explanation of health.operatorHealthExplanations ?? []) {
    console.log(formatHealthExplanation(explanation))
  }
  console.log(`productionGraphValid: ${health.productionValidation.valid}`)
  console.log(`staleProductionDescriptors: ${health.productionValidation.freshness?.staleDescriptorIds?.length ?? 0}`)
  console.log(`blockingIssues: ${health.blockingIssues.length}`)
}

function formatHealthExplanation(explanation) {
  const subject = explanation.path ?? `${explanation.subjectKind}:${explanation.subjectRef?.id ?? 'unknown'}`
  return [
    `${explanation.subjectKind}: ${subject}`,
    `state=${explanation.healthState ?? explanation.state}`,
    `issues=${(explanation.issueCodes ?? []).join(',') || 'none'}`,
    `nextAction=${explanation.nextAction ?? 'none'}`
  ].join(' | ')
}

function buildProductionHealthExplanations(productionValidation) {
  const freshness = productionValidation.freshness ?? {}
  const recordsByDescriptorId = new Map((productionValidation.records ?? [])
    .filter((record) => record.schema === artifactKinds.mediaProductionDescriptorLocal)
    .map((record) => [record.descriptorId, record]))
  const descriptorIds = Array.from(new Set([
    ...(freshness.staleDescriptorIds ?? []),
    ...(freshness.parentMismatchDescriptorIds ?? []),
    ...(freshness.missingUnitDescriptorIds ?? [])
  ])).sort()

  return descriptorIds.map((descriptorId) => {
    const descriptor = recordsByDescriptorId.get(descriptorId)
    const issueCodes = [
      freshness.staleDescriptorIds?.includes(descriptorId) ? 'stale_production_descriptor' : null,
      freshness.parentMismatchDescriptorIds?.includes(descriptorId) ? 'production_descriptor_parent_mismatch' : null,
      freshness.missingUnitDescriptorIds?.includes(descriptorId) ? 'production_descriptor_missing_unit' : null
    ].filter(Boolean)

    return {
      subjectKind: 'media-production-descriptor',
      subjectRef: {
        kind: 'media-production-descriptor',
        id: descriptorId,
        schema: descriptor?.schema ?? artifactKinds.mediaProductionDescriptorLocal
      },
      healthState: 'needs-local-attention',
      issueCodes,
      summary: `${descriptorId} needs local production descriptor attention: ${issueCodes.join(', ')}.`,
      nextAction: 'Regenerate production descriptors from current production units.',
      sourceRefs: [
        descriptor
          ? {
              kind: 'media-production-descriptor',
              id: descriptorId,
              schema: descriptor.schema,
              localOnly: true
            }
          : {
              kind: 'media-production-descriptor',
              id: descriptorId,
              schema: artifactKinds.mediaProductionDescriptorLocal,
              localOnly: true
            }
      ],
      nonClaims: healthNonClaims(),
      localOnly: true,
      meshTruth: false,
      distributedProof: false,
      ratifiedSharedState: false,
      byteAvailabilityProof: false,
      materializationProof: false,
      providerTruth: false,
      resourceAdmission: false
    }
  })
}

function healthNonClaims() {
  return {
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    byteAvailabilityProof: false,
    materializationProof: false,
    resourceAdmission: false,
    providerTruth: false,
    causalTruth: false,
    publicationAuthorization: false,
    edgeApproval: false
  }
}

function validateProjectHealth(health) {
  if (health.schema !== artifactKinds.mediaProjectHealthLocal) {
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
