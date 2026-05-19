# Edge Seams

The primary seam is:

```text
media-edge-operator-seam
```

It lets Edge inspect and organize Studio work without owning media semantics.

## Sub-Seams

- `media-work-packet-seam`: exports requested work, card refs, inputs,
  requested outputs, readiness, and operator context.
- `media-evidence-import-seam`: exposes evidence records for Edge inbox and
  operator attention flows.
- `media-readiness-guidance-seam`: exposes guidance records that say what is
  ready, blocked, or needs operator attention.
- `media-operator-decision-seam`: carries accept, reject, defer, and request
  changes decisions as local or later mesh-facing records.
- `media-byte-reference-seam`: links media asset descriptors to optional byte
  references without making Studio the byte store.
- `media-causal-evidence-seam`: exposes causal-shaped continuity fields for a
  future `media-causal-adapter`.

Edge may consume these seams in Mode 1. Mode 0 must not require Edge.
