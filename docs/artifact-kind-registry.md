# Artifact Kind Registry

Known Studio artifact kinds:

- `media.card.v1`
- `media.work_packet.v1`
- `media.provider_job_result.local.v1`
- `media.asset.descriptor.v1`
- `media.evidence.v1`
- `media.readiness.v1`
- `media.operator_decision.v1`
- `media.local_run_manifest.v1`
- `media.project_layout.v1`
- `media.local_ref.v1`
- `media.asset_lifecycle.v1`
- `media.generation_request.v1`
- `media.provider_profile.v1`
- `media.provider_capability.v1`
- `media.provider_result.v1`
- `media.provider_shape.v1`
- `media.provider_endpoint_shape.v1`
- `media.provider_mapping.v1`
- `media.edge_inspection_packet.local.v1`
- `media.byte_reference.preview.local.v1`
- `media.provider_adapter_contract.v1`
- `media.provider_failure_taxonomy.v1`
- `media.image_metadata.local.v1`
- `media.provider_adapter_run.local.v1`
- `media.edge_export_bundle.local.v1`
- `media.provider_run_ledger.local.v1`
- `media.provider_loop_status.local.v1`
- `media.reference_ingest.local.v1`
- `media.derivative.local.v1`
- `media.candidate_review.local.v1`
- `media.project_status.local.v1`
- `media.project_health.local.v1`
- `media.continuity_evidence.local.v1`
- `media.control_surface_projection.local.v1`
- `media.edge_review_evidence.local.v1`
- `media.edge_compatibility_bundle.local.v1`
- `media.operator_packet_index.local.v1`
- `media.edge_handoff_candidate.local.v1`
- `media.operator_decision_request.local.v1`
- `media.cross_project_inspection_input_list.local.v1`
- `media.cross_project_operator_index.local.v1`
- `media.production_unit.v1`
- `media.reference_primitive.v1`
- `media.continuity_band.v1`
- `media.render_strategy.v1`
- `media.production_descriptor.local.v1`
- `media.production_asset_capsule.local.v1`
- `media.approval_proposal.local.v1`
- `media.byte_descriptor_proposal.local.v1`
- `media.local_layer_resource_ref_candidate.local.v1`
- `media.operation_candidate.local.v1`
- `media.rule_resolution_trace.local.v1`

`media.operation_candidate.local.v1` and
`media.rule_resolution_trace.local.v1` are local-only mediation artifacts. They
describe candidate operations and mediation pressure; they do not execute work
or grant authority.

Future candidate artifact kinds, not implemented and not active schema
contracts:

- `media.local_layer_projection_candidate.local.v1`

This registry is intentionally small. It prevents naming drift while the local
wedge remains standalone-local and Edge-compatible without implementing Edge
integration.
