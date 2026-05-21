import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { validateRequiredRecord } from '../contracts/schemas.js'
import { assertSafeLocalPath } from '../local/project-layout.js'

const modulePath = fileURLToPath(import.meta.url)
const defaultProjectDir = 'examples/venice-smoke'
const defaultStatusRef = 'records/provider-results/media-provider-loop-status.local.json'

function parseArgs(argv) {
  const args = {
    projectDir: defaultProjectDir,
    status: defaultStatusRef,
    print: false
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]

    if (arg === '--project-dir') {
      args.projectDir = next
      i += 1
    } else if (arg === '--status') {
      args.status = next
      i += 1
    } else if (arg === '--print') {
      args.print = true
    }
  }

  return args
}

export async function inspectVeniceLoop({
  projectDir = defaultProjectDir,
  status = defaultStatusRef,
  print = false
} = {}) {
  assertSafeLocalPath(status)

  const root = path.resolve(projectDir)
  const record = JSON.parse(await readFile(path.join(root, status), 'utf8'))
  validateRequiredRecord(record)
  const summary = createVeniceLoopInspectionSummary(record, status)

  if (print) {
    console.log(JSON.stringify(summary, null, 2))
  } else {
    printVeniceLoopInspectionSummary(summary)
  }

  return {
    summary,
    record,
    status
  }
}

export function createVeniceLoopInspectionSummary(record, statusRef = defaultStatusRef) {
  const media = record.mediaSummary
  const candidate = record.selectedCandidate

  return {
    summaryKind: 'venice-loop-inspection-summary',
    statusRef,
    projectId: record.projectId,
    providerId: record.providerId,
    adapterFixture: record.adapterFixture,
    loopKind: record.loopKind,
    state: record.state,
    failedStep: record.failedStep,
    completedSteps: record.completedSteps,
    selectedCandidate: candidate
      ? {
          selectionMode: candidate.selectionMode,
          assetRecord: candidate.assetRecord,
          path: candidate.path,
          localOnly: true
        }
      : undefined,
    providerRuns: record.providerLedger
      ? {
          total: record.providerLedger.total,
          succeeded: record.providerLedger.succeeded,
          failed: record.providerLedger.failed,
          localOnly: true,
          providerTruth: false
        }
      : undefined,
    generatedCandidates: media?.generatedCandidates,
    derivatives: media?.derivatives,
    identity: media?.identity,
    remainingAttention: media?.remainingAttention,
    nextAction: record.nextAction,
    localOnly: true,
    operatorGuidanceOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    providerTruth: false,
    byteAvailabilityProof: false,
    materializationProof: false,
    resourceAdmission: false,
    edgeCalled: false,
    meshPublished: false
  }
}

function printVeniceLoopInspectionSummary(summary) {
  console.log([
    `venice loop inspection: state=${summary.state}`,
    `project=${summary.projectId}`,
    `candidate=${summary.selectedCandidate?.path ?? 'none'}`,
    `generated=${summary.generatedCandidates?.total ?? 0}`,
    `reviewed=${summary.generatedCandidates?.reviewed ?? 0}`,
    `promotedAccepted=${summary.generatedCandidates?.promotedAccepted ?? 0}`,
    `promotedRejected=${summary.generatedCandidates?.promotedRejected ?? 0}`,
    `derivatives=${summary.derivatives ? `${summary.derivatives.readyAssets}/${summary.derivatives.evaluatedAssets}` : '0/0'}`,
    `providerRuns=${summary.providerRuns?.total ?? 0}`,
    `remainingAttention=${summary.remainingAttention ?? 'unknown'}`
  ].join(' | '))

  if (summary.failedStep) {
    console.log(`failedStep: ${summary.failedStep}`)
  }
  console.log(`nextAction: ${summary.nextAction}`)
  console.log('nonClaims: local-only; no Edge call; no mesh truth; no provider truth; no byte/materialization proof; no resource admission')
}

if (process.argv[1] === modulePath) {
  await inspectVeniceLoop(parseArgs(process.argv.slice(2)))
}
