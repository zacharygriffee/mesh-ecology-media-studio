import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { writeByteDescriptorProposals } from '../assets/byte-descriptor-proposal.js'
import { writeEdgeCompatibilityBundle } from '../seams/edge-compatibility-bundle.js'
import { writeEdgeHandoffCandidate } from '../seams/edge-handoff-candidate.js'
import { writeEdgeReadinessGuidance } from '../seams/edge-readiness-guidance.js'
import { inspectLocalRun } from '../seams/inspect-local-run.js'
import { writeOperatorPacketIndex } from '../seams/operator-packet-index.js'
import { writeProjectHealth } from '../seams/project-health.js'
import { writeControlSurfaceProjection } from '../seams/control-surface-projection.js'
import { writeLocalLayerResourceRefCandidates } from './resource-ref-candidates.js'
import { runFirstWedge } from './run-first-wedge.js'
import { writeOperatorDecisionRequest } from '../review/operator-decision-request.js'
import { writeProductionRecordsFromCard } from '../production/create-production-records.js'

const modulePath = fileURLToPath(import.meta.url)
const defaultProjectDir = 'examples/inspection-fixtures/unhealthy'
const fixedTimestamp = '2026-05-19T00:00:00.000Z'
const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi
const timestampPattern = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g

function parseArgs(argv) {
  const args = {
    projectDir: defaultProjectDir,
    check: false
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]

    if (arg === '--project-dir') {
      args.projectDir = next
      i += 1
    } else if (arg === '--check') {
      args.check = true
    }
  }

  return args
}

export async function generateUnhealthyFixtures({
  projectDir = defaultProjectDir
} = {}) {
  const root = path.resolve(projectDir)
  await rm(root, { recursive: true, force: true })
  await mkdir(root, { recursive: true })
  await writeFile(path.join(root, 'README.md'), unhealthyReadme())

  await generateCase({
    root,
    caseName: 'missing-byte-proposal',
    description: 'Accepted asset exists, but no byte descriptor proposal or resource-ref candidate has been generated.',
    prepare: async () => {}
  })
  await generateCase({
    root,
    caseName: 'stale-resource-ref',
    description: 'Byte descriptor proposal exists, but the resource-ref candidate no longer matches the asset local ref.',
    prepare: async (projectRoot) => {
      await writeByteDescriptorProposals({ projectDir: projectRoot })
      await writeLocalLayerResourceRefCandidates({ projectDir: projectRoot })
      const resourceCandidatePath = await firstJsonFile(path.join(projectRoot, 'records', 'resources'))
      await mutateJson(resourceCandidatePath, (record) => {
        record.proposedResourceRef.localRef.path = 'media/accepted/stale-candidate.txt'
      })
    }
  })
  await generateCase({
    root,
    caseName: 'stale-production-descriptor',
    description: 'Production unit was updated after descriptor creation, so the descriptor is locally stale.',
    prepare: async (projectRoot) => {
      await writeByteDescriptorProposals({ projectDir: projectRoot })
      await writeLocalLayerResourceRefCandidates({ projectDir: projectRoot })
      await writeProductionRecordsFromCard({ projectDir: projectRoot })
      await mutateJson(path.join(projectRoot, 'records', 'production', 'sceneUnit.local.json'), (record) => {
        record.createdAt = '2099-01-01T00:00:00.000Z'
      })
    }
  })

  await normalizeFixture(root)
  console.log(`Generated deterministic unhealthy fixtures: ${projectDir}`)
}

export async function checkUnhealthyFixtures({
  projectDir = defaultProjectDir
} = {}) {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'media-studio-unhealthy-fixture-check-'))
  const tempFixture = path.join(tempRoot, 'unhealthy')

  await generateUnhealthyFixtures({ projectDir: tempFixture })

  const expectedRoot = path.resolve(projectDir)
  const expectedFiles = (await listFiles(expectedRoot)).map((file) => path.relative(expectedRoot, file)).sort()
  const actualFiles = (await listFiles(tempFixture)).map((file) => path.relative(tempFixture, file)).sort()

  if (expectedFiles.join('\n') !== actualFiles.join('\n')) {
    throw new Error('Unhealthy fixture file list drifted; run npm run fixture:unhealthy if the fixture shape intentionally changed')
  }

  await rm(tempRoot, { recursive: true, force: true })
  console.log(`Unhealthy fixture shape is compatible: ${projectDir}`)
}

