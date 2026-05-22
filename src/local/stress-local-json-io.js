import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createMediaSummary } from '../assets/media-summary.js'
import { runVeniceProductionRehearsal } from '../providers/venice-production-rehearsal.js'
import { createProductionAuthorityPrerequisiteReport } from '../production/authority-prerequisites.js'
import { runLocalProductionOutput } from '../production/local-output-runner.js'
import { writeEdgeCompatibilityBundle } from '../seams/edge-compatibility-bundle.js'
import { writeOperatorPacketIndex } from '../seams/operator-packet-index.js'

const modulePath = fileURLToPath(import.meta.url)

function parseArgs(argv) {
  const args = {
    projectDir: undefined,
    iterations: 3,
    readerRounds: 3,
    disableFfmpeg: true,
    keepTemp: false,
    print: false,
    quiet: false
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]

    if (arg === '--project-dir') {
      args.projectDir = next
      i += 1
    } else if (arg === '--iterations') {
      args.iterations = Number.parseInt(next, 10)
      i += 1
    } else if (arg === '--reader-rounds') {
      args.readerRounds = Number.parseInt(next, 10)
      i += 1
    } else if (arg === '--disable-ffmpeg') {
      args.disableFfmpeg = true
    } else if (arg === '--enable-ffmpeg') {
      args.disableFfmpeg = false
    } else if (arg === '--keep-temp') {
      args.keepTemp = true
    } else if (arg === '--print') {
      args.print = true
    } else if (arg === '--quiet') {
      args.quiet = true
    }
  }

  return args
}

export async function stressLocalJsonRecordIO({
  projectDir,
  iterations = 3,
  readerRounds = 3,
  disableFfmpeg = true,
  keepTemp = false,
  print = false,
  quiet = false
} = {}) {
  assertPositiveInteger(iterations, 'iterations')
  assertPositiveInteger(readerRounds, 'readerRounds')

  const createdTempProject = !projectDir
  const root = projectDir
    ? path.resolve(projectDir)
    : await mkdtemp(path.join(os.tmpdir(), 'media-studio-json-io-stress-'))

  try {
    await runQuiet(() => runVeniceProductionRehearsal({
      projectDir: root,
      liveProvider: false,
      verbose: false
    }))
    await runLocalProductionOutput({
      projectDir: root,
      disableFfmpeg,
      quiet: true
    })

    const writerTasks = []
    const readerTasks = []

    for (let index = 0; index < iterations; index += 1) {
      writerTasks.push(runLocalProductionOutput({
        projectDir: root,
        disableFfmpeg,
        quiet: true
      }))
    }

    for (let index = 0; index < readerRounds; index += 1) {
      readerTasks.push(readStatusSurfaces(root))
    }

    const [writerResults, readerResults] = await Promise.all([
      Promise.all(writerTasks),
      Promise.all(readerTasks)
    ])
    const diagnostics = summarizeDiagnostics(readerResults)
    const finalSummary = await createMediaSummary({ projectDir: root })
    const finalPrereqs = await createProductionAuthorityPrerequisiteReport({ projectDir: root })

    const result = {
      schema: 'media.local_json_io_stress.local.v1',
      mode: 'standalone-local',
      projectId: finalSummary.projectId,
      projectDir: root,
      createdTempProject,
      iterations,
      readerRounds,
      disableFfmpeg,
      writerRuns: writerResults.length,
      readerRuns: readerResults.length,
      diagnostics,
      finalState: {
        localDeliveryEvidencePresent: finalPrereqs.localDeliveryEvidencePresent ?? 0,
        localDeliveryEvidenceIntact: finalPrereqs.localDeliveryEvidenceIntact ?? 0,
        localProductionPackageComplete: finalPrereqs.localProductionPackageComplete ?? 0,
        outputIntegrityBlockingIssues: finalPrereqs.outputIntegrityBlockingIssues ?? 0,
        outputIntegrityAttentionIssues: finalPrereqs.outputIntegrityAttentionIssues ?? 0,
        pendingAuthority: finalPrereqs.pendingAuthority ?? 0,
        productionReady: finalPrereqs.productionReady ?? 0
      },
      nonClaims: {
        localOnly: true,
        operatorGuidanceOnly: true,
        productionReady: false,
        meshTruth: false,
        distributedProof: false,
        ratifiedSharedState: false,
        publicationAuthorization: false,
        approvalAuthority: false,
        ratifierAuthority: false,
        edgeCalled: false,
        meshPublished: false,
        byteAvailabilityProof: false,
        materializationProof: false,
        resourceAdmission: false,
        causalTruth: false
      }
    }

    if (print) {
      console.log(JSON.stringify(result, null, 2))
    } else if (!quiet) {
      console.log(formatLocalJsonIOStressSummary(result))
      if (diagnostics.total > 0) {
        console.log(`recordIO diagnostics: total=${diagnostics.total} | issues=${Object.entries(diagnostics.byIssueCode).map(([issue, count]) => `${issue}:${count}`).join(', ')}`)
      }
      console.log('nonClaims: local-only stress check; no Edge call; no mesh publication; no authority grant; no productionReady claim')
    }

    return result
  } finally {
    if (createdTempProject && !keepTemp) {
      await rm(root, { recursive: true, force: true })
    }
  }
}

