import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { validateRequiredRecord } from '../contracts/schemas.js'
import { assertSafeLocalPath } from '../local/project-layout.js'
import { summarizeProductionFreshness, validateProductionDescriptorGraph } from './strategy.js'

const modulePath = fileURLToPath(import.meta.url)
const defaultProjectDir = 'examples/card-to-candidate'
const defaultInputDir = 'records/production'

function parseArgs(argv) {
  const args = {
    projectDir: defaultProjectDir,
    inputDir: defaultInputDir
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]

    if (arg === '--project-dir') {
      args.projectDir = next
      i += 1
    } else if (arg === '--input-dir') {
      args.inputDir = next
      i += 1
    }
  }

  return args
}

export async function validateProductionRecordsInProject({
  projectDir = defaultProjectDir,
  inputDir = defaultInputDir,
  quiet = false
} = {}) {
  assertSafeLocalPath(inputDir)
  const root = path.resolve(projectDir)
  const files = await listJsonFiles(path.join(root, inputDir))
  const records = []

  for (const file of files) {
    const record = JSON.parse(await readFile(file, 'utf8'))
    if (!record.schema) continue
    validateRequiredRecord(record)
    records.push(record)
  }

  validateProductionDescriptorGraph(records)
  const freshness = summarizeProductionFreshness(records)

  if (!quiet) {
    console.log(formatProductionValidationSummary({ count: records.length, freshness, inputDir }))
    if (freshness.staleDescriptorIds.length > 0) {
      console.log(`staleDescriptor: ${freshness.staleDescriptorIds[0]}`)
    }
  }

  return {
    valid: true,
    count: records.length,
    freshness,
    records
  }
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

export function formatProductionValidationSummary({ count, freshness, inputDir }) {
  return [
    'production validation: valid=true',
    `records=${count}`,
    `freshness=${freshness.fresh ? 'fresh' : 'stale'}`,
    `staleDescriptors=${freshness.staleDescriptorIds.length}`,
    `input=${inputDir}`
  ].join(' | ')
}

if (process.argv[1] === modulePath) {
  await validateProductionRecordsInProject(parseArgs(process.argv.slice(2)))
}
