import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { artifactKinds } from '../contracts/artifact-kinds.js'
import { makeRef, nowIso } from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import { assertSafeLocalPath } from '../local/project-layout.js'

const modulePath = fileURLToPath(import.meta.url)
const defaultProjectDir = 'examples/card-to-candidate'
const defaultOutput = 'records/provider-results/media-provider-run-ledger.local.json'
const truthStatus = 'not mesh truth; not distributed proof; not ratified shared state'

function parseArgs(argv) {
  const args = {
    projectDir: defaultProjectDir,
    output: defaultOutput,
    print: false
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]

    if (arg === '--project-dir') {
      args.projectDir = next
      i += 1
    } else if (arg === '--output') {
      args.output = next
      i += 1
    } else if (arg === '--print') {
      args.print = true
    }
  }

  return args
}

export async function indexProviderRuns({
  projectDir = defaultProjectDir,
  output = defaultOutput,
  print = false
} = {}) {
  assertSafeLocalPath(output)

  const root = path.resolve(projectDir)
  const records = await readProjectJsonRecords(root)
  const generationRequests = new Map()
  const adapterRuns = new Map()
  const failureEvidence = new Map()
  const providerResults = []

  for (const record of records) {
    if (record.record.schema === artifactKinds.mediaGenerationRequest) {
      generationRequests.set(record.record.requestId, record)
    } else if (record.record.schema === artifactKinds.mediaProviderAdapterRunLocal) {
      adapterRuns.set(record.record.providerResultRef.id, record)
    } else if (record.record.schema === artifactKinds.mediaEvidence && record.record.evidenceKind === 'provider-failure-classification') {
      failureEvidence.set(record.record.subjectRef.id, record)
    } else if (record.record.schema === artifactKinds.mediaProviderResult) {
      providerResults.push(record)
    }
  }

  const runs = providerResults
    .map((entry) => runEntry({
      providerResultEntry: entry,
      generationRequestEntry: generationRequests.get(entry.record.requestRef.id),
      adapterRunEntry: adapterRuns.get(entry.record.resultId),
      failureEvidenceEntry: failureEvidence.get(entry.record.resultId)
    }))
    .sort((left, right) => left.providerResultRef.path.localeCompare(right.providerResultRef.path))

  const projectId = firstProjectId(runs, generationRequests) ?? path.basename(root)
  const summary = summarizeRuns(runs)
  const ledger = {
    schema: artifactKinds.mediaProviderRunLedgerLocal,
    ledgerId: `provider-run-ledger-${projectId}`,
    projectId,
    createdAt: nowIso(),
    mode: 'standalone-local',
    runs,
    summary,
    warnings: [
      'Provider run ledger is local inspection only.',
      'Provider IDs and job refs are provenance, not authority.',
      'Failed and successful provider results are not provider truth or mesh truth.'
    ],
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    providerTruth: false,
    localTruthLabel: 'local cache',
    truthStatus
  }

  validateRequiredRecord(ledger)

  const outputPath = path.join(root, output)
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(ledger, null, 2)}\n`)

  if (print) {
    console.log(JSON.stringify(ledger, null, 2))
  } else {
    printSummary(ledger, output)
  }

  return {
    ledger,
    output
  }
}

function runEntry({
  providerResultEntry,
  generationRequestEntry,
  adapterRunEntry,
  failureEvidenceEntry
}) {
  const providerResult = providerResultEntry.record
  const generationRequest = generationRequestEntry?.record
  const adapterRun = adapterRunEntry?.record
  const failure = failureEvidenceEntry?.record

  return {
    providerId: providerResult.providerId,
    status: providerResult.status,
    intentFamily: generationRequest?.intentFamily,
    projectId: generationRequest?.projectId,
    cardRef: generationRequest?.cardRef,
    cardId: generationRequest?.cardRef?.id,
    requestRef: generationRequest
      ? localRef('media-generation-request', generationRequestEntry.path, generationRequest.schema)
      : providerResult.requestRef,
    providerResultRef: localRef('media-provider-result', providerResultEntry.path, providerResult.schema),
    adapterRunRef: adapterRun
      ? localRef('media-provider-adapter-run', adapterRunEntry.path, adapterRun.schema)
      : undefined,
    failureEvidenceRef: failure
      ? localRef('media-evidence', failureEvidenceEntry.path, failure.schema)
      : undefined,
    outputCount: providerResult.outputRefs.length,
    providerTruth: false,
    localOnly: true
  }
}

function summarizeRuns(runs) {
  const byStatus = {}
  const byProvider = {}
  const byCard = {}

  for (const run of runs) {
    byStatus[run.status] = (byStatus[run.status] ?? 0) + 1
    byProvider[run.providerId] = (byProvider[run.providerId] ?? 0) + 1
    if (run.cardId) byCard[run.cardId] = (byCard[run.cardId] ?? 0) + 1
  }

  return {
    total: runs.length,
    byStatus,
    byProvider,
    byCard
  }
}

function firstProjectId(runs, generationRequests) {
  return runs.find((run) => run.projectId)?.projectId ??
    Array.from(generationRequests.values()).find((entry) => entry.record.projectId)?.record.projectId
}

async function readProjectJsonRecords(root) {
  const recordsRoot = path.join(root, 'records')
  const files = await listJsonFiles(recordsRoot)
  const records = []

  for (const filePath of files) {
    const relativePath = path.relative(root, filePath).split(path.sep).join('/')
    if (relativePath.startsWith('records/exports/')) continue
    assertSafeLocalPath(relativePath)
    const raw = JSON.parse(await readFile(filePath, 'utf8'))
    const record = raw.providerResult?.schema === artifactKinds.mediaProviderResult ? raw.providerResult : raw

    if (!record.schema) continue
    validateRequiredRecord(record)
    records.push({ path: relativePath, record })
  }

  return records
}

async function listJsonFiles(root) {
  let dirents
  try {
    dirents = await readdir(root, { withFileTypes: true })
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }

  const files = []

  for (const dirent of dirents) {
    const fullPath = path.join(root, dirent.name)
    if (dirent.isDirectory()) {
      files.push(...await listJsonFiles(fullPath))
    } else if (dirent.isFile() && dirent.name.endsWith('.json')) {
      files.push(fullPath)
    }
  }

  return files.sort()
}

function localRef(kind, relativePath, schema) {
  return {
    ...makeRef(kind, relativePath, schema),
    path: relativePath,
    localOnly: true
  }
}

function printSummary(ledger, output) {
  console.log(`provider run ledger: ${output}`)
  console.log(`total: ${ledger.summary.total}`)
  for (const [status, count] of Object.entries(ledger.summary.byStatus)) {
    console.log(`${status}: ${count}`)
  }
}

if (process.argv[1] === modulePath) {
  await indexProviderRuns(parseArgs(process.argv.slice(2)))
}
