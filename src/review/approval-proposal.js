import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { artifactKinds } from '../contracts/artifact-kinds.js'
import { makeRef, nowIso } from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import { assertSafeLocalPath } from '../local/project-layout.js'

const modulePath = fileURLToPath(import.meta.url)
const truthStatus = 'not mesh truth; not distributed proof; not ratified shared state'
const defaultProjectDir = 'examples/card-to-candidate'
const defaultDecision = 'records/decisions/media-operator-decision.local.json'
const defaultAsset = 'records/assets/media-asset-descriptor.local.json'
const defaultOutput = 'records/approvals/media-approval-proposal.local.json'

function parseArgs(argv) {
  const args = {
    projectDir: defaultProjectDir,
    decision: defaultDecision,
    asset: defaultAsset,
    output: defaultOutput
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]

    if (arg === '--project-dir') {
      args.projectDir = next
      i += 1
    } else if (arg === '--decision') {
      args.decision = next
      i += 1
    } else if (arg === '--asset') {
      args.asset = next
      i += 1
    } else if (arg === '--output') {
      args.output = next
      i += 1
    }
  }

  return args
}

export async function writeApprovalProposal({
  projectDir = defaultProjectDir,
  decision = defaultDecision,
  asset = defaultAsset,
  output = defaultOutput
} = {}) {
  assertSafeLocalPath(decision)
  assertSafeLocalPath(asset)
  assertSafeLocalPath(output)

  const root = path.resolve(projectDir)
  const localDecision = JSON.parse(await readFile(path.join(root, decision), 'utf8'))
  const assetDescriptor = JSON.parse(await readFile(path.join(root, asset), 'utf8'))
  validateRequiredRecord(localDecision, artifactKinds.mediaOperatorDecision)
  validateRequiredRecord(assetDescriptor, artifactKinds.mediaAssetDescriptor)

  const proposal = createApprovalProposal({
    projectId: assetDescriptor.projectId,
    subjectRef: localDecision.subjectRef,
    localDecision,
    localDecisionPath: decision,
    evidenceRefs: localDecision.evidenceRefs,
    proposedDecision: localDecision.decisionType
  })

  const outputPath = path.join(root, output)
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(proposal, null, 2)}\n`)

  console.log(`approval proposal: ${output}`)
  console.log('authority: required elsewhere; not granted locally')

  return {
    proposal,
    output
  }
}

export function createApprovalProposal({
  projectId,
  subjectRef,
  localDecision,
  localDecisionPath,
  evidenceRefs = [],
  proposedDecision,
  createdAt = nowIso()
}) {
  const decisionType = proposedDecision ?? localDecision?.decisionType
  const proposalType = proposalTypeForDecision(decisionType)
  const proposal = {
    schema: artifactKinds.mediaApprovalProposalLocal,
    proposalId: `approval-proposal-${projectId}-${subjectRef.id}`,
    projectId,
    subjectRef,
    proposalType,
    proposedDecision: decisionType,
    status: 'proposed',
    localDecisionRef: {
      ...makeRef('media-operator-decision', localDecision.decisionId, localDecision.schema),
      path: localDecisionPath,
      localOnly: true
    },
    evidenceRefs,
    authorityRequired: true,
    proposalOnly: true,
    operatorGuidanceOnly: true,
    approvalAuthority: false,
    ratifierAuthority: false,
    publicationAuthorization: false,
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    localTruthLabel: 'local proposal',
    truthStatus,
    createdAt
  }

  validateRequiredRecord(proposal)
  return proposal
}

function proposalTypeForDecision(decisionType) {
  if (decisionType === 'accept') return 'acceptance-approval'
  if (decisionType === 'reject') return 'rejection-approval'
  if (decisionType === 'request_changes') return 'rejection-approval'
  if (decisionType === 'defer') return 'rejection-approval'
  throw new Error(`Unsupported local decision for approval proposal: ${decisionType}`)
}

if (process.argv[1] === modulePath) {
  await writeApprovalProposal(parseArgs(process.argv.slice(2)))
}
