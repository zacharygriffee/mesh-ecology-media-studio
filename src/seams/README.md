# Seams

Future seam code belongs here.

Initial seam names:

- `media-edge-operator-seam`
- `media-work-packet-seam`
- `media-evidence-import-seam`
- `media-readiness-guidance-seam`
- `media-operator-decision-seam`
- `media-byte-reference-seam`
- `media-causal-evidence-seam`

Current local inspection helpers:

- `inspect-local-run.js`: exports a manifest-backed local run as
  `media.edge_inspection_packet.local.v1`.
- `inspect-venice-smoke.js`: exports a successful Venice smoke run.
- `inspect-provider-failure.js`: exports a failed provider result posture
  without generated assets.

These helpers do not call Edge or publish to mesh.
