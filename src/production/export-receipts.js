import { artifactKinds } from '../contracts/artifact-kinds.js'
import { makeRef } from '../contracts/constructors.js'
import { evaluateRenderReceiptFreshness } from './render-receipts.js'

export function summarizeExportReceipts(records = []) {
  const baseRows = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaExportReceiptLocal)
    .map((entry) => summarizeExportReceipt(entry.record, entry.path ?? entry.relativePath, records))
    .sort((left, right) => (right.createdAt ?? '').localeCompare(left.createdAt ?? ''))
  const hasFreshDelivery = baseRows.some((row) => row.localDeliveryEvidencePresent)
  const rows = baseRows.map((row) => classifyExportReceiptVisibility(row, hasFreshDelivery))
  const attentionRows = rows.filter((row) => row.issueCodes.length > 0)
  const currentAttentionRows = attentionRows.filter((row) => row.deliveryAttentionState === 'needs-local-attention')
  const historicalAttentionRows = attentionRows.filter((row) => row.deliveryAttentionState === 'historical-stale-receipt')
  const activeDeliveryRows = rows.filter((row) => row.activeLocalDelivery)
  const historicalRows = rows.filter((row) => row.historicalAuditOnly)

  return {
    total: rows.length,
    localPackageCopyExportReceipts: rows.filter((row) => row.exportKind === 'local-review-package-copy').length,
    ffmpegDeliveryReceipts: rows.filter((row) => row.exportKind === 'local-ffmpeg-review-delivery').length,
    exportPerformed: rows.filter((row) => row.exportPerformed).length,
    deliveryCreated: rows.filter((row) => row.deliveryCreated).length,
    localDeliveryEvidencePresent: rows
      .filter((row) => row.freshnessState === 'fresh')
      .filter((row) => row.exportPerformed && row.deliveryCreated).length,
    productionReady: rows.filter((row) => row.productionReady).length,
    publicationAuthorization: rows.filter((row) => row.publicationAuthorization).length,
    fresh: rows.filter((row) => row.freshnessState === 'fresh').length,
    stale: rows.filter((row) => row.freshnessState === 'stale').length,
    activeDeliveryReceipts: activeDeliveryRows.length,
    activeDeliveryEvidencePresent: activeDeliveryRows.length,
    historicalExportReceipts: historicalRows.length,
    rows,
    activeDeliveryRows,
    historicalRows,
    attentionRows,
    currentAttentionRows,
    historicalAttentionRows,
    currentAttention: currentAttentionRows.length,
    currentExportReceiptAttention: currentAttentionRows.length,
    historicalAttention: historicalAttentionRows.length,
    historicalExportReceiptAttention: historicalAttentionRows.length,
    localOnly: true,
    operatorGuidanceOnly: true,
    meshTruth: false,
    publicationAuthorizationClaimed: rows.some((row) => row.publicationAuthorization),
    productionReadyClaimed: rows.some((row) => row.productionReady)
  }
}

function classifyExportReceiptVisibility(row, hasFreshDelivery) {
  const deliveryAttention = deliveryAttentionState(row, hasFreshDelivery)
  const activeLocalDelivery = row.localDeliveryEvidencePresent
  const historicalAuditOnly = hasFreshDelivery && !activeLocalDelivery
  return {
    ...row,
    activeLocalDelivery,
    historicalAuditOnly,
    visibilityPosture: activeLocalDelivery
      ? 'active-delivery-receipt'
      : historicalAuditOnly
        ? 'historical-export-receipt'
        : deliveryAttention === 'needs-local-attention'
          ? 'current-export-receipt-attention'
          : 'review-only-export-receipt',
    deliveryAttentionState: deliveryAttention
  }
}

function deliveryAttentionState(row, hasFreshDelivery) {
  if (row.localDeliveryEvidencePresent) return 'active-local-delivery'
  if (row.issueCodes.length === 0) return 'review-only-delivery-receipt'
  return hasFreshDelivery ? 'historical-stale-receipt' : 'needs-local-attention'
}

