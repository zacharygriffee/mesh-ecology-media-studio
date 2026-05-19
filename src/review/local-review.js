import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import {
  createOperatorDecision,
  createReadiness,
  createReviewEvidence,
  makeRef
} from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import { assertSafeLocalPath } from '../local/project-layout.js'

export async function writeLocalAssetReview({
  projectDir,
  card,
  assetDescriptor,
  decision = 'accepted',
  operatorRef = 'local-operator',
  recordPrefix = 'local-review',
  summary = `Local review recorded ${decision} for generated provider output.`
}) {
  if (!['accepted', 'rejected'].includes(decision)) {
    throw new Error('review decision must be accepted or rejected')
  }

  const reviewEvidence = createReviewEvidence({
    card,
    assetDescriptor,
    summary
  })
  const readiness = createReadiness({
    subjectRef: makeRef('media-asset', assetDescriptor.assetId, assetDescriptor.schema),
    state: decision === 'accepted' ? 'complete' : 'caution',
    reasons: [`generated asset locally ${decision}`],
    nextActions: decision === 'accepted'
      ? ['candidate is ready for later Edge inspection if Mode 1 is needed']
      : ['revise card or provider hints before another provider attempt']
  })
  const operatorDecision = createOperatorDecision({
    assetDescriptor,
    reviewEvidence,
    operatorRef,
    decision,
    reason: `Local operator marked generated asset ${decision}.`
  })

  validateRequiredRecord(reviewEvidence)
  validateRequiredRecord(readiness)
  validateRequiredRecord(operatorDecision)

  const evidenceRecordRef = `records/evidence/${recordPrefix}-evidence.local.json`
  const readinessRecordRef = `records/readiness/${recordPrefix}-readiness.local.json`
  const decisionRecordRef = `records/decisions/${recordPrefix}-decision.local.json`

  for (const recordRef of [evidenceRecordRef, readinessRecordRef, decisionRecordRef]) {
    assertSafeLocalPath(recordRef)
    await mkdir(path.dirname(path.join(projectDir, recordRef)), { recursive: true })
  }

  await writeFile(path.join(projectDir, evidenceRecordRef), `${JSON.stringify(reviewEvidence, null, 2)}\n`)
  await writeFile(path.join(projectDir, readinessRecordRef), `${JSON.stringify(readiness, null, 2)}\n`)
  await writeFile(path.join(projectDir, decisionRecordRef), `${JSON.stringify(operatorDecision, null, 2)}\n`)

  return {
    reviewEvidence,
    readiness,
    operatorDecision,
    recordRefs: {
      reviewEvidence: evidenceRecordRef,
      readiness: readinessRecordRef,
      operatorDecision: decisionRecordRef
    }
  }
}
