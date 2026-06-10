import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'

import { createFileResourceLiftSourceCandidate } from '../src/local/file-resource-lift-source-candidate.js'
import { validateRequiredRecord } from '../src/contracts/schemas.js'

const fixtureRoot = path.resolve('examples/card-to-candidate')

test('Studio emits a local file/resource lift source candidate from existing byte and resource candidates', async () => {
  const entries = await loadFixtureEntries()
  const candidate = createFileResourceLiftSourceCandidate(entries)

  assert.equal(candidate.schema, 'studio_file_resource_lift_source_candidate.local.v0')
  assert.equal(candidate.candidateStatus, 'source_candidate_only_not_admitted')
  assert.equal(candidate.sourceLocalAssetRefs.length > 0, true)
  assert.equal(candidate.byteDescriptorProposalRefs.length, 1)
  assert.equal(candidate.resourceRefCandidateRefs.length, 1)
  assert.equal(candidate.localOnly, true)
  assert.equal(candidate.resourceAdmission, false)
  assert.equal(candidate.layerAdmission, false)
  assert.equal(candidate.byteAvailabilityProof, false)
  assert.equal(candidate.materializationProof, false)
  assert.equal(candidate.nonClaims.localPathIsCanon, false)
  assert.equal(candidate.nonClaims.storageRefIsAdmission, false)

  validateRequiredRecord(candidate)
})

test('Studio rejects lift candidates without a byte descriptor proposal', async () => {
  const entries = await loadFixtureEntries()
  const resourceRefCandidateEntries = entries.resourceRefCandidateEntries.map((entry) => ({
    ...entry,
    record: {
      ...entry.record,
      byteDescriptorAlignment: {
        ...entry.record.byteDescriptorAlignment,
        status: 'missing-byte-descriptor-proposal',
        byteDescriptorProposalRef: null
      }
    }
  }))

  assert.throws(() => createFileResourceLiftSourceCandidate({
    ...entries,
    resourceRefCandidateEntries
  }), /byte descriptor proposal/)
})

test('Studio lift source candidate validation rejects admission and authority overclaims', async () => {
  const candidate = createFileResourceLiftSourceCandidate(await loadFixtureEntries())

  assert.throws(() => validateRequiredRecord({
    ...candidate,
    resourceAdmission: true
  }), /resourceAdmission=false/)

  assert.throws(() => validateRequiredRecord({
    ...candidate,
    nonClaims: {
      ...candidate.nonClaims,
      externalReferenceIsCanon: true
    }
  }), /externalReferenceIsCanon/)
})

async function loadFixtureEntries() {
  const load = async (relativeDir, schema) => {
    const files = await listJsonFiles(path.join(fixtureRoot, relativeDir))
    const entries = []
    for (const file of files.sort()) {
      const record = JSON.parse(await readFile(file, 'utf8'))
      if (record.schema !== schema) continue
      entries.push({
        path: path.relative(fixtureRoot, file).split(path.sep).join('/'),
        record
      })
    }
    return entries
  }
  return {
    assetEntries: await load('records/assets', 'media.asset.descriptor.v1'),
    byteDescriptorProposalEntries: await load('records/bytes', 'media.byte_descriptor_proposal.local.v1'),
    resourceRefCandidateEntries: await load('records/resources', 'media.local_layer_resource_ref_candidate.local.v1')
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
  return files
}
