import { fileURLToPath } from 'node:url'

import { writeByteDescriptorProposals } from '../assets/byte-descriptor-proposal.js'
import { generateThumbnailDerivatives } from '../assets/generate-thumbnails.js'
import { createMediaSummary } from '../assets/media-summary.js'
import { repairLocalPosture } from '../local/repair-local-posture.js'
import { promoteCandidate } from '../local/promote-candidate.js'
import { writeLocalLayerResourceRefCandidates } from '../local/resource-ref-candidates.js'
import { inspectVeniceSmoke } from '../seams/inspect-venice-smoke.js'
import { runVeniceLiveSmoke } from './venice-live-smoke.js'

const modulePath = fileURLToPath(import.meta.url)
const defaultProjectDir = 'examples/venice-smoke'
const smokeAssetRecord = 'records/assets/venice-live-smoke-asset-0.local.json'
const smokeProviderResultRecord = 'records/provider-results/venice-live-smoke-provider-result.local.json'
const smokeCardRecord = 'cards/card.json'
const onePixelPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

function parseArgs(argv) {
  const args = {
    projectDir: defaultProjectDir,
    decision: 'accepted',
    operatorRef: 'local-operator',
    liveProvider: false,
    verbose: false,
    print: false
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]

    if (arg === '--project-dir') {
      args.projectDir = next
      i += 1
    } else if (arg === '--decision') {
      args.decision = next
      i += 1
    } else if (arg === '--operator-ref') {
      args.operatorRef = next
      i += 1
    } else if (arg === '--live-provider') {
      args.liveProvider = true
    } else if (arg === '--no-live-provider') {
      args.liveProvider = false
    } else if (arg === '--verbose') {
      args.verbose = true
    } else if (arg === '--print') {
      args.print = true
    }
  }

  return args
}

