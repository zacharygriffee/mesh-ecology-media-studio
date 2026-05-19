# Edge Inspection Preview

Phase 2 does not implement Edge integration. It only makes Studio's local
records easier for Edge to inspect later.

Studio remains Edge-compatible, not Edge-dependent. Mode 0 runs
standalone-local with local descriptors, local receipts, local evidence, local
decisions, and a local run manifest.

## Future Inspection Path

Edge may later inspect Studio outputs through these seams:

- `media-edge-operator-seam`: top-level operator-facing inspection boundary.
- `media-work-packet-seam`: card refs, requested outputs, inputs, readiness,
  and operator context.
- `media-evidence-import-seam`: review evidence, provider result evidence,
  ingest evidence, continuity evidence, and local receipts.
- `media-readiness-guidance-seam`: readiness state, reasons, next actions, and
  operator-guidance-only posture.
- `media-operator-decision-seam`: local accept, reject, request changes, or
  defer decisions without treating them as authorization.
- `media-byte-reference-seam`: optional byte refs on asset descriptors without
  claiming byte availability, materialization proof, or storage authority.
- `media-causal-evidence-seam`: causal-shaped fields for later
  `media-causal-adapter` interpretation without claiming causal truth.

## Local Manifest Role

`media.local_run_manifest.v1` summarizes one standalone-local wedge run. It
lists input refs, generated record refs, artifact kinds, hashes, doctrine
labels, and warnings.

The manifest must keep these flags explicit:

```json
{
  "operatorGuidanceOnly": true,
  "localOnly": true,
  "meshTruth": false,
  "distributedProof": false,
  "ratifiedSharedState": false
}
```

The manifest is not an Edge inbox item, not a mesh publication, not a provider
truth claim, not byte materialization proof, and not operator authorization.
