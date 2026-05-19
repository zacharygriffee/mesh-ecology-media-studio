import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { runFirstWedge } from '../src/local/run-first-wedge.js'
import { validateRequiredRecord } from '../src/contracts/schemas.js'
import {
  assertLifecycleState,
  assertPlacementClass,
  assertSafeLocalPath,
  createAssetLifecycle,
  createLocalRef,
  placementClasses
} from '../src/local/project-layout.js'

async function createFixtureProject() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-wedge-'))
  await mkdir(path.join(dir, 'cards'), { recursive: true })
  await mkdir(path.join(dir, 'media', 'generated'), { recursive: true })

  await writeFile(path.join(dir, 'cards', 'card.json'), JSON.stringify({
    schema: 'media.card.v1',
    cardId: 'card-test',
    projectId: 'project-test',
    kind: 'image',
    prompt: 'test prompt',
    referenceAssetRefs: [],
    target: {
      contentType: 'image/png'
    },
    providerHints: {},
    acceptanceCriteria: ['hash recorded'],
    createdAt: '2026-05-19T00:00:00.000Z'
  }, null, 2))
  await writeFile(path.join(dir, 'media', 'generated', 'candidate.txt'), 'candidate bytes')

  return dir
}

test('first wedge creates local records without claiming mesh truth', async () => {
  const dir = await createFixtureProject()

  const result = await runFirstWedge({
    projectDir: dir,
    decision: 'accepted',
    operatorRef: 'operator-test'
  })

  assert.equal(result.outputs.workPacket.schema, 'media.work_packet.v1')
  assert.equal(result.outputs.assetDescriptor.schema, 'media.asset.descriptor.v1')
  assert.equal(result.outputs.operatorDecision.localDecisionOnly, true)
  assert.match(result.outputs.assetDescriptor.truthStatus, /not mesh truth/)
  assert.equal(result.outputs.localRunManifest.schema, 'media.local_run_manifest.v1')
  assert.equal(result.outputs.localRunManifest.mode, 'standalone-local')
  assert.equal(result.outputs.localRunManifest.operatorGuidanceOnly, true)
  assert.equal(result.outputs.localRunManifest.localOnly, true)
  assert.equal(result.outputs.localRunManifest.meshTruth, false)
  assert.equal(result.outputs.localRunManifest.distributedProof, false)
  assert.equal(result.outputs.localRunManifest.ratifiedSharedState, false)
  assert.equal(result.outputs.assetDescriptor.localRef.schema, 'media.local_ref.v1')
  assert.equal(result.outputs.assetDescriptor.localRef.placementClass, 'media-accepted')
  assert.equal(result.outputs.assetDescriptor.localRef.path, 'media/accepted/candidate.txt')
  assert.equal(result.outputs.workPacket.meshTruth, false)
  assert.equal(result.outputs.providerJobResult.distributedProof, false)
  assert.equal(result.outputs.operatorDecision.ratifiedSharedState, false)
  assert.equal(result.outputs.assetDescriptor.provenance.lifecycle.schema, 'media.asset_lifecycle.v1')
  assert.equal(result.projectLayout.schema, 'media.project_layout.v1')
  assert.equal(validateRequiredRecord(result.projectLayout), true)

  const decision = JSON.parse(
    await readFile(path.join(dir, 'records', 'decisions', 'media-operator-decision.local.json'), 'utf8')
  )
  assert.equal(decision.decisionType, 'accept')

  const manifest = JSON.parse(
    await readFile(path.join(dir, 'records', 'manifests', 'media-local-run-manifest.local.json'), 'utf8')
  )
  assert.equal(manifest.hashes.candidate.algorithm, 'sha256')
  assert.ok(manifest.artifactKinds.includes('media.provider_job_result.local.v1'))
  assert.ok(manifest.artifactKinds.includes('media.local_ref.v1'))
  assert.ok(manifest.artifactKinds.includes('media.asset_lifecycle.v1'))
  assert.ok(manifest.doctrineLabels.includes('not provider truth'))
  assert.equal(manifest.generatedRecordRefs[0].path, 'records/work-packets/media-work-packet.local.json')
})

