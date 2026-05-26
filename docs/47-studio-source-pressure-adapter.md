# Studio Source-Pressure Adapter v0

Status: bounded local Studio posture; not Layer runtime, authority, admission,
append, continuity, or production storage.

## Purpose

Studio may emit source-owned pressure for the generic Layer seam through:

```text
media.studio_source_pressure_adapter_candidate.local.v1
-> media.studio_source_pressure_adapter_operator_decision.local.v1
-> media.studio_source_pressure_observation_result.local.v1
```

The target Layer envelope remains `layer_source_pressure_review.v0`. This is
not a Studio-specific Layer API.

## Required Posture

- Studio owns the media-domain pressure and source refs.
- Layer owns the generic review seam.
- The adapter candidate asks whether Studio pressure may be represented as
  generic Layer source pressure.
- The operator decision approves only a future bounded observation.
- The observation/result records that one Studio-shaped pressure artifact was
  routed through the generic Layer seam.

## Blocked

- no Studio-specific Layer API
- no Layer admission
- no durable append
- no accepted continuity
- no production storage selection
- no writer/reader admission change
- no Edge authority
- no payload validity from ref discovery
- no auto-execute

## Next Safe Move

Edge may review the observation through its Layer lane controller/action queue
surface as optional operator-facing mediation only.
