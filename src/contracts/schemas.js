import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { artifactKinds, assertKnownArtifactKind } from './artifact-kinds.js'
import {
  assertLifecycleState,
  assertPlacementClass,
  assertSafeLocalPath
} from '../local/project-layout.js'
import {
  assertResolvabilityCategory
} from '../local/resolvability.js'
import {
  assertIntentFamily,
  validateProviderCapability
} from '../providers/provider-neutral.js'
import {
  operationArtifactClasses,
  operationAuthorityBoundaries,
  operationClasses,
  operationEvidenceRequirements,
  operationReversibility,
  operationRiskTiers,
  operationScopeDeltas
} from './operation-candidates.js'
import {
  ruleDeliveryModes,
  ruleResolutionModes
} from './rule-resolution.js'
import {
  validateProviderEndpointShape,
  validateProviderMapping,
  validateProviderShape
} from '../providers/provider-shapes.js'

export const schemaFiles = {
  'media.card.v1': 'schemas/media-card.schema.json',
  'media.asset.descriptor.v1': 'schemas/media-asset-descriptor.schema.json',
  'media.work_packet.v1': 'schemas/media-work-packet.schema.json',
  'media.provider_job_result.local.v1': 'schemas/media-provider-job-result-local.schema.json',
  'media.evidence.v1': 'schemas/media-evidence.schema.json',
  'media.readiness.v1': 'schemas/media-readiness.schema.json',
  'media.operator_decision.v1': 'schemas/media-operator-decision.schema.json',
  'media.local_run_manifest.v1': 'schemas/media-local-run-manifest.schema.json',
  'media.project_layout.v1': 'schemas/media-project-layout.schema.json',
  'media.local_ref.v1': 'schemas/media-local-ref.schema.json',
  'media.asset_lifecycle.v1': 'schemas/media-asset-lifecycle.schema.json',
  'media.generation_request.v1': 'schemas/media-generation-request.schema.json',
  'media.provider_profile.v1': 'schemas/media-provider-profile.schema.json',
  'media.provider_capability.v1': 'schemas/media-provider-capability.schema.json',
  'media.provider_result.v1': 'schemas/media-provider-result.schema.json',
  'media.provider_shape.v1': 'schemas/media-provider-shape.schema.json',
  'media.provider_endpoint_shape.v1': 'schemas/media-provider-endpoint-shape.schema.json',
  'media.provider_mapping.v1': 'schemas/media-provider-mapping.schema.json',
  'media.edge_inspection_packet.local.v1': 'schemas/media-edge-inspection-packet-local.schema.json',
  'media.byte_reference.preview.local.v1': 'schemas/media-byte-reference-preview-local.schema.json',
  'media.provider_adapter_contract.v1': 'schemas/media-provider-adapter-contract.schema.json',
  'media.provider_failure_taxonomy.v1': 'schemas/media-provider-failure-taxonomy.schema.json',
  'media.image_metadata.local.v1': 'schemas/media-image-metadata-local.schema.json',
  'media.provider_adapter_run.local.v1': 'schemas/media-provider-adapter-run-local.schema.json',
  'media.edge_export_bundle.local.v1': 'schemas/media-edge-export-bundle-local.schema.json',
  'media.provider_run_ledger.local.v1': 'schemas/media-provider-run-ledger-local.schema.json',
  'media.provider_loop_status.local.v1': 'schemas/media-provider-loop-status-local.schema.json',
  'media.reference_ingest.local.v1': 'schemas/media-reference-ingest-local.schema.json',
  'media.derivative.local.v1': 'schemas/media-derivative-local.schema.json',
  'media.candidate_review.local.v1': 'schemas/media-candidate-review-local.schema.json',
  'media.project_status.local.v1': 'schemas/media-project-status-local.schema.json',
  'media.project_health.local.v1': 'schemas/media-project-health-local.schema.json',
  'media.continuity_evidence.local.v1': 'schemas/media-continuity-evidence-local.schema.json',
  'media.control_surface_projection.local.v1': 'schemas/media-control-surface-projection-local.schema.json',
  'media.edge_review_evidence.local.v1': 'schemas/media-edge-review-evidence-local.schema.json',
  'media.edge_compatibility_bundle.local.v1': 'schemas/media-edge-compatibility-bundle-local.schema.json',
  'media.operator_packet_index.local.v1': 'schemas/media-operator-packet-index-local.schema.json',
  'media.edge_handoff_candidate.local.v1': 'schemas/media-edge-handoff-candidate-local.schema.json',
  'media.operator_decision_request.local.v1': 'schemas/media-operator-decision-request-local.schema.json',
  'media.cross_project_inspection_input_list.local.v1': 'schemas/media-cross-project-inspection-input-list-local.schema.json',
  'media.cross_project_operator_index.local.v1': 'schemas/media-cross-project-operator-index-local.schema.json',
  'media.production_unit.v1': 'schemas/media-production-unit.schema.json',
  'media.reference_primitive.v1': 'schemas/media-reference-primitive.schema.json',
  'media.continuity_band.v1': 'schemas/media-continuity-band.schema.json',
  'media.render_strategy.v1': 'schemas/media-render-strategy.schema.json',
  'media.production_descriptor.local.v1': 'schemas/media-production-descriptor-local.schema.json',
  'media.production_asset_capsule.local.v1': 'schemas/media-production-asset-capsule-local.schema.json',
  'media.production_bundle.local.v1': 'schemas/media-production-bundle-local.schema.json',
  'media.production_authority_prerequisites.summary.local.v1': 'schemas/media-production-authority-prerequisites-local.schema.json',
  'media.authority_handoff_candidate.local.v1': 'schemas/media-authority-handoff-candidate-local.schema.json',
  'media.rough_cut_capsule.local.v1': 'schemas/media-rough-cut-capsule-local.schema.json',
  'media.render_export_candidate.local.v1': 'schemas/media-render-export-candidate-local.schema.json',
  'media.approval_proposal.local.v1': 'schemas/media-approval-proposal-local.schema.json',
  'media.byte_descriptor_proposal.local.v1': 'schemas/media-byte-descriptor-proposal-local.schema.json',
  'media.local_layer_resource_ref_candidate.local.v1': 'schemas/media-local-layer-resource-ref-candidate-local.schema.json',
  'media.operation_candidate.local.v1': 'schemas/media-operation-candidate-local.schema.json',
  'media.rule_resolution_trace.local.v1': 'schemas/media-rule-resolution-trace-local.schema.json'
}

