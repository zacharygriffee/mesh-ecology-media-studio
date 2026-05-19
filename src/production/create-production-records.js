import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { artifactKinds } from '../contracts/artifact-kinds.js'
import { makeRef } from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import { assertSafeLocalPath } from '../local/project-layout.js'
import {
  createClipDescriptor,
  createContinuityBand,
  createProductionUnit,
  createRenderStrategy,
  createSceneDescriptor,
  createShotDescriptor,
  refForProductionRecord,
  validateProductionDescriptorGraph
} from './strategy.js'

const modulePath = fileURLToPath(import.meta.url)
const defaultProjectDir = 'examples/card-to-candidate'
const defaultCard = 'cards/card.json'
const defaultOutputDir = 'records/production'

function parseArgs(argv) {
  const args = {
    projectDir: defaultProjectDir,
    card: defaultCard,
    outputDir: defaultOutputDir
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]

    if (arg === '--project-dir') {
      args.projectDir = next
      i += 1
    } else if (arg === '--card') {
      args.card = next
      i += 1
    } else if (arg === '--output-dir') {
      args.outputDir = next
      i += 1
    }
  }

  return args
}

export async function writeProductionRecordsFromCard({
  projectDir = defaultProjectDir,
  card = defaultCard,
  outputDir = defaultOutputDir
} = {}) {
  assertSafeLocalPath(card)
  assertSafeLocalPath(outputDir)

  const root = path.resolve(projectDir)
  const cardRecord = JSON.parse(await readFile(path.join(root, card), 'utf8'))
  validateRequiredRecord(cardRecord, artifactKinds.mediaCard)

  const records = createProductionRecordsFromCard({ card: cardRecord })
  const outputs = []

  await mkdir(path.join(root, outputDir), { recursive: true })

  for (const [name, record] of Object.entries(records)) {
    const output = path.posix.join(outputDir, `${name}.local.json`)
    assertSafeLocalPath(output)
    await writeFile(path.join(root, output), `${JSON.stringify(record, null, 2)}\n`)
    outputs.push({ name, output, record })
  }

  console.log(`production records: ${outputs.length}`)
  console.log(`output: ${outputDir}`)

  return {
    records,
    outputs
  }
}

export function createProductionRecordsFromCard({ card }) {
  validateRequiredRecord(card, artifactKinds.mediaCard)

  const sourceRef = makeRef('media-card', card.cardId, card.schema)
  const sceneTitle = card.sceneId ?? `${card.cardId}-scene`
  const shotTitle = card.shotId ?? `${card.cardId}-shot`
  const outputKind = card.kind ?? 'media'
  const inputModes = inputModesForCard(card)
  const fallbackModes = inputModes.includes('reference-to-media')
    ? ['text-to-media']
    : []

  const sceneUnit = createProductionUnit({
    projectId: card.projectId,
    unitKind: 'scene',
    title: sceneTitle,
    purpose: 'Local scene production unit derived from card metadata.',
    sourceRefs: [sourceRef],
    outputIntent: {
      outputKind,
      cardTarget: card.target,
      derivedFromCard: true
    }
  })
  const shotUnit = createProductionUnit({
    projectId: card.projectId,
    unitKind: 'shot',
    title: shotTitle,
    purpose: 'Local shot production unit derived from card metadata.',
    parentRefs: [refForProductionRecord(sceneUnit)],
    sourceRefs: [sourceRef],
    outputIntent: {
      outputKind,
      cardTarget: card.target,
      derivedFromCard: true
    }
  })
  const clipUnit = createProductionUnit({
    projectId: card.projectId,
    unitKind: outputKind === 'audio' ? 'audio-take' : outputKind === 'image' ? 'still' : 'clip',
    title: `${shotTitle}-${outputKind}`,
    purpose: 'Local renderable production unit derived from card target.',
    parentRefs: [refForProductionRecord(shotUnit)],
    sourceRefs: [sourceRef],
    outputIntent: {
      outputKind,
      cardTarget: card.target,
      derivedFromCard: true
    }
  })
  const continuityBand = createContinuityBand({
    projectId: card.projectId,
    bandKind: 'render-pass',
    label: `${card.cardId} render pass continuity`,
    subjectRefs: [
      refForProductionRecord(sceneUnit),
      refForProductionRecord(shotUnit),
      refForProductionRecord(clipUnit)
    ],
    stateAnchors: [
      'card prompt remains source intent',
      'provider output remains candidate until reviewed'
    ],
    riskLevel: card.referenceAssetRefs?.length > 0 ? 'medium' : 'low',
    sourceRefs: [sourceRef]
  })
  const renderStrategy = createRenderStrategy({
    projectId: card.projectId,
    strategyKind: 'classic-scene-shot-clip',
    productionUnitRef: refForProductionRecord(clipUnit),
    inputModes,
    fallbackModes,
    continuityRisk: {
      riskLevel: continuityBand.riskLevel,
      reason: 'Derived local render strategy from card metadata only.'
    },
    providerCapabilityPosture: {
      providerSpecific: false,
      providerHintsAreAdvisory: true,
      providerHints: card.providerHints ?? {}
    },
    referenceBurden: {
      referenceAssetRefs: card.referenceAssetRefs ?? [],
      continuityBandRefs: [refForProductionRecord(continuityBand)]
    },
    recoveryStrategy: [
      'revise card prompt',
      'add reference primitive records',
      'regenerate provider-neutral request'
    ]
  })
  const sceneDescriptor = createSceneDescriptor({
    projectId: card.projectId,
    productionUnitRef: refForProductionRecord(sceneUnit),
    title: sceneTitle,
    continuityBandRefs: [refForProductionRecord(continuityBand)],
    renderStrategyRefs: [refForProductionRecord(renderStrategy)],
    scene: {
      sourceCardId: card.cardId,
      sceneId: card.sceneId ?? null,
      promptRole: 'source intent, not mesh truth'
    }
  })
  const shotDescriptor = createShotDescriptor({
    projectId: card.projectId,
    productionUnitRef: refForProductionRecord(shotUnit),
    title: shotTitle,
    sceneRef: refForProductionRecord(sceneUnit),
    continuityBandRefs: [refForProductionRecord(continuityBand)],
    renderStrategyRefs: [refForProductionRecord(renderStrategy)],
    shot: {
      sourceCardId: card.cardId,
      shotId: card.shotId ?? null,
      target: card.target
    }
  })
  const clipDescriptor = createClipDescriptor({
    projectId: card.projectId,
    productionUnitRef: refForProductionRecord(clipUnit),
    title: `${shotTitle}-${outputKind}`,
    shotRef: refForProductionRecord(shotUnit),
    continuityBandRefs: [refForProductionRecord(continuityBand)],
    renderStrategyRefs: [refForProductionRecord(renderStrategy)],
    clip: {
      sourceCardId: card.cardId,
      outputKind,
      target: card.target,
      candidateOnly: true
    }
  })

  const records = {
    sceneUnit,
    shotUnit,
    clipUnit,
    continuityBand,
    renderStrategy,
    sceneDescriptor,
    shotDescriptor,
    clipDescriptor
  }

  validateProductionDescriptorGraph(Object.values(records))
  return records
}

function inputModesForCard(card) {
  if (card.kind === 'audio') return ['audio-to-media']
  if (card.referenceAssetRefs?.length > 0) return ['reference-to-media', 'text-to-media']
  if (card.kind === 'image' || card.kind === 'video') return ['text-to-media']
  return ['media-transformation']
}

if (process.argv[1] === modulePath) {
  await writeProductionRecordsFromCard(parseArgs(process.argv.slice(2)))
}
