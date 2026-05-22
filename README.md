# mesh-ecology-media-studio

`mesh-ecology-media-studio` is the media-domain frontier for mesh ecology.
The product/app label is **Studio** and the domain identity is `media-studio`.

Studio owns media-specific semantics for cards, provider jobs, generated
candidates, media assets, reviews, approval proposals, continuity evidence,
byte/resource posture, rough cuts, render plans, local render receipts, and
future export/package flows.

## Current Posture

Studio is local-first and operational in Mode 0. It can run without Edge, mesh
publication, distributed byte materialization, active ratifiers, or a UI.

The current production vector is:

```text
provider result
-> accepted media asset
-> local decision
-> situated approval proposal
-> production asset capsule
-> production bundle
-> rough-cut capsule
-> rough-cut review decision
-> render/export candidate
-> render adapter contract
-> dry-run render plan
-> local render receipt
-> dry-run export candidate/plan
```

The vector is useful for local review and operator inspection. It does not grant
production authority.

## Non-Claims

Studio records may be useful evidence, but they are not truth by themselves.

Studio does not claim:

- mesh truth
- distributed proof
- ratified shared state
- provider truth
- byte availability proof
- materialization proof
- resource admission
- causal truth
- Edge approval
- publication authorization
- production authority

Local files, local JSON, provider responses, review decisions, approval
proposals, inspection packets, render plans, render receipts, and bundles remain
local/operator guidance until a future authority or mesh-facing lane explicitly
promotes them.

## Operating Modes

- **Mode 0: standalone-local**. Local project folder, local media files, local
  descriptors, local receipts, local decisions, and local operator summaries.
- **Mode 1: edge-mediated**. Edge may inspect exported work packets, evidence,
  readiness guidance, decision requests, handoff candidates, and compatibility
  bundles.
- **Mode 2: mesh-mediated**. Media descriptors, byte references, proposals,
  PUBs/RATs, and ratification flows become mesh-facing.
- **Mode 3: distributed production**. Multiple devices, actors, providers,
  ratifiers, and operator/control surfaces cooperate.

Mode 0 is the working baseline today.

## Repo Relationships

### Edge

Studio is Edge-compatible, not Edge-dependent. Edge owns the operator-facing
boundary/control plane. Studio owns media work and media-domain records.

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

Studio follows Spine's repo-family posture around rule books, Rulebook Cascade
(RBC), projection events, proof standards, and identity/storage layering.
Content identity, byte publication identity, descriptor identity,
situation/placement identity, resource identity, causal referent identity,
materialization identity, and authority state stay separate.

Studio is intentionally in a hybrid identity compatibility state:

- `assetId` remains the descriptor id field for compatibility and is still
  content-derived in active generation paths.
- `contentId` is the explicit byte/content sameness field.
- Byte descriptor proposals are keyed by `contentId`.
- Resource-ref candidates are keyed by descriptor/situation/placement resource
  subjects.
- Changing `assetId` generation is deferred until storage/backend promotion,
  virtual-drive/materialization work, or a deliberate descriptor-id schema
  transition.

See [Identity Migration Boundary](docs/44-identity-migration-boundary.md).

### Packs

Packs provides shared actor/control-plane vocabulary and control-surface
posture. Studio preserves these media intent families without letting Packs own
Studio product semantics:

```text
image-generation
video-generation
audio-generation
media-transformation
media-evidence
```

Future UI/DX should project over stable Studio/Edge/Packs artifacts, refs,
status views, decision requests, and inspection packets. Studio should not build
UI contracts from REPL output.

### Bytes

Large media bytes belong in local files, Hyperdrive, Hyperblob, or later byte
materialization stores. `mesh-ecology-bytes` defines portable byte descriptors,
references, and materialization requests. Studio defines media meaning,
provider lineage, review posture, production packaging, and render/export
posture.

### Causal Substrate

`causal-substrate` remains optional. Studio records causal-shaped fields early
enough to map later through a future `media-causal-adapter`, but causal
substrate is not Studio's workflow engine, storage engine, policy engine, or
authority lane.

