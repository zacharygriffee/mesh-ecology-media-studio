import { fileURLToPath } from 'node:url'

import { createMediaSummary } from '../assets/media-summary.js'
import { nowIso } from '../contracts/constructors.js'
import { writeEdgeCompatibilityBundle } from '../seams/edge-compatibility-bundle.js'
import { writeOperatorPacketIndex } from '../seams/operator-packet-index.js'
import { writeAuthorityHandoffCandidate } from './authority-handoff-candidate.js'
import { createProductionAuthorityPrerequisiteReport, writeProductionAuthorityPrerequisiteReport } from './authority-prerequisites.js'
import { writeExportCandidate } from './export-candidate.js'
import { writeFfmpegExport } from './export-ffmpeg.js'
import { writeLocalExportPackage } from './export-local-package.js'
import { writeExportPlanCandidate } from './export-plan-candidate.js'
import { writeLocalPackageReviewDecision } from './local-package-review-decision.js'
import { createLocalPackagePostureSummary, formatLocalPackagePostureFields } from './local-package-posture.js'
import { writePublicationAuthorityRequestCandidate } from './publication-authority-request-candidate.js'
import { writeRenderAdapterContract } from './render-adapter-contract.js'
import { writeContactSheetRender } from './render-contact-sheet.js'
import { writeRenderExportCandidate } from './render-export-candidate.js'
import { writeFfmpegRender } from './render-ffmpeg.js'
import { writeRenderPlanCandidate } from './render-plan-candidate.js'
import { writeRoughCutCapsule } from './rough-cut-capsule.js'
import { writeRoughCutReviewDecision } from './rough-cut-review-decision.js'

const modulePath = fileURLToPath(import.meta.url)
const defaultProjectDir = 'examples/venice-smoke'

function parseArgs(argv) {
  const args = {
    projectDir: defaultProjectDir,
    disableFfmpeg: false,
    skipContactSheet: false,
    skipLocalPackage: false,
    print: false,
    quiet: false
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]

    if (arg === '--project-dir') {
      args.projectDir = next
      i += 1
    } else if (arg === '--disable-ffmpeg') {
      args.disableFfmpeg = true
    } else if (arg === '--skip-contact-sheet') {
      args.skipContactSheet = true
    } else if (arg === '--skip-local-package') {
      args.skipLocalPackage = true
    } else if (arg === '--print') {
      args.print = true
    } else if (arg === '--quiet') {
      args.quiet = true
    }
  }

  return args
}