export async function runVeniceOperationalLoop({
  projectDir = defaultProjectDir,
  decision = 'accepted',
  operatorRef = 'local-operator',
  liveProvider = false,
  verbose = false,
  env = process.env,
  envPath = '.env',
  fetchImpl
} = {}) {
  const status = {
    summaryKind: 'venice-operational-loop-status',
    projectDir,
    decision,
    liveProviderRequested: liveProvider,
    liveProviderCalled: false,
    state: 'running',
    completedSteps: [],
    failedStep: null,
    nextAction: null,
    localOnly: true,
    operatorGuidanceOnly: true,
    meshTruth: false,
    providerTruth: false,
    byteAvailabilityProof: false,
    materializationProof: false,
    resourceAdmission: false,
    edgeCalled: false,
    meshPublished: false
  }

  try {
    status.liveProviderCalled = liveProvider
    const provider = await runMaybeQuiet(verbose, () => runVeniceLiveSmoke({
      projectDir,
      env: liveProvider ? env : dryRunEnv(env),
      envPath,
      fetchImpl: liveProvider ? fetchImpl : localVeniceFetch,
      externalApiCall: liveProvider
    }))
    status.liveProviderCalled = provider.live === true
    status.provider = {
      status: provider.providerResult.status,
      generatedAssets: provider.generatedAssets.assets.length,
      providerResultRef: smokeProviderResultRecord,
      localOnly: true,
      providerTruth: false
    }
    status.completedSteps.push('provider_smoke')
  } catch (error) {
    return failStatus(status, {
      failedStep: 'provider_smoke',
      error,
      nextAction: liveProvider
        ? 'Check VENICE_LIVE, VENICE_INFERENCE_KEY, network access, provider budget, and provider failure evidence.'
        : 'Check the local Venice-shaped smoke response and provider normalization path.'
    })
  }

  try {
    const beforePromotion = await runMaybeQuiet(verbose, () => generateThumbnailDerivatives({ projectDir }))
    status.thumbnailsBeforePromotion = thumbnailCounts(beforePromotion)
    status.completedSteps.push('thumbnail_generated_candidate')
  } catch (error) {
    return failStatus(status, {
      failedStep: 'thumbnail_generated_candidate',
      error,
      nextAction: 'Review image metadata and rerun npm run derivatives:thumbnail for the project.'
    })
  }

  try {
    const promotion = await runMaybeQuiet(verbose, () => promoteCandidate({
      projectDir,
      assetRecord: smokeAssetRecord,
      cardRecord: smokeCardRecord,
      providerResultRecord: smokeProviderResultRecord,
      decision,
      operatorRef
    }))
    status.promotion = {
      decision,
      assetRecord: promotion.assetRecord,
      path: promotion.assetDescriptor.localRef.path,
      localOnly: true,
      publicationAuthorization: false
    }
    status.completedSteps.push('promote_candidate')
  } catch (error) {
    return failStatus(status, {
      failedStep: 'promote_candidate',
      error,
      nextAction: 'Check the generated asset/provider result records, then rerun promote:candidate or this loop.'
    })
  }

  try {
    const afterPromotion = await runMaybeQuiet(verbose, () => generateThumbnailDerivatives({ projectDir }))
    status.thumbnailsAfterPromotion = thumbnailCounts(afterPromotion)
    status.completedSteps.push('thumbnail_promoted_candidate')
  } catch (error) {
    return failStatus(status, {
      failedStep: 'thumbnail_promoted_candidate',
      error,
      nextAction: 'Review promoted asset metadata and rerun npm run derivatives:thumbnail for the project.'
    })
  }

  try {
    const byteResult = await writeByteDescriptorProposals({ projectDir, quiet: true })
    status.byteDescriptorProposals = byteResult.proposals.length
    status.completedSteps.push('byte_descriptor_proposals')
  } catch (error) {
    return failStatus(status, {
      failedStep: 'byte_descriptor_proposals',
      error,
      nextAction: 'Check accepted/reference asset descriptors before rerunning npm run bytes:proposal.'
    })
  }

  try {
    const resourceResult = await writeLocalLayerResourceRefCandidates({ projectDir, quiet: true })
    status.resourceRefCandidates = resourceResult.candidates.length
    status.completedSteps.push('resource_ref_candidates')
  } catch (error) {
    return failStatus(status, {
      failedStep: 'resource_ref_candidates',
      error,
      nextAction: 'Check byte descriptor proposals and situated asset descriptors before rerunning npm run resource:refs.'
    })
  }

  try {
    const repair = await runMaybeQuiet(verbose, () => repairLocalPosture({ projectDir }))
    status.repair = {
      repaired: repair.repairs.length,
      skipped: repair.skippedIssues.length,
      remainingAttention: repair.remainingAttention,
      skippedIssues: repair.skippedIssues,
      localOnly: true
    }
    status.completedSteps.push('repair_local_posture')
  } catch (error) {
    return failStatus(status, {
      failedStep: 'repair_local_posture',
      error,
      nextAction: 'Run npm run repair:local-posture manually to inspect repairable and skipped issues.'
    })
  }

  try {
    const inspection = await runMaybeQuiet(verbose, () => inspectVeniceSmoke({ projectDir }))
    status.inspection = {
      output: inspection.output,
      operationalSummary: inspection.packet.operationalSummary,
      localOnly: true,
      edgeCalled: false
    }
    status.completedSteps.push('inspect_venice_smoke')
  } catch (error) {
    return failStatus(status, {
      failedStep: 'inspect_venice_smoke',
      error,
      nextAction: 'Run npm run inspect:venice-smoke to see which Venice smoke records are missing.'
    })
  }

  const summary = await createMediaSummary({ projectDir })
  status.mediaSummary = compactMediaSummary(summary)
  status.state = status.mediaSummary.remainingAttention === 0
    ? 'complete_review_only'
    : 'complete_with_attention'
  status.nextAction = status.state === 'complete_review_only'
    ? 'Review the local-only generated image loop outputs; no truth, authority, or resource admission was granted.'
    : 'Review attention rows in npm run media:summary before considering the loop complete.'

  return status
}

function failStatus(status, { failedStep, error, nextAction }) {
  return {
    ...status,
    state: 'failed_review_only',
    failedStep,
    error: error?.message ?? String(error),
    nextAction,
    localOnly: true,
    operatorGuidanceOnly: true,
    meshTruth: false,
    providerTruth: false,
    byteAvailabilityProof: false,
    materializationProof: false,
    resourceAdmission: false,
    edgeCalled: false,
    meshPublished: false
  }
}