export const requiredFields = {
  'media.card.v1': [
    'schema',
    'cardId',
    'projectId',
    'kind',
    'prompt',
    'referenceAssetRefs',
    'target',
    'providerHints',
    'acceptanceCriteria',
    'createdAt'
  ],
  'media.asset.descriptor.v1': [
    'schema',
    'assetId',
    'projectId',
    'contentType',
    'hash',
    'size',
    'localRef',
    'source',
    'lineage',
    'provenance',
    'createdAt'
  ],
  'media.work_packet.v1': [
    'schema',
    'packetId',
    'intentFamily',
    'projectId',
    'cardRef',
    'inputs',
    'requestedOutputs',
    'operatorContext',
    'readiness',
    'createdAt'
  ],
  'media.evidence.v1': [
    'schema',
    'evidenceId',
    'evidenceKind',
    'projectId',
    'subjectRef',
    'source',
    'summary',
    'refs',
    'createdAt'
  ],
  'media.readiness.v1': [
    'schema',
    'readinessId',
    'subjectRef',
    'state',
    'reasons',
    'nextActions',
    'operatorGuidanceOnly',
    'createdAt'
  ],
  'media.operator_decision.v1': [
    'schema',
    'decisionId',
    'subjectRef',
    'decisionType',
    'operatorRef',
    'reason',
    'evidenceRefs',
    'createdAt'
  ],
  'media.provider_job_result.local.v1': [
    'schema',
    'providerJobResultId',
    'projectId',
    'packetRef',
    'cardRef',
    'provider',
    'result',
    'localTruthLabel',
    'truthStatus',
    'createdAt'
  ],
  'media.production_authority_prerequisites.summary.local.v1': [
    'schema',
    'reportId',
    'projectId',
    'mode',
    'candidates',
    'rows',
    'createdAt',
    'localOnly',
    'operatorGuidanceOnly'
  ],
  'media.authority_handoff_candidate.local.v1': [
    'schema',
    'handoffCandidateId',
    'projectId',
    'handoffKind',
    'mode',
    'targetAuthorityLane',
    'prerequisiteSummary',
    'authorityReviewInputs',
    'acceptedCandidateRows',
    'sourceRefs',
    'authorityGaps',
    'nextActions',
    'createdAt',
    'operatorGuidanceOnly',
    'productionReady',
    'approvalAuthority',
    'ratifierAuthority',
    'publicationAuthorization',
    'providerTruth',
    'byteAvailabilityProof',
    'materializationProof',
    'resourceAdmission',
    'causalTruth',
    'edgeCalled',
    'meshPublished',
    'localOnly',
    'meshTruth',
    'distributedProof',
    'ratifiedSharedState',
    'localTruthLabel',
    'truthStatus'
  ],
  'media.rough_cut_capsule.local.v1': [
    'schema',
    'roughCutId',
    'projectId',
    'roughCutKind',
    'mode',
    'orderedItems',
    'sourceRefs',
    'assemblyPosture',
    'renderPosture',
    'nextActions',
    'createdAt',
    'operatorGuidanceOnly',
    'productionReady',
    'approvalAuthority',
    'ratifierAuthority',
    'publicationAuthorization',
    'providerTruth',
    'byteAvailabilityProof',
    'materializationProof',
    'resourceAdmission',
    'causalTruth',
    'edgeCalled',
    'meshPublished',
    'localOnly',
    'meshTruth',
    'distributedProof',
    'ratifiedSharedState',
    'localTruthLabel',
    'truthStatus'
  ],
  'media.render_export_candidate.local.v1': [
    'schema',
    'candidateId',
    'projectId',
    'mode',
    'candidateKind',
    'sourceRoughCutRef',
    'reviewDecisionRef',
    'orderedItemRefs',
    'renderPosture',
    'exportPosture',
    'sourceRefs',
    'nextActions',
    'createdAt',
    'operatorGuidanceOnly',
    'productionReady',
    'approvalAuthority',
    'ratifierAuthority',
    'publicationAuthorization',
    'providerTruth',
    'byteAvailabilityProof',
    'materializationProof',
    'resourceAdmission',
    'causalTruth',
    'edgeCalled',
    'meshPublished',
    'localOnly',
    'meshTruth',
    'distributedProof',
    'ratifiedSharedState',
    'localTruthLabel',
    'truthStatus'
  ],
  'media.local_run_manifest.v1': [
    'schema',
    'runId',
    'createdAt',
    'mode',
    'inputCardRef',
    'candidateInputRef',
    'generatedRecordRefs',
    'artifactKinds',
    'hashes',
    'doctrineLabels',
    'warnings',
    'operatorGuidanceOnly',
    'localOnly',
    'meshTruth',
    'distributedProof',
    'ratifiedSharedState'
  ],
  'media.project_layout.v1': [
    'schema',
    'projectId',
    'mode',
    'directories',
    'localOnly',
    'meshTruth',
    'distributedProof',
    'ratifiedSharedState'
  ],
  'media.local_ref.v1': [
    'schema',
    'refKind',
    'placementClass',
    'path',
    'localOnly',
    'meshTruth',
    'distributedProof',
    'ratifiedSharedState'
  ],
  'media.asset_lifecycle.v1': [
    'schema',
    'assetId',
    'projectId',
    'state',
    'refs',
    'localOnly',
    'meshTruth',
    'distributedProof',
    'ratifiedSharedState'
  ],
  'media.generation_request.v1': [
    'schema',
    'requestId',
    'projectId',
    'cardRef',
    'intentFamily',
    'prompt',
    'negativePrompt',
    'referenceAssetRefs',
    'target',
    'providerHints',
    'createdAt',
    'localOnly',
    'meshTruth'
  ],
  'media.provider_profile.v1': [
    'schema',
    'providerId',
    'displayName',
    'capabilities',
    'localOnly',
    'meshTruth',
    'createdAt'
  ],
  'media.provider_capability.v1': [
    'schema',
    'capabilityId',
    'intentFamily',
    'outputKinds',
    'localOnly',
    'meshTruth',
    'createdAt'
  ],
  'media.provider_result.v1': [
    'schema',
    'resultId',
    'requestRef',
    'providerId',
    'providerJobRef',
    'status',
    'outputRefs',
    'createdAt',
    'localOnly',
    'meshTruth'
  ],
  'media.provider_shape.v1': [
    'schema',
    'providerId',
    'providerFamily',
    'endpoints',
    'authKind',
    'localOnly',
    'meshTruth',
    'providerTruth',
    'createdAt'
  ],
  'media.provider_endpoint_shape.v1': [
    'schema',
    'endpointId',
    'providerId',
    'intentFamily',
    'operationKind',
    'requestShape',
    'responseShape',
    'asyncPattern',
    'outputDelivery',
    'knownFailureModes',
    'localOnly',
    'meshTruth',
    'providerTruth',
    'createdAt'
  ],
  'media.provider_mapping.v1': [
    'schema',
    'mappingId',
    'providerId',
    'endpointId',
    'studioInput',
    'providerInput',
    'providerOutput',
    'studioOutput',
    'warnings',
    'localOnly',
    'meshTruth',
    'providerTruth',
    'createdAt'
  ],
  'media.edge_inspection_packet.local.v1': [
    'schema',
    'packetId',
    'createdAt',
    'mode',
    'seam',
    'sourceRunRef',
    'recordRefs',
    'artifactKinds',
    'generatedArtifactRefs',
    'warnings',
    'operatorGuidanceOnly',
    'localOnly',
    'meshTruth',
    'distributedProof',
    'ratifiedSharedState',
    'providerTruth',
    'byteAvailabilityProof',
    'materializationProof',
    'publicationAuthorization'
  ],
  'media.byte_reference.preview.local.v1': [
    'schema',
    'byteRefPreviewId',
    'sourceRef',
    'localRef',
    'hash',
    'size',
    'contentType',
    'byteDescriptorPreview',
    'status',
    'byteAvailabilityProof',
    'materializationProof',
    'localOnly',
    'meshTruth',
    'distributedProof',
    'ratifiedSharedState',
    'createdAt'
  ],
  'media.provider_adapter_contract.v1': [
    'schema',
    'adapterId',
    'providerId',
    'endpointId',
    'intentFamily',
    'inputSchema',
    'outputSchema',
    'failureTaxonomyRef',
    'localOnly',
    'meshTruth',
    'distributedProof',
    'ratifiedSharedState',
    'providerTruth',
    'createdAt'
  ],
  'media.provider_failure_taxonomy.v1': [
    'schema',
    'taxonomyId',
    'providerId',
    'failureKinds',
    'localOnly',
    'meshTruth',
    'distributedProof',
    'ratifiedSharedState',
    'providerTruth',
    'createdAt'
  ],
  'media.image_metadata.local.v1': [
    'schema',
    'metadataId',
    'assetRef',
    'localRef',
    'contentType',
    'width',
    'height',
    'localOnly',
    'meshTruth',
    'distributedProof',
    'ratifiedSharedState',
    'localTruthLabel',
    'truthStatus',
    'createdAt'
  ],
  'media.provider_adapter_run.local.v1': [
    'schema',
    'adapterRunId',
    'adapterId',
    'providerId',
    'endpointId',
    'requestRef',
    'mode',
    'providerInputSummary',
    'providerResultRef',
    'status',
    'failureEvidenceRefs',
    'startedAt',
    'completedAt',
    'localOnly',
    'meshTruth',
    'distributedProof',
    'ratifiedSharedState',
    'providerTruth',
    'localTruthLabel',
    'truthStatus',
    'createdAt'
  ],
  'media.edge_export_bundle.local.v1': [
    'schema',
    'bundleId',
    'createdAt',
    'mode',
    'sourcePacketRef',
    'bundleRootRef',
    'includedRecordRefs',
    'includedArtifactRefs',
    'warnings',
    'operatorGuidanceOnly',
    'localOnly',
    'meshTruth',
    'distributedProof',
    'ratifiedSharedState',
    'providerTruth',
    'byteAvailabilityProof',
    'materializationProof',
    'publicationAuthorization',
    'localTruthLabel',
    'truthStatus'
  ],
  'media.provider_run_ledger.local.v1': [
    'schema',
    'ledgerId',
    'projectId',
    'createdAt',
    'mode',
    'runs',
    'summary',
    'warnings',
    'localOnly',
    'meshTruth',
    'distributedProof',
    'ratifiedSharedState',
    'providerTruth',
    'localTruthLabel',
    'truthStatus'
  ],
  'media.provider_loop_status.local.v1': [
    'schema',
    'statusId',
    'projectId',
    'providerId',
    'loopKind',
    'state',
    'createdAt',
    'completedSteps',
    'nextAction',
    'localOnly',
    'operatorGuidanceOnly',
    'meshTruth',
    'distributedProof',
    'ratifiedSharedState',
    'providerTruth',
    'byteAvailabilityProof',
    'materializationProof',
    'resourceAdmission',
    'edgeCalled',
    'meshPublished',
    'localTruthLabel',
    'truthStatus'
  ],
  'media.reference_ingest.local.v1': [
    'schema',
    'ingestId',
    'projectId',
    'sourceRef',
    'assetRef',
    'assetRecordRef',
    'createdAt',
    'localOnly',
    'meshTruth',
    'distributedProof',
    'ratifiedSharedState',
    'providerTruth',
    'byteAvailabilityProof',
    'materializationProof',
    'localTruthLabel',
    'truthStatus'
  ],
  'media.derivative.local.v1': [
    'schema',
    'derivativeId',
    'projectId',
    'derivativeKind',
    'derivativeSubjectRef',
    'derivativeIdentity',
    'sourceAssetRef',
    'sourceAssetDescriptorRef',
    'sourceContentRef',
    'sourceSituationRef',
    'sourcePlacementRef',
    'sourceLocalRef',
    'derivativeLocalRef',
    'toolRef',
    'status',
    'createdAt',
    'localOnly',
    'meshTruth',
    'distributedProof',
    'ratifiedSharedState',
    'byteAvailabilityProof',
    'materializationProof',
    'resourceAdmission',
    'localTruthLabel',
    'truthStatus'
  ],
  'media.candidate_review.local.v1': [
    'schema',
    'candidateReviewId',
    'projectId',
    'cardRef',
    'candidateAssetRefs',
    'selectedAssetRef',
    'operatorRef',
    'criteria',
    'summary',
    'createdAt',
    'localOnly',
    'meshTruth',
    'distributedProof',
    'ratifiedSharedState',
    'localTruthLabel',
    'truthStatus'
  ],
  'media.project_status.local.v1': [
    'schema',
    'statusId',
    'projectId',
    'createdAt',
    'mode',
    'counts',
    'latestRefs',
    'warnings',
    'localOnly',
    'meshTruth',
    'distributedProof',
    'ratifiedSharedState',
    'providerTruth',
    'byteAvailabilityProof',
    'materializationProof',
    'localTruthLabel',
    'truthStatus'
  ],
  'media.project_health.local.v1': [
    'schema',
    'healthId',
    'projectId',
    'createdAt',
    'mode',
    'healthState',
    'blockingIssues',
    'statusRef',
    'readinessRef',
    'assetResourceConsistency',
    'edgeReadinessState',
    'productionValidation',
    'operatorGuidanceOnly',
    'localOnly',
    'meshTruth',
    'distributedProof',
    'ratifiedSharedState',
    'providerTruth',
    'byteAvailabilityProof',
    'materializationProof',
    'edgeRuntimeVerified',
    'localTruthLabel',
    'truthStatus'
  ],
  'media.continuity_evidence.local.v1': [
    'schema',
    'continuityEvidenceId',
    'projectId',
    'subjectRef',
    'parentRefs',
    'referents',
    'branchId',
    'contextId',
    'observerRef',
    'continuityClaims',
    'transitionSummary',
    'createdAt',
    'localOnly',
    'meshTruth',
    'distributedProof',
    'ratifiedSharedState',
    'causalTruth',
    'localTruthLabel',
    'truthStatus'
  ],
  'media.control_surface_projection.local.v1': [
    'schema',
    'projectionId',
    'projectId',
    'createdAt',
    'mode',
    'packsDoctrineRefs',
    'posture',
    'planes',
    'views',
    'actions',
    'observationRefs',
    'warnings',
    'localOnly',
    'meshTruth',
    'distributedProof',
    'ratifiedSharedState',
    'providerTruth',
    'authoritySurface',
    'rendererContract',
    'localTruthLabel',
    'truthStatus'
  ],
  'media.edge_review_evidence.local.v1': [
    'schema',
    'edgeReviewEvidenceId',
    'projectId',
    'createdAt',
    'artifactKind',
    'schemaVersion',
    'reviewStatus',
    'edgeReadinessHint',
    'edgeImportClassification',
    'sourceRefs',
    'summary',
    'reasonCodes',
    'localOnly',
    'meshTruth',
    'distributedProof',
    'ratifiedSharedState',
    'providerTruth',
    'edgeRuntimeBuilt',
    'edgeRuntimeVerified',
    'localTruthLabel',
    'truthStatus'
  ],
  'media.edge_compatibility_bundle.local.v1': [
    'schema',
    'compatibilityBundleId',
    'projectId',
    'createdAt',
    'mode',
    'targetRepo',
    'targetSurface',
    'edgeDoctrineRefs',
    'studioSourceRefs',
    'edgeShapeTargets',
    'studioReviewEvidence',
    'edgeWorkPacketCandidate',
    'edgeEvidenceImportCandidate',
    'edgeReadinessViewCandidate',
    'edgeReturnSurfaceCandidate',
    'warnings',
    'localOnly',
    'meshTruth',
    'distributedProof',
    'ratifiedSharedState',
    'providerTruth',
    'edgeRuntimeBuilt',
    'edgeRuntimeVerified',
    'localTruthLabel',
    'truthStatus'
  ],
  'media.operator_packet_index.local.v1': [
    'schema',
    'indexId',
    'projectId',
    'createdAt',
    'mode',
    'indexedRootRef',
    'packetRefs',
    'bundleRefs',
    'healthRefs',
    'handoffCandidateRefs',
    'operatorDecisionRequestRefs',
    'summary',
    'warnings',
    'operatorGuidanceOnly',
    'localOnly',
    'meshTruth',
    'distributedProof',
    'ratifiedSharedState',
    'providerTruth',
    'edgeRuntimeBuilt',
    'edgeRuntimeVerified',
    'localTruthLabel',
    'truthStatus'
  ],
  'media.edge_handoff_candidate.local.v1': [
    'schema',
    'handoffCandidateId',
    'projectId',
    'createdAt',
    'mode',
    'targetSurface',
    'targetSeams',
    'sourceRefs',
    'inspectionPacketRef',
    'compatibilityBundleRef',
    'projectHealthRef',
    'operatorPacketIndexRef',
    'readinessState',
    'handoffState',
    'readinessDiagnosis',
    'edgeShapeTargets',
    'warnings',
    'operatorGuidanceOnly',
    'localOnly',
    'meshTruth',
    'distributedProof',
    'ratifiedSharedState',
    'providerTruth',
    'edgeRuntimeBuilt',
    'edgeRuntimeVerified',
    'localTruthLabel',
    'truthStatus'
  ],
  'media.operator_decision_request.local.v1': [
    'schema',
    'requestId',
    'projectId',
    'createdAt',
    'mode',
    'requestKind',
    'targetSurface',
    'subjectRef',
    'sourceRefs',
    'requestedDecisionTypes',
    'reason',
    'nextActions',
    'status',
    'operatorGuidanceOnly',
    'requestOnly',
    'authorityRequired',
    'edgeRuntimeBuilt',
    'edgeRuntimeVerified',
    'approvalAuthority',
    'ratifierAuthority',
    'publicationAuthorization',
    'localOnly',
    'meshTruth',
    'distributedProof',
    'ratifiedSharedState',
    'providerTruth',
    'localTruthLabel',
    'truthStatus'
  ],
  'media.cross_project_inspection_input_list.local.v1': [
    'schema',
    'inputListId',
    'createdAt',
    'mode',
    'projects',
    'warnings',
    'operatorGuidanceOnly',
    'localOnly',
    'meshTruth',
    'distributedProof',
    'ratifiedSharedState',
    'providerTruth',
    'edgeRuntimeBuilt',
    'edgeRuntimeVerified',
    'localTruthLabel',
    'truthStatus'
  ],
  'media.cross_project_operator_index.local.v1': [
    'schema',
    'indexId',
    'createdAt',
    'mode',
    'inputListRef',
    'projectRefs',
    'projectSummaries',
    'summary',
    'warnings',
    'operatorGuidanceOnly',
    'localOnly',
    'meshTruth',
    'distributedProof',
    'ratifiedSharedState',
    'providerTruth',
    'edgeRuntimeBuilt',
    'edgeRuntimeVerified',
    'localTruthLabel',
    'truthStatus'
  ],
  'media.production_unit.v1': [
    'schema',
    'productionUnitId',
    'projectId',
    'unitKind',
    'title',
    'purpose',
    'parentRefs',
    'sourceRefs',
    'continuityBandRefs',
    'referencePrimitiveRefs',
    'renderStrategyRefs',
    'outputIntent',
    'localOnly',
    'meshTruth',
    'distributedProof',
    'ratifiedSharedState',
    'localTruthLabel',
    'truthStatus',
    'createdAt'
  ],
  'media.reference_primitive.v1': [
    'schema',
    'primitiveId',
    'projectId',
    'primitiveKind',
    'name',
    'descriptor',
    'anchors',
    'evidenceRefs',
    'assetRefs',
    'scope',
    'localOnly',
    'meshTruth',
    'distributedProof',
    'ratifiedSharedState',
    'localTruthLabel',
    'truthStatus',
    'createdAt'
  ],
  'media.continuity_band.v1': [
    'schema',
    'bandId',
    'projectId',
    'bandKind',
    'label',
    'subjectRefs',
    'stateAnchors',
    'riskLevel',
    'locks',
    'sourceRefs',
    'localOnly',
    'meshTruth',
    'distributedProof',
    'ratifiedSharedState',
    'localTruthLabel',
    'truthStatus',
    'createdAt'
  ],
  'media.render_strategy.v1': [
    'schema',
    'strategyId',
    'projectId',
    'strategyKind',
    'productionUnitRef',
    'inputModes',
    'fallbackModes',
    'continuityRisk',
    'providerCapabilityPosture',
    'referenceBurden',
    'recoveryStrategy',
    'guidanceOnly',
    'localOnly',
    'meshTruth',
    'distributedProof',
    'ratifiedSharedState',
    'localTruthLabel',
    'truthStatus',
    'createdAt'
  ],
  'media.production_descriptor.local.v1': [
    'schema',
    'descriptorId',
    'projectId',
    'descriptorKind',
    'productionUnitRef',
    'title',
    'parentUnitRefs',
    'continuityBandRefs',
    'referencePrimitiveRefs',
    'renderStrategyRefs',
    'descriptor',
    'localOnly',
    'meshTruth',
    'distributedProof',
    'ratifiedSharedState',
    'localTruthLabel',
    'truthStatus',
    'createdAt'
  ],
  'media.production_asset_capsule.local.v1': [
    'schema',
    'capsuleId',
    'projectId',
    'capsuleKind',
    'subjectAssetRef',
    'contentRef',
    'assetDescriptorRef',
    'situationRef',
    'placementRef',
    'localRef',
    'productionPosture',
    'bundleRefs',
    'createdAt',
    'operatorGuidanceOnly',
    'productionReady',
    'approvalAuthority',
    'ratifierAuthority',
    'publicationAuthorization',
    'providerTruth',
    'byteAvailabilityProof',
    'materializationProof',
    'resourceAdmission',
    'causalTruth',
    'localOnly',
    'meshTruth',
    'distributedProof',
    'ratifiedSharedState',
    'localTruthLabel',
    'truthStatus'
  ],
  'media.production_bundle.local.v1': [
    'schema',
    'bundleId',
    'projectId',
    'bundleKind',
    'capsuleRefs',
    'assetRefs',
    'contentRefs',
    'productionPosture',
    'createdAt',
    'operatorGuidanceOnly',
    'productionReady',
    'approvalAuthority',
    'ratifierAuthority',
    'publicationAuthorization',
    'providerTruth',
    'byteAvailabilityProof',
    'materializationProof',
    'resourceAdmission',
    'causalTruth',
    'localOnly',
    'meshTruth',
    'distributedProof',
    'ratifiedSharedState',
    'localTruthLabel',
    'truthStatus'
  ],
  'media.approval_proposal.local.v1': [
    'schema',
    'proposalId',
    'projectId',
    'subjectRef',
    'proposalType',
    'proposedDecision',
    'status',
    'localDecisionRef',
    'evidenceRefs',
    'authorityRequired',
    'proposalOnly',
    'operatorGuidanceOnly',
    'approvalAuthority',
    'ratifierAuthority',
    'publicationAuthorization',
    'localOnly',
    'meshTruth',
    'distributedProof',
    'ratifiedSharedState',
    'localTruthLabel',
    'truthStatus',
    'createdAt'
  ],
  'media.byte_descriptor_proposal.local.v1': [
    'schema',
    'byteDescriptorProposalId',
    'projectId',
    'sourceAssetRef',
    'assetRecordRef',
    'localRef',
    'hash',
    'size',
    'contentType',
    'proposedByteDescriptor',
    'status',
    'byteAvailabilityProof',
    'materializationProof',
    'byteAuthority',
    'localOnly',
    'meshTruth',
    'distributedProof',
    'ratifiedSharedState',
    'localTruthLabel',
    'truthStatus',
    'createdAt'
  ],
  'media.local_layer_resource_ref_candidate.local.v1': [
    'schema',
    'resourceRefCandidateId',
    'projectId',
    'sourceRef',
    'sourcePath',
    'resourceKind',
    'currentRefCategory',
    'targetRefCategory',
    'proposedResourceRef',
    'byteDescriptorAlignment',
    'promotionPosture',
    'resolvabilityPosture',
    'status',
    'localLayerResourceRef',
    'replicatedPointerRef',
    'causalReviewableRef',
    'localOnly',
    'meshTruth',
    'distributedProof',
    'ratifiedSharedState',
    'localTruthLabel',
    'truthStatus',
    'createdAt'
  ],
  'media.operation_candidate.local.v1': [
    'schema',
    'operationId',
    'projectId',
    'artifactClass',
    'operationClass',
    'subjectRef',
    'scopeDelta',
    'riskTier',
    'reversibility',
    'authorityBoundary',
    'evidenceRequirement',
    'requestedBy',
    'sourceRefs',
    'createdAt',
    'localOnly',
    'meshTruth',
    'distributedProof',
    'ratifiedSharedState',
    'localTruthLabel',
    'truthStatus'
  ],
  'media.rule_resolution_trace.local.v1': [
    'schema',
    'traceId',
    'operationRef',
    'projectId',
    'effectiveRuleBookRef',
    'resolutionMode',
    'deliveryMode',
    'reasons',
    'appliedRules',
    'blockedClaims',
    'createdAt',
    'localOnly',
    'operatorGuidanceOnly',
    'meshTruth',
    'distributedProof',
    'ratifiedSharedState',
    'authorityGranted',
    'executionPerformed',
    'edgeCalled',
    'meshPublished',
    'truthClaimed',
    'completionClaimed',
    'providerTruthClaimed',
    'byteAvailabilityProven',
    'materializationProven',
    'causalTruthClaimed',
    'publicationAuthorized',
    'nonClaims',
    'localTruthLabel',
    'truthStatus'
  ]
}

