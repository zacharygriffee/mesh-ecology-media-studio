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
Studio also follows Spine's family-wide identity layering posture: content
identity, byte publication identity, descriptor identity, situation/placement
identity, resource identity, causal referent identity, materialization identity,
and authority state must remain distinct.

Spine's Virtualia placement posture adds directional family vocabulary for
`sourceId`, `originLocusId`, `dreamRefId`, `emergenceLocusId`,
`emergencePathId`, `placementId`, and `projectionId`. Studio treats these as
alignment terms, not active schemas. Studio may surface Virtualia-compatible
media/projection pressure later, but Studio media assets and projections are
not Virtualia reality by themselves.

Studio is currently in a deliberate hybrid identity compatibility state. The
active `assetId` field remains content-derived for compatibility, while
`contentId` keys byte sameness and descriptor/situation/placement refs key
resource posture. Step 5, changing active `assetId` generation, is deferred
until storage/backend promotion, virtual-drive/materialization work, or a
deliberate descriptor-id schema transition. See
[Identity Migration Boundary](docs/44-identity-migration-boundary.md).

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

This reads `examples/card-to-candidate/cards/card.json`, treats
`examples/card-to-candidate/media/generated/candidate.txt` as the local
generated candidate, hashes it, copies it into `media/accepted/` or
`media/rejected/`, and writes local records under `records/`. The run also
writes a local manifest under `records/manifests/`.

All generated records are local drafts, local receipts, local caches, or local
decisions. They are not mesh truth, distributed proof, or ratified shared state.

Run local tests:

```bash
npm test
```

Optional Venice live smoke testing is gated and off by default:

```bash
VENICE_LIVE=1 npm run provider:venice:smoke
```

The command reads `VENICE_INFERENCE_KEY` from the environment or ignored `.env`,
uses a constrained image request, writes decoded bytes under
`media/generated/provider-smoke/`, and records only local non-truth-bearing
provider result, asset descriptor, review evidence, readiness, and operator
decision records.

Export an existing Venice smoke run for local Edge-readable inspection without
calling Venice:

```bash
npm run inspect:venice-smoke
```

Export any manifest-backed local run:

```bash
npm run inspect:local-run -- --project-dir examples/card-to-candidate
```

Export failed provider posture from local failure records:

```bash
npm run inspect:provider-failure
```

Summarize or index inspection records:

```bash
npm run inspect:summary -- --project-dir examples/card-to-candidate --packet records/exports/local-run-edge-inspection-packet.local.json
npm run inspect:index -- --project-dir examples/card-to-candidate
npm run operator:cross-project-index
```

Index provider attempts across a local project:

```bash
npm run inspect:provider-runs -- --project-dir examples/card-to-candidate
```

Create a local Edge-handoff preview bundle from an inspection packet:

```bash
npm run export:inspection-bundle -- --project-dir examples/card-to-candidate
```

Promote an existing local candidate without rerunning provider work:

```bash
npm run promote:candidate -- --project-dir examples/card-to-candidate --decision accepted
```

Ingest a local reference asset into `media/references/`:

```bash
npm run reference:ingest -- --project-dir examples/card-to-candidate --source media/generated/candidate.txt --filename candidate-reference.txt
```

Import source, generated, or reference media into the local project layout:

```bash
npm run media:import -- --project-dir examples/card-to-candidate --source media/generated/candidate.txt --placement source
```

The import writes a local asset descriptor with metadata probe posture and
derivative readiness guidance. Generate image thumbnails explicitly with:

```bash
npm run derivatives:thumbnail -- --project-dir examples/card-to-candidate
```

Thumbnail receipts remain local-only derivative records; they do not prove byte
availability, materialization, resource admission, or mesh truth. Proxy and
waveform generation remain deferred. See
[Local Media Intake And Derivative Readiness](docs/45-local-media-intake-and-derivative-readiness.md).

Summarize local intake and derivative posture without opening raw JSON:

```bash
npm run media:summary -- --project-dir examples/card-to-candidate
npm run media:summary -- --project-dir examples/card-to-candidate --print
npm run --silent media:summary -- --project-dir examples/card-to-candidate --print
```

Compare local candidate assets and record a local selection:

```bash
npm run review:candidates -- --project-dir examples/card-to-candidate
```

Write a local project status snapshot:

```bash
npm run status:project -- --project-dir examples/card-to-candidate
npm run health:project -- --project-dir examples/card-to-candidate
npm run health:summary -- --project-dir examples/card-to-candidate
```

Project health, inspection summaries, handoff candidates, and cross-project
indexes include compact per-asset attention rows when an asset is missing or
stale against byte proposal, resource-ref candidate, or production descriptor
posture. These rows suggest safe local next actions only; they do not prove byte
availability, materialization, resource admission, or authority.

Byte posture is reported by `contentId`; resource posture is reported by
descriptor/situation/placement subject. `assetId` remains a compatibility
descriptor id and must not be used alone for new byte or resource behavior.

Write local continuity evidence:

```bash
npm run continuity:draft -- --project-dir examples/card-to-candidate
```

