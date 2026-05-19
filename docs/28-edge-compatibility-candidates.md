# Edge Compatibility Candidates

Phase 13 maps Studio's local inspection output to documented Edge review
artifact shapes without requiring Edge to run.

This phase reads `mesh-ecology-edge` as doctrine only. Studio does not mutate
Edge and does not claim that Edge accepted, built, verified, imported, or
published these records.

## Read-Only Edge Inputs

The compatibility bundle targets these documented Edge shapes:

- `edge_cross_project_work_packet.v1`
- `edge_cross_project_evidence_import.v1`
- `edge_cross_project_readiness_view.v1`
- `edge_operator_return_surface.v1`
- `edge_operator_decision.v1`

The source docs are:

- `../mesh-ecology-edge/docs/phase-139-cross-project-readiness-view.md`
- `../mesh-ecology-edge/docs/phase-140-cross-project-work-packet.md`
- `../mesh-ecology-edge/docs/phase-142-cross-project-evidence-import.md`
- `../mesh-ecology-edge/docs/phase-146-operator-return-surface.md`
- `../mesh-ecology-edge/docs/phase-150-operator-decision-builder.md`

## Command

Run the local wedge and inspection commands first:

```bash
npm run wedge:example
npm run inspect:local-run -- --project-dir examples/card-to-candidate
npm run status:project -- --project-dir examples/card-to-candidate
npm run readiness:edge -- --project-dir examples/card-to-candidate
npm run control:surface -- --project-dir examples/card-to-candidate
npm run edge:compat -- --project-dir examples/card-to-candidate
```

The final command writes:

```text
records/exports/media-edge-compatibility-bundle.local.json
```

If optional production strategy records exist under `records/production/`,
local inspection and Edge compatibility bundles include them as Studio-owned
source records. This lets Edge inspect scene/shot/clip, rough-cut, export,
world, panorama, reference primitive, continuity band, and render strategy
posture without requiring Edge to own those media semantics.

## Studio-Owned Evidence

The bundle contains a nested Studio-owned evidence shape:

```text
media.edge_review_evidence.local.v1
```

It also carries Edge generic import classification metadata:

```text
edgeImportClassification.classificationOnly: true
edgeImportClassification.edgeOwnsSchema: false
targetRepo: mesh-ecology-media-studio
targetSurface: media-edge-operator-seam
```

This is evidence routing metadata only. It is not Edge truth, project
completion, schema acceptance, or execution permission.

## Edge Shape Candidates

The bundle includes Edge-shaped candidates under explicit candidate names:

- `edgeWorkPacketCandidate`
- `edgeEvidenceImportCandidate`
- `edgeReadinessViewCandidate`
- `edgeReturnSurfaceCandidate`

They use `edgeArtifactKind` and `edgeSchemaVersion`, not Edge-owned
`artifactKind` claims. This keeps them readable by future Edge work while
making the boundary clear:

```text
edgeRuntimeBuilt: false
edgeRuntimeVerified: false
```

The bundle also carries `readinessResourceSummary`, copied from Studio's local
status/readiness records. This lets Edge inspect missing byte proposals,
missing resource candidates, unresolved candidates, stale byte descriptor
proposals, and stale resource candidates without treating them as Edge runtime
verification. If `media.project_health.local.v1` exists, the bundle includes it
as another Studio source record for inspection.

## No Runtime Integration

This phase does not:

- call Edge
- invoke an Edge REPL command
- create browser endpoints
- mutate repos
- execute provider work
- schedule or run jobs
- publish to mesh
- infer mesh truth, domain truth, provider truth, byte proof, or ratifier
  authority

The bundle is a local compatibility artifact for future operator-facing Edge
inspection.
