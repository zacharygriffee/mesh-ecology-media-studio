import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { makeRef, nowIso } from '../contracts/constructors.js'
import { validateRequiredRecord } from '../contracts/schemas.js'
import { assertSafeLocalPath } from '../local/project-layout.js'

const truthStatus = 'not mesh truth; not distributed proof; not ratified shared state'

export function classifyProviderFailure({ providerId, httpStatus, responseJson }) {
  const providerError = responseJson?.error
  const providerCode = providerError?.code ?? responseJson?.code
  const providerMessage = providerError?.message ?? responseJson?.message
  let failureKind = 'provider-failed'
  let retriable = false

  if (httpStatus === 401 || httpStatus === 403) {
    failureKind = 'auth-failure'
  } else if (httpStatus === 429) {
    failureKind = 'rate-limit'
    retriable = true
  } else if (httpStatus >= 500) {
    failureKind = 'provider-failed'
    retriable = true
  } else if (httpStatus >= 400) {
    failureKind = 'request-rejected'
  }

  return {
    providerId,
    failureKind,
    httpStatus,
    providerCode,
    retriable,
    summary: providerMessage
      ? `${providerId} returned ${httpStatus}: ${providerMessage}`
      : `${providerId} returned HTTP ${httpStatus}`,
    localOnly: true,
    meshTruth: false,
    providerTruth: false
  }
}

export function createProviderFailureEvidence({
  projectId,
  generationRequest,
  providerResult,
  classification,
  createdAt = nowIso()
}) {
  const evidence = {
    schema: 'media.evidence.v1',
    evidenceId: `provider-failure-${providerResult.resultId}`,
    evidenceKind: 'provider-failure-classification',
    projectId,
    subjectRef: makeRef('media-provider-result', providerResult.resultId, providerResult.schema),
    source: {
      sourceType: 'provider-adapter-runner',
      mode: 'standalone-local',
      providerId: providerResult.providerId,
      classification,
      providerTruth: false
    },
    summary: classification.summary,
    refs: [
      makeRef('media-generation-request', generationRequest.requestId, generationRequest.schema),
      makeRef('media-provider-result', providerResult.resultId, providerResult.schema)
    ],
    classificationOnly: true,
    localOnly: true,
    meshTruth: false,
    distributedProof: false,
    ratifiedSharedState: false,
    localTruthLabel: 'local evidence',
    truthStatus,
    createdAt
  }

  validateRequiredRecord(evidence)

  return evidence
}

export async function writeProviderFailureEvidenceRecord({
  projectDir,
  generationRequest,
  providerResult,
  classification,
  recordRef = 'records/evidence/provider-failure-evidence.local.json'
}) {
  assertSafeLocalPath(recordRef)

  const evidence = createProviderFailureEvidence({
    projectId: generationRequest.projectId,
    generationRequest,
    providerResult,
    classification
  })
  const outputPath = path.join(projectDir, recordRef)
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`)

  return {
    evidence,
    recordRef
  }
}
