import { fileURLToPath } from 'node:url'

import { writeByteDescriptorProposals } from '../assets/byte-descriptor-proposal.js'
import { writeProductionRecordsFromCard } from '../production/create-production-records.js'
import { writeControlSurfaceProjection } from '../seams/control-surface-projection.js'
import { writeEdgeCompatibilityBundle } from '../seams/edge-compatibility-bundle.js'
import { inspectLocalRun } from '../seams/inspect-local-run.js'
import { writeOperatorPacketIndex } from '../seams/operator-packet-index.js'
import { writeProjectHealth } from '../seams/project-health.js'
import { writeLocalLayerResourceRefCandidates } from './resource-ref-candidates.js'

const modulePath = fileURLToPath(import.meta.url)
const defaultProjectDir = 'examples/card-to-candidate'

const byteRepairIssues = new Set([
  'missing_byte_descriptor_proposal',
  'stale_byte_descriptor_proposal'
])

const resourceRepairIssues = new Set([
  'missing_resource_ref_candidate',
  'stale_resource_ref_candidate',
  'unresolved_resource_ref_candidate',
  'accepted_asset_without_byte_resource_posture'
])

const productionRepairIssues = new Set([
  'stale_production_descriptor',
  'production_descriptor_parent_mismatch',
  'production_descriptor_missing_unit'
])

const derivativeGuidanceIssues = new Set([
  'missing_thumbnail',
  'missing_proxy',
  'missing_waveform',
  'metadata_probe_unavailable',
  'unsupported_media_type'
])

function parseArgs(argv) {
  const args = {
    projectDir: defaultProjectDir,
    print: false,
    refreshOperator: true
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]

    if (arg === '--project-dir') {
      args.projectDir = next
      i += 1
    } else if (arg === '--print') {
      args.print = true
    } else if (arg === '--no-refresh-operator') {
      args.refreshOperator = false
    }
  }

  return args
}

