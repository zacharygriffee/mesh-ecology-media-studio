import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { artifactKinds } from '../contracts/artifact-kinds.js'
import { makeRef, nowIso } from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import { assertSafeLocalPath } from '../local/project-layout.js'
import { readProjectRecords } from '../seams/project-status.js'

const modulePath = fileURLToPath(import.meta.url)
const defaultProjectDir = 'examples/venice-smoke'
const defaultOutput = 'records/production/media-production-bundle.local.json'
const truthStatus = 'not mesh truth; not distributed proof; not ratified shared state'

function parseArgs(argv) {
  const args = {
    projectDir: defaultProjectDir,
    output: defaultOutput,
    print: false,
    quiet: false
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]

    if (arg === '--project-dir') {
      args.projectDir = next
      i += 1
    } else if (arg === '--output') {
      args.output = next
      i += 1
    } else if (arg === '--print') {
      args.print = true
    } else if (arg === '--quiet') {
      args.quiet = true
    }
  }

  return args
}

export async function writeProductionBundle({
  projectDir = defaultProjectDir,
  output = defaultOutput,
  print = false,
  quiet = false,
  createdAt = nowIso()
} = {}) {
  assertSafeLocalPath(output)

  const root = path.resolve(projectDir)
  const records = await readProjectRecords(root)
  const bundle = createProductionBundleFromRecords({
    records,
    createdAt
  })

  const outputPath = path.join(root, output)
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(bundle, null, 2)}\n`)

  if (print) {
    console.log(JSON.stringify(bundle, null, 2))
  } else if (!quiet) {
    console.log(formatProductionBundleSummary(bundle, output))
    console.log(`nextAction: ${bundle.productionPosture.nextAction}`)
    console.log('nonClaims: local-only; no mesh truth; no provider truth; no byte/materialization proof; no resource admission; no approval authority')
  }

  return {
    bundle,
    output
  }
}

export function createProductionBundleFromRecords({
  records,
  createdAt = nowIso()
}) {
  const capsules = records
    .filter((entry) => entry.record.schema === artifactKinds.mediaProductionAssetCapsuleLocal)
    .sort(compareRecordCreatedAt)
  const projectId = capsules[0]?.record.projectId ??
    records.find((entry) => typeof entry.record.projectId === 'string')?.record.projectId ??
    'unknown-project'
  const capsuleRefs = capsules.map((entry) =>
    localRecordRef('media-production-asset-capsule', entry.record.capsuleId, entry.record.schema, entry.path)
  )
  const assetRefs = compactRefs(capsules.map((entry) => ({
    ...entry.record.subjectAssetRef,
    localOnly: true
  })))
  const contentRefs = compactRefs(capsules.map((entry) => ({
    ...entry.record.contentRef,
    localOnly: true
  })))
  const blockers = []
  if (capsuleRefs.length === 0) blockers.push('production_capsules_missing')
  blockers.push('authority_not_granted')

  const bundle = {
    schema: artifactKinds.mediaProductionBundleLocal,
    bundleId: `production-bundle-${stableId([
      projectId,
      ...capsuleRefs.map((ref) => ref.id)
    ].join('|'))}`,
    projectId,
    bundleKind: 'production-capsule-set',
    capsuleRefs,
    assetRefs,
    contentRefs,
    productionPosture: {
      state: capsuleRefs.length > 0 ? 'review-only-bundle' : 'needs-capsules',
      productionReady: false,
      capsuleCount: capsuleRefs.length,
      blockers,
      nextAction: capsuleRefs.length > 0
        ? 'Inspect bundled capsules and route approval proposals through the proper authority lane before production use.'
        : 'Run npm run production:capsule for accepted generated assets before creating a useful production bundle.',
      localOnly: true,
      operatorGuidanceOnly: true
    },
    notes: [
      'This bundle groups local production asset capsule refs for operator inspection only.',
      'It does not copy media bytes, publish to mesh, call Edge, grant approval, or prove availability.',
      'Capsules remain asset-level packages; this bundle is a review grouping over those refs.'
    ],
    createdAt,
    operatorGuidanceOnly: true,
    productionReady: false,
    approvalAuthority: false,
    ratifierAuthority: false,
    publicationAuthorization: false,
    providerTruth: false,
    byteAvailabilityProof: false,
    materializationProof: false,
    resourceAdmission: false,
    causalTruth: false,
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    localTruthLabel: 'local production bundle',
    truthStatus
  }

  validateRequiredRecord(bundle)
  return bundle
}

export function formatProductionBundleSummary(bundle, output = defaultOutput) {
  return [
    `production bundle: project=${bundle.projectId}`,
    `capsules=${bundle.capsuleRefs.length}`,
    `assets=${bundle.assetRefs.length}`,
    `contents=${bundle.contentRefs.length}`,
    `state=${bundle.productionPosture.state}`,
    `productionReady=${bundle.productionReady}`,
    `output=${output}`
  ].join(' | ')
}

function localRecordRef(kind, id, schema, relativePath) {
  return {
    ...makeRef(kind, id, schema),
    path: relativePath,
    localOnly: true
  }
}

function compactRefs(refs) {
  const output = []
  const seen = new Set()
  for (const ref of refs.filter((candidate) => candidate?.id)) {
    const key = `${ref.schema}:${ref.id}:${ref.path ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    output.push(ref)
  }
  return output
}

function compareRecordCreatedAt(left, right) {
  const rightTime = Date.parse(right.record?.createdAt ?? '') || 0
  const leftTime = Date.parse(left.record?.createdAt ?? '') || 0
  if (rightTime !== leftTime) return rightTime - leftTime
  return left.path.localeCompare(right.path)
}

function stableId(seed) {
  return createHash('sha256').update(seed).digest('hex').slice(0, 24)
}

if (process.argv[1] === modulePath) {
  await writeProductionBundle(parseArgs(process.argv.slice(2)))
}
