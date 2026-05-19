# mesh-ecology-media-studio

`mesh-ecology-media-studio` is the media-domain frontier for mesh ecology.
The product/app label is **Studio** and the domain identity is `media-studio`.

Studio owns media-specific semantics for cards, shots, scenes, references,
provider jobs, generated candidates, media assets, reviews, approvals,
continuity evidence, byte references, rough cuts, and exports.

## Purpose

Studio starts as a local-first media production repo with explicit descriptors
and evidence. Its first operational wedge is:

```text
card -> provider job -> media candidate -> ingest -> review -> accept/reject
```

Mode 0 must work without Edge, mesh publication, provider API integration, or
distributed byte materialization.

## Non-Goals

Studio does not:

- implement a full video studio UI in this first pass
- call provider APIs yet
- require Edge
- act as a mesh runtime, ratification engine, byte store, or truth engine
- make local JSON, local files, UI selection, publication, receipts, or review
  into mesh truth
- make causal-substrate, Autobase, Hypercore, Hyperdrive, or Hyperblob mandatory

## Operating Modes

- **Mode 0: standalone-local**. Local project folder, local descriptors, local
  receipts, local decisions, and local media files. Useful by itself.
- **Mode 1: edge-mediated**. Edge may inspect exported work packets, evidence,
  readiness guidance, and operator decision requests.
- **Mode 2: mesh-mediated**. Media descriptors, byte references, proposals,
  PUBs/RATs, and ratification flows become mesh-facing.
- **Mode 3: distributed production**. Multiple devices, actors, providers,
  ratifiers, and operator surfaces cooperate.

## Repo Relationships

### Edge

Studio is Edge-compatible, not Edge-dependent.

Edge owns the operator-facing boundary/control plane, evidence inboxes,
readiness guidance, workbench composition, and operator-mediated handoff
posture. Studio owns media-specific work and records.

Primary seam:

```text
media-edge-operator-seam
```

Sub-seams:

```text
media-work-packet-seam
media-evidence-import-seam
media-readiness-guidance-seam
media-operator-decision-seam
media-byte-reference-seam
media-causal-evidence-seam
```

### Spine

Spine is the system-composition reference for how mesh ecology repos fit
together. Studio follows that posture by treating HTTP, local paths, JSON
files, provider results, receipts, and local operator actions as bootstrap or
evidence surfaces unless a later mesh-facing lane explicitly promotes them.

### Packs

Packs provides shared actor/control-plane vocabulary. Studio preserves these
media intent families without letting Packs own media product semantics:

```text
image-generation
video-generation
audio-generation
media-transformation
media-evidence
```

### Bytes

Large media bytes belong in local files, Hyperdrive, Hyperblob, or later byte
materialization stores. `mesh-ecology-bytes` defines portable byte descriptors,
references, and materialization requests. Studio defines what a media asset
means, how it was produced, how it was reviewed, and how it relates to cards.

### Causal Substrate

`causal-substrate` remains optional. Studio records causal-shaped fields early
enough to map later through `media-causal-adapter`, including parent refs,
referents, branch ids, context ids, observer/operator ids, continuity claims,
and transition summaries.

## First Executable Wedge

Run the local-only example:

```bash
npm run wedge:example
```

This reads `examples/card-to-candidate/input/card.json`, treats
`examples/card-to-candidate/local-media/candidate.txt` as the local generated
candidate, hashes it, writes a local work packet, provider result descriptor,
asset descriptor, review evidence, readiness record, and local operator
decision under `examples/card-to-candidate/out/`. Phase 2 also writes a local
run manifest: `media-local-run-manifest.local.json`.

All generated records are local drafts, local receipts, local caches, or local
decisions. They are not mesh truth, distributed proof, or ratified shared state.

Run local tests:

```bash
npm test
```

Phase 2 inspection hardening adds the manifest, a small artifact-kind registry,
and modest malformed-record checks so Edge can inspect later without being
required now.

## Start Here

- [docs/00-start-here.md](docs/00-start-here.md)
- [docs/01-charter.md](docs/01-charter.md)
- [docs/09-first-wedge.md](docs/09-first-wedge.md)
- [docs/10-edge-inspection-preview.md](docs/10-edge-inspection-preview.md)
