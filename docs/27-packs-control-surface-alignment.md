# Packs Control Surface Alignment

Phase 12 aligns Studio's local inspection records with the control-surface
vocabulary in `mesh-ecology-packs`. This is a semantic projection only. It does
not add UI, Edge calls, provider calls, surface runtime messages, mesh
publication, or authoring authority.

## Read-Only Packs Doctrine

The projection is based on these read-only Packs sources:

- `../mesh-ecology-packs/docs/surface-first-doctrine.md`
- `../mesh-ecology-packs/docs/adjacent-control-plane-conventions.md`
- `../mesh-ecology-packs/docs/adjacent-control-plane-observation-contract.md`
- `../mesh-ecology-packs/docs/control-plane-information-architecture.md`
- `../mesh-ecology-packs/docs/mesh-native-interaction-model.md`
- `../mesh-ecology-packs/docs/media-intent-map.md`
- `../mesh-ecology-packs/docs/media-contract.json`

Studio does not copy Packs ownership into media semantics. Packs owns shared
control-plane vocabulary. Studio owns cards, provider lineage, assets, reviews,
continuity evidence, and media-specific inspection records.

## Projection Record

Run:

```bash
npm run control:surface -- --project-dir examples/card-to-candidate
```

The command writes:

```text
records/exports/media-control-surface-projection.local.json
```

The record kind is:

```text
media.control_surface_projection.local.v1
```

It maps local Studio outputs into Packs-facing concepts:

- planes: `presentation`, `operational`, `authoring`
- views: `topology`, `concerns`, `actors`, `evidence`, `actions`, `approvals`
- posture: `readonly observer`
- observation refs: local manifest, inspection packet, export bundle, provider
  ledger, project status, candidate reviews, and continuity evidence when
  present

## No UI Contract Yet

This phase deliberately stops before UI. The projection does not define:

- layout
- renderer components
- browser storage
- `surface.request`
- `surface.response`
- `surface.event`
- writable worker posture
- authority initialization

The projection is meant to help a later Edge or operator surface inspect local
Studio output without deciding presentation or authority too early.

## Doctrine Flags

The projection is local-only:

```text
localOnly: true
meshTruth: false
distributedProof: false
ratifiedSharedState: false
providerTruth: false
authoritySurface: false
rendererContract: false
```

It is a local cache and observation aid, not an authority surface.
