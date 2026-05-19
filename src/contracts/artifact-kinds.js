export const artifactKinds = Object.freeze({
  mediaCard: 'media.card.v1',
  mediaWorkPacket: 'media.work_packet.v1',
  mediaProviderJobResultLocal: 'media.provider_job_result.local.v1',
  mediaAssetDescriptor: 'media.asset.descriptor.v1',
  mediaEvidence: 'media.evidence.v1',
  mediaReadiness: 'media.readiness.v1',
  mediaOperatorDecision: 'media.operator_decision.v1',
  mediaLocalRunManifest: 'media.local_run_manifest.v1'
})

export const knownArtifactKinds = Object.freeze(Object.values(artifactKinds))

export function assertKnownArtifactKind(kind) {
  if (!knownArtifactKinds.includes(kind)) {
    throw new Error(`Unknown artifact kind: ${kind}`)
  }

  return true
}