test('local refs accept safe project-relative paths', () => {
  const localRef = createLocalRef({
    placementClass: placementClasses.mediaAccepted,
    relativePath: 'media/accepted/candidate.txt',
    contentType: 'text/plain'
  })

  assert.equal(localRef.schema, 'media.local_ref.v1')
  assert.equal(localRef.localOnly, true)
  assert.equal(localRef.meshTruth, false)
  assert.equal(validateRequiredRecord(localRef), true)
})

test('local refs block unsafe paths', () => {
  for (const unsafePath of [
    '/tmp/candidate.txt',
    '../candidate.txt',
    'media/../candidate.txt',
    '~/candidate.txt',
    'https://example.com/candidate.txt',
    'file:///tmp/candidate.txt',
    'media\\accepted\\candidate.txt'
  ]) {
    assert.throws(
      () => assertSafeLocalPath(unsafePath),
      /Local ref path/
    )
  }
})

test('placement class validation rejects unknown classes', () => {
  assert.equal(assertPlacementClass(placementClasses.mediaGenerated), true)

  assert.throws(
    () => assertPlacementClass('media-final'),
    /Invalid placement class/
  )
})

test('lifecycle state validation rejects unknown states', () => {
  assert.equal(assertLifecycleState('accepted'), true)

  assert.throws(
    () => assertLifecycleState('approved'),
    /Invalid asset lifecycle state/
  )
})

test('asset lifecycle helper creates local-only lifecycle records', () => {
  const lifecycle = createAssetLifecycle({
    assetId: 'asset-test',
    projectId: 'project-test',
    state: 'accepted',
    refs: [],
    reason: 'test'
  })

  assert.equal(lifecycle.schema, 'media.asset_lifecycle.v1')
  assert.equal(lifecycle.localOnly, true)
  assert.equal(lifecycle.meshTruth, false)
  assert.equal(validateRequiredRecord(lifecycle), true)
})

test('validator rejects missing schema', async () => {
  const record = { packetId: 'packet-test' }

  assert.throws(
    () => validateRequiredRecord(record),
    /missing schema/
  )
})

test('validator rejects missing id for known record type', async () => {
  const dir = await createFixtureProject()
  const result = await runFirstWedge({ projectDir: dir })
  const record = { ...result.outputs.workPacket }
  delete record.packetId

  assert.throws(
    () => validateRequiredRecord(record),
    /missing required fields: packetId/
  )
})

test('validator rejects missing projectId where expected', async () => {
  const dir = await createFixtureProject()
  const result = await runFirstWedge({ projectDir: dir })
  const record = { ...result.outputs.assetDescriptor }
  delete record.projectId

  assert.throws(
    () => validateRequiredRecord(record),
    /missing required fields: projectId/
  )
})

test('validator rejects missing local-only doctrine flags', async () => {
  const dir = await createFixtureProject()
  const result = await runFirstWedge({ projectDir: dir })
  const record = { ...result.outputs.reviewEvidence }
  delete record.localOnly

  assert.throws(
    () => validateRequiredRecord(record),
    /localOnly=true/
  )
})

test('validator rejects invalid readiness state', async () => {
  const dir = await createFixtureProject()
  const result = await runFirstWedge({ projectDir: dir })
  const record = {
    ...result.outputs.readiness,
    state: 'approved'
  }

  assert.throws(
    () => validateRequiredRecord(record),
    /invalid readiness state/
  )
})

test('validator rejects invalid decision type', async () => {
  const dir = await createFixtureProject()
  const result = await runFirstWedge({ projectDir: dir })
  const record = {
    ...result.outputs.operatorDecision,
    decisionType: 'approve'
  }

  assert.throws(
    () => validateRequiredRecord(record),
    /invalid decision type/
  )
})
