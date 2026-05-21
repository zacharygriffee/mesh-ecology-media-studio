import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { artifactKinds } from '../contracts/artifact-kinds.js'
import { makeRef, nowIso } from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import {
  assertSafeLocalPath,
  createLocalRef,
  placementClasses
} from '../local/project-layout.js'
import { sha256File } from '../assets/media-metadata.js'

const modulePath = fileURLToPath(import.meta.url)
const defaultProjectDir = 'examples/venice-smoke'
const defaultPlan = 'records/production/media-export-plan-candidate.local.json'
const defaultOutput = 'records/production/media-export-receipt.local.json'
const truthStatus = 'not mesh truth; not distributed proof; not ratified shared state'

function parseArgs(argv) {
  const args = {
    projectDir: defaultProjectDir,
    plan: defaultPlan,
    output: defaultOutput,
    print: false,
    quiet: false
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]

    if (arg === '--project-dir') {
      args.projectDir = next
      i += 1
    } else if (arg === '--plan') {
      args.plan = next
      i += 1
    } else if (arg === '--output') {
      args.output = next
      i += 1
    } else if (arg === '--print') {
      args.print = true
    } else if (arg === '--quiet') {
      args.quiet = true
    }
  }

  return args
}

export async function writeLocalExportPackage({
  projectDir = defaultProjectDir,
  plan = defaultPlan,
  output = defaultOutput,
  print = false,
  quiet = false,
  createdAt = nowIso()
} = {}) {
  assertSafeLocalPath(plan)
  assertSafeLocalPath(output)

  const root = path.resolve(projectDir)
  const exportPlan = JSON.parse(await readFile(path.join(root, plan), 'utf8'))
  validateRequiredRecord(exportPlan, artifactKinds.mediaExportPlanCandidateLocal)

  const renderReceiptPath = exportPlan.sourceRenderReceiptRef?.path
  if (!renderReceiptPath) {
    throw new Error('Local export package requires a source render receipt path')
  }
  assertSafeLocalPath(renderReceiptPath)
  const renderReceipt = JSON.parse(await readFile(path.join(root, renderReceiptPath), 'utf8'))
  validateRequiredRecord(renderReceipt, artifactKinds.mediaRenderReceiptLocal)

  const receipt = await createLocalExportReceipt({
    root,
    exportPlan,
    planPath: plan,
    renderReceipt,
    renderReceiptPath,
    receiptPath: output,
    createdAt
  })

  const outputPath = path.join(root, output)
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(receipt, null, 2)}\n`)

  if (print) {
    console.log(JSON.stringify(receipt, null, 2))
  } else if (!quiet) {
    console.log(formatLocalExportPackageSummary(receipt, output))
    console.log('nonClaims: local-only export receipt; delivery copy only; no publication authorization; no production authority; productionReady=false')
  }

  return {
    receipt,
    output
  }
}

export async function createLocalExportReceipt({
  root,
  exportPlan,
  planPath = defaultPlan,
  renderReceipt,
  renderReceiptPath,
  receiptPath = defaultOutput,
  createdAt = nowIso()
}) {
  if (exportPlan.exportPerformed || exportPlan.productionReady) {
    throw new Error('Local export package expects a dry-run export plan candidate without prior export completion')
  }
  if (!exportPlan.planPosture?.refsResolved || !exportPlan.planPosture?.targetOutputPathResolved) {
    throw new Error('Local export package requires an export plan with resolved refs and target output path')
  }
  if (renderReceipt.renderPerformed !== true || renderReceipt.exportPerformed !== false) {
    throw new Error('Local export package requires a local render receipt that has rendered preview bytes but no export delivery')
  }

  const sourceOutputPath = renderReceipt.outputLocalRef?.path
  if (!sourceOutputPath) {
    throw new Error('Local export package requires render receipt outputLocalRef.path')
  }
  assertSafeLocalPath(sourceOutputPath)
  const sourceOutputAbsolutePath = path.join(root, sourceOutputPath)
  const sourceStat = await stat(sourceOutputAbsolutePath)
  const sourceHash = await sha256File(sourceOutputAbsolutePath)
  const sourceExt = path.extname(sourceOutputPath)
  const exportReceiptId = `export-receipt-${stableId([
    exportPlan.projectId,
    exportPlan.planId,
    renderReceipt.renderReceiptId,
    sourceHash
  ].join('|'))}`
  const packageRoot = exportPlan.targetOutputRef.path
  assertSafeLocalPath(packageRoot)
  const deliveryRelativePath = `${packageRoot}/delivery-${exportReceiptId.slice('export-receipt-'.length)}${sourceExt}`
  const manifestRelativePath = `${packageRoot}/export-manifest.local.json`
  assertSafeLocalPath(deliveryRelativePath)
  assertSafeLocalPath(manifestRelativePath)

  await mkdir(path.dirname(path.join(root, deliveryRelativePath)), { recursive: true })
  await copyFile(sourceOutputAbsolutePath, path.join(root, deliveryRelativePath))
  const deliveryStat = await stat(path.join(root, deliveryRelativePath))
  const deliveryHash = await sha256File(path.join(root, deliveryRelativePath))
  const deliveryLocalRef = createLocalRef({
    placementClass: placementClasses.mediaExport,
    relativePath: deliveryRelativePath,
    contentType: renderReceipt.outputLocalRef.contentType,
    hash: deliveryHash,
    size: deliveryStat.size
  })
  const deliveryManifestRef = createLocalRef({
    placementClass: placementClasses.mediaExport,
    relativePath: manifestRelativePath,
    contentType: 'application/json',
    hash: null,
    size: null
  })

  const sourceExportPlanRef = localRecordRef('media-export-plan-candidate', exportPlan.planId, exportPlan.schema, planPath)
  const sourceRenderReceiptRef = localRecordRef('media-render-receipt', renderReceipt.renderReceiptId, renderReceipt.schema, renderReceiptPath)
  const sourceRefs = compactRefs([
    sourceExportPlanRef,
    exportPlan.sourceExportCandidateRef,
    exportPlan.sourceRoughCutRef,
    exportPlan.reviewDecisionRef,
    sourceRenderReceiptRef,
    ...(exportPlan.sourceRefs ?? [])
  ])
  const receipt = {
    schema: artifactKinds.mediaExportReceiptLocal,
    exportReceiptId,
    projectId: exportPlan.projectId,
    mode: 'standalone-local',
    exportKind: 'local-review-package-copy',
    sourceExportPlanRef,
    sourceExportCandidateRef: exportPlan.sourceExportCandidateRef,
    sourceRoughCutRef: exportPlan.sourceRoughCutRef,
    sourceRenderReceiptRef,
    sourceOutputLocalRef: {
      ...renderReceipt.outputLocalRef,
      hash: sourceHash,
      size: sourceStat.size,
      localOnly: true
    },
    deliveryLocalRef,
    deliveryManifestRef,
    packageRootRef: {
      ...makeRef('local-export-package-root', exportReceiptId, 'media.local_ref.v1'),
      path: packageRoot,
      localOnly: true
    },
    executionPosture: {
      exportEngine: 'local-copy',
      sourceBytesRead: true,
      deliveryBytesCreated: true,
      manifestCreated: true,
      exportPerformed: true,
      deliveryCreated: true,
      publicationAuthorization: false,
      productionReady: false,
      localOnly: true,
      operatorGuidanceOnly: true
    },
    output: {
      contentType: deliveryLocalRef.contentType,
      bytes: deliveryStat.size,
      hash: deliveryHash,
      copiedFromHash: sourceHash,
      localOnly: true,
      byteAvailabilityProof: false,
      materializationProof: false
    },
    sourceRefs,
    nextActions: [
      'Review the local delivery package before any publication or authority lane.',
      'Do not treat local export delivery as publication authorization or production readiness.'
    ],
    createdAt,
    operatorGuidanceOnly: true,
    exportPerformed: true,
    deliveryCreated: true,
    productionReady: false,
    approvalAuthority: false,
    ratifierAuthority: false,
    publicationAuthorization: false,
    providerTruth: false,
    byteAvailabilityProof: false,
    materializationProof: false,
    resourceAdmission: false,
    causalTruth: false,
    edgeCalled: false,
    meshPublished: false,
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    localTruthLabel: 'local export receipt',
    truthStatus
  }

  await writeExportManifest({
    root,
    manifestRelativePath,
    receipt,
    receiptPath,
    sourceRenderReceipt: renderReceipt,
    deliveryHash
  })

  const manifestStat = await stat(path.join(root, manifestRelativePath))
  const manifestHash = await sha256File(path.join(root, manifestRelativePath))
  receipt.deliveryManifestRef.hash = manifestHash
  receipt.deliveryManifestRef.size = manifestStat.size
  validateRequiredRecord(receipt)
  return receipt
}

export function formatLocalExportPackageSummary(receipt, output = defaultOutput) {
  return [
    `local export package: project=${receipt.projectId}`,
    `delivery=${receipt.deliveryLocalRef.path}`,
    `sourceRenderReceipt=${receipt.sourceRenderReceiptRef.id}`,
    `bytesRead=${receipt.executionPosture.sourceBytesRead}`,
    `deliveryCreated=${receipt.deliveryCreated}`,
    `exportPerformed=${receipt.exportPerformed}`,
    `publicationAuthorization=${receipt.publicationAuthorization}`,
    `productionReady=${receipt.productionReady}`,
    `receipt=${output}`
  ].join(' | ')
}

async function writeExportManifest({
  root,
  manifestRelativePath,
  receipt,
  receiptPath,
  sourceRenderReceipt,
  deliveryHash
}) {
  const manifest = {
    schema: 'media.local_export_manifest.local.v1',
    exportReceiptRef: localRecordRef('media-export-receipt', receipt.exportReceiptId, receipt.schema, receiptPath),
    sourceRenderReceiptRef: receipt.sourceRenderReceiptRef,
    sourceOutputLocalRef: receipt.sourceOutputLocalRef,
    deliveryLocalRef: receipt.deliveryLocalRef,
    renderKind: sourceRenderReceipt.renderKind,
    deliveryHash,
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    publicationAuthorization: false,
    productionReady: false
  }

  await writeFile(path.join(root, manifestRelativePath), `${JSON.stringify(manifest, null, 2)}\n`)
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

function stableId(seed) {
  return createHash('sha256').update(seed).digest('hex').slice(0, 24)
}

if (process.argv[1] === modulePath) {
  await writeLocalExportPackage(parseArgs(process.argv.slice(2)))
}
