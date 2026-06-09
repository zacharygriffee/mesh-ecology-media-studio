import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const modulePath = fileURLToPath(import.meta.url)

function parseArgs(argv) {
  const args = {
    projectDir: 'examples/card-to-candidate',
    json: false
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]

    if (arg === '--project-dir') {
      args.projectDir = next
      i += 1
    } else if (arg === '--json') {
      args.json = true
    }
  }

  return args
}

export async function indexInspectionRecords({
  projectDir = 'examples/card-to-candidate',
  json = false
} = {}) {
  const root = path.resolve(projectDir)
  const files = await listJsonFiles(path.join(root, 'records'))
  const entries = []

  for (const file of files) {
    try {
      const record = JSON.parse(await readFile(file, 'utf8'))
      const schema = record.schema ?? record.summaryKind ?? record.providerResult?.schema ?? 'unknown'
      const relativePath = path.relative(root, file).split(path.sep).join('/')
      entries.push({
        schema,
        path: relativePath,
        status: record.providerResult?.status ?? record.status ?? record.operationState
      })
    } catch {
      entries.push({
        schema: 'unreadable-json',
        path: path.relative(root, file).split(path.sep).join('/')
      })
    }
  }

  const index = {
    projectDir,
    manifests: entries.filter((entry) => entry.schema === 'media.local_run_manifest.v1'),
    providerResults: entries.filter((entry) => entry.schema === 'media.provider_result.v1'),
    inspectionPackets: entries.filter((entry) => entry.schema === 'media.edge_inspection_packet.local.v1'),
    currentOperationSummaries: entries.filter((entry) => entry.schema === 'studio-current-operational-runbook'),
    all: entries
  }

  if (json) {
    console.log(JSON.stringify(index, null, 2))
  } else {
    console.log(`project: ${projectDir}`)
    console.log(`manifests: ${index.manifests.length}`)
    console.log(`providerResults: ${index.providerResults.length}`)
    console.log(`inspectionPackets: ${index.inspectionPackets.length}`)
    console.log(`currentOperationSummaries: ${index.currentOperationSummaries.length}`)
    for (const entry of entries) {
      console.log(`${entry.schema}\t${entry.path}${entry.status ? `\t${entry.status}` : ''}`)
    }
  }

  return index
}

async function listJsonFiles(root) {
  const entries = []

  try {
    for (const dirent of await readdir(root, { withFileTypes: true })) {
      const fullPath = path.join(root, dirent.name)
      if (dirent.isDirectory()) {
        entries.push(...await listJsonFiles(fullPath))
      } else if (dirent.isFile() && dirent.name.endsWith('.json')) {
        entries.push(fullPath)
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }

  return entries.sort()
}

if (process.argv[1] === modulePath) {
  await indexInspectionRecords(parseArgs(process.argv.slice(2)))
}
