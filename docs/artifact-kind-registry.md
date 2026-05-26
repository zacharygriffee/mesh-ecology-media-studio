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
- `media.edge_pressure_artifact.local.v1`
- `media.layer_pressure_artifact.local.v1`
- `media.studio_source_pressure_adapter_candidate.local.v1`
- `media.studio_source_pressure_adapter_operator_decision.local.v1`
- `media.studio_source_pressure_observation_result.local.v1`
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
- `media.production_bundle.local.v1`
- `media.production_authority_prerequisites.summary.local.v1`
- `media.authority_handoff_candidate.local.v1`
- `media.publication_authority_request_candidate.local.v1`
- `media.rough_cut_capsule.local.v1`
- `media.render_export_candidate.local.v1`
- `media.render_adapter_contract.local.v1`
- `media.render_plan_candidate.local.v1`
- `media.render_receipt.local.v1`
- `media.export_candidate.local.v1`
- `media.export_plan_candidate.local.v1`
- `media.export_receipt.local.v1`
- `media.approval_proposal.local.v1`
- `media.byte_descriptor_proposal.local.v1`
- `media.local_layer_resource_ref_candidate.local.v1`
- `media.operation_candidate.local.v1`
- `media.rule_resolution_trace.local.v1`

`media.operation_candidate.local.v1` and
`media.rule_resolution_trace.local.v1` are local-only mediation artifacts. They
describe candidate operations and mediation pressure; they do not execute work
or grant authority.

`media.edge_pressure_artifact.local.v1` and
`media.layer_pressure_artifact.local.v1` package Studio-owned source pressure
for Edge and Layer review. They carry local media, operator, production-package,
authority-handoff, and resource-ref candidate refs with non-claims attached. They
do not grant Edge approval, Layer admission, production authority, publication
authorization, mesh publication, accepted continuity, or local-layer authority.

`media.studio_source_pressure_adapter_candidate.local.v1`,
`media.studio_source_pressure_adapter_operator_decision.local.v1`, and
`media.studio_source_pressure_observation_result.local.v1` let Studio present a
bounded Studio-shaped pressure artifact to the generic
`layer_source_pressure_review.v0` seam. They do not create a Studio-specific
Layer API, grant Layer admission, approve durable append, create accepted
continuity, select production storage, mutate writer/reader admission, or make
Edge authority.

`media.authority_handoff_candidate.local.v1` packages local production bundle,
approval proposal, capsule, situated identity, and prerequisite refs for a
future authority lane. It is candidate-only and does not grant approval,
ratification, publication authorization, or production readiness.

`media.publication_authority_request_candidate.local.v1` packages a locally
reviewed, integrity-checked output package for future publication/export
authority review. It is request-only and does not grant export authorization,
publication authorization, ratifier authority, or production readiness.

`media.rough_cut_capsule.local.v1` orders accepted production item refs into a
local review cut. It does not render a timeline, export media, grant authority,
or mark production readiness.

`media.render_export_candidate.local.v1`,
`media.render_adapter_contract.local.v1`,
`media.render_plan_candidate.local.v1`, and
`media.render_receipt.local.v1` describe local render preparation and preview
evidence. They do not create export delivery, authorize publication, grant
production authority, or make a cut production-ready.

`media.export_candidate.local.v1` and
`media.export_plan_candidate.local.v1` describe dry-run local delivery posture
over a reviewed rough cut. They resolve refs and target output placement only;
they do not read media bytes, create delivery files, authorize publication, or
make a package production-ready.

`media.export_receipt.local.v1` records a local delivery-candidate copy or
ffmpeg delivery render plus manifest for review. It can prove Studio performed a
local export operation, but it is not publication authorization, production
readiness, byte availability proof, or materialization proof.

Future candidate artifact kinds, not implemented and not active schema
contracts:

- `media.local_layer_projection_candidate.local.v1`

This registry is intentionally small. It prevents naming drift while the local
wedge remains standalone-local and Edge-compatible without implementing Edge
integration.
