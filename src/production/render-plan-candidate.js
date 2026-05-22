import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { artifactKinds } from '../contracts/artifact-kinds.js'
import { makeRef, nowIso } from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import { assertSafeLocalPath } from '../local/project-layout.js'
import { writeJsonAtomic } from '../local/atomic-json.js'

const modulePath = fileURLToPath(import.meta.url)
const defaultProjectDir = 'examples/venice-smoke'
const defaultCandidate = 'records/production/media-render-export-candidate.local.json'
const defaultContract = 'records/production/media-render-adapter-contract.local.json'
const defaultOutput = 'records/production/media-render-plan-candidate.local.json'

function parseArgs(argv) {
  const args = {
    projectDir: defaultProjectDir,
    candidate: defaultCandidate,
    contract: defaultContract,
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
    } else if (arg === '--candidate') {
      args.candidate = next
      i += 1
    } else if (arg === '--contract') {
      args.contract = next
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

export async function writeRenderPlanCandidate({
  projectDir = defaultProjectDir,
  candidate = defaultCandidate,
  contract = defaultContract,
  output = defaultOutput,
  print = false,
  quiet = false,
  createdAt = nowIso()
} = {}) {
  assertSafeLocalPath(candidate)
  assertSafeLocalPath(contract)
  assertSafeLocalPath(output)

  const root = path.resolve(projectDir)
  const renderExportCandidate = JSON.parse(await readFile(path.join(root, candidate), 'utf8'))
  const adapterContract = JSON.parse(await readFile(path.join(root, contract), 'utf8'))
  validateRequiredRecord(renderExportCandidate, artifactKinds.mediaRenderExportCandidateLocal)
  validateRequiredRecord(adapterContract, artifactKinds.mediaRenderAdapterContractLocal)
  const plan = createRenderPlanCandidate({
    renderExportCandidate,
    candidatePath: candidate,
    adapterContract,
    contractPath: contract,
    createdAt
  })

  await writeJsonAtomic(root, output, plan)

  if (print) {
    console.log(JSON.stringify(plan, null, 2))
  } else if (!quiet) {
    console.log(formatRenderPlanCandidateSummary(plan, output))
    console.log('nonClaims: local-only; dry-run plan only; no media bytes read; no render execution; no export output; productionReady=false')
  }

  return {
    plan,
    output
  }
}

export function createRenderPlanCandidate({
  renderExportCandidate,
  candidatePath = defaultCandidate,
  adapterContract,
  contractPath = defaultContract,
  createdAt = nowIso()
}) {
  if (adapterContract.sourceRenderExportCandidateRef?.id !== renderExportCandidate.candidateId) {
    throw new Error('Render adapter contract does not reference the provided render/export candidate')
  }

  const sourceRenderExportCandidateRef = localRecordRef(
    'media-render-export-candidate',
    renderExportCandidate.candidateId,
    renderExportCandidate.schema,
    candidatePath
  )
  const renderAdapterContractRef = localRecordRef(
    'media-render-adapter-contract',
    adapterContract.contractId,
    adapterContract.schema,
    contractPath
  )
  const targetOutputRef = {
    ...makeRef('planned-render-output', `${adapterContract.outputPlacement.relativePath}/${adapterContract.targetFormat.formatId}`, 'media.local_ref.v1'),
    path: adapterContract.outputPlacement.relativePath,
    targetFormat: adapterContract.targetFormat.formatId,
    materialized: false,
    localOnly: true
  }

  const plan = {
    schema: artifactKinds.mediaRenderPlanCandidateLocal,
    planId: `render-plan-candidate-${stableId([
      renderExportCandidate.projectId,
      renderExportCandidate.candidateId,
      adapterContract.contractId,
      targetOutputRef.path
    ].join('|'))}`,
    projectId: renderExportCandidate.projectId,
    mode: 'standalone-local',
    planKind: 'dry-run-render-plan-candidate',
    sourceRenderExportCandidateRef,
    renderAdapterContractRef,
    sourceRoughCutRef: renderExportCandidate.sourceRoughCutRef,
    reviewDecisionRef: renderExportCandidate.reviewDecisionRef,
    orderedItems: adapterContract.orderedItems.map((item) => ({
      itemRef: item.itemRef,
      acceptedAssetRef: item.acceptedAssetRef,
      productionAssetCapsuleRef: item.productionAssetCapsuleRef,
      localRef: item.localRef,
      resolvedForPlanning: true,
      bytesRead: false,
      localOnly: true
    })),
    targetOutputRef,
    planPosture: {
      state: 'dry-run-plan-only',
      refsResolved: true,
      targetOutputPathResolved: true,
      mediaBytesRead: false,
      rendererSelected: false,
      renderPerformed: false,
      exportPerformed: false,
      outputCreated: false,
      localOnly: true,
      operatorGuidanceOnly: true
    },
    sourceRefs: compactRefs([
      sourceRenderExportCandidateRef,
      renderAdapterContractRef,
      renderExportCandidate.sourceRoughCutRef,
      renderExportCandidate.reviewDecisionRef,
      ...(adapterContract.sourceRefs ?? [])
    ]),
    nextActions: [
      'Review this dry-run plan before deciding whether a real renderer should execute.',
      'Do not treat planned output paths as materialized media or export artifacts.'
    ],
    createdAt,
    operatorGuidanceOnly: true,
    candidateOnly: true,
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
    localTruthLabel: 'local dry-run render plan candidate',
    truthStatus: 'not mesh truth; not distributed proof; not ratified shared state'
  }

  validateRequiredRecord(plan)
  return plan
}

export function formatRenderPlanCandidateSummary(plan, output = defaultOutput) {
  return [
    `render plan candidate: project=${plan.projectId}`,
    `items=${plan.orderedItems.length}`,
    `refsResolved=${plan.planPosture.refsResolved}`,
    `target=${plan.targetOutputRef.path}`,
    `bytesRead=${plan.planPosture.mediaBytesRead}`,
    `renderPerformed=${plan.renderPerformed}`,
    `exportPerformed=${plan.exportPerformed}`,
    `productionReady=${plan.productionReady}`,
    `output=${output}`
  ].join(' | ')
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
  await writeRenderPlanCandidate(parseArgs(process.argv.slice(2)))
}