export function summarizeExportReceipt(receipt, relativePath, records = []) {
  const freshness = evaluateExportReceiptFreshness({ receipt, records })

  return {
    receiptRef: {
      ...makeRef('media-export-receipt', receipt.exportReceiptId, receipt.schema),
      path: relativePath,
      localOnly: true
    },
    exportReceiptId: receipt.exportReceiptId,
    exportKind: receipt.exportKind,
    sourceExportPlanRef: receipt.sourceExportPlanRef,
    sourceExportCandidateRef: receipt.sourceExportCandidateRef,
    sourceRoughCutRef: receipt.sourceRoughCutRef,
    sourceRenderReceiptRef: receipt.sourceRenderReceiptRef,
    reviewDecisionRef: receiptReviewDecisionRef(receipt),
    deliveryLocalRef: receipt.deliveryLocalRef,
    deliveryManifestRef: receipt.deliveryManifestRef,
    exportPerformed: receipt.exportPerformed === true,
    deliveryCreated: receipt.deliveryCreated === true,
    localDeliveryEvidencePresent: freshness.state === 'fresh' &&
      receipt.exportPerformed === true &&
      receipt.deliveryCreated === true,
    sourceRoughCutId: receipt.sourceRoughCutRef?.id ?? null,
    sourceRenderReceiptId: receipt.sourceRenderReceiptRef?.id ?? null,
    sourceExportPlanId: receipt.sourceExportPlanRef?.id ?? null,
    publicationAuthorization: receipt.publicationAuthorization === true,
    productionReady: receipt.productionReady === true,
    freshnessState: freshness.state,
    issueCodes: freshness.issueCodes,
    nextAction: freshness.issueCodes.length === 0
      ? 'Review local delivery package; publication authorization and production readiness remain separate.'
      : 'Regenerate the local export package from the current export plan and render receipt.',
    sourceRefs: freshness.checkedRefs,
    createdAt: receipt.createdAt,
    localOnly: true,
    operatorGuidanceOnly: true,
    meshTruth: false,
    approvalAuthority: false,
    exportAuthorization: false
  }
}

