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

## Local Command

By default, Studio emits only the Edge and Layer pressure artifacts:

```bash
npm run pressure:studio -- --project-dir examples/card-to-candidate
```

Add `--adapter-chain` to emit the bounded local adapter chain:

```bash
npm run pressure:studio -- --project-dir examples/card-to-candidate --adapter-chain
```

This writes:

```text
records/exports/media-studio-source-pressure-adapter-candidate.local.json
records/exports/media-studio-source-pressure-adapter-operator-decision.local.json
records/exports/media-studio-source-pressure-observation-result.local.json
```

Use `--adapter-decision rejected` to write only the candidate and operator
decision, with no observation result.

Refresh the read-only operator surfaces after emitting the chain:

```bash
npm run inspect:local-run -- --project-dir examples/card-to-candidate
npm run operator:index -- --project-dir examples/card-to-candidate
npm run edge:compat -- --project-dir examples/card-to-candidate
```

These surfaces may carry adapter refs and counts for local review. They do not
call Layer or Edge, create queue actions, dispatch work, accept results, or
grant authority.

The adapter artifacts are runtime evidence. They are intentionally not checked
into `examples/card-to-candidate`; regenerate them when an operator needs a
fresh local review package.

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
