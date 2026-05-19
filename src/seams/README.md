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
- `summarize-inspection-packet.js`: prints a compact table for an inspection
  packet.
- `index-inspection-records.js`: lists local manifests, provider results, and
  inspection packets.
- `index-provider-runs.js`: writes a local provider-run ledger across one
  project.
- `export-inspection-bundle.js`: copies an inspection packet, local records,
  and referenced artifacts into a local handoff-preview bundle.
- `project-status.js`: writes a local project status snapshot for cards,
  references, provider runs, assets, reviews, and exports.
- `control-surface-projection.js`: writes a local Packs-aligned control
  surface projection for future Edge inspection without defining UI contracts.
- `edge-compatibility-bundle.js`: writes Studio-owned evidence and
  Edge-shaped review candidates without calling or claiming Edge runtime
  verification.
- `continuity-evidence.js`: writes local continuity evidence drafts for an
  asset's card, branch, context, and lineage fields.

These helpers do not call Edge or publish to mesh.
