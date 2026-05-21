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
  mediaProviderLoopStatusLocal: 'media.provider_loop_status.local.v1',
  mediaReferenceIngestLocal: 'media.reference_ingest.local.v1',
  mediaDerivativeLocal: 'media.derivative.local.v1',
  mediaCandidateReviewLocal: 'media.candidate_review.local.v1',
  mediaProjectStatusLocal: 'media.project_status.local.v1',
  mediaProjectHealthLocal: 'media.project_health.local.v1',
  mediaContinuityEvidenceLocal: 'media.continuity_evidence.local.v1',
  mediaControlSurfaceProjectionLocal: 'media.control_surface_projection.local.v1',
  mediaEdgeReviewEvidenceLocal: 'media.edge_review_evidence.local.v1',
  mediaEdgeCompatibilityBundleLocal: 'media.edge_compatibility_bundle.local.v1',
  mediaOperatorPacketIndexLocal: 'media.operator_packet_index.local.v1',
  mediaEdgeHandoffCandidateLocal: 'media.edge_handoff_candidate.local.v1',
  mediaOperatorDecisionRequestLocal: 'media.operator_decision_request.local.v1',
  mediaCrossProjectInspectionInputListLocal: 'media.cross_project_inspection_input_list.local.v1',
  mediaCrossProjectOperatorIndexLocal: 'media.cross_project_operator_index.local.v1',
  mediaProductionUnit: 'media.production_unit.v1',
  mediaReferencePrimitive: 'media.reference_primitive.v1',
  mediaContinuityBand: 'media.continuity_band.v1',
  mediaRenderStrategy: 'media.render_strategy.v1',
  mediaProductionDescriptorLocal: 'media.production_descriptor.local.v1',
  mediaProductionAssetCapsuleLocal: 'media.production_asset_capsule.local.v1',
  mediaProductionBundleLocal: 'media.production_bundle.local.v1',
  mediaProductionAuthorityPrerequisitesLocal: 'media.production_authority_prerequisites.summary.local.v1',
  mediaAuthorityHandoffCandidateLocal: 'media.authority_handoff_candidate.local.v1',
  mediaRoughCutCapsuleLocal: 'media.rough_cut_capsule.local.v1',
  mediaRenderExportCandidateLocal: 'media.render_export_candidate.local.v1',
  mediaRenderAdapterContractLocal: 'media.render_adapter_contract.local.v1',
  mediaRenderPlanCandidateLocal: 'media.render_plan_candidate.local.v1',
  mediaRenderReceiptLocal: 'media.render_receipt.local.v1',
  mediaExportCandidateLocal: 'media.export_candidate.local.v1',
  mediaExportPlanCandidateLocal: 'media.export_plan_candidate.local.v1',
  mediaExportReceiptLocal: 'media.export_receipt.local.v1',
  mediaApprovalProposalLocal: 'media.approval_proposal.local.v1',
  mediaByteDescriptorProposalLocal: 'media.byte_descriptor_proposal.local.v1',
  mediaLocalLayerResourceRefCandidateLocal: 'media.local_layer_resource_ref_candidate.local.v1',
  mediaOperationCandidateLocal: 'media.operation_candidate.local.v1',
  mediaRuleResolutionTraceLocal: 'media.rule_resolution_trace.local.v1'
})

export const knownArtifactKinds = Object.freeze(Object.values(artifactKinds))

export const futureCandidateArtifactKinds = Object.freeze({
  mediaLocalLayerProjectionCandidateLocal: 'media.local_layer_projection_candidate.local.v1'
})

export function assertKnownArtifactKind(kind) {
  if (!knownArtifactKinds.includes(kind)) {
    throw new Error(`Unknown artifact kind: ${kind}`)
  }

  return true
}