export async function runLocalProductionOutput({
  projectDir = defaultProjectDir,
  disableFfmpeg = false,
  skipContactSheet = false,
  skipLocalPackage = false,
  print = false,
  quiet = false,
  createdAt = nowIso()
} = {}) {
  const steps = []
  const stepTime = createStepClock(createdAt)

  const roughCut = await recordStep(steps, 'rough-cut', () =>
    writeRoughCutCapsule({ projectDir, quiet: true, createdAt: stepTime() })
  )
  const review = await recordStep(steps, 'rough-cut-review', () =>
    writeRoughCutReviewDecision({ projectDir, quiet: true, createdAt: stepTime() })
  )
  const renderExport = await recordStep(steps, 'render-export-candidate', () =>
    writeRenderExportCandidate({ projectDir, quiet: true, createdAt: stepTime() })
  )
  const adapter = await recordStep(steps, 'render-adapter-contract', () =>
    writeRenderAdapterContract({ projectDir, quiet: true, createdAt: stepTime() })
  )
  const renderPlan = await recordStep(steps, 'render-plan', () =>
    writeRenderPlanCandidate({ projectDir, quiet: true, createdAt: stepTime() })
  )
  const contactSheet = skipContactSheet
    ? await skipStep(steps, 'render-contact-sheet', 'contact sheet disabled')
    : await recordStep(steps, 'render-contact-sheet', () =>
      writeContactSheetRender({ projectDir, quiet: true, createdAt: stepTime() })
    )
  const ffmpegRender = await recordStep(steps, 'render-ffmpeg', () =>
    writeFfmpegRender({ projectDir, disableFfmpeg, quiet: true, createdAt: stepTime() })
  )
  const exportCandidate = await recordStep(steps, 'export-candidate', () =>
    writeExportCandidate({ projectDir, quiet: true, createdAt: stepTime() })
  )
  const exportPlan = await recordStep(steps, 'export-plan', () =>
    writeExportPlanCandidate({ projectDir, quiet: true, createdAt: stepTime() })
  )
  const localExport = skipLocalPackage
    ? await skipStep(steps, 'export-local-package', 'local package copy disabled')
    : await recordStep(steps, 'export-local-package', () =>
      writeLocalExportPackage({ projectDir, quiet: true, createdAt: stepTime() })
    )
  const ffmpegExport = await recordStep(steps, 'export-ffmpeg', () =>
    writeFfmpegExport({ projectDir, disableFfmpeg, quiet: true, createdAt: stepTime() })
  )
  const prerequisiteReport = await recordStep(steps, 'authority-prereqs', () =>
    writeProductionAuthorityPrerequisiteReport({ projectDir, quiet: true, createdAt: stepTime() })
  )
  const packageReview = canReviewLocalPackage(prerequisiteReport.result)
    ? await recordStep(steps, 'local-package-review', () =>
      writeLocalPackageReviewDecision({ projectDir, quiet: true, createdAt: stepTime() })
    )
    : await skipStep(steps, 'local-package-review', 'local production package incomplete or output integrity blocked')
  const publicationAuthorityRequest = packageReview.result?.decision
    ? await recordStep(steps, 'publication-authority-request', () =>
      writePublicationAuthorityRequestCandidate({ projectDir, quiet: true, createdAt: stepTime() })
    )
    : await skipStep(steps, 'publication-authority-request', 'local package review missing')
  const authorityHandoff = await recordStep(steps, 'authority-handoff', () =>
    writeAuthorityHandoffCandidate({ projectDir, quiet: true, createdAt: stepTime() })
  )
  const operatorIndex = await recordStep(steps, 'operator-index', () =>
    writeOperatorPacketIndex({ projectDir, quiet: true })
  )
  const edgeCompatibility = await recordStep(steps, 'edge-compatibility-bundle', () =>
    writeEdgeCompatibilityBundle({ projectDir, quiet: true })
  )
  const mediaSummary = await createMediaSummary({ projectDir })
  const finalPrereqs = await createProductionAuthorityPrerequisiteReport({ projectDir })
  const localPackagePosture = await createLocalPackagePostureSummary({
    projectDir,
    prerequisiteReport: finalPrereqs
  })

  const result = {
    projectId: mediaSummary.projectId,
    mode: 'standalone-local',
    steps,
    refs: {
      roughCutId: roughCut.result.roughCut?.roughCutId ?? null,
      roughCutReviewDecisionId: review.result.decision?.decisionId ?? null,
      renderExportCandidateId: renderExport.result.candidate?.candidateId ?? null,
      renderAdapterContractId: adapter.result.contract?.contractId ?? null,
      renderPlanId: renderPlan.result.plan?.planId ?? null,
      contactSheetRenderReceiptId: contactSheet.result?.receipt?.renderReceiptId ?? null,
      ffmpegRenderReceiptId: ffmpegRender.result?.receipt?.renderReceiptId ?? null,
      exportCandidateId: exportCandidate.result.candidate?.exportCandidateId ?? null,
      exportPlanId: exportPlan.result.plan?.planId ?? null,
      localExportReceiptId: localExport.result?.receipt?.exportReceiptId ?? null,
      ffmpegExportReceiptId: ffmpegExport.result?.receipt?.exportReceiptId ?? null,
      localPackageReviewDecisionId: packageReview.result?.decision?.decisionId ?? null,
      authorityHandoffCandidateId: authorityHandoff.result.candidate?.handoffCandidateId ?? null,
      publicationAuthorityRequestCandidateId: publicationAuthorityRequest.result?.candidate?.requestCandidateId ?? null,
      operatorPacketIndexId: operatorIndex.result.index?.indexId ?? null,
      edgeCompatibilityBundleId: edgeCompatibility.result.bundle?.compatibilityBundleId ?? null
    },
    summary: {
      roughCutItems: mediaSummary.productionRoughCuts.itemRefs,
      roughCutReviewed: mediaSummary.productionRoughCuts.reviewed,
      renderReceipts: mediaSummary.renderReceipts.total,
      exportReceipts: mediaSummary.exportReceipts.total,
      ffmpegDeliveryReceipts: mediaSummary.exportReceipts.ffmpegDeliveryReceipts,
      localDeliveryEvidencePresent: mediaSummary.exportReceipts.localDeliveryEvidencePresent,
      activeDeliveryReceipts: mediaSummary.exportReceipts.activeDeliveryReceipts,
      historicalExportReceipts: mediaSummary.exportReceipts.historicalExportReceipts,
      currentExportReceiptAttention: mediaSummary.exportReceipts.currentAttention,
      historicalExportReceiptAttention: mediaSummary.exportReceipts.historicalAttention,
      localPackageReviewed: packageReview.result?.decision ? 1 : 0,
      publicationAuthorityRequests: publicationAuthorityRequest.result?.candidate ? 1 : 0,
      localProductionPackageComplete: finalPrereqs.localProductionPackageComplete ?? 0,
      pendingAuthority: finalPrereqs.pendingAuthority ?? 0,
      productionReady: finalPrereqs.productionReady ?? 0,
      localPackageState: localPackagePosture.packageState,
      latestLocalPackageReviewPosture: localPackagePosture.latestReviewPosture,
      localPackageIntegrityPosture: localPackagePosture.integrityPosture,
      localPackageNextAction: localPackagePosture.safeNextAction
    },
    localPackagePosture,
    nonClaims: {
      localOnly: true,
      operatorGuidanceOnly: true,
      approvalAuthority: false,
      ratifierAuthority: false,
      publicationAuthorization: false,
      productionReady: false,
      meshTruth: false,
      resourceAdmission: false,
      byteAvailabilityProof: false,
      materializationProof: false,
      causalTruth: false,
      edgeCalled: false,
      meshPublished: false
    }
  }

  if (print) {
    console.log(JSON.stringify(result, null, 2))
  } else if (!quiet) {
    console.log(formatLocalProductionOutputSummary(result))
    console.log('nonClaims: local-only output runner; no approval authority; no publication authorization; no productionReady claim; no Edge call; no mesh publication')
  }

  return result
}

