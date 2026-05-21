import { artifactKinds } from '../contracts/artifact-kinds.js'
import { makeRef } from '../contracts/constructors.js'
import { evaluateRenderExportCandidateFreshness } from './render-export-candidate.js'

export function summarizeRenderReceipts(records = []) {
  const rows = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaRenderReceiptLocal)
    .map((entry) => summarizeRenderReceipt(entry.record, entry.path ?? entry.relativePath, records))
    .sort((left, right) => (right.createdAt ?? '').localeCompare(left.createdAt ?? ''))

  return {
    total: rows.length,
    renderPerformed: rows.filter((row) => row.renderPerformed).length,
    exportPerformed: rows.filter((row) => row.exportPerformed).length,
    productionReady: rows.filter((row) => row.productionReady).length,
    contactSheet: rows.filter((row) => row.renderKind === 'local-contact-sheet').length,
    ffmpegPreview: rows.filter((row) => row.renderKind === 'local-ffmpeg-review-mp4').length,
    fresh: rows.filter((row) => row.freshnessState === 'fresh').length,
    stale: rows.filter((row) => row.freshnessState === 'stale').length,
    rows,
    attentionRows: rows.filter((row) => row.issueCodes.length > 0),
    localOnly: true,
    operatorGuidanceOnly: true,
    meshTruth: false,
    exportPerformedClaimed: rows.some((row) => row.exportPerformed),
    productionReadyClaimed: rows.some((row) => row.productionReady)
  }
}

export function summarizeRenderReceipt(receipt, relativePath, records = []) {
  const freshness = evaluateRenderReceiptFreshness({ receipt, records })
  return {
    receiptRef: {
      ...makeRef('media-render-receipt', receipt.renderReceiptId, receipt.schema),
      path: relativePath,
      localOnly: true
    },
    renderReceiptId: receipt.renderReceiptId,
    renderKind: receipt.renderKind,
    sourceRenderPlanRef: receipt.sourceRenderPlanRef ?? null,
    sourceRenderExportCandidateRef: receipt.sourceRenderExportCandidateRef ?? null,
    sourceRoughCutRef: receipt.sourceRoughCutRef ?? null,
    reviewDecisionRef: receipt.reviewDecisionRef ?? null,
    outputLocalRef: receipt.outputLocalRef ?? null,
    rendererSelected: receipt.executionPosture?.rendererSelected === true,
    renderPerformed: receipt.renderPerformed === true,
    exportPerformed: receipt.exportPerformed === true,
    productionReady: receipt.productionReady === true,
    freshnessState: freshness.state,
    issueCodes: freshness.issueCodes,
    nextAction: freshness.nextAction,
    sourceRefs: freshness.checkedRefs,
    createdAt: receipt.createdAt,
    localOnly: true,
    operatorGuidanceOnly: true,
    approvalAuthority: false,
    publicationAuthorization: false,
    meshTruth: false
  }
}