const idFields = {
  [artifactKinds.mediaCard]: 'cardId',
  [artifactKinds.mediaWorkPacket]: 'packetId',
  [artifactKinds.mediaProviderJobResultLocal]: 'providerJobResultId',
  [artifactKinds.mediaAssetDescriptor]: 'assetId',
  [artifactKinds.mediaEvidence]: 'evidenceId',
  [artifactKinds.mediaReadiness]: 'readinessId',
  [artifactKinds.mediaOperatorDecision]: 'decisionId',
  [artifactKinds.mediaLocalRunManifest]: 'runId',
  [artifactKinds.mediaProjectLayout]: 'projectId',
  [artifactKinds.mediaLocalRef]: 'path',
  [artifactKinds.mediaAssetLifecycle]: 'assetId',
  [artifactKinds.mediaGenerationRequest]: 'requestId',
  [artifactKinds.mediaProviderProfile]: 'providerId',
  [artifactKinds.mediaProviderCapability]: 'capabilityId',
  [artifactKinds.mediaProviderResult]: 'resultId',
  [artifactKinds.mediaProviderShape]: 'providerId',
  [artifactKinds.mediaProviderEndpointShape]: 'endpointId',
  [artifactKinds.mediaProviderMapping]: 'mappingId',
  [artifactKinds.mediaEdgeInspectionPacketLocal]: 'packetId',
  [artifactKinds.mediaByteReferencePreviewLocal]: 'byteRefPreviewId',
  [artifactKinds.mediaProviderAdapterContract]: 'adapterId',
  [artifactKinds.mediaProviderFailureTaxonomy]: 'taxonomyId',
  [artifactKinds.mediaImageMetadataLocal]: 'metadataId',
  [artifactKinds.mediaProviderAdapterRunLocal]: 'adapterRunId',
  [artifactKinds.mediaEdgeExportBundleLocal]: 'bundleId',
  [artifactKinds.mediaProviderRunLedgerLocal]: 'ledgerId',
  [artifactKinds.mediaProviderLoopStatusLocal]: 'statusId',
  [artifactKinds.mediaReferenceIngestLocal]: 'ingestId',
  [artifactKinds.mediaDerivativeLocal]: 'derivativeId',
  [artifactKinds.mediaCandidateReviewLocal]: 'candidateReviewId',
  [artifactKinds.mediaProjectStatusLocal]: 'statusId',
  [artifactKinds.mediaProjectHealthLocal]: 'healthId',
  [artifactKinds.mediaContinuityEvidenceLocal]: 'continuityEvidenceId',
  [artifactKinds.mediaControlSurfaceProjectionLocal]: 'projectionId',
  [artifactKinds.mediaEdgeReviewEvidenceLocal]: 'edgeReviewEvidenceId',
  [artifactKinds.mediaEdgeCompatibilityBundleLocal]: 'compatibilityBundleId',
  [artifactKinds.mediaOperatorPacketIndexLocal]: 'indexId',
  [artifactKinds.mediaEdgeHandoffCandidateLocal]: 'handoffCandidateId',
  [artifactKinds.mediaOperatorDecisionRequestLocal]: 'requestId',
  [artifactKinds.mediaCrossProjectInspectionInputListLocal]: 'inputListId',
  [artifactKinds.mediaCrossProjectOperatorIndexLocal]: 'indexId',
  [artifactKinds.mediaProductionUnit]: 'productionUnitId',
  [artifactKinds.mediaReferencePrimitive]: 'primitiveId',
  [artifactKinds.mediaContinuityBand]: 'bandId',
  [artifactKinds.mediaRenderStrategy]: 'strategyId',
  [artifactKinds.mediaProductionDescriptorLocal]: 'descriptorId',
  [artifactKinds.mediaProductionAssetCapsuleLocal]: 'capsuleId',
  [artifactKinds.mediaProductionBundleLocal]: 'bundleId',
  [artifactKinds.mediaProductionAuthorityPrerequisitesLocal]: 'reportId',
  [artifactKinds.mediaAuthorityHandoffCandidateLocal]: 'handoffCandidateId',
  [artifactKinds.mediaRoughCutCapsuleLocal]: 'roughCutId',
  [artifactKinds.mediaRenderExportCandidateLocal]: 'candidateId',
  [artifactKinds.mediaApprovalProposalLocal]: 'proposalId',
  [artifactKinds.mediaByteDescriptorProposalLocal]: 'byteDescriptorProposalId',
  [artifactKinds.mediaLocalLayerResourceRefCandidateLocal]: 'resourceRefCandidateId',
  [artifactKinds.mediaOperationCandidateLocal]: 'operationId',
  [artifactKinds.mediaRuleResolutionTraceLocal]: 'traceId'
}

const domainProjectSchemas = new Set([
  artifactKinds.mediaCard,
  artifactKinds.mediaWorkPacket,
  artifactKinds.mediaProviderJobResultLocal,
  artifactKinds.mediaAssetDescriptor,
  artifactKinds.mediaEvidence,
  artifactKinds.mediaProjectLayout,
  artifactKinds.mediaAssetLifecycle,
  artifactKinds.mediaGenerationRequest,
  artifactKinds.mediaProviderRunLedgerLocal,
  artifactKinds.mediaProviderLoopStatusLocal,
  artifactKinds.mediaReferenceIngestLocal,
  artifactKinds.mediaDerivativeLocal,
  artifactKinds.mediaCandidateReviewLocal,
  artifactKinds.mediaProjectStatusLocal,
  artifactKinds.mediaProjectHealthLocal,
  artifactKinds.mediaContinuityEvidenceLocal,
  artifactKinds.mediaControlSurfaceProjectionLocal,
  artifactKinds.mediaEdgeReviewEvidenceLocal,
  artifactKinds.mediaEdgeCompatibilityBundleLocal,
  artifactKinds.mediaOperatorPacketIndexLocal,
  artifactKinds.mediaEdgeHandoffCandidateLocal,
  artifactKinds.mediaOperatorDecisionRequestLocal,
  artifactKinds.mediaProductionUnit,
  artifactKinds.mediaReferencePrimitive,
  artifactKinds.mediaContinuityBand,
  artifactKinds.mediaRenderStrategy,
  artifactKinds.mediaProductionDescriptorLocal,
  artifactKinds.mediaProductionAssetCapsuleLocal,
  artifactKinds.mediaProductionBundleLocal,
  artifactKinds.mediaProductionAuthorityPrerequisitesLocal,
  artifactKinds.mediaAuthorityHandoffCandidateLocal,
  artifactKinds.mediaRoughCutCapsuleLocal,
  artifactKinds.mediaRenderExportCandidateLocal,
  artifactKinds.mediaApprovalProposalLocal,
  artifactKinds.mediaByteDescriptorProposalLocal,
  artifactKinds.mediaLocalLayerResourceRefCandidateLocal,
  artifactKinds.mediaOperationCandidateLocal,
  artifactKinds.mediaRuleResolutionTraceLocal
])

const localGeneratedSchemas = new Set([
  artifactKinds.mediaWorkPacket,
  artifactKinds.mediaProviderJobResultLocal,
  artifactKinds.mediaAssetDescriptor,
  artifactKinds.mediaEvidence,
  artifactKinds.mediaReadiness,
  artifactKinds.mediaOperatorDecision,
  artifactKinds.mediaLocalRunManifest,
  artifactKinds.mediaEdgeInspectionPacketLocal,
  artifactKinds.mediaByteReferencePreviewLocal,
  artifactKinds.mediaImageMetadataLocal,
  artifactKinds.mediaProviderAdapterRunLocal,
  artifactKinds.mediaEdgeExportBundleLocal,
  artifactKinds.mediaProviderRunLedgerLocal,
  artifactKinds.mediaReferenceIngestLocal,
  artifactKinds.mediaDerivativeLocal,
  artifactKinds.mediaCandidateReviewLocal,
  artifactKinds.mediaProjectStatusLocal,
  artifactKinds.mediaProjectHealthLocal,
  artifactKinds.mediaContinuityEvidenceLocal,
  artifactKinds.mediaControlSurfaceProjectionLocal,
  artifactKinds.mediaEdgeReviewEvidenceLocal,
  artifactKinds.mediaEdgeCompatibilityBundleLocal,
  artifactKinds.mediaOperatorPacketIndexLocal,
  artifactKinds.mediaEdgeHandoffCandidateLocal,
  artifactKinds.mediaOperatorDecisionRequestLocal,
  artifactKinds.mediaCrossProjectInspectionInputListLocal,
  artifactKinds.mediaCrossProjectOperatorIndexLocal,
  artifactKinds.mediaProductionUnit,
  artifactKinds.mediaReferencePrimitive,
  artifactKinds.mediaContinuityBand,
  artifactKinds.mediaRenderStrategy,
  artifactKinds.mediaProductionDescriptorLocal,
  artifactKinds.mediaProductionAssetCapsuleLocal,
  artifactKinds.mediaProductionBundleLocal,
  artifactKinds.mediaProductionAuthorityPrerequisitesLocal,
  artifactKinds.mediaAuthorityHandoffCandidateLocal,
  artifactKinds.mediaRoughCutCapsuleLocal,
  artifactKinds.mediaRenderExportCandidateLocal,
  artifactKinds.mediaApprovalProposalLocal,
  artifactKinds.mediaByteDescriptorProposalLocal,
  artifactKinds.mediaLocalLayerResourceRefCandidateLocal,
  artifactKinds.mediaOperationCandidateLocal,
  artifactKinds.mediaRuleResolutionTraceLocal
])