async function generateCase({ root, caseName, description, prepare }) {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), `media-studio-${caseName}-`))
  await mkdir(path.join(projectRoot, 'cards'), { recursive: true })
  await mkdir(path.join(projectRoot, 'media', 'generated'), { recursive: true })
  await cp('examples/card-to-candidate/cards/card.json', path.join(projectRoot, 'cards', 'card.json'))
  await cp('examples/card-to-candidate/media/generated/candidate.txt', path.join(projectRoot, 'media', 'generated', 'candidate.txt'))

  await runFirstWedge({
    projectDir: projectRoot,
    decision: 'accepted',
    operatorRef: 'fixture-operator'
  })
  await prepare(projectRoot)
  await writeEdgeReadinessGuidance({ projectDir: projectRoot })
  await writeProjectHealth({ projectDir: projectRoot, summary: true })
  await inspectLocalRun({ projectDir: projectRoot })
  await writeControlSurfaceProjection({ projectDir: projectRoot })
  await writeEdgeCompatibilityBundle({ projectDir: projectRoot })
  await writeOperatorPacketIndex({ projectDir: projectRoot })
  await writeEdgeHandoffCandidate({ projectDir: projectRoot })
  await writeOperatorDecisionRequest({ projectDir: projectRoot })

  const caseRoot = path.join(root, caseName)
  await mkdir(caseRoot, { recursive: true })
  await writeFile(path.join(caseRoot, 'README.md'), caseReadme({ caseName, description }))
  await copySelectedRecord(projectRoot, caseRoot, 'records/manifests/media-project-health.local.json', 'media-project-health.local.json')
  await copySelectedRecord(projectRoot, caseRoot, 'records/exports/media-edge-handoff-candidate.local.json', 'media-edge-handoff-candidate.local.json')
  await copySelectedRecord(projectRoot, caseRoot, 'records/requests/media-operator-decision-request.local.json', 'media-operator-decision-request.local.json')

  const health = JSON.parse(await readFile(path.join(projectRoot, 'records/manifests/media-project-health.local.json'), 'utf8'))
  const handoff = JSON.parse(await readFile(path.join(projectRoot, 'records/exports/media-edge-handoff-candidate.local.json'), 'utf8'))
  const request = JSON.parse(await readFile(path.join(projectRoot, 'records/requests/media-operator-decision-request.local.json'), 'utf8'))
  await writeFile(path.join(caseRoot, 'summary.local.json'), `${JSON.stringify({
    caseName,
    healthState: health.healthState,
    blockingIssues: health.blockingIssues,
    handoffState: handoff.handoffState,
    requestKind: request.requestKind,
    nextActions: request.nextActions,
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false
  }, null, 2)}\n`)

  await rm(projectRoot, { recursive: true, force: true })
}

async function copySelectedRecord(projectRoot, caseRoot, source, target) {
  await cp(path.join(projectRoot, source), path.join(caseRoot, target))
}

async function mutateJson(file, mutator) {
  const record = JSON.parse(await readFile(file, 'utf8'))
  mutator(record)
  await writeFile(file, `${JSON.stringify(record, null, 2)}\n`)
}

async function firstJsonFile(root) {
  const files = (await listFiles(root)).filter((file) => file.endsWith('.json')).sort()
  if (files.length === 0) {
    throw new Error(`Expected at least one JSON file under ${root}`)
  }

  return files[0]
}

async function normalizeFixture(root) {
  const files = (await listFiles(root)).filter((file) => file.endsWith('.json'))
  const texts = new Map()
  const uuidMap = new Map()
  let uuidIndex = 1

  for (const file of files) {
    const text = await readFile(file, 'utf8')
    texts.set(file, text)
    for (const match of text.matchAll(uuidPattern)) {
      const uuid = match[0].toLowerCase()
      if (!uuidMap.has(uuid)) {
        uuidMap.set(uuid, `00000000-0000-4000-8000-${String(uuidIndex).padStart(12, '0')}`)
        uuidIndex += 1
      }
    }
  }

  for (const [file, text] of texts) {
    let normalized = text.replace(timestampPattern, fixedTimestamp)
    for (const [from, to] of uuidMap) {
      normalized = normalized.replaceAll(from, to)
    }
    await writeFile(file, normalized)
  }
}

async function listFiles(root) {
  const files = []

  for (const dirent of await readdir(root, { withFileTypes: true })) {
    const fullPath = path.join(root, dirent.name)
    if (dirent.isDirectory()) {
      files.push(...await listFiles(fullPath))
    } else if (dirent.isFile()) {
      files.push(fullPath)
    }
  }

  return files.sort()
}

function unhealthyReadme() {
  return `# Unhealthy Inspection Fixtures

These fixtures are compact local-only examples of handoffs that need operator
attention before any future Edge-mediated review. They are not mesh truth,
distributed proof, byte materialization proof, publication authorization, or
ratifier authority.
`
}

function caseReadme({ caseName, description }) {
  return `# ${caseName}

${description}

This fixture keeps only the local records most relevant to operator attention:

- \`media-project-health.local.json\`
- \`media-edge-handoff-candidate.local.json\`
- \`media-operator-decision-request.local.json\`
- \`summary.local.json\`

The records are local-only examples and do not call Edge.
`
}

if (process.argv[1] === modulePath) {
  const args = parseArgs(process.argv.slice(2))
  if (args.check) {
    await checkUnhealthyFixtures(args)
  } else {
    await generateUnhealthyFixtures(args)
  }
}