export function evaluateRenderReceiptFreshness({
  receipt,
  records = []
}) {
  const issueCodes = []
  const sourcePlan = findRecordEntry(records, artifactKinds.mediaRenderPlanCandidateLocal, {
    id: receipt.sourceRenderPlanRef?.id,
    path: receipt.sourceRenderPlanRef?.path,
    idField: 'planId'
  })
  const sourceCandidate = findRecordEntry(records, artifactKinds.mediaRenderExportCandidateLocal, {
    id: receipt.sourceRenderExportCandidateRef?.id,
    path: receipt.sourceRenderExportCandidateRef?.path,
    idField: 'candidateId'
  })

  if (!sourcePlan) {
    issueCodes.push('source_render_plan_missing')
  }

  if (!sourceCandidate) {
    issueCodes.push('source_render_export_candidate_missing')
  } else {
    const candidateFreshness = evaluateRenderExportCandidateFreshness({
      candidate: sourceCandidate.record,
      records
    })
    issueCodes.push(...candidateFreshness.issueCodes)
  }

  if (sourcePlan) {
    const latestPlan = latestRecordEntry(records, artifactKinds.mediaRenderPlanCandidateLocal, (record) =>
      record.sourceRenderExportCandidateRef?.id === receipt.sourceRenderExportCandidateRef?.id
    )
    if (latestPlan?.record.planId && latestPlan.record.planId !== receipt.sourceRenderPlanRef?.id) {
      issueCodes.push('latest_render_plan_changed')
    }

    const planSignature = orderedItemSignatureFromPlan(sourcePlan.record)
    const receiptSignature = orderedItemSignatureFromReceipt(receipt)
    if (planSignature !== receiptSignature) {
      issueCodes.push('ordered_items_changed')
    }
  }

  const latestDecision = latestRecordEntry(records, artifactKinds.mediaOperatorDecision, (record) =>
    record.roughCutReview &&
    record.subjectRef?.id === receipt.sourceRoughCutRef?.id
  )
  if (latestDecision?.record.decisionId && latestDecision.record.decisionId !== receipt.reviewDecisionRef?.id) {
    issueCodes.push('latest_rough_cut_review_changed')
  }
  if (latestDecision?.record.decisionType && latestDecision.record.decisionType !== 'review_rough_cut') {
    issueCodes.push('latest_rough_cut_review_not_approved_for_render_export')
  }

  const uniqueIssues = [...new Set(issueCodes)]
  return {
    state: uniqueIssues.length === 0 ? 'fresh' : 'stale',
    issueCodes: uniqueIssues,
    checkedRefs: compactRefs([
      receipt.sourceRenderPlanRef,
      receipt.sourceRenderExportCandidateRef,
      receipt.sourceRoughCutRef,
      receipt.reviewDecisionRef,
      sourcePlan ? localRecordRef('media-render-plan-candidate', sourcePlan.record.planId, sourcePlan.record.schema, sourcePlan.path) : null,
      sourceCandidate ? localRecordRef('media-render-export-candidate', sourceCandidate.record.candidateId, sourceCandidate.record.schema, sourceCandidate.path) : null,
      latestDecision ? localRecordRef('media-operator-decision', latestDecision.record.decisionId, latestDecision.record.schema, latestDecision.path) : null
    ]),
    nextAction: uniqueIssues.length === 0
      ? 'Render receipt is current local preview evidence; export delivery and authority remain separate.'
      : 'Regenerate render/export preparation and local preview render from the latest reviewed rough cut.',
    localOnly: true,
    operatorGuidanceOnly: true,
    renderPerformed: receipt.renderPerformed === true,
    exportPerformed: false,
    productionReady: false,
    meshTruth: false,
    publicationAuthorization: false
  }
}

function findRecordEntry(records, schema, { id, path, idField }) {
  return records.find((entry) => entry.record.schema === schema && path && entry.path === path) ??
    records.find((entry) => entry.record.schema === schema && id && entry.record[idField] === id)
}

function latestRecordEntry(records, schema, predicate) {
  return records
    .filter((entry) => entry.record.schema === schema)
    .filter((entry) => predicate(entry.record))
    .sort((left, right) => {
      const rightTime = Date.parse(right.record.createdAt ?? '') || 0
      const leftTime = Date.parse(left.record.createdAt ?? '') || 0
      if (rightTime !== leftTime) return rightTime - leftTime
      return (right.path ?? '').localeCompare(left.path ?? '')
    })[0]
}

function orderedItemSignatureFromPlan(plan) {
  return (plan.orderedItems ?? [])
    .map((item) => `${item.itemRef?.order ?? item.order}:${item.itemRef?.id ?? item.itemId}`)
    .join('|')
}

function orderedItemSignatureFromReceipt(receipt) {
  return (receipt.orderedItems ?? [])
    .map((item) => `${item.order}:${item.itemRef?.id ?? item.itemId}`)
    .join('|')
}

function localRecordRef(kind, id, schema, relativePath) {
  return {
    ...makeRef(kind, id, schema),
    path: relativePath,
    localOnly: true
  }
}

function compactRefs(refs) {
  const output = []
  const seen = new Set()
  for (const ref of refs.filter((candidate) => candidate?.id)) {
    const key = `${ref.schema}:${ref.id}:${ref.path ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    output.push(ref)
  }
  return output
}