const readinessStates = new Set(['draft', 'blocked', 'ready', 'caution', 'complete'])
const decisionTypes = new Set(['accept', 'reject', 'request_changes', 'review_provider_loop', 'retry_provider_loop', 'review_rough_cut', 'defer'])
const productionUnitKinds = new Set([
  'project',
  'episode',
  'sequence',
  'scene',
  'shot',
  'clip',
  'still',
  'audio-take',
  'reference-plate',
  'world',
  'panorama',
  'entity-reference',
  'look-variant',
  'rough-cut',
  'export'
])
const referencePrimitiveKinds = new Set([
  'entity',
  'character',
  'prop',
  'environment',
  'space',
  'world',
  'panorama',
  'look',
  'plate',
  'audio-voice',
  'text-lock'
])
const continuityBandKinds = new Set([
  'time',
  'location',
  'appearance',
  'entity-state',
  'world-state',
  'audio-state',
  'render-pass'
])
const continuityRiskLevels = new Set(['none', 'low', 'medium', 'high', 'critical'])
const renderStrategyKinds = new Set([
  'classic-scene-shot-clip',
  'reference-first',
  'frame-chain',
  'world-panorama',
  'entity-look',
  'audio-first',
  'rough-cut',
  'export'
])
const renderInputModes = new Set([
  'text-to-media',
  'reference-to-media',
  'frame-to-media',
  'multi-reference-to-media',
  'world-to-media',
  'audio-to-media',
  'media-transformation'
])
const productionDescriptorKinds = new Set(['scene', 'shot', 'clip', 'rough-cut', 'export'])
const approvalProposalTypes = new Set([
  'acceptance-approval',
  'rejection-approval',
  'export-approval',
  'publication-approval'
])
const approvalProposalStatuses = new Set(['proposed', 'withdrawn', 'superseded'])
const operatorDecisionRequestKinds = new Set(['review-ready-handoff', 'resolve-local-attention', 'review-provider-loop'])
const operatorDecisionRequestStatuses = new Set(['proposed', 'withdrawn', 'superseded'])
const requestedOperatorDecisionTypes = new Set(['review_handoff', 'resolve_blockers', 'request_changes', 'review_provider_loop', 'retry_provider_loop', 'defer'])

export async function readSchema(schemaId, options = {}) {
  const rootDir = options.rootDir ?? process.cwd()
  const file = schemaFiles[schemaId]

  if (!file) {
    throw new Error(`Unknown schema id: ${schemaId}`)
  }

  return JSON.parse(await readFile(path.join(rootDir, file), 'utf8'))
}

export function validateRequiredRecord(record, schemaId = record?.schema) {
  if (!record || typeof record !== 'object') {
    throw new Error('Record must be an object')
  }

  if (!record.schema) {
    throw new Error('Record is missing schema')
  }

  assertKnownArtifactKind(schemaId)

  if (record.schema !== schemaId) {
    throw new Error(`Record schema mismatch: expected ${schemaId}, received ${record.schema}`)
  }

  const fields = requiredFields[schemaId]

  if (!fields) {
    throw new Error(`Unknown schema id: ${schemaId}`)
  }

  const missing = fields.filter((field) => record[field] === undefined || record[field] === null)

  if (missing.length > 0) {
    throw new Error(`Record ${schemaId} is missing required fields: ${missing.join(', ')}`)
  }

  validateRecordShape(record, schemaId)

  return true
}

