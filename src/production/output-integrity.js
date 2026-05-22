import { stat } from 'node:fs/promises'
import path from 'node:path'

import { sha256File } from '../assets/media-metadata.js'
import { artifactKinds } from '../contracts/artifact-kinds.js'
import { assertSafeLocalPath } from '../local/project-layout.js'
import { summarizeExportReceipts } from './export-receipts.js'

const renderIssueCodes = Object.freeze({
  missing: 'missing_render_preview_bytes',
  hashMismatch: 'render_preview_hash_mismatch',
  sizeMismatch: 'render_preview_size_mismatch'
})

const exportIssueCodes = Object.freeze({
  missingDelivery: 'missing_export_delivery_bytes',
  deliveryHashMismatch: 'export_delivery_hash_mismatch',
  deliverySizeMismatch: 'export_delivery_size_mismatch',
  missingManifest: 'missing_export_manifest',
  manifestHashMismatch: 'export_manifest_hash_mismatch',
  manifestSizeMismatch: 'export_manifest_size_mismatch',
  invalidRenderDependency: 'export_depends_on_invalid_render_receipt'
})

export async function evaluateLocalOutputIntegrity({
  projectDir,
  records = []
} = {}) {
  const root = path.resolve(projectDir)
  const renderRows = []
  for (const entry of records.filter((candidate) => candidate.record.schema === artifactKinds.mediaRenderReceiptLocal)) {
    renderRows.push(await evaluateRenderReceiptIntegrity({ root, entry }))
  }

  const renderRowsById = new Map(renderRows.map((row) => [row.renderReceiptId, row]))
  const exportRows = []
  for (const entry of records.filter((candidate) => candidate.record.schema === artifactKinds.mediaExportReceiptLocal)) {
    exportRows.push(await evaluateExportReceiptIntegrity({
      root,
      entry,
      renderRowsById
    }))
  }
  const exportReceiptSummary = summarizeExportReceipts(records)
  const exportVisibilityByReceiptId = new Map(
    exportReceiptSummary.rows.map((row) => [row.exportReceiptId, {
      activeLocalDelivery: row.activeLocalDelivery,
      historicalAuditOnly: row.historicalAuditOnly,
      visibilityPosture: row.visibilityPosture
    }])
  )
  const activeDeliveryReceiptIds = new Set(exportReceiptSummary.activeDeliveryRows.map((row) => row.exportReceiptId))
  const visibleExportRows = exportRows.map((row) => ({
    ...row,
    ...(exportVisibilityByReceiptId.get(row.exportReceiptId) ?? {
      activeLocalDelivery: false,
      historicalAuditOnly: false,
      visibilityPosture: 'review-only-export-receipt'
    })
  }))

  const blockingIssueRows = visibleExportRows
    .filter((row) => !row.historicalAuditOnly)
    .filter((row) => row.blockingIssueCodes.length > 0)
  const attentionRows = renderRows.filter((row) => row.attentionIssueCodes.length > 0)
  const activeDeliveryEvidenceIntact = visibleExportRows
    .filter((row) => activeDeliveryReceiptIds.has(row.exportReceiptId))
    .filter((row) => row.exportPerformed && row.deliveryCreated)
    .filter((row) => row.blockingIssueCodes.length === 0).length

  return {
    schema: 'media.output_integrity.summary.local.v1',
    renderReceipts: renderRows.length,
    exportReceipts: visibleExportRows.length,
    localDeliveryEvidenceIntact: activeDeliveryEvidenceIntact,
    activeDeliveryEvidenceIntact,
    historicalExportReceipts: exportReceiptSummary.historicalExportReceipts,
    outputIntegrityBlockingIssues: blockingIssueRows.reduce((sum, row) => sum + row.blockingIssueCodes.length, 0),
    outputIntegrityAttentionIssues: attentionRows.reduce((sum, row) => sum + row.attentionIssueCodes.length, 0),
    renderRows,
    exportRows: visibleExportRows,
    blockingRows: blockingIssueRows,
    attentionRows,
    localOnly: true,
    operatorGuidanceOnly: true,
    productionReady: false,
    publicationAuthorization: false,
    meshTruth: false,
    approvalAuthority: false
  }
}

async function evaluateRenderReceiptIntegrity({ root, entry }) {
  const receipt = entry.record
  const outputCheck = await checkLocalRef({
    root,
    localRef: receipt.outputLocalRef,
    missingIssueCode: renderIssueCodes.missing,
    hashMismatchIssueCode: renderIssueCodes.hashMismatch,
    sizeMismatchIssueCode: renderIssueCodes.sizeMismatch,
    required: receipt.renderPerformed === true
  })

  return {
    receiptRef: {
      kind: 'media-render-receipt',
      id: receipt.renderReceiptId,
      schema: receipt.schema,
      path: entry.path ?? entry.relativePath,
      localOnly: true
    },
    renderReceiptId: receipt.renderReceiptId,
    renderKind: receipt.renderKind,
    sourceRoughCutRef: receipt.sourceRoughCutRef ?? null,
    outputLocalRef: receipt.outputLocalRef ?? null,
    renderPerformed: receipt.renderPerformed === true,
    exportPerformed: receipt.exportPerformed === true,
    productionReady: false,
    attentionIssueCodes: outputCheck.issueCodes,
    blockingIssueCodes: [],
    checkedRefs: outputCheck.checkedRefs,
    localOnly: true,
    operatorGuidanceOnly: true,
    meshTruth: false
  }
}

