import { artifactKinds } from '../contracts/artifact-kinds.js'

const layerRefPattern = /^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/

export function collectLayerInteropOptions(argv) {
  const options = {}

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]

    if (arg === '--layer-ref') {
      options.layerRef = next
      i += 1
    } else if (arg === '--layer-profile-ref') {
      options.layerProfileRef = next
      i += 1
    } else if (arg === '--layer-continuity-ref') {
      options.continuityRef = next
      i += 1
    } else if (arg === '--layer-desync-posture-ref') {
      options.desyncPostureRef = next
      i += 1
    } else if (arg === '--layer-rbc-profile-ref') {
      options.rbcProfileRefs = [...(options.rbcProfileRefs ?? []), next]
      i += 1
    }
  }

  return options
}

export function createLayerInteropPosture({
  layerRef,
  layerProfileRef,
  continuityRef,
  desyncPostureRef,
  rbcProfileRefs = []
} = {}) {
  const normalizedRbcRefs = rbcProfileRefs.filter(Boolean).map((id) => layerInteropRef('rbc-profile', id))
  const refsAttached = Boolean(layerRef && layerProfileRef)

  return {
    postureKind: 'mesh-ecology-layer-import-refs',
    repoRef: 'mesh-ecology-layer',
    layerContractRefs: [
      layerInteropRef('layer-contract', 'layer-profile.v0'),
      layerInteropRef('layer-contract', 'layer-continuity-ref.v0'),
      layerInteropRef('layer-contract', 'layer-desync-posture.v0'),
      layerInteropRef('layer-contract', 'layer-continuity-substrate-selection-review.v0')
    ],
    interopState: refsAttached ? 'layer-refs-attached-review-only' : 'layer-refs-not-attached',
    layerRef: layerRef ? layerInteropRef('layer', layerRef) : null,
    layerProfileRef: layerProfileRef ? layerInteropRef('layer-profile', layerProfileRef) : null,
    continuityRef: continuityRef ? layerInteropRef('layer-continuity-ref', continuityRef) : null,
    desyncPostureRef: desyncPostureRef ? layerInteropRef('layer-desync-posture', desyncPostureRef) : null,
    rbcProfileRefs: normalizedRbcRefs,
    eventFamilyRefs: [
      {
        kind: 'layer-event-family',
        id: 'operator_recorded_local_layer_decision',
        candidateOnly: true,
        localOnly: true
      }
    ],
    substratePosture: {
      substrateSelected: false,
      durableAppendApproved: false,
      continuitySubstrateRef: layerInteropRef('continuity-substrate', 'continuity-substrate:candidate:unselected'),
      localOnly: true,
      operatorGuidanceOnly: true
    },
    scaffoldPosture: {
      localJsonIsScaffold: true,
      rendererOutputIsScaffold: true,
      deviceLocalFileIsScaffold: true,
      repoPathIsScaffold: true,
      localOnly: true
    },
    nonClaims: {
      layerProfileIsRuntime: false,
      layerProfileIsStorageBackend: false,
      layerProfileIsAuthority: false,
      layerRefsGrantAdmission: false,
      durableAppendApproved: false,
      continuityClaimed: false,
      rendererOutputIsContinuity: false,
      localJsonIsLayerAuthority: false,
      addressabilityIsIdentity: false,
      productionReady: false
    },
    localOnly: true,
    operatorGuidanceOnly: true
  }
}