export function validateRecordShape(record, schemaId = record.schema) {
  const idField = idFields[schemaId]

  if (!idField || !isNonEmptyString(record[idField])) {
    throw new Error(`Record ${schemaId} is missing id field: ${idField}`)
  }

  if (requiredFields[schemaId]?.includes('createdAt') && !isNonEmptyString(record.createdAt)) {
    throw new Error(`Record ${schemaId} is missing createdAt`)
  }

  if (domainProjectSchemas.has(schemaId) && !isNonEmptyString(record.projectId)) {
    throw new Error(`Record ${schemaId} is missing projectId`)
  }

  if (record.subjectRef !== undefined) {
    validateRef(record.subjectRef, `${schemaId}.subjectRef`)
  }

  if (record.cardRef !== undefined) {
    validateRef(record.cardRef, `${schemaId}.cardRef`)
  }

  if (record.requestRef !== undefined) {
    validateRef(record.requestRef, `${schemaId}.requestRef`)
  }

  if (record.packetRef !== undefined) {
    validateRef(record.packetRef, `${schemaId}.packetRef`)
  }

  if (Array.isArray(record.evidenceRefs)) {
    record.evidenceRefs.forEach((ref, index) => validateRef(ref, `${schemaId}.evidenceRefs[${index}]`))
  }

  if (Array.isArray(record.generatedRecordRefs)) {
    record.generatedRecordRefs.forEach((ref, index) => validateGeneratedRecordRef(ref, `${schemaId}.generatedRecordRefs[${index}]`))
  }

  if (schemaId === artifactKinds.mediaReadiness && !readinessStates.has(record.state)) {
    throw new Error(`Record ${schemaId} has invalid readiness state: ${record.state}`)
  }

  if (schemaId === artifactKinds.mediaOperatorDecision && !decisionTypes.has(record.decisionType)) {
    throw new Error(`Record ${schemaId} has invalid decision type: ${record.decisionType}`)
  }

  if (schemaId === artifactKinds.mediaLocalRef) {
    assertPlacementClass(record.placementClass)
    assertSafeLocalPath(record.path)
    validateLocalFalseFlags(record, schemaId)
  }

  if (schemaId === artifactKinds.mediaProjectLayout) {
    validateLocalFalseFlags(record, schemaId)
  }

  if (schemaId === artifactKinds.mediaAssetLifecycle) {
    assertLifecycleState(record.state)
    validateLocalFalseFlags(record, schemaId)
  }

  if (schemaId === artifactKinds.mediaAssetDescriptor && record.localRef?.schema === artifactKinds.mediaLocalRef) {
    assertPlacementClass(record.localRef.placementClass)
    assertSafeLocalPath(record.localRef.path)
  }

  if (schemaId === artifactKinds.mediaGenerationRequest) {
    assertIntentFamily(record.intentFamily)
    validateLocalFalseFlags(record, schemaId)
  }

  if (schemaId === artifactKinds.mediaProviderCapability) {
    validateProviderCapability(record)
    validateLocalFalseFlags(record, schemaId)
  }

  if (schemaId === artifactKinds.mediaProviderProfile) {
    if (!Array.isArray(record.capabilities) || record.capabilities.length === 0) {
      throw new Error('Provider profile must declare at least one capability')
    }

    record.capabilities.forEach(validateProviderCapability)
    validateLocalFalseFlags(record, schemaId)
  }

  if (schemaId === artifactKinds.mediaProviderResult) {
    if (!record.providerId) {
      throw new Error('Provider result is missing providerId')
    }

    if (!record.providerJobRef || typeof record.providerJobRef !== 'object' || !record.providerJobRef.id) {
      throw new Error('Provider result is missing providerJobRef')
    }

    validateLocalFalseFlags(record, schemaId)

    if (record.providerTruth !== false) {
      throw new Error('Provider result must set providerTruth=false')
    }
  }

  if (schemaId === artifactKinds.mediaProviderShape) {
    validateProviderShape(record)
  }

  if (schemaId === artifactKinds.mediaProviderEndpointShape) {
    validateProviderEndpointShape(record)
  }

  if (schemaId === artifactKinds.mediaProviderMapping) {
    validateProviderMapping(record)
  }

  if (schemaId === artifactKinds.mediaEdgeInspectionPacketLocal) {
    if (record.seam !== 'media-edge-operator-seam') {
      throw new Error(`Record ${schemaId} has invalid seam: ${record.seam}`)
    }

    if (record.operatorGuidanceOnly !== true) {
      throw new Error(`Record ${schemaId} must set operatorGuidanceOnly=true`)
    }

    if (!record.recordRefs || typeof record.recordRefs !== 'object') {
      throw new Error(`Record ${schemaId} must include recordRefs`)
    }

    for (const [name, ref] of Object.entries(record.recordRefs)) {
      validateInspectionRef(ref, `${schemaId}.recordRefs.${name}`)
    }

    if (!Array.isArray(record.generatedArtifactRefs)) {
      throw new Error(`Record ${schemaId} generatedArtifactRefs must be an array`)
    }

    record.generatedArtifactRefs.forEach((ref, index) => validateInspectionRef(ref, `${schemaId}.generatedArtifactRefs[${index}]`))
  }

  if (schemaId === artifactKinds.mediaByteReferencePreviewLocal) {
    validateRef(record.sourceRef, `${schemaId}.sourceRef`)

    if (!record.localRef || typeof record.localRef !== 'object') {
      throw new Error(`Record ${schemaId} must include localRef`)
    }

    assertSafeLocalPath(record.localRef.path)

    if (record.status !== 'not-materialized') {
      throw new Error(`Record ${schemaId} must set status=not-materialized`)
    }

    validateLocalFalseFlags(record, schemaId)

    if (record.byteAvailabilityProof !== false || record.materializationProof !== false) {
      throw new Error(`Record ${schemaId} must not claim byte availability or materialization proof`)
    }

    if (record.byteDescriptorPreview.intendedSchema !== 'media.byte_descriptor.v1') {
      throw new Error(`Record ${schemaId} must preview media.byte_descriptor.v1`)
    }

    if (record.byteDescriptorPreview.byteAvailabilityProof !== false || record.byteDescriptorPreview.materializationProof !== false) {
      throw new Error(`Record ${schemaId} byteDescriptorPreview must not claim byte proof`)
    }
  }

  if (schemaId === artifactKinds.mediaProviderAdapterContract) {
    assertIntentFamily(record.intentFamily)
    validateLocalFalseFlags(record, schemaId)

    if (record.providerTruth !== false) {
      throw new Error(`Record ${schemaId} must set providerTruth=false`)
    }
  }

  if (schemaId === artifactKinds.mediaProviderFailureTaxonomy) {
    if (!Array.isArray(record.failureKinds) || record.failureKinds.length === 0) {
      throw new Error(`Record ${schemaId} must include failureKinds`)
    }

    validateLocalFalseFlags(record, schemaId)

    if (record.providerTruth !== false) {
      throw new Error(`Record ${schemaId} must set providerTruth=false`)
    }
  }

  if (schemaId === artifactKinds.mediaImageMetadataLocal) {
    validateRef(record.assetRef, `${schemaId}.assetRef`)
    assertSafeLocalPath(record.localRef.path)
    validateLocalFalseFlags(record, schemaId)

    if (!Number.isInteger(record.width) || record.width < 1 || !Number.isInteger(record.height) || record.height < 1) {
      throw new Error(`Record ${schemaId} must include positive integer dimensions`)
    }
  }

  if (schemaId === artifactKinds.mediaProviderAdapterRunLocal) {
    validateRef(record.requestRef, `${schemaId}.requestRef`)
    validateRef(record.providerResultRef, `${schemaId}.providerResultRef`)
    validateLocalFalseFlags(record, schemaId)

    if (!['dry-run', 'live-smoke'].includes(record.mode)) {
      throw new Error(`Record ${schemaId} has invalid mode: ${record.mode}`)
    }

    if (record.providerTruth !== false) {
      throw new Error(`Record ${schemaId} must set providerTruth=false`)
    }
  }

  if (schemaId === artifactKinds.mediaEdgeExportBundleLocal) {
    validateInspectionRef(record.sourcePacketRef, `${schemaId}.sourcePacketRef`)
    validateInspectionRef(record.bundleRootRef, `${schemaId}.bundleRootRef`)
    record.includedRecordRefs.forEach((ref, index) => validateInspectionRef(ref, `${schemaId}.includedRecordRefs[${index}]`))
    record.includedArtifactRefs.forEach((ref, index) => validateInspectionRef(ref, `${schemaId}.includedArtifactRefs[${index}]`))
    validateLocalFalseFlags(record, schemaId)
  }

  if (schemaId === artifactKinds.mediaProviderRunLedgerLocal) {
    if (record.mode !== 'standalone-local') {
      throw new Error(`Record ${schemaId} has invalid mode: ${record.mode}`)
    }

    if (!Array.isArray(record.runs)) {
      throw new Error(`Record ${schemaId} runs must be an array`)
    }

    for (const [index, run] of record.runs.entries()) {
      if (!isNonEmptyString(run.providerId) || !isNonEmptyString(run.status)) {
        throw new Error(`Record ${schemaId}.runs[${index}] must include providerId and status`)
      }
    }

    validateLocalFalseFlags(record, schemaId)

    if (record.providerTruth !== false) {
      throw new Error(`Record ${schemaId} must set providerTruth=false`)
    }
  }

  if (schemaId === artifactKinds.mediaProviderLoopStatusLocal) {
    if (!['running', 'complete_review_only', 'complete_with_attention', 'failed_review_only'].includes(record.state)) {
      throw new Error(`Record ${schemaId} has invalid state: ${record.state}`)
    }

    if (!Array.isArray(record.completedSteps)) {
      throw new Error(`Record ${schemaId} completedSteps must be an array`)
    }

    if (record.operatorGuidanceOnly !== true) {
      throw new Error(`Record ${schemaId} must be operator guidance only`)
    }

    validateLocalFalseFlags(record, schemaId)

    for (const field of ['providerTruth', 'byteAvailabilityProof', 'materializationProof', 'resourceAdmission', 'edgeCalled', 'meshPublished']) {
      if (record[field] !== false) {
        throw new Error(`Record ${schemaId} must set ${field}=false`)
      }
    }
  }

  if (schemaId === artifactKinds.mediaReferenceIngestLocal) {
    validateInspectionRef(record.sourceRef, `${schemaId}.sourceRef`)
    validateRef(record.assetRef, `${schemaId}.assetRef`)
    validateInspectionRef(record.assetRecordRef, `${schemaId}.assetRecordRef`)

    if (record.imageMetadataRef !== undefined && record.imageMetadataRef !== null) {
      validateInspectionRef(record.imageMetadataRef, `${schemaId}.imageMetadataRef`)
    }

    validateLocalFalseFlags(record, schemaId)

    for (const flag of ['providerTruth', 'byteAvailabilityProof', 'materializationProof']) {
      if (record[flag] !== false) {
        throw new Error(`Record ${schemaId} must set ${flag}=false`)
      }
    }
  }

  if (schemaId === artifactKinds.mediaDerivativeLocal) {
    validateRef(record.sourceAssetRef, `${schemaId}.sourceAssetRef`)
    validateRef(record.sourceAssetDescriptorRef, `${schemaId}.sourceAssetDescriptorRef`)
    validateRef(record.sourceContentRef, `${schemaId}.sourceContentRef`)
    validateRef(record.sourceSituationRef, `${schemaId}.sourceSituationRef`)
    validateRef(record.sourcePlacementRef, `${schemaId}.sourcePlacementRef`)
    validateRef(record.derivativeSubjectRef, `${schemaId}.derivativeSubjectRef`)

    if (record.derivativeKind !== 'thumbnail') {
      throw new Error(`Record ${schemaId} has invalid derivativeKind: ${record.derivativeKind}`)
    }

    if (record.status !== 'ready-for-local-inspection') {
      throw new Error(`Record ${schemaId} must set status=ready-for-local-inspection`)
    }

    for (const localRefField of ['sourceLocalRef', 'derivativeLocalRef']) {
      if (!record[localRefField] || typeof record[localRefField] !== 'object') {
        throw new Error(`Record ${schemaId} must include ${localRefField}`)
      }
      assertSafeLocalPath(record[localRefField].path)
    }

    if (!record.toolRef || record.toolRef.tool !== 'sharp') {
      throw new Error(`Record ${schemaId} must include sharp toolRef`)
    }

    if (!record.derivativeIdentity || typeof record.derivativeIdentity !== 'object') {
      throw new Error(`Record ${schemaId} must include derivativeIdentity`)
    }

    if (record.derivativeIdentity.derivativeSubjectRef?.id !== record.derivativeSubjectRef.id) {
      throw new Error(`Record ${schemaId} derivativeIdentity must align with derivativeSubjectRef`)
    }

    if (
      record.derivativeIdentity.sourceContentId !== record.sourceContentRef.id ||
      record.derivativeIdentity.sourceAssetDescriptorId !== record.sourceAssetDescriptorRef.id ||
      record.derivativeIdentity.sourceSituationId !== record.sourceSituationRef.id ||
      record.derivativeIdentity.sourcePlacementId !== record.sourcePlacementRef.id ||
      record.derivativeIdentity.sourceLocalPath !== record.sourceLocalRef.path
    ) {
      throw new Error(`Record ${schemaId} derivativeIdentity must align with source refs`)
    }

    validateLocalFalseFlags(record, schemaId)

    for (const flag of ['byteAvailabilityProof', 'materializationProof', 'resourceAdmission']) {
      if (record[flag] !== false) {
        throw new Error(`Record ${schemaId} must set ${flag}=false`)
      }
    }
  }

  if (schemaId === artifactKinds.mediaCandidateReviewLocal) {
    validateRef(record.cardRef, `${schemaId}.cardRef`)
    validateRef(record.selectedAssetRef, `${schemaId}.selectedAssetRef`)

    if (!Array.isArray(record.candidateAssetRefs) || record.candidateAssetRefs.length === 0) {
      throw new Error(`Record ${schemaId} must include candidateAssetRefs`)
    }

    record.candidateAssetRefs.forEach((ref, index) => validateRef(ref, `${schemaId}.candidateAssetRefs[${index}]`))
    validateLocalFalseFlags(record, schemaId)
  }

  if (schemaId === artifactKinds.mediaProjectStatusLocal) {
    if (record.mode !== 'standalone-local') {
      throw new Error(`Record ${schemaId} has invalid mode: ${record.mode}`)
    }

    validateLocalFalseFlags(record, schemaId)

    for (const flag of ['providerTruth', 'byteAvailabilityProof', 'materializationProof']) {
      if (record[flag] !== false) {
        throw new Error(`Record ${schemaId} must set ${flag}=false`)
      }
    }
  }

  if (schemaId === artifactKinds.mediaProjectHealthLocal) {
    if (record.mode !== 'standalone-local') {
      throw new Error(`Record ${schemaId} has invalid mode: ${record.mode}`)
    }

    if (!['ready-for-local-inspection', 'needs-local-attention'].includes(record.healthState)) {
      throw new Error(`Record ${schemaId} has invalid healthState: ${record.healthState}`)
    }

    if (!Array.isArray(record.blockingIssues)) {
      throw new Error(`Record ${schemaId}.blockingIssues must be an array`)
    }

    validateInspectionRef(record.statusRef, `${schemaId}.statusRef`)
    validateInspectionRef(record.readinessRef, `${schemaId}.readinessRef`)

    if (!record.assetResourceConsistency || typeof record.assetResourceConsistency !== 'object') {
      throw new Error(`Record ${schemaId} must include assetResourceConsistency`)
    }

    if (!record.productionValidation || typeof record.productionValidation !== 'object') {
      throw new Error(`Record ${schemaId} must include productionValidation`)
    }

    if (record.operatorGuidanceOnly !== true) {
      throw new Error(`Record ${schemaId} must set operatorGuidanceOnly=true`)
    }

    validateLocalFalseFlags(record, schemaId)

    for (const flag of ['providerTruth', 'byteAvailabilityProof', 'materializationProof', 'edgeRuntimeVerified']) {
      if (record[flag] !== false) {
        throw new Error(`Record ${schemaId} must set ${flag}=false`)
      }
    }
  }

  if (schemaId === artifactKinds.mediaContinuityEvidenceLocal) {
    validateRef(record.subjectRef, `${schemaId}.subjectRef`)
    record.parentRefs.forEach((ref, index) => validateRef(ref, `${schemaId}.parentRefs[${index}]`))
    validateLocalFalseFlags(record, schemaId)

    if (record.causalTruth !== false) {
      throw new Error(`Record ${schemaId} must set causalTruth=false`)
    }
  }

  if (schemaId === artifactKinds.mediaControlSurfaceProjectionLocal) {
    if (record.mode !== 'standalone-local') {
      throw new Error(`Record ${schemaId} has invalid mode: ${record.mode}`)
    }

    if (record.posture?.readonlyFirst !== true) {
      throw new Error(`Record ${schemaId} must set posture.readonlyFirst=true`)
    }

    if (record.posture?.authorityPosture !== 'observer') {
      throw new Error(`Record ${schemaId} must set posture.authorityPosture=observer`)
    }

    for (const collection of ['packsDoctrineRefs', 'planes', 'views', 'actions', 'warnings']) {
      if (!Array.isArray(record[collection])) {
        throw new Error(`Record ${schemaId}.${collection} must be an array`)
      }
    }

    if (!record.observationRefs || typeof record.observationRefs !== 'object') {
      throw new Error(`Record ${schemaId} must include observationRefs`)
    }

    for (const [name, ref] of Object.entries(record.observationRefs)) {
      if (Array.isArray(ref)) {
        ref.forEach((entry, index) => validateInspectionRef(entry, `${schemaId}.observationRefs.${name}[${index}]`))
      } else if (ref !== null && ref !== undefined) {
        validateInspectionRef(ref, `${schemaId}.observationRefs.${name}`)
      }
    }

    validateLocalFalseFlags(record, schemaId)

    for (const flag of ['providerTruth', 'authoritySurface', 'rendererContract']) {
      if (record[flag] !== false) {
        throw new Error(`Record ${schemaId} must set ${flag}=false`)
      }
    }
  }

  if (schemaId === artifactKinds.mediaEdgeReviewEvidenceLocal) {
    validateLocalFalseFlags(record, schemaId)

    if (record.artifactKind !== 'media_studio_edge_review_evidence') {
      throw new Error(`Record ${schemaId} must set artifactKind=media_studio_edge_review_evidence`)
    }

    if (record.schemaVersion !== 'media_studio_edge_review_evidence.v1') {
      throw new Error(`Record ${schemaId} must set schemaVersion=media_studio_edge_review_evidence.v1`)
    }

    if (record.reviewStatus !== 'ready_for_operator_review') {
      throw new Error(`Record ${schemaId} must set reviewStatus=ready_for_operator_review`)
    }

    if (record.edgeReadinessHint !== 'ready_for_operator_review') {
      throw new Error(`Record ${schemaId} must set edgeReadinessHint=ready_for_operator_review`)
    }

    validateEdgeClassification(record.edgeImportClassification, schemaId)
    validateEdgeRuntimeFlags(record, schemaId)

    for (const flag of ['providerTruth']) {
      if (record[flag] !== false) {
        throw new Error(`Record ${schemaId} must set ${flag}=false`)
      }
    }
  }

  if (schemaId === artifactKinds.mediaEdgeCompatibilityBundleLocal) {
    if (record.mode !== 'standalone-local') {
      throw new Error(`Record ${schemaId} has invalid mode: ${record.mode}`)
    }

    if (record.targetRepo !== 'mesh-ecology-media-studio') {
      throw new Error(`Record ${schemaId} must target mesh-ecology-media-studio`)
    }

    if (record.targetSurface !== 'media-edge-operator-seam') {
      throw new Error(`Record ${schemaId} must target media-edge-operator-seam`)
    }

    for (const collection of ['edgeDoctrineRefs', 'studioSourceRefs', 'edgeShapeTargets', 'warnings']) {
      if (!Array.isArray(record[collection])) {
        throw new Error(`Record ${schemaId}.${collection} must be an array`)
      }
    }

    validateReadinessResourceSummary(record.readinessResourceSummary, `${schemaId}.readinessResourceSummary`)

    for (const ref of record.studioSourceRefs) {
      validateInspectionRef(ref, `${schemaId}.studioSourceRefs`)
    }

    validateRequiredRecord(record.studioReviewEvidence, artifactKinds.mediaEdgeReviewEvidenceLocal)
    validateEdgeRuntimeFlags(record, schemaId)
    validateLocalFalseFlags(record, schemaId)

    for (const flag of ['providerTruth']) {
      if (record[flag] !== false) {
        throw new Error(`Record ${schemaId} must set ${flag}=false`)
      }
    }

    validateEdgeCandidate(record.edgeWorkPacketCandidate, 'edge_cross_project_work_packet', 'edge_cross_project_work_packet.v1', schemaId)
    validateEdgeCandidate(record.edgeEvidenceImportCandidate, 'edge_cross_project_evidence_import', 'edge_cross_project_evidence_import.v1', schemaId)
    validateEdgeCandidate(record.edgeReadinessViewCandidate, 'edge_cross_project_readiness_view', 'edge_cross_project_readiness_view.v1', schemaId)
    validateEdgeCandidate(record.edgeReturnSurfaceCandidate, 'edge_operator_return_surface', 'edge_operator_return_surface.v1', schemaId)
  }

  if (schemaId === artifactKinds.mediaOperatorPacketIndexLocal) {
    if (record.mode !== 'standalone-local') {
      throw new Error(`Record ${schemaId} has invalid mode: ${record.mode}`)
    }

    validateInspectionRef(record.indexedRootRef, `${schemaId}.indexedRootRef`)

    for (const collection of ['packetRefs', 'bundleRefs', 'healthRefs', 'handoffCandidateRefs', 'operatorDecisionRequestRefs', 'warnings']) {
      if (!Array.isArray(record[collection])) {
        throw new Error(`Record ${schemaId}.${collection} must be an array`)
      }
    }

    record.packetRefs.forEach((ref, index) => validateInspectionRef(ref, `${schemaId}.packetRefs[${index}]`))
    record.bundleRefs.forEach((ref, index) => validateInspectionRef(ref, `${schemaId}.bundleRefs[${index}]`))
    record.healthRefs.forEach((ref, index) => validateInspectionRef(ref, `${schemaId}.healthRefs[${index}]`))
    record.handoffCandidateRefs.forEach((ref, index) => validateInspectionRef(ref, `${schemaId}.handoffCandidateRefs[${index}]`))
    record.operatorDecisionRequestRefs.forEach((ref, index) => validateInspectionRef(ref, `${schemaId}.operatorDecisionRequestRefs[${index}]`))
    if (record.mediationRefs !== undefined) {
      if (!Array.isArray(record.mediationRefs)) {
        throw new Error(`Record ${schemaId}.mediationRefs must be an array`)
      }

      record.mediationRefs.forEach((ref, index) => validateInspectionRef(ref, `${schemaId}.mediationRefs[${index}]`))
    }
    if (record.providerLoopStatusRefs !== undefined) {
      if (!Array.isArray(record.providerLoopStatusRefs)) {
        throw new Error(`Record ${schemaId}.providerLoopStatusRefs must be an array`)
      }

      record.providerLoopStatusRefs.forEach((ref, index) => validateInspectionRef(ref, `${schemaId}.providerLoopStatusRefs[${index}]`))
    }
    if (record.providerLoopStatuses !== undefined && !Array.isArray(record.providerLoopStatuses)) {
      throw new Error(`Record ${schemaId}.providerLoopStatuses must be an array`)
    }

    if (!record.summary || typeof record.summary !== 'object') {
      throw new Error(`Record ${schemaId}.summary must be an object`)
    }

    if (record.operatorGuidanceOnly !== true) {
      throw new Error(`Record ${schemaId} must set operatorGuidanceOnly=true`)
    }

    validateLocalFalseFlags(record, schemaId)

    for (const flag of ['providerTruth', 'edgeRuntimeBuilt', 'edgeRuntimeVerified']) {
      if (record[flag] !== false) {
        throw new Error(`Record ${schemaId} must set ${flag}=false`)
      }
    }
  }

  if (schemaId === artifactKinds.mediaEdgeHandoffCandidateLocal) {
    if (record.mode !== 'standalone-local') {
      throw new Error(`Record ${schemaId} has invalid mode: ${record.mode}`)
    }

    if (record.targetSurface !== 'media-edge-operator-seam') {
      throw new Error(`Record ${schemaId} must target media-edge-operator-seam`)
    }

    if (!['ready-for-edge-inspection', 'needs-local-attention'].includes(record.handoffState)) {
      throw new Error(`Record ${schemaId} has invalid handoffState: ${record.handoffState}`)
    }

    for (const collection of ['targetSeams', 'sourceRefs', 'edgeShapeTargets', 'warnings']) {
      if (!Array.isArray(record[collection])) {
        throw new Error(`Record ${schemaId}.${collection} must be an array`)
      }
    }

    record.sourceRefs.forEach((ref, index) => validateInspectionRef(ref, `${schemaId}.sourceRefs[${index}]`))
    record.edgeShapeTargets.forEach((target, index) => {
      if (!target || typeof target !== 'object' || !isNonEmptyString(target.edgeArtifactKind) || !isNonEmptyString(target.edgeSchemaVersion)) {
        throw new Error(`Record ${schemaId}.edgeShapeTargets[${index}] must include Edge artifact kind and schema version`)
      }
    })

    validateInspectionRef(record.inspectionPacketRef, `${schemaId}.inspectionPacketRef`)
    validateInspectionRef(record.compatibilityBundleRef, `${schemaId}.compatibilityBundleRef`)
    validateInspectionRef(record.projectHealthRef, `${schemaId}.projectHealthRef`)
    validateInspectionRef(record.operatorPacketIndexRef, `${schemaId}.operatorPacketIndexRef`)

    validateHandoffDiagnosis(record.readinessDiagnosis, `${schemaId}.readinessDiagnosis`)

    if (record.operatorGuidanceOnly !== true) {
      throw new Error(`Record ${schemaId} must set operatorGuidanceOnly=true`)
    }

    validateLocalFalseFlags(record, schemaId)
    validateEdgeRuntimeFlags(record, schemaId)

    for (const flag of ['providerTruth']) {
      if (record[flag] !== false) {
        throw new Error(`Record ${schemaId} must set ${flag}=false`)
      }
    }
  }

  if (schemaId === artifactKinds.mediaOperatorDecisionRequestLocal) {
    if (record.mode !== 'standalone-local') {
      throw new Error(`Record ${schemaId} has invalid mode: ${record.mode}`)
    }

    if (!operatorDecisionRequestKinds.has(record.requestKind)) {
      throw new Error(`Record ${schemaId} has invalid requestKind: ${record.requestKind}`)
    }

    if (!operatorDecisionRequestStatuses.has(record.status)) {
      throw new Error(`Record ${schemaId} has invalid status: ${record.status}`)
    }

    if (record.targetSurface !== 'media-edge-operator-seam') {
      throw new Error(`Record ${schemaId} must target media-edge-operator-seam`)
    }

    validateRef(record.subjectRef, `${schemaId}.subjectRef`)
    if (!Array.isArray(record.sourceRefs)) {
      throw new Error(`Record ${schemaId}.sourceRefs must be an array`)
    }
    record.sourceRefs.forEach((ref, index) => validateInspectionRef(ref, `${schemaId}.sourceRefs[${index}]`))

    if (!Array.isArray(record.requestedDecisionTypes)) {
      throw new Error(`Record ${schemaId}.requestedDecisionTypes must be an array`)
    }

    for (const decisionType of record.requestedDecisionTypes) {
      if (!requestedOperatorDecisionTypes.has(decisionType)) {
        throw new Error(`Record ${schemaId} has invalid requested decision type: ${decisionType}`)
      }
    }

    if (!Array.isArray(record.nextActions)) {
      throw new Error(`Record ${schemaId}.nextActions must be an array`)
    }

    if (record.operatorGuidanceOnly !== true || record.requestOnly !== true || record.authorityRequired !== true) {
      throw new Error(`Record ${schemaId} must remain request-only operator guidance requiring authority`)
    }

    validateLocalFalseFlags(record, schemaId)
    validateEdgeRuntimeFlags(record, schemaId)

    for (const flag of ['approvalAuthority', 'ratifierAuthority', 'publicationAuthorization', 'providerTruth']) {
      if (record[flag] !== false) {
        throw new Error(`Record ${schemaId} must set ${flag}=false`)
      }
    }
  }

  if (schemaId === artifactKinds.mediaCrossProjectInspectionInputListLocal) {
    if (record.mode !== 'standalone-local') {
      throw new Error(`Record ${schemaId} has invalid mode: ${record.mode}`)
    }

    if (!Array.isArray(record.projects) || record.projects.length === 0) {
      throw new Error(`Record ${schemaId}.projects must be a non-empty array`)
    }

    record.projects.forEach((project, index) => validateCrossProjectInput(project, `${schemaId}.projects[${index}]`))

    if (!Array.isArray(record.warnings)) {
      throw new Error(`Record ${schemaId}.warnings must be an array`)
    }

    if (record.operatorGuidanceOnly !== true) {
      throw new Error(`Record ${schemaId} must set operatorGuidanceOnly=true`)
    }

    validateLocalFalseFlags(record, schemaId)
    validateEdgeRuntimeFlags(record, schemaId)

    if (record.providerTruth !== false) {
      throw new Error(`Record ${schemaId} must set providerTruth=false`)
    }
  }

  if (schemaId === artifactKinds.mediaCrossProjectOperatorIndexLocal) {
    if (record.mode !== 'standalone-local') {
      throw new Error(`Record ${schemaId} has invalid mode: ${record.mode}`)
    }

    validateInspectionRef(record.inputListRef, `${schemaId}.inputListRef`)

    for (const collection of ['projectRefs', 'projectSummaries', 'warnings']) {
      if (!Array.isArray(record[collection])) {
        throw new Error(`Record ${schemaId}.${collection} must be an array`)
      }
    }

    record.projectRefs.forEach((ref, index) => validateInspectionRef(ref, `${schemaId}.projectRefs[${index}]`))
    record.projectSummaries.forEach((summary, index) => validateCrossProjectSummary(summary, `${schemaId}.projectSummaries[${index}]`))

    if (!record.summary || typeof record.summary !== 'object') {
      throw new Error(`Record ${schemaId}.summary must be an object`)
    }

    if (record.operatorGuidanceOnly !== true || record.summary.operatorGuidanceOnly !== true) {
      throw new Error(`Record ${schemaId} must set operatorGuidanceOnly=true`)
    }

    validateLocalFalseFlags(record, schemaId)
    validateEdgeRuntimeFlags(record, schemaId)

    if (record.providerTruth !== false) {
      throw new Error(`Record ${schemaId} must set providerTruth=false`)
    }
  }

  if (schemaId === artifactKinds.mediaProductionUnit) {
    if (!productionUnitKinds.has(record.unitKind)) {
      throw new Error(`Record ${schemaId} has invalid production unit kind: ${record.unitKind}`)
    }

    for (const collection of ['parentRefs', 'sourceRefs', 'continuityBandRefs', 'referencePrimitiveRefs', 'renderStrategyRefs']) {
      validateRefArray(record[collection], `${schemaId}.${collection}`)
    }

    validateLocalFalseFlags(record, schemaId)
  }

  if (schemaId === artifactKinds.mediaReferencePrimitive) {
    if (!referencePrimitiveKinds.has(record.primitiveKind)) {
      throw new Error(`Record ${schemaId} has invalid reference primitive kind: ${record.primitiveKind}`)
    }

    if (!Array.isArray(record.anchors)) {
      throw new Error(`Record ${schemaId}.anchors must be an array`)
    }

    validateRefArray(record.evidenceRefs, `${schemaId}.evidenceRefs`)
    validateRefArray(record.assetRefs, `${schemaId}.assetRefs`)
    validateLocalFalseFlags(record, schemaId)
  }

  if (schemaId === artifactKinds.mediaContinuityBand) {
    if (!continuityBandKinds.has(record.bandKind)) {
      throw new Error(`Record ${schemaId} has invalid continuity band kind: ${record.bandKind}`)
    }

    if (!continuityRiskLevels.has(record.riskLevel)) {
      throw new Error(`Record ${schemaId} has invalid continuity risk level: ${record.riskLevel}`)
    }

    validateRefArray(record.subjectRefs, `${schemaId}.subjectRefs`)
    validateRefArray(record.sourceRefs, `${schemaId}.sourceRefs`)

    for (const collection of ['stateAnchors', 'locks']) {
      if (!Array.isArray(record[collection])) {
        throw new Error(`Record ${schemaId}.${collection} must be an array`)
      }
    }

    validateLocalFalseFlags(record, schemaId)
  }

  if (schemaId === artifactKinds.mediaRenderStrategy) {
    if (!renderStrategyKinds.has(record.strategyKind)) {
      throw new Error(`Record ${schemaId} has invalid render strategy kind: ${record.strategyKind}`)
    }

    validateRef(record.productionUnitRef, `${schemaId}.productionUnitRef`)

    for (const mode of record.inputModes) {
      if (!renderInputModes.has(mode)) {
        throw new Error(`Record ${schemaId} has invalid input mode: ${mode}`)
      }
    }

    for (const mode of record.fallbackModes) {
      if (!renderInputModes.has(mode)) {
        throw new Error(`Record ${schemaId} has invalid fallback mode: ${mode}`)
      }
    }

    if (record.guidanceOnly !== true) {
      throw new Error(`Record ${schemaId} must set guidanceOnly=true`)
    }

    validateLocalFalseFlags(record, schemaId)
  }

  if (schemaId === artifactKinds.mediaProductionDescriptorLocal) {
    if (!productionDescriptorKinds.has(record.descriptorKind)) {
      throw new Error(`Record ${schemaId} has invalid production descriptor kind: ${record.descriptorKind}`)
    }

    validateRef(record.productionUnitRef, `${schemaId}.productionUnitRef`)

    for (const collection of ['parentUnitRefs', 'continuityBandRefs', 'referencePrimitiveRefs', 'renderStrategyRefs']) {
      validateRefArray(record[collection], `${schemaId}.${collection}`)
    }

    if (!record.descriptor || typeof record.descriptor !== 'object') {
      throw new Error(`Record ${schemaId}.descriptor must be an object`)
    }

    if (record.descriptorKind === 'rough-cut' && record.descriptor.publicationAuthorization !== false) {
      throw new Error(`Record ${schemaId} rough-cut descriptor must not claim publication authorization`)
    }

    if (record.descriptorKind === 'export' && record.descriptor.publicationAuthorization !== false) {
      throw new Error(`Record ${schemaId} export descriptor must not claim publication authorization`)
    }

    validateLocalFalseFlags(record, schemaId)
  }

  if (schemaId === artifactKinds.mediaProductionAssetCapsuleLocal) {
    if (!['production-asset-candidate'].includes(record.capsuleKind)) {
      throw new Error(`Record ${schemaId} has invalid capsule kind: ${record.capsuleKind}`)
    }

    if (!['needs-approval-proposal', 'approval-proposed-review-only'].includes(record.productionPosture?.state)) {
      throw new Error(`Record ${schemaId} has invalid production posture state: ${record.productionPosture?.state}`)
    }

    validateRef(record.subjectAssetRef, `${schemaId}.subjectAssetRef`)
    validateRef(record.contentRef, `${schemaId}.contentRef`)
    validateRef(record.assetDescriptorRef, `${schemaId}.assetDescriptorRef`)

    if (!Array.isArray(record.bundleRefs)) {
      throw new Error(`Record ${schemaId} bundleRefs must be an array`)
    }

    if (record.operatorGuidanceOnly !== true || record.productionReady !== false) {
      throw new Error(`Record ${schemaId} must remain review-only and productionReady=false`)
    }

    for (const flag of ['approvalAuthority', 'ratifierAuthority', 'publicationAuthorization', 'providerTruth', 'byteAvailabilityProof', 'materializationProof', 'resourceAdmission', 'causalTruth']) {
      if (record[flag] !== false) {
        throw new Error(`Record ${schemaId} must set ${flag}=false`)
      }
    }

    validateLocalFalseFlags(record, schemaId)
  }

  if (schemaId === artifactKinds.mediaProductionBundleLocal) {
    if (!['production-capsule-set'].includes(record.bundleKind)) {
      throw new Error(`Record ${schemaId} has invalid bundle kind: ${record.bundleKind}`)
    }

    if (!['needs-capsules', 'review-only-bundle'].includes(record.productionPosture?.state)) {
      throw new Error(`Record ${schemaId} has invalid production posture state: ${record.productionPosture?.state}`)
    }

    for (const [field, label] of [
      [record.capsuleRefs, 'capsuleRefs'],
      [record.assetRefs, 'assetRefs'],
      [record.contentRefs, 'contentRefs']
    ]) {
      if (!Array.isArray(field)) {
        throw new Error(`Record ${schemaId}.${label} must be an array`)
      }
    }

    for (const ref of record.capsuleRefs) {
      validateRef(ref, `${schemaId}.capsuleRefs[]`)
    }

    if (record.operatorGuidanceOnly !== true || record.productionReady !== false) {
      throw new Error(`Record ${schemaId} must remain review-only and productionReady=false`)
    }

    for (const flag of ['approvalAuthority', 'ratifierAuthority', 'publicationAuthorization', 'providerTruth', 'byteAvailabilityProof', 'materializationProof', 'resourceAdmission', 'causalTruth']) {
      if (record[flag] !== false) {
        throw new Error(`Record ${schemaId} must set ${flag}=false`)
      }
    }

    validateLocalFalseFlags(record, schemaId)
  }

  if (schemaId === artifactKinds.mediaAuthorityHandoffCandidateLocal) {
    if (!['production-authority-review-candidate'].includes(record.handoffKind)) {
      throw new Error(`Record ${schemaId} has invalid handoff kind: ${record.handoffKind}`)
    }

    if (record.mode !== 'standalone-local') {
      throw new Error(`Record ${schemaId} has invalid mode: ${record.mode}`)
    }

    if (record.targetAuthorityLane !== 'future-authority-lane') {
      throw new Error(`Record ${schemaId} must target future-authority-lane`)
    }

    for (const collection of ['authorityReviewInputs', 'acceptedCandidateRows', 'sourceRefs', 'authorityGaps', 'nextActions']) {
      if (!Array.isArray(record[collection])) {
        throw new Error(`Record ${schemaId}.${collection} must be an array`)
      }
    }

    record.sourceRefs.forEach((ref, index) => validateInspectionRef(ref, `${schemaId}.sourceRefs[${index}]`))

    if (!record.prerequisiteSummary || typeof record.prerequisiteSummary !== 'object') {
      throw new Error(`Record ${schemaId}.prerequisiteSummary must be an object`)
    }

    if (record.operatorGuidanceOnly !== true || record.productionReady !== false) {
      throw new Error(`Record ${schemaId} must remain handoff-only and productionReady=false`)
    }

    for (const flag of ['approvalAuthority', 'ratifierAuthority', 'publicationAuthorization', 'providerTruth', 'byteAvailabilityProof', 'materializationProof', 'resourceAdmission', 'causalTruth', 'edgeCalled', 'meshPublished']) {
      if (record[flag] !== false) {
        throw new Error(`Record ${schemaId} must set ${flag}=false`)
      }
    }

    validateLocalFalseFlags(record, schemaId)
  }

  if (schemaId === artifactKinds.mediaRoughCutCapsuleLocal) {
    if (!['ordered-production-review-cut'].includes(record.roughCutKind)) {
      throw new Error(`Record ${schemaId} has invalid rough cut kind: ${record.roughCutKind}`)
    }

    if (record.mode !== 'standalone-local') {
      throw new Error(`Record ${schemaId} has invalid mode: ${record.mode}`)
    }

    for (const collection of ['orderedItems', 'sourceRefs', 'nextActions']) {
      if (!Array.isArray(record[collection])) {
        throw new Error(`Record ${schemaId}.${collection} must be an array`)
      }
    }

    record.sourceRefs.forEach((ref, index) => validateInspectionRef(ref, `${schemaId}.sourceRefs[${index}]`))

    for (const [index, item] of record.orderedItems.entries()) {
      if (!Number.isInteger(item.order) || item.order < 1) {
        throw new Error(`Record ${schemaId}.orderedItems[${index}] has invalid order`)
      }

      if (item.acceptedAssetRef) validateInspectionRef(item.acceptedAssetRef, `${schemaId}.orderedItems[${index}].acceptedAssetRef`)
      if (item.productionAssetCapsuleRef) validateInspectionRef(item.productionAssetCapsuleRef, `${schemaId}.orderedItems[${index}].productionAssetCapsuleRef`)
      if (item.productionBundleRef) validateInspectionRef(item.productionBundleRef, `${schemaId}.orderedItems[${index}].productionBundleRef`)
      if (item.approvalProposalRef) validateInspectionRef(item.approvalProposalRef, `${schemaId}.orderedItems[${index}].approvalProposalRef`)

      if (item.nonClaims?.rendered !== false || item.nonClaims?.productionReady !== false) {
        throw new Error(`Record ${schemaId}.orderedItems[${index}] must remain non-rendered and productionReady=false`)
      }
    }

    if (!['review-only-rough-cut', 'needs-production-items'].includes(record.assemblyPosture?.state)) {
      throw new Error(`Record ${schemaId} has invalid assembly posture state: ${record.assemblyPosture?.state}`)
    }

    if (record.renderPosture?.rendered !== false || record.renderPosture?.exportRef !== null) {
      throw new Error(`Record ${schemaId} must not claim rendered/exported output`)
    }

    if (record.operatorGuidanceOnly !== true || record.productionReady !== false) {
      throw new Error(`Record ${schemaId} must remain review-only and productionReady=false`)
    }

    for (const flag of ['approvalAuthority', 'ratifierAuthority', 'publicationAuthorization', 'providerTruth', 'byteAvailabilityProof', 'materializationProof', 'resourceAdmission', 'causalTruth', 'edgeCalled', 'meshPublished']) {
      if (record[flag] !== false) {
        throw new Error(`Record ${schemaId} must set ${flag}=false`)
      }
    }

    validateLocalFalseFlags(record, schemaId)
  }

  if (schemaId === artifactKinds.mediaRenderExportCandidateLocal) {
    if (record.candidateKind !== 'rough-cut-render-export-candidate') {
      throw new Error(`Record ${schemaId} has invalid candidate kind: ${record.candidateKind}`)
    }

    if (record.mode !== 'standalone-local') {
      throw new Error(`Record ${schemaId} has invalid mode: ${record.mode}`)
    }

    validateInspectionRef(record.sourceRoughCutRef, `${schemaId}.sourceRoughCutRef`)
    validateInspectionRef(record.reviewDecisionRef, `${schemaId}.reviewDecisionRef`)

    for (const collection of ['orderedItemRefs', 'sourceRefs', 'nextActions']) {
      if (!Array.isArray(record[collection])) {
        throw new Error(`Record ${schemaId}.${collection} must be an array`)
      }
    }

    record.orderedItemRefs.forEach((ref, index) => validateRef(ref, `${schemaId}.orderedItemRefs[${index}]`))
    record.sourceRefs.forEach((ref, index) => validateInspectionRef(ref, `${schemaId}.sourceRefs[${index}]`))

    if (record.reviewPosture?.reviewed !== true || record.reviewPosture?.decisionType !== 'review_rough_cut') {
      throw new Error(`Record ${schemaId} requires a reviewed rough-cut decision`)
    }

    if (record.renderPosture?.renderPerformed !== false || record.renderPosture?.rendererSelected !== false) {
      throw new Error(`Record ${schemaId} must not claim render execution or renderer selection`)
    }

    if (record.exportPosture?.exportPerformed !== false || record.exportPosture?.exportOutputRef !== null) {
      throw new Error(`Record ${schemaId} must not claim export execution or output`)
    }

    if (record.operatorGuidanceOnly !== true || record.candidateOnly !== true || record.productionReady !== false) {
      throw new Error(`Record ${schemaId} must remain candidate-only and productionReady=false`)
    }

    for (const flag of ['approvalAuthority', 'ratifierAuthority', 'publicationAuthorization', 'providerTruth', 'byteAvailabilityProof', 'materializationProof', 'resourceAdmission', 'causalTruth', 'edgeCalled', 'meshPublished']) {
      if (record[flag] !== false) {
        throw new Error(`Record ${schemaId} must set ${flag}=false`)
      }
    }

    validateLocalFalseFlags(record, schemaId)
  }

  if (schemaId === artifactKinds.mediaApprovalProposalLocal) {
    if (!approvalProposalTypes.has(record.proposalType)) {
      throw new Error(`Record ${schemaId} has invalid proposal type: ${record.proposalType}`)
    }

    if (!approvalProposalStatuses.has(record.status)) {
      throw new Error(`Record ${schemaId} has invalid proposal status: ${record.status}`)
    }

    validateRef(record.subjectRef, `${schemaId}.subjectRef`)
    if (record.subjectAssetDescriptorRef !== undefined) {
      validateInspectionRef(record.subjectAssetDescriptorRef, `${schemaId}.subjectAssetDescriptorRef`)
    }
    if (record.subjectContentRef !== undefined) {
      validateRef(record.subjectContentRef, `${schemaId}.subjectContentRef`)
    }
    if (record.subjectSituationRef !== undefined) {
      validateRef(record.subjectSituationRef, `${schemaId}.subjectSituationRef`)
    }
    if (record.subjectPlacementRef !== undefined) {
      validateRef(record.subjectPlacementRef, `${schemaId}.subjectPlacementRef`)
    }
    validateRef(record.localDecisionRef, `${schemaId}.localDecisionRef`)
    validateRefArray(record.evidenceRefs, `${schemaId}.evidenceRefs`)

    if (record.authorityRequired !== true || record.proposalOnly !== true || record.operatorGuidanceOnly !== true) {
      throw new Error(`Record ${schemaId} must remain proposal-only operator guidance requiring authority`)
    }

    for (const flag of ['approvalAuthority', 'ratifierAuthority', 'publicationAuthorization']) {
      if (record[flag] !== false) {
        throw new Error(`Record ${schemaId} must set ${flag}=false`)
      }
    }

    validateLocalFalseFlags(record, schemaId)
  }

  if (schemaId === artifactKinds.mediaByteDescriptorProposalLocal) {
    validateRef(record.sourceAssetRef, `${schemaId}.sourceAssetRef`)
    validateInspectionRef(record.assetRecordRef, `${schemaId}.assetRecordRef`)

    if (!record.localRef || typeof record.localRef !== 'object') {
      throw new Error(`Record ${schemaId} must include localRef`)
    }

    assertSafeLocalPath(record.localRef.path)

    if (record.status !== 'proposed') {
      throw new Error(`Record ${schemaId} must set status=proposed`)
    }

    if (!record.proposedByteDescriptor || record.proposedByteDescriptor.intendedSchema !== 'media.byte_descriptor.v1') {
      throw new Error(`Record ${schemaId} must propose media.byte_descriptor.v1`)
    }

    for (const flag of ['byteAvailabilityProof', 'materializationProof', 'byteAuthority']) {
      if (record[flag] !== false) {
        throw new Error(`Record ${schemaId} must set ${flag}=false`)
      }
    }

    for (const flag of ['byteAvailabilityProof', 'materializationProof']) {
      if (record.proposedByteDescriptor[flag] !== false) {
        throw new Error(`Record ${schemaId}.proposedByteDescriptor must set ${flag}=false`)
      }
    }

    validateLocalFalseFlags(record, schemaId)
  }

  if (schemaId === artifactKinds.mediaLocalLayerResourceRefCandidateLocal) {
    validateRef(record.sourceRef, `${schemaId}.sourceRef`)
    assertSafeLocalPath(record.sourcePath)
    assertResolvabilityCategory(record.currentRefCategory)
    assertResolvabilityCategory(record.targetRefCategory)
    validateResolvabilityPosture(record.resolvabilityPosture, `${schemaId}.resolvabilityPosture`)

    if (record.status !== 'candidate') {
      throw new Error(`Record ${schemaId} must set status=candidate`)
    }

    if (!record.proposedResourceRef || typeof record.proposedResourceRef !== 'object') {
      throw new Error(`Record ${schemaId} must include proposedResourceRef`)
    }

    validateResourcePromotionPosture(record, schemaId)
    validateByteDescriptorAlignment(record.byteDescriptorAlignment, `${schemaId}.byteDescriptorAlignment`)

    for (const flag of ['localLayerResourceRef', 'replicatedPointerRef', 'causalReviewableRef']) {
      if (record[flag] !== false) {
        throw new Error(`Record ${schemaId} must set ${flag}=false`)
      }
    }

    for (const flag of ['resourceAdmission', 'materializationProof', 'promotionAuthority']) {
      if (record[flag] !== undefined && record[flag] !== false) {
        throw new Error(`Record ${schemaId} must set ${flag}=false when present`)
      }
    }

    validateLocalFalseFlags(record, schemaId)
  }

  if (schemaId === artifactKinds.mediaOperationCandidateLocal) {
    assertSetValue(record.artifactClass, operationArtifactClasses, `${schemaId}.artifactClass`)
    assertSetValue(record.operationClass, operationClasses, `${schemaId}.operationClass`)
    assertSetValue(record.scopeDelta, operationScopeDeltas, `${schemaId}.scopeDelta`)
    assertSetValue(record.riskTier, operationRiskTiers, `${schemaId}.riskTier`)
    assertSetValue(record.reversibility, operationReversibility, `${schemaId}.reversibility`)
    assertSetValue(record.authorityBoundary, operationAuthorityBoundaries, `${schemaId}.authorityBoundary`)
    assertSetValue(record.evidenceRequirement, operationEvidenceRequirements, `${schemaId}.evidenceRequirement`)
    validateRef(record.subjectRef, `${schemaId}.subjectRef`)
    validateRefArray(record.sourceRefs, `${schemaId}.sourceRefs`)
    validateLocalFalseFlags(record, schemaId)
  }

  if (schemaId === artifactKinds.mediaRuleResolutionTraceLocal) {
    assertSetValue(record.resolutionMode, ruleResolutionModes, `${schemaId}.resolutionMode`)
    assertSetValue(record.deliveryMode, ruleDeliveryModes, `${schemaId}.deliveryMode`)
    validateRef(record.operationRef, `${schemaId}.operationRef`)
    validateRef(record.effectiveRuleBookRef, `${schemaId}.effectiveRuleBookRef`)

    for (const collection of ['reasons', 'appliedRules', 'blockedClaims']) {
      if (!Array.isArray(record[collection])) {
        throw new Error(`Record ${schemaId}.${collection} must be an array`)
      }
    }

    if (record.reasons.length === 0 || record.appliedRules.length === 0) {
      throw new Error(`Record ${schemaId} must include reasons and appliedRules`)
    }

    if (record.operatorGuidanceOnly !== true) {
      throw new Error(`Record ${schemaId} must set operatorGuidanceOnly=true`)
    }

    validateTraceNonClaims(record, schemaId)
    validateLocalFalseFlags(record, schemaId)
  }

  if (localGeneratedSchemas.has(schemaId)) {
    validateLocalDoctrineFlags(record, schemaId)
  }

  return true
}