Write local production records from the current card without UI:

```bash
npm run production:from-card -- --project-dir examples/card-to-candidate
npm run production:validate -- --project-dir examples/card-to-candidate
```

Write a local approval proposal without granting approval authority:

```bash
npm run approval:proposal -- --project-dir examples/card-to-candidate
```

Write local byte descriptor proposals without claiming byte materialization:

```bash
npm run bytes:proposal -- --project-dir examples/card-to-candidate
```

Write local-layer resource-ref candidates without claiming admitted resources:

```bash
npm run resource:refs -- --project-dir examples/card-to-candidate
```

Write local Edge-inspection readiness guidance from resolvability coverage:

```bash
npm run readiness:edge -- --project-dir examples/card-to-candidate
```

Write a local Packs-aligned control-surface projection without adding UI:

```bash
npm run control:surface -- --project-dir examples/card-to-candidate
```

Write a local Edge compatibility bundle without calling Edge:

```bash
npm run edge:compat -- --project-dir examples/card-to-candidate
npm run operator:index -- --project-dir examples/card-to-candidate
npm run handoff:edge -- --project-dir examples/card-to-candidate
npm run operator:decision-request -- --project-dir examples/card-to-candidate
```

Regenerate the committed inspection fixture:

```bash
npm run fixture:inspection
npm run fixture:inspection:check
npm run fixture:unhealthy
npm run fixture:unhealthy:check
```

Phase 2 inspection hardening added the manifest, a small artifact-kind
registry, and modest malformed-record checks. Phase 3 adds the local project
layout, safe local refs, placement classes, and asset lifecycle states. Phase 4
adds provider-neutral generation request, provider profile/capability, and
normalized provider result records without calling provider APIs. Phase 5 adds
a provider shape registry for endpoint quirks and mapping fixtures without
making provider payloads Studio canon. Phase 6 adds a Venice dry-run adapter
that maps fixtures only and performs no network calls. Phase 7 adds the Venice
live smoke gate without making provider APIs part of the default wedge. Phase 8
adds the provider adapter runner receipt, provider failure evidence, image
metadata inspection, fixture freshness checks, and local export bundles.
Phase 9 adds a local provider-run ledger and local reference asset ingest.
Phase 10 adds local candidate comparison records and project status snapshots.
Phase 11 completes the narrow Mode 0 slice with continuity drafts, byte
descriptor preview alignment, candidate-review inspection export, card-grouped
provider attempts, and committed Edge bundle fixtures. Phase 12 adds a
Packs-aligned control-surface projection for future inspection without defining
UI, Edge runtime messages, or an authority surface. Phase 13 adds Studio-built
Edge compatibility candidates for documented Edge review shapes without
claiming Edge runtime verification. Phase 14 adds generalized production-unit,
reference-primitive, continuity-band, and render-strategy records so
scene/shot/clip stays available as one strategy without becoming the root
ontology. Phase 15 adds local production descriptors for scene, shot, clip,
rough-cut, and export specializations without making them mesh truth or
publication authority. Phase 16 adds approval proposal records that can be
inspected later without claiming ratifier authority or publication
authorization. Phase 17 adds byte descriptor proposal records for accepted and
reference assets without claiming byte availability, materialization, or byte
authority. Phase 18 documents local record folder conventions and extends
local project status plus inspection summaries for production, approval, and
byte proposal records. Phase 19 adds a local production-from-card CLI without
adding UI, provider calls, Edge calls, or mesh publication. Phase 20 adopts
Spine's JSON-exit posture with scaffold resolvability labels and resource-ref
candidates, without promoting a local-layer backend. Phase 21 adds readiness
guidance for unresolved resource refs, aligns resource candidates with byte
descriptor proposals when present, and validates production descriptor
parentage without adding UI, Edge calls, or mesh publication. Phase 22 carries
readiness/resource summaries into Edge compatibility bundles, adds stale byte
descriptor detection, and adds a local project health snapshot while still
keeping resource promotion, Edge runtime verification, and mesh publication
deferred. Phase 23 adds local operator packet indexes and Edge handoff
candidates so inspection artifacts are easier to scan without adding UI,
calling Edge, or claiming authority. Phase 24 adds production descriptor
freshness checks and handoff readiness diagnosis so stale local production
records explain why a handoff needs attention.
Phase 25 adds request-only operator decision request records so Studio can ask
for later Edge-mediated attention without granting approval, ratifier, or
publication authority.
Phase 26 adds compact unhealthy inspection fixtures for missing byte proposals,
stale resource refs, and stale production descriptors.
Phase 27 adds an explicit cross-project inspection input list and local
operator index so several project handoff postures can be scanned without
project discovery or Edge runtime calls.
Phase 28 makes resource promotion posture explicit so local resource-ref
candidates remain candidate-only and cannot be mistaken for admitted resource
identity.
Phase 29 aligns Studio with the repo family: Spine rule-book and projection
posture, Edge operator seams, Packs control-surface doctrine, Bytes references,
causal-substrate continuity, Platform activation boundaries, mesh-v0-2 actor
hygiene, Identity authority, and Testbed proof scope.
Studio now also points at Spine's Virtualia placement posture: Studio owns
media-specific projection and asset workflows, while Virtualia remains an
emergent cross-repo continuum and not a Studio runtime target.
Phase 39 adds local media operation candidates and rule-resolution traces so
Studio can describe `auto_prepare`, `ask_operator`, and `forbid` mediation
pressure without executing media operations or calling Edge.
The REPL posture note clarifies that REPL is a transitional lab/debug surface;
Studio should target CLI/status JSON, artifacts, refs, inspection packets,
handoff candidates, decision requests, and Packs-aligned projections instead of
wrapping Edge REPL output.
Studio's Edge compatibility bundle now points at current Edge app-facing seam
guidance and Spine device/surface/rule-book posture, not old Edge phase docs as
live doctrine.
Per-asset health explanations now make unhealthy accepted assets and stale
production descriptors visible in existing health, inspection, handoff, and
cross-project operator summaries without adding a new artifact family.
Local posture repair can now regenerate safe missing/stale byte proposal,
resource-ref candidate, and production descriptor records from existing health
issues without inventing reviews, approvals, provider results, or authority.
The media identity and storage posture now ties Studio's same-byte asset issue
to Spine's family-wide identity layering doctrine so content, publication,
descriptor, situation, placement, resource, causal, materialization, and
authority layers do not collapse into one Studio meaning. The shared-basis
identity fixture shows identical bytes forked into accepted and reference roles
with shared content/origin but distinct situation, placement, and resource
candidate identities.
The command surface inventory maps compact command output, machine-readable
artifact output, JSON stdout support, stable refs, and known churn posture for
current operational commands.

