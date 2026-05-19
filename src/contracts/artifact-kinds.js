export const artifactKinds = Object.freeze({
  mediaCard: 'media.card.v1',
  mediaWorkPacket: 'media.work_packet.v1',
  mediaProviderJobResultLocal: 'media.provider_job_result.local.v1',
  mediaAssetDescriptor: 'media.asset.descriptor.v1',
  mediaEvidence: 'media.evidence.v1',
  mediaReadiness: 'media.readiness.v1',
  mediaOperatorDecision: 'media.operator_decision.v1',
  mediaLocalRunManifest: 'media.local_run_manifest.v1',
  mediaProjectLayout: 'media.project_layout.v1',
  mediaLocalRef: 'media.local_ref.v1',
  mediaAssetLifecycle: 'media.asset_lifecycle.v1',
  mediaGenerationRequest: 'media.generation_request.v1',
  mediaProviderProfile: 'media.provider_profile.v1',
  mediaProviderCapability: 'media.provider_capability.v1',
  mediaProviderResult: 'media.provider_result.v1',
  mediaProviderShape: 'media.provider_shape.v1',
  mediaProviderEndpointShape: 'media.provider_endpoint_shape.v1',
  mediaProviderMapping: 'media.provider_mapping.v1',
  mediaEdgeInspectionPacketLocal: 'media.edge_inspection_packet.local.v1',
  mediaByteReferencePreviewLocal: 'media.byte_reference.preview.local.v1',
  mediaProviderAdapterContract: 'media.provider_adapter_contract.v1',
  mediaProviderFailureTaxonomy: 'media.provider_failure_taxonomy.v1',
  mediaImageMetadataLocal: 'media.image_metadata.local.v1',
  mediaProviderAdapterRunLocal: 'media.provider_adapter_run.local.v1',
  mediaEdgeExportBundleLocal: 'media.edge_export_bundle.local.v1',
  mediaProviderRunLedgerLocal: 'media.provider_run_ledger.local.v1',
  mediaReferenceIngestLocal: 'media.reference_ingest.local.v1'
})

export const knownArtifactKinds = Object.freeze(Object.values(artifactKinds))

export function assertKnownArtifactKind(kind) {
  if (!knownArtifactKinds.includes(kind)) {
    throw new Error(`Unknown artifact kind: ${kind}`)
  }

  return true
}