export function evaluateExportReceiptFreshness({
  receipt,
  records = []
}) {
  const issueCodes = []
  const sourcePlan = findRecordEntry(records, artifactKinds.mediaExportPlanCandidateLocal, {
    id: receipt.sourceExportPlanRef?.id,
    path: receipt.sourceExportPlanRef?.path,
    idField: 'planId'
  })
  const sourceRenderReceipt = findRecordEntry(records, artifactKinds.mediaRenderReceiptLocal, {
    id: receipt.sourceRenderReceiptRef?.id,
    path: receipt.sourceRenderReceiptRef?.path,
    idField: 'renderReceiptId'
  })
  const sourceExportCandidate = findRecordEntry(records, artifactKinds.mediaExportCandidateLocal, {
    id: receipt.sourceExportCandidateRef?.id,
    path: receipt.sourceExportCandidateRef?.path,
    idField: 'exportCandidateId'
  })

  if (!sourcePlan) {
    issueCodes.push('source_export_plan_missing')
  }

  if (!sourceExportCandidate) {
    issueCodes.push('source_export_candidate_missing')
  }

  if (!sourceRenderReceipt) {
    issueCodes.push('source_render_receipt_missing')
  } else {
    const renderFreshness = evaluateRenderReceiptFreshness({
      receipt: sourceRenderReceipt.record,
      records
    })
    issueCodes.push(...renderFreshness.issueCodes)
  }

  if (sourcePlan) {
    if (
      receipt.sourceExportCandidateRef?.id &&
      sourcePlan.record.sourceExportCandidateRef?.id &&
      sourcePlan.record.sourceExportCandidateRef.id !== receipt.sourceExportCandidateRef.id
    ) {
      issueCodes.push('source_export_candidate_changed')
    }

    const latestPlan = latestRecordEntry(records, artifactKinds.mediaExportPlanCandidateLocal, (record) =>
      record.sourceExportCandidateRef?.id === receipt.sourceExportCandidateRef?.id
    )
    if (latestPlan?.record.planId && latestPlan.record.planId !== receipt.sourceExportPlanRef?.id) {
      issueCodes.push('latest_export_plan_changed')
    }

    const planSignature = orderedItemSignatureFromPlan(sourcePlan.record)
    const receiptSignature = orderedItemSignatureFromReceipt(receipt)
    if (planSignature !== receiptSignature) {
      issueCodes.push('ordered_items_changed')
    }

    const targetPath = sourcePlan.record.targetOutputRef?.path
    if (targetPath && !receipt.deliveryLocalRef?.path?.startsWith(`${targetPath}/`)) {
      issueCodes.push('target_output_path_changed')
    }
  }

  if (sourceExportCandidate) {
    const candidateSignature = orderedItemSignatureFromExportCandidate(sourceExportCandidate.record)
    const receiptSignature = orderedItemSignatureFromReceipt(receipt)
    if (candidateSignature !== receiptSignature) {
      issueCodes.push('source_export_candidate_ordered_items_changed')
    }
  }

  const latestDecision = latestRecordEntry(records, artifactKinds.mediaOperatorDecision, (record) =>
    record.roughCutReview &&
    record.subjectRef?.id === receipt.sourceRoughCutRef?.id
  )
  const reviewDecisionRef = receiptReviewDecisionRef(receipt)
  if (latestDecision?.record.decisionId && latestDecision.record.decisionId !== reviewDecisionRef?.id) {
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
      receipt.sourceExportPlanRef,
      receipt.sourceExportCandidateRef,
      receipt.sourceRenderReceiptRef,
      receipt.sourceRoughCutRef,
      reviewDecisionRef,
      sourcePlan ? localRecordRef('media-export-plan-candidate', sourcePlan.record.planId, sourcePlan.record.schema, sourcePlan.path) : null,
      sourceExportCandidate ? localRecordRef('media-export-candidate', sourceExportCandidate.record.exportCandidateId, sourceExportCandidate.record.schema, sourceExportCandidate.path) : null,
      sourceRenderReceipt ? localRecordRef('media-render-receipt', sourceRenderReceipt.record.renderReceiptId, sourceRenderReceipt.record.schema, sourceRenderReceipt.path) : null,
      latestDecision ? localRecordRef('media-operator-decision', latestDecision.record.decisionId, latestDecision.record.schema, latestDecision.path) : null
    ]),
    nextAction: uniqueIssues.length === 0
      ? 'Export receipt is current local delivery evidence; publication authorization and production readiness remain separate.'
      : 'Regenerate export planning and local delivery from the latest reviewed rough cut and render receipt.',
    localOnly: true,
    operatorGuidanceOnly: true,
    exportPerformed: receipt.exportPerformed === true,
    deliveryCreated: receipt.deliveryCreated === true,
    productionReady: false,
    meshTruth: false,
    publicationAuthorization: false
  }
}

function receiptReviewDecisionRef(receipt) {
  return receipt.reviewDecisionRef ??
    (receipt.sourceRefs ?? []).find((ref) => ref.schema === artifactKinds.mediaOperatorDecision || ref.kind === 'media-operator-decision') ??
    null
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
    .map((item) => `${item.itemRef?.order ?? item.order}:${item.itemRef?.id ?? item.itemId ?? item.id}`)
    .join('|')
}

function orderedItemSignatureFromReceipt(receipt) {
  return (receipt.orderedItems ?? [])
    .map((item) => `${item.order}:${item.itemRef?.id ?? item.itemId ?? item.id}`)
    .join('|')
}

function orderedItemSignatureFromExportCandidate(candidate) {
  return (candidate.orderedItemRefs ?? [])
    .map((item) => `${item.order}:${item.id ?? item.itemId ?? item.itemRef?.id}`)
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