## Quick Start

Install dependencies:

```bash
npm install
```

Run the local-only first wedge:

```bash
npm run wedge:example
```

Run tests:

```bash
npm test
```

Summarize a project:

```bash
npm run media:summary -- --project-dir examples/card-to-candidate
npm run health:summary -- --project-dir examples/card-to-candidate
```

The first wedge reads `examples/card-to-candidate/cards/card.json`, treats
`examples/card-to-candidate/media/generated/candidate.txt` as the local
generated candidate, hashes it, copies it into `media/accepted/` or
`media/rejected/`, and writes local records under `records/`.

## Provider Work

Studio's provider contract remains provider-neutral:

```text
media.generation_request.v1
media.provider_profile.v1
media.provider_capability.v1
media.provider_result.v1
```

Venice is the first operational provider fixture, not Studio provider canon.

Run the local Venice-shaped loop without a live provider call:

```bash
npm run provider:venice:loop
```

Run the gated live Venice smoke path only when spending provider credits is
intentional:

```bash
VENICE_LIVE=1 npm run provider:venice:smoke
```

The live path reads `VENICE_INFERENCE_KEY` from the environment or ignored
`.env`, uses a constrained image request, writes decoded bytes under
`media/generated/provider-smoke/`, and records local non-truth-bearing provider,
asset, review, readiness, and operator decision records.

Inspect existing Venice records without calling Venice:

```bash
npm run inspect:venice-smoke
npm run inspect:venice-loop
```

## Media Intake And Derivatives

Import media into the local project layout:

```bash
npm run media:import -- --project-dir examples/card-to-candidate --source media/generated/candidate.txt --placement source
npm run reference:ingest -- --project-dir examples/card-to-candidate --source media/generated/candidate.txt --filename candidate-reference.txt
```

Generate image thumbnails explicitly:

```bash
npm run derivatives:thumbnail -- --project-dir examples/card-to-candidate
```

Thumbnail receipts are local-only derivative records. They do not prove byte
availability, materialization, resource admission, or mesh truth. Proxy and
waveform generation remain deferred.

## Review And Local Posture

Compare local candidates and record a local selection:

```bash
npm run review:candidates -- --project-dir examples/card-to-candidate
```

Create byte and resource posture:

```bash
npm run bytes:proposal -- --project-dir examples/card-to-candidate
npm run resource:refs -- --project-dir examples/card-to-candidate
npm run readiness:edge -- --project-dir examples/card-to-candidate
```

Repair safe local posture from health explanations:

```bash
npm run repair:local-posture -- --project-dir examples/card-to-candidate
```

Repair can regenerate local-only byte proposal, resource-ref candidate, and
card-derived production descriptor records when health explanations show they
are missing or stale. It does not invent review decisions, call providers, call
Edge, publish to mesh, or prove byte availability/materialization.

## Production Packaging

The current local production lane is provider-neutral and authority-free:

```bash
npm run provider:venice:rehearse-production -- --project-dir examples/venice-smoke
npm run production:capsule -- --project-dir examples/venice-smoke
npm run production:bundle -- --project-dir examples/venice-smoke
npm run production:rough-cut -- --project-dir examples/venice-smoke
npm run production:rough-cut-review -- --project-dir examples/venice-smoke
npm run production:authority-prereqs -- --project-dir examples/venice-smoke
npm run production:authority-handoff -- --project-dir examples/venice-smoke
```