function thumbnailCounts(result) {
  return {
    generated: result.generated.length,
    skipped: result.skipped.length,
    localOnly: true,
    materializationProof: false
  }
}

function compactMediaSummary(summary) {
  return {
    projectId: summary.projectId,
    assets: summary.assets.total,
    images: summary.assets.byMediaKind.image,
    videos: summary.assets.byMediaKind.video,
    audio: summary.assets.byMediaKind.audio,
    unsupported: summary.assets.byMediaKind.unsupported,
    generatedCandidates: {
      total: summary.generatedCandidates.total,
      reviewed: summary.generatedCandidates.reviewed,
      pending: summary.generatedCandidates.pendingReview,
      promotedAccepted: summary.generatedCandidates.promotedAccepted,
      promotedRejected: summary.generatedCandidates.promotedRejected
    },
    derivatives: {
      readyAssets: summary.derivativeReadiness.readyAssets,
      evaluatedAssets: summary.derivativeReadiness.evaluatedAssets,
      attentionAssets: summary.derivativeReadiness.attentionAssets,
      thumbnails: summary.derivatives.byKind.thumbnail
    },
    identity: {
      byteContent: summary.identity.byteContent,
      resourceSituations: summary.identity.resourceSituations
    },
    remainingAttention: summary.derivativeReadiness.attentionAssets +
      summary.generatedCandidates.pendingReview +
      summary.identity.byteContent.missingContentIds.length +
      summary.identity.resourceSituations.missingSubjectRefs.length,
    localOnly: true,
    meshTruth: false,
    byteAvailabilityProof: false,
    materializationProof: false,
    resourceAdmission: false
  }
}

function dryRunEnv(env) {
  return {
    ...env,
    VENICE_LIVE: '1',
    VENICE_INFERENCE_KEY: env.VENICE_INFERENCE_KEY ?? 'local-dry-run-venice-key'
  }
}

async function runMaybeQuiet(verbose, fn) {
  if (verbose) return fn()

  const original = console.log
  console.log = () => {}
  try {
    return await fn()
  } finally {
    console.log = original
  }
}

async function localVeniceFetch() {
  return {
    status: 200,
    async json() {
      return {
        id: 'venice-local-dry-run-response',
        images: [onePixelPngBase64],
        request: { format: 'png' }
      }
    }
  }
}

export function printVeniceOperationalLoopStatus(status) {
  const summary = status.mediaSummary
  if (!summary) {
    console.log([
      `venice loop: state=${status.state}`,
      `failedStep=${status.failedStep}`,
      `liveProviderCalled=${status.liveProviderCalled}`
    ].join(' | '))
    console.log(`nextAction: ${status.nextAction}`)
    console.log('nonClaims: local-only; no Edge call; no mesh truth; no byte/materialization proof; no resource admission')
    return
  }

  console.log([
    `venice loop: state=${status.state}`,
    `project=${summary.projectId}`,
    `liveProviderCalled=${status.liveProviderCalled}`,
    `generated=${summary.generatedCandidates.total}`,
    `reviewed=${summary.generatedCandidates.reviewed}`,
    `promotedAccepted=${summary.generatedCandidates.promotedAccepted}`,
    `promotedRejected=${summary.generatedCandidates.promotedRejected}`,
    `derivatives=${summary.derivatives.readyAssets}/${summary.derivatives.evaluatedAssets}`,
    `byteContent=${summary.identity.byteContent.coveredContentIds}/${summary.identity.byteContent.expectedContentIds}`,
    `resourceSituations=${summary.identity.resourceSituations.coveredSituationPlacements}/${summary.identity.resourceSituations.expectedSituationPlacements}`,
    `remainingAttention=${summary.remainingAttention}`
  ].join(' | '))
  console.log(`nextAction: ${status.nextAction}`)
  console.log('nonClaims: local-only; no Edge call; no mesh truth; no byte/materialization proof; no resource admission')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const status = await runVeniceOperationalLoop(args)

  if (args.print) {
    console.log(JSON.stringify(status, null, 2))
  } else {
    printVeniceOperationalLoopStatus(status)
  }

  if (status.state !== 'complete_review_only') {
    process.exitCode = 1
  }
}

if (process.argv[1] === modulePath) {
  await main()
}