function validateRefArray(refs, label) {
  if (!Array.isArray(refs)) {
    throw new Error(`${label} must be an array`)
  }

  refs.forEach((ref, index) => validateRef(ref, `${label}[${index}]`))
}

function validateLocalFalseFlags(record, schemaId) {
  const falseFlags = ['meshTruth', 'distributedProof', 'ratifiedSharedState']

  if (record.localOnly !== true) {
    throw new Error(`Record ${schemaId} must set localOnly=true`)
  }

  for (const flag of falseFlags) {
    if (record[flag] !== false) {
      throw new Error(`Record ${schemaId} must set ${flag}=false`)
    }
  }
}

function assertSetValue(value, allowed, label) {
  if (!allowed.includes(value)) {
    throw new Error(`${label} has invalid value: ${value}`)
  }
}

function validateTraceNonClaims(record, schemaId) {
  const requiredFalseFlags = [
    'authorityGranted',
    'executionPerformed',
    'edgeCalled',
    'meshPublished',
    'truthClaimed',
    'completionClaimed',
    'providerTruthClaimed',
    'byteAvailabilityProven',
    'materializationProven',
    'causalTruthClaimed',
    'publicationAuthorized'
  ]

  if (!record.nonClaims || typeof record.nonClaims !== 'object') {
    throw new Error(`Record ${schemaId} must include nonClaims`)
  }

  for (const flag of requiredFalseFlags) {
    if (record[flag] !== false || record.nonClaims[flag] !== false) {
      throw new Error(`Record ${schemaId} must set ${flag}=false`)
    }
  }
}