async function evaluateExportReceiptIntegrity({ root, entry, renderRowsById }) {
  const receipt = entry.record
  const deliveryCheck = await checkLocalRef({
    root,
    localRef: receipt.deliveryLocalRef,
    missingIssueCode: exportIssueCodes.missingDelivery,
    hashMismatchIssueCode: exportIssueCodes.deliveryHashMismatch,
    sizeMismatchIssueCode: exportIssueCodes.deliverySizeMismatch,
    required: receipt.exportPerformed === true || receipt.deliveryCreated === true
  })
  const manifestCheck = await checkLocalRef({
    root,
    localRef: receipt.deliveryManifestRef,
    missingIssueCode: exportIssueCodes.missingManifest,
    hashMismatchIssueCode: exportIssueCodes.manifestHashMismatch,
    sizeMismatchIssueCode: exportIssueCodes.manifestSizeMismatch,
    required: Boolean(receipt.deliveryManifestRef?.path)
  })
  const renderDependency = receipt.sourceRenderReceiptRef?.id
    ? renderRowsById.get(receipt.sourceRenderReceiptRef.id)
    : null
  const dependencyIssues = []
  if (receipt.sourceRenderReceiptRef?.id && (!renderDependency || renderDependency.attentionIssueCodes.length > 0)) {
    dependencyIssues.push(exportIssueCodes.invalidRenderDependency)
  }
  const blockingIssueCodes = [
    ...deliveryCheck.issueCodes,
    ...manifestCheck.issueCodes,
    ...dependencyIssues
  ]

  return {
    receiptRef: {
      kind: 'media-export-receipt',
      id: receipt.exportReceiptId,
      schema: receipt.schema,
      path: entry.path ?? entry.relativePath,
      localOnly: true
    },
    exportReceiptId: receipt.exportReceiptId,
    exportKind: receipt.exportKind,
    sourceRoughCutRef: receipt.sourceRoughCutRef ?? null,
    sourceRenderReceiptRef: receipt.sourceRenderReceiptRef ?? null,
    deliveryLocalRef: receipt.deliveryLocalRef ?? null,
    deliveryManifestRef: receipt.deliveryManifestRef ?? null,
    exportPerformed: receipt.exportPerformed === true,
    deliveryCreated: receipt.deliveryCreated === true,
    productionReady: false,
    publicationAuthorization: false,
    localDeliveryEvidenceIntact: receipt.exportPerformed === true &&
      receipt.deliveryCreated === true &&
      blockingIssueCodes.length === 0,
    blockingIssueCodes,
    attentionIssueCodes: [],
    checkedRefs: [
      ...deliveryCheck.checkedRefs,
      ...manifestCheck.checkedRefs,
      ...(renderDependency?.receiptRef ? [renderDependency.receiptRef] : [])
    ],
    localOnly: true,
    operatorGuidanceOnly: true,
    meshTruth: false
  }
}

async function checkLocalRef({
  root,
  localRef,
  missingIssueCode,
  hashMismatchIssueCode,
  sizeMismatchIssueCode,
  required
}) {
  if (!required) {
    return {
      issueCodes: [],
      checkedRefs: []
    }
  }

  if (!localRef?.path) {
    return {
      issueCodes: [missingIssueCode],
      checkedRefs: []
    }
  }

  assertSafeLocalPath(localRef.path)
  const absolutePath = path.join(root, localRef.path)
  const issueCodes = []
  let fileStat
  try {
    fileStat = await stat(absolutePath)
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return {
        issueCodes: [missingIssueCode],
        checkedRefs: [localRef]
      }
    }
    throw error
  }

  if (typeof localRef.size === 'number' && fileStat.size !== localRef.size) {
    issueCodes.push(sizeMismatchIssueCode)
  }

  const expectedHash = normalizeHash(localRef.hash)
  if (expectedHash) {
    const actualHash = await sha256File(absolutePath)
    if (actualHash.value !== expectedHash.value || actualHash.algorithm !== expectedHash.algorithm) {
      issueCodes.push(hashMismatchIssueCode)
    }
  }

  return {
    issueCodes,
    checkedRefs: [localRef]
  }
}

function normalizeHash(hash) {
  if (!hash) return null
  if (typeof hash === 'string') {
    if (hash.startsWith('sha256:')) {
      return {
        algorithm: 'sha256',
        value: hash.slice('sha256:'.length)
      }
    }
    return {
      algorithm: 'sha256',
      value: hash
    }
  }
  if (hash.algorithm && hash.value) {
    return {
      algorithm: hash.algorithm,
      value: hash.value
    }
  }
  return null
}
