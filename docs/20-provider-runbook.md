# Provider Runbook

This runbook covers the current Venice-only provider workflow.

## Dry Run

Dry-run tests map Studio generation requests to Venice-shaped payloads and
fixture responses back to `media.provider_result.v1`.

```bash
npm test
```

Dry-run paths do not read provider keys and do not call Venice.

## Live Smoke

Live smoke is explicitly gated:

```bash
VENICE_LIVE=1 npm run provider:venice:smoke
```

The command reads `VENICE_INFERENCE_KEY` from the shell environment or ignored
`.env`.

The smoke gate constrains the request to:

- `venice-sd35`
- `512x512`
- one variant
- JSON/base64 output
- no web search

Successful smoke runs write local bytes, asset descriptors, review evidence,
readiness, local operator decision, and a manifest under ignored
`examples/venice-smoke/`. They also write a local adapter-run receipt and image
metadata when PNG dimensions can be read.

Failed smoke runs write the normalized provider result, adapter-run receipt,
and local provider-failure evidence. They do not create generated assets or
review decisions.

## Inspect Existing Runs

Export a Venice smoke run:

```bash
npm run inspect:venice-smoke
```

Export any local manifest-backed run:

```bash
npm run inspect:local-run -- --project-dir examples/card-to-candidate
```

Export failed provider posture:

```bash
npm run inspect:provider-failure
```

Summarize an inspection packet:

```bash
npm run inspect:summary -- --project-dir examples/card-to-candidate --packet records/exports/local-run-edge-inspection-packet.local.json
```

Index inspection records in a project:

```bash
npm run inspect:index -- --project-dir examples/card-to-candidate
```

Index provider attempts in a project:

```bash
npm run inspect:provider-runs -- --project-dir examples/card-to-candidate
```

Write local inference-source posture after a Venice loop:

```bash
npm run provider:venice:loop -- --project-dir examples/venice-smoke
npm run inference:source-posture -- --project-dir examples/venice-smoke
```

This writes `media.studio_inference_source_posture.local.v1`. It classifies
operator-supplied, Studio provider-adapter, Edge agent-seat, local inference,
Agent Bridge/BYO-AI, and mesh-v0-2 pub/rat source lanes. Existing Venice records
count as local `studio_provider_adapter` evidence only. The posture writer does
not call Venice, read provider keys, dispatch Edge work, prove provider truth,
materialize Bytes, claim Causal continuity, admit Layer refs, publish to mesh,
or mark production readiness.

Promote an existing local candidate without rerunning provider work:

```bash
npm run promote:candidate -- --project-dir examples/card-to-candidate --decision accepted
```

Regenerate the committed inspection fixture deterministically:

```bash
npm run fixture:inspection
npm run fixture:inspection:check
```

Create a local export bundle from an inspection packet:

```bash
npm run export:inspection-bundle -- --project-dir examples/card-to-candidate
```

Inspection export creates local `media.edge_inspection_packet.local.v1` packets.
It does not call Venice, Edge, Bytes, causal-substrate, or mesh publication.

## Boundaries

Provider API responses are provenance, not authority. Local file existence,
hashes, byte-preview fields, and operator decisions remain local-only until a
future mesh-facing lane promotes them through the proper proposal, publication,
ratification, and materialization flows.

Provider adapter contracts and failure taxonomies are documented in
[Provider Adapter Contracts](21-provider-adapter-contracts.md).
