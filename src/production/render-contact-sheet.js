import { createHash } from 'node:crypto'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

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
const defaultPlan = 'records/production/media-render-plan-candidate.local.json'
const defaultOutput = 'records/production/media-render-receipt.local.json'
const truthStatus = 'not mesh truth; not distributed proof; not ratified shared state'

function parseArgs(argv) {
  const args = {
    projectDir: defaultProjectDir,
    plan: defaultPlan,
    output: defaultOutput,
    tileSize: 320,
    columns: 3,
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
    } else if (arg === '--tile-size') {
      args.tileSize = Number(next)
      i += 1
    } else if (arg === '--columns') {
      args.columns = Number(next)
      i += 1
    } else if (arg === '--print') {
      args.print = true
    } else if (arg === '--quiet') {
      args.quiet = true
    }
  }

  return args
}

export async function writeContactSheetRender({
  projectDir = defaultProjectDir,
  plan = defaultPlan,
  output = defaultOutput,
  tileSize = 320,
  columns = 3,
  print = false,
  quiet = false,
  createdAt = nowIso()
} = {}) {
  assertSafeLocalPath(plan)
  assertSafeLocalPath(output)
  assertRenderOptions({ tileSize, columns })

  const root = path.resolve(projectDir)
  const renderPlan = JSON.parse(await readFile(path.join(root, plan), 'utf8'))
  validateRequiredRecord(renderPlan, artifactKinds.mediaRenderPlanCandidateLocal)
  const receipt = await createContactSheetRenderReceipt({
    root,
    renderPlan,
    planPath: plan,
    tileSize,
    columns,
    createdAt
  })

  const outputPath = path.join(root, output)
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(receipt, null, 2)}\n`)

  if (print) {
    console.log(JSON.stringify(receipt, null, 2))
  } else if (!quiet) {
    console.log(formatContactSheetRenderSummary(receipt, output))
    console.log('nonClaims: local-only render receipt; no export performed; no production authority; no publication authorization; productionReady=false')
  }

  return {
    receipt,
    output
  }
}

export async function createContactSheetRenderReceipt({
  root,
  renderPlan,
  planPath = defaultPlan,
  tileSize = 320,
  columns = 3,
  createdAt = nowIso()
}) {
  if (renderPlan.renderPerformed || renderPlan.exportPerformed || renderPlan.productionReady) {
    throw new Error('Contact sheet render expects a dry-run render plan candidate without prior render/export completion')
  }
  if (!renderPlan.planPosture?.refsResolved || !renderPlan.planPosture?.targetOutputPathResolved) {
    throw new Error('Contact sheet render requires a render plan with resolved refs and target output path')
  }
  if (!Array.isArray(renderPlan.orderedItems) || renderPlan.orderedItems.length === 0) {
    throw new Error('Contact sheet render requires at least one ordered item')
  }

  const renderReceiptId = `render-receipt-${stableId([
    renderPlan.projectId,
    renderPlan.planId,
    tileSize,
    columns,
    ...renderPlan.orderedItems.map((item) => `${item.itemRef?.order}:${item.itemRef?.id}:${item.localRef?.path}`)
  ].join('|'))}`
  const outputRelativePath = `${renderPlan.targetOutputRef.path}/contact-sheet-${renderReceiptId.slice('render-receipt-'.length)}.png`
  assertSafeLocalPath(outputRelativePath)
  const outputPath = path.join(root, outputRelativePath)
  await mkdir(path.dirname(outputPath), { recursive: true })

  const renderedItems = await renderContactSheet({
    root,
    outputPath,
    orderedItems: renderPlan.orderedItems,
    tileSize,
    columns
  })
  const fileStat = await stat(outputPath)
  const hash = await sha256File(outputPath)
  const outputLocalRef = createLocalRef({
    placementClass: placementClasses.mediaExport,
    relativePath: outputRelativePath,
    contentType: 'image/png',
    hash,
    size: fileStat.size
  })

  const receipt = {
    schema: artifactKinds.mediaRenderReceiptLocal,
    renderReceiptId,
    projectId: renderPlan.projectId,
    mode: 'standalone-local',
    renderKind: 'local-contact-sheet',
    sourceRenderPlanRef: localRecordRef('media-render-plan-candidate', renderPlan.planId, renderPlan.schema, planPath),
    sourceRenderExportCandidateRef: renderPlan.sourceRenderExportCandidateRef,
    renderAdapterContractRef: renderPlan.renderAdapterContractRef,
    sourceRoughCutRef: renderPlan.sourceRoughCutRef,
    reviewDecisionRef: renderPlan.reviewDecisionRef,
    orderedItems: renderedItems,
    outputLocalRef,
    output: {
      contentType: 'image/png',
      width: renderedItems.canvas.width,
      height: renderedItems.canvas.height,
      bytes: fileStat.size,
      hash,
      localOnly: true,
      byteAvailabilityProof: false,
      materializationProof: false
    },
    executionPosture: {
      rendererSelected: true,
      rendererId: 'local-sharp-contact-sheet',
      rendererEngine: 'sharp',
      localCommandExecution: true,
      mediaBytesRead: true,
      outputBytesCreated: true,
      renderPerformed: true,
      exportPerformed: false,
      publicationAuthorization: false,
      productionReady: false,
      localOnly: true,
      operatorGuidanceOnly: true
    },
    sourceRefs: compactRefs([
      localRecordRef('media-render-plan-candidate', renderPlan.planId, renderPlan.schema, planPath),
      renderPlan.sourceRenderExportCandidateRef,
      renderPlan.renderAdapterContractRef,
      renderPlan.sourceRoughCutRef,
      renderPlan.reviewDecisionRef,
      ...(renderPlan.sourceRefs ?? [])
    ]),
    nextActions: [
      'Review the contact sheet locally as render evidence only.',
      'Keep export rendering, publication authorization, and production readiness separate.'
    ],
    createdAt,
    localOnly: true,
    renderPerformed: true,
    exportPerformed: false,
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
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    localTruthLabel: 'local contact sheet render receipt',
    truthStatus
  }

  validateRequiredRecord(receipt)
  return receipt
}

export function formatContactSheetRenderSummary(receipt, output = defaultOutput) {
  return [
    `contact sheet render: project=${receipt.projectId}`,
    `items=${receipt.orderedItems.length}`,
    `output=${receipt.outputLocalRef.path}`,
    `bytesRead=${receipt.executionPosture.mediaBytesRead}`,
    `renderPerformed=${receipt.renderPerformed}`,
    `exportPerformed=${receipt.exportPerformed}`,
    `productionReady=${receipt.productionReady}`,
    `receipt=${output}`
  ].join(' | ')
}

async function renderContactSheet({
  root,
  outputPath,
  orderedItems,
  tileSize,
  columns
}) {
  const renderedItems = []
  const composites = []
  const resolvedColumns = Math.min(columns, orderedItems.length)
  const rows = Math.ceil(orderedItems.length / resolvedColumns)
  const canvas = {
    width: resolvedColumns * tileSize,
    height: rows * tileSize
  }

  for (const [index, item] of orderedItems.entries()) {
    const localPath = item.localRef?.path
    if (!localPath) {
      throw new Error(`Contact sheet item ${item.itemRef?.id ?? index} is missing a localRef path`)
    }
    assertSafeLocalPath(localPath)
    const sourcePath = path.join(root, localPath)
    const { data, info } = await sharp(sourcePath)
      .resize({
        width: tileSize,
        height: tileSize,
        fit: 'inside',
        withoutEnlargement: false
      })
      .png()
      .toBuffer({ resolveWithObject: true })
    const column = index % resolvedColumns
    const row = Math.floor(index / resolvedColumns)
    const left = column * tileSize + Math.floor((tileSize - info.width) / 2)
    const top = row * tileSize + Math.floor((tileSize - info.height) / 2)
    composites.push({
      input: data,
      left,
      top
    })
    renderedItems.push({
      itemRef: item.itemRef,
      acceptedAssetRef: item.acceptedAssetRef,
      productionAssetCapsuleRef: item.productionAssetCapsuleRef,
      sourceLocalRef: item.localRef,
      order: item.itemRef?.order ?? index,
      tile: {
        row,
        column,
        width: info.width,
        height: info.height,
        localOnly: true
      },
      bytesRead: true,
      rendered: true,
      localOnly: true
    })
  }

  await sharp({
    create: {
      width: canvas.width,
      height: canvas.height,
      channels: 4,
      background: { r: 248, g: 248, b: 246, alpha: 1 }
    }
  })
    .composite(composites)
    .png()
    .toFile(outputPath)

  Object.defineProperty(renderedItems, 'canvas', {
    value: canvas,
    enumerable: false
  })
  return renderedItems
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

function assertRenderOptions({ tileSize, columns }) {
  if (!Number.isInteger(tileSize) || tileSize < 32 || tileSize > 2048) {
    throw new Error('Contact sheet tile size must be an integer from 32 through 2048')
  }
  if (!Number.isInteger(columns) || columns < 1 || columns > 12) {
    throw new Error('Contact sheet columns must be an integer from 1 through 12')
  }
}

function stableId(seed) {
  return createHash('sha256').update(seed).digest('hex').slice(0, 24)
}

if (process.argv[1] === modulePath) {
  await writeContactSheetRender(parseArgs(process.argv.slice(2)))
}