export function summarizeLayerInteropFromRecords(records = []) {
  const postureEntries = records
    .filter((entry) =>
      entry.record?.schema === artifactKinds.mediaAuthorityHandoffCandidateLocal ||
      entry.record?.schema === artifactKinds.mediaProductionAuthorityPrerequisitesLocal
    )
    .filter((entry) => entry.record.layerInteropPosture)
    .sort((left, right) => (Date.parse(right.record.createdAt ?? '') || 0) - (Date.parse(left.record.createdAt ?? '') || 0))
  const latest = postureEntries[0]?.record.layerInteropPosture ?? createLayerInteropPosture()
  const layerRefs = compactLayerRefs(postureEntries.map((entry) => entry.record.layerInteropPosture.layerRef))
  const layerProfileRefs = compactLayerRefs(postureEntries.map((entry) => entry.record.layerInteropPosture.layerProfileRef))
  const continuityRefs = compactLayerRefs(postureEntries.map((entry) => entry.record.layerInteropPosture.continuityRef))
  const desyncPostureRefs = compactLayerRefs(postureEntries.map((entry) => entry.record.layerInteropPosture.desyncPostureRef))
  const rbcProfileRefs = compactLayerRefs(postureEntries.flatMap((entry) => entry.record.layerInteropPosture.rbcProfileRefs ?? []))
  const attached = postureEntries.some((entry) =>
    entry.record.layerInteropPosture.interopState === 'layer-refs-attached-review-only'
  )
  const issueCodes = layerInteropIssueCodes({
    layerRefs,
    layerProfileRefs,
    continuityRefs,
    desyncPostureRefs,
    rbcProfileRefs
  })
  const attentionRows = issueCodes.length > 0
    ? [{
        subjectRef: {
          kind: 'mesh-ecology-layer-interoperability',
          id: 'layer-interop-posture',
          repoRef: 'mesh-ecology-layer',
          localOnly: true,
          authorityGranted: false
        },
        subjectKind: 'layer-interop-posture',
        healthState: 'needs-local-attention',
        issueCodes,
        summary: `Layer interop refs disagree across local authority posture records: ${issueCodes.join(', ')}.`,
        nextAction: 'Regenerate authority prerequisite and handoff records with the same intended Layer refs, or remove stale authority posture records.',
        sourceRefs: postureEntries.map((entry) => ({
          kind: entry.record.schema === artifactKinds.mediaAuthorityHandoffCandidateLocal
            ? 'media-authority-handoff-candidate'
            : 'media-production-authority-prerequisites',
          id: entry.record.handoffCandidateId ?? entry.record.reportId,
          path: entry.relativePath ?? entry.path,
          schema: entry.record.schema,
          localOnly: true
        })),
        nonClaims: {
          layerAuthority: false,
          continuityClaimed: false,
          durableAppendApproved: false,
          productionReady: false
        },
        localOnly: true,
        operatorGuidanceOnly: true
      }]
    : []

  return {
    state: attached ? 'layer-refs-attached-review-only' : 'layer-refs-not-attached',
    postureRecords: postureEntries.length,
    authorityHandoffRecords: postureEntries.filter((entry) => entry.record.schema === artifactKinds.mediaAuthorityHandoffCandidateLocal).length,
    authorityPrerequisiteRecords: postureEntries.filter((entry) => entry.record.schema === artifactKinds.mediaProductionAuthorityPrerequisitesLocal).length,
    layerRefs,
    layerProfileRefs,
    continuityRefs,
    desyncPostureRefs,
    rbcProfileRefs,
    issueCodes,
    attentionRows,
    needsOperatorAttention: attentionRows.length > 0,
    durableAppendApproved: false,
    substrateSelected: false,
    continuityClaimed: false,
    layerAuthority: false,
    layerProfileIsRuntime: false,
    layerProfileIsStorageBackend: false,
    rendererOutputIsContinuity: false,
    localJsonIsLayerAuthority: false,
    latestPosture: latest,
    localOnly: true,
    operatorGuidanceOnly: true
  }
}

function layerInteropRef(kind, id) {
  assertLayerRef(id)
  return {
    kind,
    id,
    repoRef: 'mesh-ecology-layer',
    localOnly: true,
    authorityGranted: false
  }
}

function assertLayerRef(ref) {
  if (typeof ref !== 'string' || !layerRefPattern.test(ref)) {
    throw new Error(`Invalid mesh-ecology-layer ref: ${ref}`)
  }
}

function compactLayerRefs(refs) {
  const output = []
  const seen = new Set()
  for (const ref of refs.filter((candidate) => candidate?.id)) {
    const key = `${ref.kind}:${ref.id}`
    if (seen.has(key)) continue
    seen.add(key)
    output.push(ref)
  }
  return output
}

function layerInteropIssueCodes({
  layerRefs,
  layerProfileRefs,
  continuityRefs,
  desyncPostureRefs,
  rbcProfileRefs
}) {
  return [
    layerRefs.length > 1 ? 'layer_ref_mismatch' : null,
    layerProfileRefs.length > 1 ? 'layer_profile_ref_mismatch' : null,
    continuityRefs.length > 1 ? 'layer_continuity_ref_mismatch' : null,
    desyncPostureRefs.length > 1 ? 'layer_desync_posture_ref_mismatch' : null,
    rbcProfileRefs.length > 1 ? 'layer_rbc_profile_ref_mismatch' : null
  ].filter(Boolean)
}
