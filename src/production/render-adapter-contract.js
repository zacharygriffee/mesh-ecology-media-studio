import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { artifactKinds } from '../contracts/artifact-kinds.js'
import { makeRef, nowIso } from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import { assertSafeLocalPath } from '../local/project-layout.js'
import { readProjectRecords } from '../seams/project-status.js'
import { evaluateRenderExportCandidateFreshness } from './render-export-candidate.js'

const modulePath = fileURLToPath(import.meta.url)
const defaultProjectDir = 'examples/venice-smoke'
const defaultCandidate = 'records/production/media-render-export-candidate.local.json'
const defaultOutput = 'records/production/media-render-adapter-contract.local.json'

function parseArgs(argv) {
  const args = {
    projectDir: defaultProjectDir,
    candidate: defaultCandidate,
    output: defaultOutput,
    targetFormat: 'local-review-preview',
    outputPlacement: 'media/exports/render-preview',
    print: false,
    quiet: false
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]

    if (arg === '--project-dir') {
      args.projectDir = next
      i += 1
    } else if (arg === '--candidate') {
      args.candidate = next
      i += 1
    } else if (arg === '--output') {
      args.output = next
      i += 1
    } else if (arg === '--target-format') {
      args.targetFormat = next
      i += 1
    } else if (arg === '--output-placement') {
      args.outputPlacement = next
      i += 1
    } else if (arg === '--print') {
      args.print = true
    } else if (arg === '--quiet') {
      args.quiet = true
    }
  }

  return args
}

export async function writeRenderAdapterContract({
  projectDir = defaultProjectDir,
  candidate = defaultCandidate,
  output = defaultOutput,
  targetFormat = 'local-review-preview',
  outputPlacement = 'media/exports/render-preview',
  print = false,
  quiet = false,
  createdAt = nowIso()
} = {}) {
  assertSafeLocalPath(candidate)
  assertSafeLocalPath(output)
  assertSafeLocalPath(outputPlacement)

  const root = path.resolve(projectDir)
  const renderExportCandidate = JSON.parse(await readFile(path.join(root, candidate), 'utf8'))
  validateRequiredRecord(renderExportCandidate, artifactKinds.mediaRenderExportCandidateLocal)
  const records = await readProjectRecords(root)
  const contract = createRenderAdapterContract({
    renderExportCandidate,
    candidatePath: candidate,
    records,
    targetFormat,
    outputPlacement,
    createdAt
  })

  await mkdir(path.dirname(path.join(root, output)), { recursive: true })
  await writeFile(path.join(root, output), `${JSON.stringify(contract, null, 2)}\n`)

  if (print) {
    console.log(JSON.stringify(contract, null, 2))
  } else if (!quiet) {
    console.log(formatRenderAdapterContractSummary(contract, output))
    console.log('nonClaims: local-only; adapter contract only; no renderer selected; no render execution; no export output; productionReady=false')
  }

  return {
    contract,
    output
  }
}

export function createRenderAdapterContract({
  renderExportCandidate,
  candidatePath = defaultCandidate,
  records = [],
  targetFormat = 'local-review-preview',
  outputPlacement = 'media/exports/render-preview',
  createdAt = nowIso()
}) {
  const freshness = evaluateRenderExportCandidateFreshness({ candidate: renderExportCandidate, records })
  const sourceRenderExportCandidateRef = {
    ...makeRef('media-render-export-candidate', renderExportCandidate.candidateId, renderExportCandidate.schema),
    path: candidatePath,
    localOnly: true
  }
  const contract = {
    schema: artifactKinds.mediaRenderAdapterContractLocal,
    contractId: `render-adapter-contract-${stableId([
      renderExportCandidate.projectId,
      renderExportCandidate.candidateId,
      targetFormat,
      outputPlacement
    ].join('|'))}`,
    projectId: renderExportCandidate.projectId,
    mode: 'standalone-local',
    contractKind: 'local-renderer-adapter-contract',
    sourceRenderExportCandidateRef,
    sourceRoughCutRef: renderExportCandidate.sourceRoughCutRef,
    reviewDecisionRef: renderExportCandidate.reviewDecisionRef,
    candidateFreshness: {
      state: freshness.state,
      issueCodes: freshness.issueCodes,
      localOnly: true,
      operatorGuidanceOnly: true
    },
    orderedItems: (renderExportCandidate.orderedItemRefs ?? []).map((item) => ({
      itemRef: {
        kind: item.kind,
        id: item.id,
        schema: item.schema,
        order: item.order,
        localOnly: true
      },
      acceptedAssetRef: item.acceptedAssetRef ?? null,
      productionAssetCapsuleRef: item.productionAssetCapsuleRef ?? null,
      localRef: item.localRef ?? null,
      localOnly: true
    })),
    targetFormat: {
      formatId: targetFormat,
      formatSelected: false,
      rendererNeutral: true,
      deliveryIntent: 'local-review-render',
      localOnly: true
    },
    outputPlacement: {
      placementClass: 'media-exports',
      relativePath: outputPlacement,
      materializationPlanned: false,
      localOnly: true
    },
    capabilityRequirements: [
      'resolve ordered rough-cut item refs',
      'read accepted asset or derivative refs from local materialization',
      'write planned output placement only after operator-mediated render authorization',
      'preserve local-only non-claims and productionReady=false until authority changes'
    ],
    adapterSelection: {
      adapterSelected: false,
      adapterId: null,
      rendererEngine: null,
      localOnly: true
    },
    sourceRefs: compactRefs([
      sourceRenderExportCandidateRef,
      renderExportCandidate.sourceRoughCutRef,
      renderExportCandidate.reviewDecisionRef,
      ...(renderExportCandidate.sourceRefs ?? [])
    ]),
    nextActions: [
      'Use this contract to build a dry-run render plan candidate before selecting or running a renderer.',
      'Keep render authorization, export authorization, publication authorization, and production readiness separate.'
    ],
    nonClaims: {
      rendererSelected: false,
      renderPerformed: false,
      exportPerformed: false,
      outputBytesCreated: false,
      approvalAuthority: false,
      publicationAuthorization: false,
      productionReady: false,
      meshTruth: false
    },
    createdAt,
    operatorGuidanceOnly: true,
    productionReady: false,
    renderPerformed: false,
    exportPerformed: false,
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
    localTruthLabel: 'local render adapter contract',
    truthStatus: 'not mesh truth; not distributed proof; not ratified shared state'
  }

  validateRequiredRecord(contract)
  return contract
}

export function formatRenderAdapterContractSummary(contract, output = defaultOutput) {
  return [
    `render adapter contract: project=${contract.projectId}`,
    `items=${contract.orderedItems.length}`,
    `targetFormat=${contract.targetFormat.formatId}`,
    `adapterSelected=${contract.adapterSelection.adapterSelected}`,
    `renderPerformed=${contract.renderPerformed}`,
    `exportPerformed=${contract.exportPerformed}`,
    `productionReady=${contract.productionReady}`,
    `output=${output}`
  ].join(' | ')
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
  await writeRenderAdapterContract(parseArgs(process.argv.slice(2)))
}
