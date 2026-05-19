import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runFirstWedge } from './run-first-wedge.js'
import { inspectLocalRun } from '../seams/inspect-local-run.js'

const modulePath = fileURLToPath(import.meta.url)
const fixedTimestamp = '2026-05-19T00:00:00.000Z'
const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi
const timestampPattern = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g

function parseArgs(argv) {
  const args = {
    projectDir: 'examples/inspection-fixtures/card-to-candidate'
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]

    if (arg === '--project-dir') {
      args.projectDir = next
      i += 1
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
  await inspectLocalRun({
    projectDir: root,
    output: 'inspection-packets/local-run-edge-inspection-packet.local.json'
  })
  await normalizeFixture(root)

  console.log(`Generated deterministic inspection fixture: ${projectDir}`)
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

It contains a completed first-wedge run and a generated
\`media.edge_inspection_packet.local.v1\` packet under:

\`\`\`text
inspection-packets/local-run-edge-inspection-packet.local.json
\`\`\`

The fixture is for deterministic inspection/export examples. It is not mesh
truth, distributed proof, byte availability proof, materialization proof, or
ratifier authority.
`
}

if (process.argv[1] === modulePath) {
  await generateInspectionFixture(parseArgs(process.argv.slice(2)))
}
