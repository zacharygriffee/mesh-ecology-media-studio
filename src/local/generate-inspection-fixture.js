import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runFirstWedge } from './run-first-wedge.js'
import { inspectLocalRun } from '../seams/inspect-local-run.js'
import { exportInspectionBundle } from '../seams/export-inspection-bundle.js'
import { writeContinuityEvidence } from '../seams/continuity-evidence.js'
import { writeCandidateReview } from '../review/candidate-review.js'

const modulePath = fileURLToPath(import.meta.url)
const fixedTimestamp = '2026-05-19T00:00:00.000Z'
const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi
const timestampPattern = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g

function parseArgs(argv) {
  const args = {
    projectDir: 'examples/inspection-fixtures/card-to-candidate',
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

export async function generateInspectionFixture({
  projectDir = 'examples/inspection-fixtures/card-to-candidate'
} = {}) {
  const root = path.resolve(projectDir)
  await rm(root, { recursive: true, force: true })
  await mkdir(path.join(root, 'cards'), { recursive: true })
  await mkdir(path.join(root, 'media', 'generated'), { recursive: true })
  await cp('examples/card-to-candidate/cards/card.json', path.join(root, 'cards', 'card.json'))
  await cp('examples/card-to-candidate/media/generated/candidate.txt', path.join(root, 'media', 'generated', 'candidate.txt'))
  await writeFile(path.join(root, 'README.md'), fixtureReadme())

  await runFirstWedge({
    projectDir: root,
    decision: 'accepted',
    operatorRef: 'fixture-operator'
  })
  await writeCandidateReview({
    projectDir: root,
    operatorRef: 'fixture-operator'
  })
  await writeContinuityEvidence({
    projectDir: root
  })
  await inspectLocalRun({
    projectDir: root,
    output: 'inspection-packets/local-run-edge-inspection-packet.local.json'
  })
  await exportInspectionBundle({
    projectDir: root,
    packet: 'inspection-packets/local-run-edge-inspection-packet.local.json',
    outputDir: 'inspection-bundle/local-run'
  })
  await normalizeFixture(root)

  console.log(`Generated deterministic inspection fixture: ${projectDir}`)
}

export async function checkInspectionFixture({
  projectDir = 'examples/inspection-fixtures/card-to-candidate'
} = {}) {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'media-studio-fixture-check-'))
  const tempFixture = path.join(tempRoot, 'card-to-candidate')

  await generateInspectionFixture({ projectDir: tempFixture })

  const expectedRoot = path.resolve(projectDir)
  const expectedFiles = (await listFiles(expectedRoot)).map((file) => path.relative(expectedRoot, file)).sort()
  const actualFiles = (await listFiles(tempFixture)).map((file) => path.relative(tempFixture, file)).sort()

  if (expectedFiles.join('\n') !== actualFiles.join('\n')) {
    throw new Error('Inspection fixture file list drifted; run npm run fixture:inspection if the fixture shape intentionally changed')
  }

  await rm(tempRoot, { recursive: true, force: true })
  console.log(`Inspection fixture shape is compatible: ${projectDir}`)
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

function fixtureReadme() {
  return `# Card To Candidate Inspection Fixture

This fixture is a committed local-only inspection example.

It contains a completed first-wedge run, local candidate review, local
continuity evidence, a generated \`media.edge_inspection_packet.local.v1\`
packet, and a local export bundle under:

\`\`\`text
inspection-packets/local-run-edge-inspection-packet.local.json
inspection-bundle/local-run/
\`\`\`

The fixture is for deterministic inspection/export examples. It is not mesh
truth, distributed proof, byte availability proof, materialization proof, or
ratifier authority.
`
}

if (process.argv[1] === modulePath) {
  const args = parseArgs(process.argv.slice(2))
  if (args.check) {
    await checkInspectionFixture(args)
  } else {
    await generateInspectionFixture(args)
  }
}