export function formatLocalProductionOutputSummary(result) {
  return [
    `production local output: project=${result.projectId}`,
    `steps=${result.steps.filter((step) => step.state === 'completed').length}/${result.steps.length}`,
    `roughCutItems=${result.summary.roughCutItems}`,
    `roughCutReviewed=${result.summary.roughCutReviewed}`,
    `renderReceipts=${result.summary.renderReceipts}`,
    `exportReceipts=${result.summary.exportReceipts}`,
    `ffmpegDeliveryReceipts=${result.summary.ffmpegDeliveryReceipts}`,
    `localDeliveryEvidencePresent=${result.summary.localDeliveryEvidencePresent}`,
    `activeDeliveryReceipts=${result.summary.activeDeliveryReceipts}`,
    `historicalExportReceipts=${result.summary.historicalExportReceipts}`,
    `currentExportReceiptAttention=${result.summary.currentExportReceiptAttention}`,
    `historicalExportReceiptAttention=${result.summary.historicalExportReceiptAttention}`,
    `localPackageReviewed=${result.summary.localPackageReviewed}`,
    `publicationAuthorityRequests=${result.summary.publicationAuthorityRequests}`,
    `localProductionPackageComplete=${result.summary.localProductionPackageComplete}`,
    `pendingAuthority=${result.summary.pendingAuthority}`,
    `productionReady=${result.summary.productionReady}`,
    formatLocalPackagePostureFields(result.localPackagePosture)
  ].join(' | ')
}

function canReviewLocalPackage(report) {
  return (report?.candidates ?? 0) > 0 &&
    (report.localProductionPackageComplete ?? 0) === report.candidates &&
    (report.localDeliveryEvidenceIntact ?? 0) === report.candidates &&
    (report.outputIntegrityBlockingIssues ?? 0) === 0
}

async function recordStep(steps, step, fn) {
  const result = await fn()
  const state = result?.skipped ? 'skipped' : 'completed'
  steps.push({
    step,
    state,
    reason: result?.skipped?.reason ?? null,
    localOnly: true,
    authorityGranted: false,
    productionReady: false
  })
  return { result }
}

async function skipStep(steps, step, reason) {
  const result = {
    skipped: true,
    reason,
    localOnly: true,
    productionReady: false
  }
  steps.push({
    step,
    state: 'skipped',
    reason,
    localOnly: true,
    authorityGranted: false,
    productionReady: false
  })
  return { result }
}

function createStepClock(start) {
  const startTime = Date.parse(start)
  let offset = 0
  return () => {
    if (!Number.isFinite(startTime)) return nowIso()
    const value = new Date(startTime + offset).toISOString()
    offset += 1000
    return value
  }
}

if (process.argv[1] === modulePath) {
  await runLocalProductionOutput(parseArgs(process.argv.slice(2)))
}