These commands package accepted assets and rough-cut refs for local review and
future authority inspection. They do not grant approval, ratification,
publication authorization, or production readiness.
After local render/export delivery evidence exists, the authority prerequisite
surface can show `localProductionPackageComplete=true` while still reporting
`authorityMissing=true` and `productionReady=false`.
`production:authority-prereqs` and `production:authority-handoff` can also
carry optional `mesh-ecology-layer` refs with `--layer-ref`,
`--layer-profile-ref`, `--layer-continuity-ref`, `--layer-desync-posture-ref`,
and `--layer-rbc-profile-ref`. These are import refs only; they do not select a
continuity substrate, approve durable append, admit a layer participant, or
grant production authority.
`media:summary`, `operator:index`, Venice inspection, and `edge:compat` surface
that Layer interop posture compactly so an operator can see attached refs
without treating them as authority or continuity.
If prerequisite and handoff records disagree about Layer refs, those same
surfaces show local Layer interop attention so the operator can regenerate the
stale record set. This is consistency guidance only, not Layer validation.
`operator:cross-project-index` can also surface that Layer attention when an
input project explicitly includes its operator packet index.

`request_changes` rough-cut decisions can regenerate the local rough-cut refs:

```bash
npm run production:rough-cut-revise -- --project-dir examples/venice-smoke
```

## Local Render Path

Render/export preparation is split into explicit local records:

```bash
npm run production:render-export-candidate -- --project-dir examples/venice-smoke
npm run production:render-export-mediate -- --project-dir examples/venice-smoke
npm run production:render-adapter-contract -- --project-dir examples/venice-smoke
npm run production:render-plan -- --project-dir examples/venice-smoke
npm run production:export-candidate -- --project-dir examples/venice-smoke
npm run production:export-plan -- --project-dir examples/venice-smoke
npm run production:export-local-package -- --project-dir examples/venice-smoke
npm run production:export-ffmpeg -- --project-dir examples/venice-smoke
npm run production:local-package-review -- --project-dir examples/venice-smoke
npm run production:publication-authority-request -- --project-dir examples/venice-smoke
```

For the common local output path, the same existing steps can be run as one
bounded orchestration:

```bash
npm run production:local-output -- --project-dir examples/venice-smoke
```

This writes the same rough-cut, review, render, export, authority-prereq, local
package review, publication/export authority request, and authority-handoff
records, then refreshes the existing operator index and Edge-compatible bundle.
The authority handoff is refreshed after the publication/export request so the
handoff can carry both local package review and request-candidate refs for a
future authority lane.
If multiple local package review decisions exist, the latest one is the active
operator posture; a later `request_changes` decision blocks new
publication/export authority request candidates until the package is reviewed
again.
It is an operator convenience command only; it does not add authority, publish,
call Edge, or make the package production-ready.
The runner uses the current production bundle, so ordered multi-item rough cuts
stay part of the same local review/output lane.
Pass `--disable-ffmpeg` to keep the orchestrated path on contact-sheet render
and local package-copy delivery evidence only.
Authority-prereq checks verify that local delivery/export bytes still exist and
match their receipts before reporting local production package completeness.
`media:summary`, `health:summary`, `operator:index`, and `edge:compat` surface
the same output-integrity posture compactly for operator inspection.
`production:local-package-review` records local operator review after integrity
passes. `production:publication-authority-request` packages that reviewed local
output evidence for a future authority lane, but still grants no publication or
export authority.

The first real local render commands consume the dry-run render plan:

```bash
npm run production:render-contact-sheet -- --project-dir examples/venice-smoke
npm run production:render-ffmpeg -- --project-dir examples/venice-smoke
```

`production:render-contact-sheet` writes a PNG contact sheet for local review.
`production:render-ffmpeg` writes a local MP4 preview using npm-managed
`ffmpeg-static` by default. To disable ffmpeg execution:

```bash
npm run production:render-ffmpeg -- --project-dir examples/venice-smoke --disable-ffmpeg
MEDIA_STUDIO_FFMPEG=disabled npm run production:render-ffmpeg -- --project-dir examples/venice-smoke
```

