import { mkdir, open, readFile, rename, rm } from 'node:fs/promises'
import path from 'node:path'

import { assertSafeLocalPath } from './project-layout.js'

export function isTemporaryJsonPath(relativePath) {
  const basename = path.posix.basename(relativePath)
  return basename.startsWith('.') ||
    basename.endsWith('.tmp') ||
    basename.endsWith('.partial') ||
    relativePath.endsWith('.tmp') ||
    relativePath.endsWith('.partial')
}

export function isDiscoverableJsonPath(relativePath) {
  return relativePath.endsWith('.json') && !isTemporaryJsonPath(relativePath)
}

export async function writeJsonAtomic(root, relativePath, value, options = {}) {
  assertSafeLocalPath(relativePath)

  const finalPath = path.join(root, relativePath)
  const parent = path.dirname(finalPath)
  const basename = path.basename(finalPath)
  const tempPath = path.join(parent, `.${basename}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`)
  const serialized = `${JSON.stringify(value, null, 2)}\n`

  await mkdir(parent, { recursive: true })

  let file
  try {
    file = await open(tempPath, 'w')
    await file.writeFile(serialized)
    if (options.fsync !== false) {
      await file.sync()
    }
    await file.close()
    file = undefined
    await rename(tempPath, finalPath)
  } catch (error) {
    if (file) {
      await file.close().catch(() => {})
    }
    await rm(tempPath, { force: true }).catch(() => {})
    throw error
  }
}

export async function readJsonFile(root, relativePath) {
  assertSafeLocalPath(relativePath)

  try {
    return JSON.parse(await readFile(path.join(root, relativePath), 'utf8'))
  } catch (error) {
    if (error instanceof SyntaxError) {
      const wrapped = new Error(`Failed to parse JSON record ${relativePath}: ${error.message}`)
      wrapped.cause = error
      wrapped.issueCode = parseFailureIssueCode(error)
      throw wrapped
    }
    throw error
  }
}

export async function readOptionalJsonFile(root, relativePath) {
  try {
    return await readJsonFile(root, relativePath)
  } catch (error) {
    if (error.code === 'ENOENT') return undefined
    throw error
  }
}

export async function readJsonFileTolerant(root, relativePath) {
  assertSafeLocalPath(relativePath)

  try {
    return {
      ok: true,
      value: JSON.parse(await readFile(path.join(root, relativePath), 'utf8'))
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        ok: false,
        missing: true,
        diagnostic: createJsonReadDiagnostic(relativePath, {
          issueCode: 'record_missing',
          message: `JSON record is missing: ${relativePath}`
        })
      }
    }

    if (error instanceof SyntaxError) {
      return {
        ok: false,
        diagnostic: createJsonReadDiagnostic(relativePath, {
          issueCode: parseFailureIssueCode(error),
          message: error.message
        })
      }
    }

    throw error
  }
}

export function createJsonReadDiagnostic(relativePath, { issueCode, message }) {
  return {
    schema: 'media.local_record_read_diagnostic.local.v1',
    diagnosticId: `local-record-read-diagnostic-${stablePathId(relativePath)}`,
    diagnosticKind: 'local-record-read',
    issueCode,
    path: relativePath,
    summary: message,
    retrySafe: true,
    localOnly: true,
    operatorGuidanceOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    approvalAuthority: false,
    ratifierAuthority: false,
    publicationAuthorization: false,
    edgeCalled: false,
    meshPublished: false
  }
}

export function summarizeRecordReadDiagnostics(records) {
  const diagnostics = records
    .filter((entry) => entry.record.schema === 'media.local_record_read_diagnostic.local.v1')
    .map((entry) => entry.record)
  const byIssueCode = {}

  for (const diagnostic of diagnostics) {
    byIssueCode[diagnostic.issueCode] = (byIssueCode[diagnostic.issueCode] ?? 0) + 1
  }

  return {
    diagnostics: diagnostics.length,
    byIssueCode,
    attentionRows: diagnostics.map((diagnostic) => ({
      path: diagnostic.path,
      issueCode: diagnostic.issueCode,
      summary: diagnostic.summary,
      nextAction: 'Retry after the writer finishes; if the record remains malformed, regenerate the local record.',
      localOnly: true,
      operatorGuidanceOnly: true,
      retrySafe: true,
      nonClaims: {
        meshTruth: false,
        distributedProof: false,
        ratifiedSharedState: false,
        approvalAuthority: false,
        ratifierAuthority: false,
        publicationAuthorization: false
      }
    }))
  }
}

function parseFailureIssueCode(error) {
  return /unexpected end|unterminated|end of json/i.test(error.message)
    ? 'record_read_incomplete'
    : 'record_parse_failed'
}

function stablePathId(relativePath) {
  return relativePath
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}