## Start Here

- [docs/00-start-here.md](docs/00-start-here.md)
- [docs/01-charter.md](docs/01-charter.md)
- [docs/09-first-wedge.md](docs/09-first-wedge.md)
- [docs/10-edge-inspection-preview.md](docs/10-edge-inspection-preview.md)
- [docs/11-local-project-layout.md](docs/11-local-project-layout.md)
- [docs/12-asset-lifecycle.md](docs/12-asset-lifecycle.md)
- [docs/13-provider-neutral-job-contract.md](docs/13-provider-neutral-job-contract.md)
- [docs/14-provider-adapter-boundary.md](docs/14-provider-adapter-boundary.md)
- [docs/15-provider-shape-registry.md](docs/15-provider-shape-registry.md)
- [docs/16-venice-dry-run-adapter.md](docs/16-venice-dry-run-adapter.md)
- [docs/17-venice-live-smoke-gate.md](docs/17-venice-live-smoke-gate.md)
- [docs/18-venice-smoke-edge-inspection-preview.md](docs/18-venice-smoke-edge-inspection-preview.md)
- [docs/19-local-inspection-export.md](docs/19-local-inspection-export.md)
- [docs/20-provider-runbook.md](docs/20-provider-runbook.md)
- [docs/21-provider-adapter-contracts.md](docs/21-provider-adapter-contracts.md)
- [docs/22-local-image-metadata.md](docs/22-local-image-metadata.md)
- [docs/23-adapter-runner-and-export-bundles.md](docs/23-adapter-runner-and-export-bundles.md)
- [docs/24-provider-run-ledger-and-references.md](docs/24-provider-run-ledger-and-references.md)
- [docs/25-candidate-review-and-project-status.md](docs/25-candidate-review-and-project-status.md)
- [docs/26-narrow-slice-completion.md](docs/26-narrow-slice-completion.md)
- [docs/27-packs-control-surface-alignment.md](docs/27-packs-control-surface-alignment.md)
- [docs/28-edge-compatibility-candidates.md](docs/28-edge-compatibility-candidates.md)
- [docs/29-production-strategy-posture.md](docs/29-production-strategy-posture.md)
- [docs/30-production-descriptors.md](docs/30-production-descriptors.md)
- [docs/31-approval-proposals.md](docs/31-approval-proposals.md)
- [docs/32-byte-descriptor-proposals.md](docs/32-byte-descriptor-proposals.md)
- [docs/33-record-folder-conventions.md](docs/33-record-folder-conventions.md)
- [docs/34-json-exit-and-resolvability-posture.md](docs/34-json-exit-and-resolvability-posture.md)
- [docs/35-operator-packet-index-and-handoff.md](docs/35-operator-packet-index-and-handoff.md)
- [docs/36-cross-project-inspection-index.md](docs/36-cross-project-inspection-index.md)
- [docs/37-comprehensive-state.md](docs/37-comprehensive-state.md)
- [docs/38-repo-family-alignment.md](docs/38-repo-family-alignment.md)
- [docs/39-operation-candidate-and-rule-resolution.md](docs/39-operation-candidate-and-rule-resolution.md)
- [docs/40-repl-posture-and-control-surface-target.md](docs/40-repl-posture-and-control-surface-target.md)
- [docs/41-command-surface-inventory.md](docs/41-command-surface-inventory.md)
- [docs/42-media-identity-and-storage-posture.md](docs/42-media-identity-and-storage-posture.md)
