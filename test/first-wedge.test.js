import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { runFirstWedge } from '../src/local/run-first-wedge.js'

test('first wedge creates local records without claiming mesh truth', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'media-studio-wedge-'))
  await mkdir(path.join(dir, 'input'), { recursive: true })
  await mkdir(path.join(dir, 'local-media'), { recursive: true })

  await writeFile(path.join(dir, 'input', 'card.json'), JSON.stringify({
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
  await writeFile(path.join(dir, 'local-media', 'candidate.txt'), 'candidate bytes')

  const result = await runFirstWedge({
    projectDir: dir,
    decision: 'accepted',
    operatorRef: 'operator-test'
  })

  assert.equal(result.outputs.workPacket.schema, 'media.work_packet.v1')
  assert.equal(result.outputs.assetDescriptor.schema, 'media.asset.descriptor.v1')
  assert.equal(result.outputs.operatorDecision.localDecisionOnly, true)
  assert.match(result.outputs.assetDescriptor.truthStatus, /not mesh truth/)

  const decision = JSON.parse(
    await readFile(path.join(dir, 'out', 'media-operator-decision.local.json'), 'utf8')
  )
  assert.equal(decision.decisionType, 'accept')
})
