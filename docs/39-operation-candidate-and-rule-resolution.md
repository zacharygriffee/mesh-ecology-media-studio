# Operation Candidate And Rule Resolution

Phase 39 makes Studio's adopted Spine rule-book posture concrete for local
media work.

## Operation Candidates

An operation candidate describes a possible media-domain operation before it is
executed. It uses bounded dimensions instead of bespoke policy names:

- `artifactClass`
- `operationClass`
- `scopeDelta`
- `riskTier`
- `reversibility`
- `authorityBoundary`
- `evidenceRequirement`
- `requestedBy`
- `sourceRefs`

The artifact kind is:

```text
media.operation_candidate.local.v1
```

Operation candidates are local drafts. They do not execute provider calls,
move files, publish to mesh, grant authority, or call Edge.

## Rule-Resolution Traces

A rule-resolution trace records the local mediation result for one operation
candidate.

The artifact kind is:

```text
media.rule_resolution_trace.local.v1
```

Allowed resolution modes are:

```text
auto_prepare
ask_operator
forbid
```

Allowed delivery modes are:

```text
log_only
inbox
urgent
critical
digest
```

`auto_execute` is not implemented. Studio can prepare local records and
operator guidance, but it does not run the operation behind the trace.

## Spine Rule-Book Posture

Studio adopts Spine's rule-book doctrine:

```text
A rule book is an elected compatibility boundary.
It is not truth.
It is not global law.
It is not runtime authority.
It is not a scheduler.
It is not an executor.
It is not causal-substrate.
```

Resolution precedence is:

```text
forbid > ask_operator > auto_prepare > auto_execute
```

Current posture:

- `auto_execute` is absent.
- Stricter rules win by default.
- Loosening requires explicit operator approval.
- The current resolver is deterministic and local.
- This is not a full inherited rule-book engine.

## Initial Resolver

The local resolver maps bounded operation dimensions to mediation pressure:

- `submit_live_provider_job` -> `ask_operator`, `urgent`
- `prepare_provider_job` -> `auto_prepare`, `log_only`, unless required card
  evidence is missing
- `move_candidate_to_accepted` / `move_candidate_to_rejected` ->
  `auto_prepare` only when review evidence is present, otherwise
  `ask_operator`
- `delete_local_media` -> `forbid`, `urgent`
- `propose_byte_descriptor` / `propose_resource_ref` -> `auto_prepare`,
  proposal/candidate only
- `prepare_export` -> `ask_operator`, `inbox`
- `generate_proxy` / `generate_thumbnail` -> `auto_prepare`, `log_only`

Each trace preserves non-claims:

```text
authorityGranted: false
executionPerformed: false
edgeCalled: false
meshPublished: false
truthClaimed: false
completionClaimed: false
providerTruthClaimed: false
byteAvailabilityProven: false
materializationProven: false
causalTruthClaimed: false
publicationAuthorized: false
```

## Edge Inspection

Rule books produce mediation pressure. Control surfaces deliver mediation
pressure.

Studio may produce local mediation artifacts. Edge may later inspect and
deliver them to an operator through the `media-edge-operator-seam`, but this
phase does not call Edge and does not make Studio the Edge cockpit.

## Example Command

Generate local example candidates and traces:

```bash
npm run rule:example
```

The command writes ignored runtime outputs under:

```text
examples/card-to-candidate/records/rule-traces/
```

## Inspection Visibility

Local inspection now scans `records/rule-traces/` and includes operation
candidates and rule-resolution traces in:

- `media.edge_inspection_packet.local.v1`
- inspection summary mediation rows
- `media.operator_packet_index.local.v1` mediation refs
- `media.edge_compatibility_bundle.local.v1` Studio source refs

This makes mediation pressure visible to later Edge review without making Edge
required and without treating traces as execution, approval, or authority.

## Non-Execution Boundary

This phase does not implement:

- full rule-book inheritance
- `auto_execute`
- provider API calls
- Edge runtime calls
- mesh publication
- Autobase or Hypercore/Corestore
- UI
- active organisms
- active ratifiers
- deletion execution