Render receipts are local evidence only. They are not export deliveries,
publication authorization, production readiness, or authority.
`production:export-candidate` and `production:export-plan` create a dry-run
delivery candidate over the reviewed rough cut and existing preview receipts.
They resolve refs and target output placement only; they do not read media bytes,
create delivery files, authorize publication, or make the package production-ready.
`production:export-local-package` copies the selected local preview into a
review delivery folder and writes a manifest/receipt. It is still local-only
delivery evidence, not publication authorization or production readiness.
`production:export-ffmpeg` renders a local MP4 delivery candidate from the
export plan using `ffmpeg-static` by default. It also supports
`--disable-ffmpeg` and remains local-only delivery evidence.
`production:authority-prereqs` now distinguishes local export delivery evidence
from authority: fresh export receipts can show `localDeliveryEvidencePresent`,
`deliveryCreated=true`, and `exportPerformed=true`; ffmpeg MP4 delivery
receipts are counted distinctly from package-copy receipts. Publication
authorization and production readiness remain false.
The same delivery-evidence distinction appears in `media:summary`,
`operator:index`, Venice smoke inspection, and Edge-compatible bundles.
Export receipt rows also show freshness, source rough cut/render refs, delivery
paths, and next action so stale delivery evidence is inspectable without opening
raw JSON.
The test suite now exercises a two-item rough-cut path through local review,
contact-sheet/ffmpeg render receipts, local/ffmpeg export receipts, authority
prereqs, operator index, and Edge-compatible export rows.

## Inspection And Edge-Compatible Artifacts

Export and inspect local records:

```bash
npm run inspect:local-run -- --project-dir examples/card-to-candidate
npm run inspect:summary -- --project-dir examples/card-to-candidate --packet records/exports/local-run-edge-inspection-packet.local.json
npm run inspect:index -- --project-dir examples/card-to-candidate
npm run inspect:provider-runs -- --project-dir examples/card-to-candidate
npm run operator:index -- --project-dir examples/card-to-candidate
npm run operator:cross-project-index
```

Create local Edge-compatible surfaces without calling Edge:

```bash
npm run export:inspection-bundle -- --project-dir examples/card-to-candidate
npm run edge:compat -- --project-dir examples/card-to-candidate
npm run handoff:edge -- --project-dir examples/card-to-candidate
npm run operator:decision-request -- --project-dir examples/card-to-candidate
```

Edge-compatible bundles include export receipt refs plus delivery/source refs
for operator inspection. They do not make local delivery evidence authoritative.

Create a Packs-aligned control-surface projection without adding UI:

```bash
npm run control:surface -- --project-dir examples/card-to-candidate
```

## Fixture Checks

Check committed fixture freshness:

```bash
npm run fixture:inspection:check
npm run fixture:unhealthy:check
```

Regenerate fixtures intentionally:

```bash
npm run fixture:inspection
npm run fixture:unhealthy
```

## Documentation Map

Start with:

- [Start Here](docs/00-start-here.md)
- [Charter](docs/01-charter.md)
- [Boundary And Ownership](docs/02-boundary-and-ownership.md)
- [First Wedge](docs/09-first-wedge.md)
- [Command Surface Inventory](docs/41-command-surface-inventory.md)
- [Comprehensive State](docs/37-comprehensive-state.md)

Current posture docs:

- [Repo Family Alignment](docs/38-repo-family-alignment.md)
- [REPL Posture And Control-Surface Target](docs/40-repl-posture-and-control-surface-target.md)
- [Media Identity And Storage Posture](docs/42-media-identity-and-storage-posture.md)
- [Identity Migration Boundary](docs/44-identity-migration-boundary.md)
- [Local Media Intake And Derivative Readiness](docs/45-local-media-intake-and-derivative-readiness.md)
- [Production Asset Capsule](docs/46-production-asset-capsule.md)

Provider and Edge docs:

- [Provider-Neutral Job Contract](docs/13-provider-neutral-job-contract.md)
- [Provider Adapter Boundary](docs/14-provider-adapter-boundary.md)
- [Provider Shape Registry](docs/15-provider-shape-registry.md)
- [Venice Live Smoke Gate](docs/17-venice-live-smoke-gate.md)
- [Edge Inspection Preview](docs/10-edge-inspection-preview.md)
- [Edge Compatibility Candidates](docs/28-edge-compatibility-candidates.md)

The detailed phase history lives in
[Comprehensive State](docs/37-comprehensive-state.md), not in this README.