export async function repairLocalPosture({
  projectDir = defaultProjectDir,
  print = false,
  refreshOperator = true
} = {}) {
  const before = await withQuietLogs(() => writeProjectHealth({ projectDir, summary: true }))
  const issueCodes = collectIssueCodes(before.health.operatorHealthExplanations)
  const repairs = []
  const skipped = []

  if (hasAny(issueCodes, byteRepairIssues)) {
    const result = await writeByteDescriptorProposals({ projectDir, quiet: true })
    repairs.push({
      repairKind: 'byte_descriptor_proposals',
      issueCodes: matchingIssues(issueCodes, byteRepairIssues),
      recordsWritten: result.proposals.length,
      localOnly: true,
      meshTruth: false,
      byteAvailabilityProof: false,
      materializationProof: false
    })
  }

  if (hasAny(issueCodes, resourceRepairIssues)) {
    const result = await writeLocalLayerResourceRefCandidates({ projectDir, quiet: true })
    repairs.push({
      repairKind: 'local_layer_resource_ref_candidates',
      issueCodes: matchingIssues(issueCodes, resourceRepairIssues),
      recordsWritten: result.candidates.length,
      localOnly: true,
      meshTruth: false,
      resourceAdmission: false,
      materializationProof: false
    })
  }

  if (hasAny(issueCodes, productionRepairIssues)) {
    const result = await writeProductionRecordsFromCard({ projectDir, quiet: true })
    repairs.push({
      repairKind: 'production_descriptors',
      issueCodes: matchingIssues(issueCodes, productionRepairIssues),
      recordsWritten: result.outputs.length,
      localOnly: true,
      meshTruth: false,
      causalTruth: false,
      publicationAuthorization: false
    })
  }

  const unrepairable = Array.from(issueCodes)
    .filter((issueCode) => !byteRepairIssues.has(issueCode))
    .filter((issueCode) => !resourceRepairIssues.has(issueCode))
    .filter((issueCode) => !productionRepairIssues.has(issueCode))
    .sort()

  for (const issueCode of unrepairable) {
    const derivativeGuidance = derivativeGuidanceIssues.has(issueCode)
    skipped.push({
      issueCode,
      reason: derivativeGuidance
        ? 'Derivative readiness is guidance-only; derivative generation is not implemented.'
        : 'No safe local posture repair is defined for this issue.',
      nonBlocking: derivativeGuidance,
      localOnly: true
    })
  }

  const after = await withQuietLogs(() => writeProjectHealth({ projectDir, summary: true }))
  const refreshed = {
    projectHealth: after.output
  }

  if (refreshOperator) {
    try {
      const inspection = await withQuietLogs(() => inspectLocalRun({ projectDir }))
      refreshed.inspectionPacket = inspection.output
    } catch (error) {
      skipped.push({
        issueCode: 'inspection_refresh_skipped',
        reason: error.message,
        localOnly: true
      })
    }

    try {
      const projection = await withQuietLogs(() => writeControlSurfaceProjection({ projectDir }))
      refreshed.controlSurfaceProjection = projection.output
    } catch (error) {
      skipped.push({
        issueCode: 'control_surface_refresh_skipped',
        reason: error.message,
        localOnly: true
      })
    }

    try {
      const bundle = await withQuietLogs(() => writeEdgeCompatibilityBundle({ projectDir }))
      refreshed.edgeCompatibilityBundle = bundle.output
    } catch (error) {
      skipped.push({
        issueCode: 'edge_compatibility_refresh_skipped',
        reason: error.message,
        localOnly: true
      })
    }

    try {
      const index = await withQuietLogs(() => writeOperatorPacketIndex({ projectDir }))
      refreshed.operatorPacketIndex = index.output
    } catch (error) {
      skipped.push({
        issueCode: 'operator_index_refresh_skipped',
        reason: error.message,
        localOnly: true
      })
    }
  }

  const summary = {
    projectId: after.health.projectId,
    projectDir,
    startedHealthState: before.health.healthState,
    finalHealthState: after.health.healthState,
    repaired: repairs.reduce((sum, repair) => sum + repair.recordsWritten, 0),
    repairGroups: repairs.length,
    skipped: skipped.length,
    remainingAttention: after.health.operatorHealthExplanations.length,
    bytePosture: after.health.assetResourceConsistency?.bytePosture,
    resourcePosture: after.health.assetResourceConsistency?.resourcePosture,
    repairs,
    skippedIssues: skipped,
    refreshed,
    remainingIssueCodes: Array.from(collectIssueCodes(after.health.operatorHealthExplanations)).sort(),
    nonClaims: {
      localOnly: true,
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

  if (print) {
    console.log(JSON.stringify(summary, null, 2))
  } else {
    printRepairSummary(summary)
  }

  return summary
}

function printRepairSummary(summary) {
  const bytePosture = summary.bytePosture
    ? `${summary.bytePosture.coveredContentIds}/${summary.bytePosture.expectedContentIds}`
    : 'unknown'
  const resourcePosture = summary.resourcePosture
    ? `${summary.resourcePosture.coveredSituationPlacements}/${summary.resourcePosture.expectedSituationPlacements}`
    : 'unknown'
  console.log([
    `local posture repair: project=${summary.projectId}`,
    `repaired=${summary.repaired}`,
    `repairGroups=${summary.repairGroups}`,
    `skipped=${summary.skipped}`,
    `remainingAttention=${summary.remainingAttention}`,
    `byteContent=${bytePosture}`,
    `resourceSituations=${resourcePosture}`,
    `health=${summary.startedHealthState}->${summary.finalHealthState}`
  ].join(' | '))

  for (const repair of summary.repairs) {
    console.log(`repaired: ${repair.repairKind} | records=${repair.recordsWritten} | issues=${repair.issueCodes.join(',')}`)
  }

  for (const skipped of summary.skippedIssues) {
    console.log(`skipped: ${skipped.issueCode} | nonBlocking=${skipped.nonBlocking === true} | reason=${skipped.reason}`)
  }

  console.log('nonClaims: local-only; no mesh truth; no byte/materialization proof; no resource admission')
}

function collectIssueCodes(explanations = []) {
  const issueCodes = new Set()
  for (const explanation of explanations) {
    for (const issueCode of explanation.issueCodes ?? []) {
      issueCodes.add(issueCode)
    }
  }
  return issueCodes
}

function hasAny(issueCodes, repairIssues) {
  for (const issueCode of issueCodes) {
    if (repairIssues.has(issueCode)) return true
  }
  return false
}

function matchingIssues(issueCodes, repairIssues) {
  return Array.from(issueCodes).filter((issueCode) => repairIssues.has(issueCode)).sort()
}

async function withQuietLogs(fn) {
  const originalLog = console.log
  console.log = () => {}
  try {
    return await fn()
  } finally {
    console.log = originalLog
  }
}

if (process.argv[1] === modulePath) {
  await repairLocalPosture(parseArgs(process.argv.slice(2)))
}