export function formatLocalJsonIOStressSummary(result) {
  return [
    `local json io stress: project=${result.projectId}`,
    `writers=${result.writerRuns}`,
    `readerRounds=${result.readerRuns}`,
    `disableFfmpeg=${result.disableFfmpeg}`,
    `diagnostics=${result.diagnostics.total}`,
    `localDeliveryEvidenceIntact=${result.finalState.localDeliveryEvidenceIntact}`,
    `localProductionPackageComplete=${result.finalState.localProductionPackageComplete}`,
    `outputIntegrityBlocking=${result.finalState.outputIntegrityBlockingIssues}`,
    `pendingAuthority=${result.finalState.pendingAuthority}`,
    `productionReady=${result.finalState.productionReady}`
  ].join(' | ')
}

async function readStatusSurfaces(projectDir) {
  const [mediaSummary, authorityPrereqs, operatorIndex, edgeCompatibility] = await Promise.all([
    createMediaSummary({ projectDir }),
    createProductionAuthorityPrerequisiteReport({ projectDir }),
    writeOperatorPacketIndex({ projectDir, quiet: true }),
    writeEdgeCompatibilityBundle({ projectDir, quiet: true })
  ])

  return {
    mediaSummary,
    authorityPrereqs,
    operatorIndex: operatorIndex.index,
    edgeCompatibility: edgeCompatibility.bundle
  }
}

function summarizeDiagnostics(readerResults) {
  const diagnostics = []

  for (const result of readerResults) {
    diagnostics.push(...(result.mediaSummary.recordIO?.attentionRows ?? []))
    diagnostics.push(...(result.authorityPrereqs.recordReadDiagnostics?.attentionRows ?? []))
    diagnostics.push(...(result.operatorIndex.recordReadDiagnostics?.attentionRows ?? []))
  }

  const byIssueCode = diagnostics.reduce((acc, diagnostic) => {
    const issueCode = diagnostic.issueCode ?? 'unknown'
    acc[issueCode] = (acc[issueCode] ?? 0) + 1
    return acc
  }, {})

  return {
    total: diagnostics.length,
    byIssueCode
  }
}

function assertPositiveInteger(value, name) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`)
  }
}

async function runQuiet(fn) {
  const originalLog = console.log
  console.log = () => {}
  try {
    return await fn()
  } finally {
    console.log = originalLog
  }
}

if (process.argv[1] === modulePath) {
  await stressLocalJsonRecordIO(parseArgs(process.argv.slice(2)))
}