function validateLocalDoctrineFlags(record, schemaId) {
  validateLocalFalseFlags(record, schemaId)

  if (!isNonEmptyString(record.localTruthLabel)) {
    throw new Error(`Record ${schemaId} is missing localTruthLabel`)
  }

  if (!isNonEmptyString(record.truthStatus) || !record.truthStatus.includes('not mesh truth')) {
    throw new Error(`Record ${schemaId} is missing doctrine truthStatus`)
  }

  if (schemaId === artifactKinds.mediaOperatorDecision && record.localDecisionOnly !== true) {
    throw new Error(`Record ${schemaId} must set localDecisionOnly=true`)
  }

  if (schemaId === artifactKinds.mediaLocalRunManifest) {
    if (record.resolvabilityPosture !== undefined) {
      validateResolvabilityPosture(record.resolvabilityPosture, `${schemaId}.resolvabilityPosture`)
    }

    if (record.candidateInputRef?.resolvabilityCategory !== undefined) {
      assertResolvabilityCategory(record.candidateInputRef.resolvabilityCategory)
    }

    const requiredFalseFlags = [
      'meshTruth',
      'distributedProof',
      'ratifiedSharedState',
      'providerTruth',
      'byteAvailabilityProof',
      'materializationProof',
      'causalTruth',
      'publicationAuthorization'
    ]

    if (record.operatorGuidanceOnly !== true) {
      throw new Error(`Record ${schemaId} must set operatorGuidanceOnly=true`)
    }

    for (const flag of requiredFalseFlags) {
      if (record[flag] !== false) {
        throw new Error(`Record ${schemaId} must set ${flag}=false`)
      }
    }
  }

  if (schemaId === artifactKinds.mediaEdgeInspectionPacketLocal || schemaId === artifactKinds.mediaEdgeExportBundleLocal) {
    const requiredFalseFlags = [
      'meshTruth',
      'distributedProof',
      'ratifiedSharedState',
      'providerTruth',
      'byteAvailabilityProof',
      'materializationProof',
      'publicationAuthorization'
    ]

    for (const flag of requiredFalseFlags) {
      if (record[flag] !== false) {
        throw new Error(`Record ${schemaId} must set ${flag}=false`)
      }
    }
  }

  if (schemaId === artifactKinds.mediaByteReferencePreviewLocal) {
    for (const flag of ['byteAvailabilityProof', 'materializationProof']) {
      if (record[flag] !== false) {
        throw new Error(`Record ${schemaId} must set ${flag}=false`)
      }
    }
  }
}

