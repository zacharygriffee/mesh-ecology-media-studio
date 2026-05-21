import { artifactKinds } from '../contracts/artifact-kinds.js'
import { makeRef } from '../contracts/constructors.js'

export function summarizeExportReceipts(records = []) {
  const rows = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaExportReceiptLocal)
    .map((entry) => summarizeExportReceipt(entry.record, entry.path ?? entry.relativePath, records))
    .sort((left, right) => (right.createdAt ?? '').localeCompare(left.createdAt ?? ''))

  return {
    total: rows.length,
    exportPerformed: rows.filter((row) => row.exportPerformed).length,
    deliveryCreated: rows.filter((row) => row.deliveryCreated).length,
    productionReady: rows.filter((row) => row.productionReady).length,
    publicationAuthorization: rows.filter((row) => row.publicationAuthorization).length,
    rows,
    attentionRows: rows.filter((row) => row.issueCodes.length > 0),
    localOnly: true,
    operatorGuidanceOnly: true,
    meshTruth: false,
    publicationAuthorizationClaimed: rows.some((row) => row.publicationAuthorization),
    productionReadyClaimed: rows.some((row) => row.productionReady)
  }
}

export function summarizeExportReceipt(receipt, relativePath, records = []) {
  const issueCodes = []
  if (!findRecord(records, artifactKinds.mediaExportPlanCandidateLocal, 'planId', receipt.sourceExportPlanRef?.id)) {
    issueCodes.push('source_export_plan_missing')
  }
  if (!findRecord(records, artifactKinds.mediaRenderReceiptLocal, 'renderReceiptId', receipt.sourceRenderReceiptRef?.id)) {
    issueCodes.push('source_render_receipt_missing')
  }

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
    sourceRenderReceiptRef: receipt.sourceRenderReceiptRef,
    deliveryLocalRef: receipt.deliveryLocalRef,
    deliveryManifestRef: receipt.deliveryManifestRef,
    exportPerformed: receipt.exportPerformed === true,
    deliveryCreated: receipt.deliveryCreated === true,
    publicationAuthorization: receipt.publicationAuthorization === true,
    productionReady: receipt.productionReady === true,
    issueCodes,
    nextAction: issueCodes.length === 0
      ? 'Review local delivery package; publication authorization and production readiness remain separate.'
      : 'Regenerate the local export package from the current export plan and render receipt.',
    createdAt: receipt.createdAt,
    localOnly: true,
    operatorGuidanceOnly: true,
    meshTruth: false,
    approvalAuthority: false
  }
}

function findRecord(records, schema, idField, id) {
  return records.find((entry) => entry.record.schema === schema && entry.record[idField] === id)
}