function validateEdgeClassification(classification, schemaId) {
  if (!classification || typeof classification !== 'object') {
    throw new Error(`Record ${schemaId} must include edgeImportClassification`)
  }

  const required = [
    'projectId',
    'targetRepo',
    'targetSurface',
    'evidenceKind',
    'edgeExpectedEvidenceKind'
  ]
  const missing = required.filter((field) => !isNonEmptyString(classification[field]))
  if (missing.length > 0) {
    throw new Error(`Record ${schemaId}.edgeImportClassification is missing: ${missing.join(', ')}`)
  }

  if (classification.classificationOnly !== true) {
    throw new Error(`Record ${schemaId}.edgeImportClassification must set classificationOnly=true`)
  }

  if (classification.edgeOwnsSchema !== false) {
    throw new Error(`Record ${schemaId}.edgeImportClassification must set edgeOwnsSchema=false`)
  }

  if (classification.targetRepo !== 'mesh-ecology-media-studio') {
    throw new Error(`Record ${schemaId}.edgeImportClassification targetRepo must be mesh-ecology-media-studio`)
  }

  if (classification.targetSurface !== 'media-edge-operator-seam') {
    throw new Error(`Record ${schemaId}.edgeImportClassification targetSurface must be media-edge-operator-seam`)
  }
}

function validateEdgeRuntimeFlags(record, schemaId) {
  for (const flag of ['edgeRuntimeBuilt', 'edgeRuntimeVerified']) {
    if (record[flag] !== false) {
      throw new Error(`Record ${schemaId} must set ${flag}=false`)
    }
  }
}

function validateEdgeCandidate(candidate, artifactKind, schemaVersion, schemaId) {
  if (!candidate || typeof candidate !== 'object') {
    throw new Error(`Record ${schemaId} must include ${artifactKind} candidate`)
  }

  if (candidate.edgeArtifactKind !== artifactKind) {
    throw new Error(`Record ${schemaId} candidate must target ${artifactKind}`)
  }

  if (candidate.edgeSchemaVersion !== schemaVersion) {
    throw new Error(`Record ${schemaId} candidate must target ${schemaVersion}`)
  }

  if (candidate.edgeRuntimeBuilt !== false || candidate.edgeRuntimeVerified !== false) {
    throw new Error(`Record ${schemaId} candidate must not claim Edge runtime build or verification`)
  }

  if (candidate.operatorGuidanceOnly !== true || candidate.reviewOnly !== true) {
    throw new Error(`Record ${schemaId} candidate must be review-only operator guidance`)
  }
}

function validateRef(ref, label) {
  if (!ref || typeof ref !== 'object') {
    throw new Error(`${label} must be an object ref`)
  }

  if (!isNonEmptyString(ref.kind)) {
    throw new Error(`${label}.kind must be a string`)
  }

  if (!isNonEmptyString(ref.id)) {
    throw new Error(`${label}.id must be a string`)
  }

  if (ref.schema !== undefined && !isNonEmptyString(ref.schema)) {
    throw new Error(`${label}.schema must be a string when present`)
  }
}

function validateGeneratedRecordRef(ref, label) {
  validateRef(ref, label)

  if (!isNonEmptyString(ref.path)) {
    throw new Error(`${label}.path must be a string`)
  }

  if (ref.resolvabilityCategory !== undefined) {
    assertResolvabilityCategory(ref.resolvabilityCategory)
  }

  if (ref.localOnly !== true) {
    throw new Error(`${label}.localOnly must be true`)
  }

  if (ref.byteRefPreview !== undefined) {
    validateRequiredRecord(ref.byteRefPreview, artifactKinds.mediaByteReferencePreviewLocal)
  }
}

function validateInspectionRef(ref, label) {
  validateRef(ref, label)

  if (!isNonEmptyString(ref.path)) {
    throw new Error(`${label}.path must be a string`)
  }

  assertSafeLocalPath(ref.path)

  if (ref.localOnly !== true) {
    throw new Error(`${label}.localOnly must be true`)
  }
}

function validateResolvabilityPosture(posture, label) {
  if (!posture || typeof posture !== 'object') {
    throw new Error(`${label} must be an object`)
  }

  assertResolvabilityCategory(posture.currentCategory)
  assertResolvabilityCategory(posture.targetCategory)

  if (posture.localJsonIsScaffold !== true || posture.localPathIsScaffold !== true) {
    throw new Error(`${label} must preserve local JSON/path scaffold posture`)
  }

  if (posture.operatorFacingIdentityBoundary !== false) {
    throw new Error(`${label} must not claim operator-facing identity boundary`)
  }
}

function validateByteDescriptorAlignment(alignment, label) {
  if (!alignment || typeof alignment !== 'object') {
    throw new Error(`${label} must be an object`)
  }

  if (!['aligned', 'missing-byte-descriptor-proposal'].includes(alignment.status)) {
    throw new Error(`${label} has invalid status: ${alignment.status}`)
  }

  if (alignment.requiredBeforePromotion !== true) {
    throw new Error(`${label} must set requiredBeforePromotion=true`)
  }

  if (alignment.status === 'aligned') {
    validateInspectionRef(alignment.byteDescriptorProposalRef, `${label}.byteDescriptorProposalRef`)
  } else if (alignment.byteDescriptorProposalRef !== null && alignment.byteDescriptorProposalRef !== undefined) {
    throw new Error(`${label}.byteDescriptorProposalRef must be null when missing`)
  }
}

function validateResourcePromotionPosture(record, schemaId) {
  const proposed = record.proposedResourceRef
  const posture = record.promotionPosture

  if (proposed.candidateOnly !== true) {
    throw new Error(`Record ${schemaId}.proposedResourceRef must set candidateOnly=true`)
  }

  if (proposed.promotionStatus !== 'candidate-only') {
    throw new Error(`Record ${schemaId}.proposedResourceRef must set promotionStatus=candidate-only`)
  }

  if (proposed.promotionAuthority !== false) {
    throw new Error(`Record ${schemaId}.proposedResourceRef must set promotionAuthority=false`)
  }

  for (const flag of ['resourceAdmission', 'materializationProof']) {
    if (proposed[flag] !== undefined && proposed[flag] !== false) {
      throw new Error(`Record ${schemaId}.proposedResourceRef must set ${flag}=false when present`)
    }
  }

  if (!posture || typeof posture !== 'object') {
    throw new Error(`Record ${schemaId} must include promotionPosture`)
  }

  if (posture.status !== 'candidate-only') {
    throw new Error(`Record ${schemaId}.promotionPosture must set status=candidate-only`)
  }

  if (posture.admissionRequired !== true || posture.byteDescriptorRequired !== true) {
    throw new Error(`Record ${schemaId}.promotionPosture must require admission and byte descriptor alignment`)
  }

  if (posture.requiredTargetCategory !== 'local_layer_resource_ref') {
    throw new Error(`Record ${schemaId}.promotionPosture must target local_layer_resource_ref`)
  }

  for (const flag of ['promotionAuthority', 'localLayerResourceRef', 'replicatedPointerRef', 'causalReviewableRef']) {
    if (posture[flag] !== false) {
      throw new Error(`Record ${schemaId}.promotionPosture must set ${flag}=false`)
    }
  }

  if (!Array.isArray(posture.notes)) {
    throw new Error(`Record ${schemaId}.promotionPosture.notes must be an array`)
  }
}

function validateReadinessResourceSummary(summary, label) {
  if (!summary || typeof summary !== 'object') {
    throw new Error(`${label} must be an object`)
  }

  if (summary.operatorGuidanceOnly !== true || summary.localOnly !== true) {
    throw new Error(`${label} must remain local operator guidance`)
  }

  for (const flag of ['meshTruth', 'distributedProof', 'ratifiedSharedState', 'edgeRuntimeVerified']) {
    if (summary[flag] !== false) {
      throw new Error(`${label} must set ${flag}=false`)
    }
  }
}

function validateHandoffDiagnosis(diagnosis, label) {
  if (!diagnosis || typeof diagnosis !== 'object') {
    throw new Error(`${label} must be an object`)
  }

  for (const collection of ['blockingIssues', 'reasons', 'nextActions']) {
    if (!Array.isArray(diagnosis[collection])) {
      throw new Error(`${label}.${collection} must be an array`)
    }
  }

  if (diagnosis.operatorGuidanceOnly !== true || diagnosis.localOnly !== true) {
    throw new Error(`${label} must remain local operator guidance`)
  }

  for (const flag of ['meshTruth', 'distributedProof', 'ratifiedSharedState', 'edgeRuntimeVerified']) {
    if (diagnosis[flag] !== false) {
      throw new Error(`${label} must set ${flag}=false`)
    }
  }
}

function validateCrossProjectInput(project, label) {
  if (!project || typeof project !== 'object') {
    throw new Error(`${label} must be an object`)
  }

  if (!isNonEmptyString(project.projectId)) {
    throw new Error(`${label}.projectId must be a string`)
  }

  validateInspectionRef(project.rootRef, `${label}.rootRef`)

  if (!project.artifactRefs || typeof project.artifactRefs !== 'object') {
    throw new Error(`${label}.artifactRefs must be an object`)
  }

  for (const [name, ref] of Object.entries(project.artifactRefs)) {
    validateInspectionRef(ref, `${label}.artifactRefs.${name}`)
  }
}

function validateCrossProjectSummary(summary, label) {
  if (!summary || typeof summary !== 'object') {
    throw new Error(`${label} must be an object`)
  }

  if (!isNonEmptyString(summary.projectId)) {
    throw new Error(`${label}.projectId must be a string`)
  }

  validateInspectionRef(summary.rootRef, `${label}.rootRef`)

  if (!summary.refs || typeof summary.refs !== 'object') {
    throw new Error(`${label}.refs must be an object`)
  }

  for (const [name, ref] of Object.entries(summary.refs)) {
    validateInspectionRef(ref, `${label}.refs.${name}`)
  }

  for (const collection of ['blockingIssues', 'nextActions', 'warnings']) {
    if (!Array.isArray(summary[collection])) {
      throw new Error(`${label}.${collection} must be an array`)
    }
  }

  if (summary.missingArtifactRefs !== undefined) {
    if (!Array.isArray(summary.missingArtifactRefs)) {
      throw new Error(`${label}.missingArtifactRefs must be an array`)
    }

    summary.missingArtifactRefs.forEach((missing, index) => {
      if (!missing || typeof missing !== 'object' || !isNonEmptyString(missing.name)) {
        throw new Error(`${label}.missingArtifactRefs[${index}] must include name`)
      }
      validateInspectionRef(missing.expectedRef, `${label}.missingArtifactRefs[${index}].expectedRef`)
      for (const flag of ['meshTruth', 'distributedProof', 'ratifiedSharedState']) {
        if (missing[flag] !== false) {
          throw new Error(`${label}.missingArtifactRefs[${index}] must set ${flag}=false`)
        }
      }
      if (missing.localOnly !== true) {
        throw new Error(`${label}.missingArtifactRefs[${index}] must set localOnly=true`)
      }
    })
  }

  if (summary.operatorGuidanceOnly !== true || summary.localOnly !== true) {
    throw new Error(`${label} must remain local operator guidance`)
  }

  for (const flag of ['meshTruth', 'distributedProof', 'ratifiedSharedState', 'edgeRuntimeBuilt', 'edgeRuntimeVerified']) {
    if (summary[flag] !== false) {
      throw new Error(`${label} must set ${flag}=false`)
    }
  }
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0
}
