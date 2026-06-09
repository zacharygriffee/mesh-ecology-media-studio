# Production Asset Capsule

## Purpose

`media.production_asset_capsule.local.v1` packages the local refs an operator
needs to inspect an accepted generated asset before broader production use.

It is shaped from the live Venice loop path, but it is provider-neutral:

```txt
accepted asset descriptor
contentId
situationRef / placementRef
thumbnail derivative refs
byte descriptor proposal ref
resource-ref candidate ref
provider result / adapter-run / loop-status refs
local decision ref
approval proposal ref when present
```

The capsule does not copy media bytes. It does not call Venice, Edge, Bytes,
Causal Substrate, a storage backend, or a mesh runtime.

## Command

```bash
npm run production:capsule -- --project-dir examples/venice-smoke
```

Default output:

```txt
records/production/media-production-asset-capsule.local.json
```

Use `--asset-record records/assets/...local.json` to select a specific accepted
asset descriptor. Use `--print` for JSON output.

## Operator Reading

The compact command output reports:

```txt
asset path
capsule state
derivative count
byte posture present/missing
resource posture present/missing
approval proposal present/missing
productionReady=false
```

The safe next action is either to create an approval proposal or route the
existing proposal through the proper authority lane.

`npm run media:summary` reports capsule totals:

```txt
production capsules: total=1 | expected=1 | missing=0 | attention=0
production approval: candidates=1 | decisions=1 | proposals=1 | capsules=1 | bundles=1 | pendingAuthority=1 | productionReady=0
```

`npm run health:summary` reports missing production capsules as project
attention when accepted provider-generated assets do not yet have a capsule.
That health row is operator guidance only; it does not make the asset
production-ready.

`npm run operator:index` includes capsule refs and prints compact capsule rows
when records exist. Regenerated inspection packets, export bundles, and Edge
compatibility bundles include production capsule record refs so Edge-compatible
surfaces can inspect the package later without Studio calling Edge.

The production approval lane is a readability summary over existing records.
It makes these states separate:

- local decision present
- approval proposal present
- production capsule present
- production bundle present
- authority still missing

Even when every local package exists, `productionReady` remains `0` until a
future authority lane acts.

## Production Bundle

`npm run production:bundle` writes `media.production_bundle.local.v1`.

The bundle groups existing production capsule refs:

```txt
capsuleRefs
assetRefs
contentRefs
productionPosture
```

It is useful when an operator wants one compact production review/handoff
artifact over multiple accepted assets. It does not replace
`media.production_asset_capsule.local.v1`; capsules remain the per-asset
package, and the bundle is only a ref grouping over those packages.

The bundle is also local operator guidance only. It does not copy bytes, grant
approval, prove availability, publish to mesh, call Edge, or authorize
production use.

## Production Assembly Boundary

The current assembly lane is intentionally narrow:

- `media.production_asset_capsule.local.v1` is the per-asset production package.
- `media.production_bundle.local.v1` groups production asset capsules.
- `media.rough_cut_capsule.local.v1` orders accepted production items for local
  review.
- `media.operator_decision.v1` may record local rough-cut review, defer, or
  request-changes posture.
- `media.render_export_candidate.local.v1` may identify a reviewed rough cut as
  ready for future render/export preparation.
- `media.production_authority_prerequisites.summary.local.v1` and
  `media.authority_handoff_candidate.local.v1` show what a future authority
  lane would need to inspect.

This is not an editor, renderer, export engine, publication lane, or authority
lane. Rough cuts are local review assemblies over refs. A reviewed rough cut can
improve operator confidence that the ordered package was inspected, but it does
not make production use authorized.

## Venice Production Rehearsal

`npm run provider:venice:rehearse-production` runs the current local Venice
operational path through approval proposal, production capsule, production
bundle, Venice inspection, operator index, and Edge-compatible bundle creation.
It defaults to the local Venice-shaped provider fixture; `--live-provider` is
still explicit.

The command is useful for checking the operational lane end to end:

```txt
venice production rehearsal: state=complete_review_only_authority_missing
```

That state means the local records are inspectable and bundled, but production
authority is still absent.

## Authority Prerequisites

`npm run production:authority-prereqs` reads existing local records and writes a
local prerequisite posture record showing whether an accepted production
candidate has the local package expected before a future authority review:

```txt
production authority prerequisites: project=venice-smoke-project | candidates=1 | localPackageComplete=1 | localProductionPackageComplete=1 | missingLocalPrerequisites=0 | roughCutReviewed=1 | roughCutChangesRequested=0 | roughCutDeferred=0 | renderExportCandidates=1 | renderReceipts=1 | exportReceipts=2 | ffmpegDeliveryReceipts=1 | localDeliveryEvidencePresent=1 | deliveryCreated=1 | exportPerformed=1 | renderAuthorizationMissing=1 | exportAuthorizationMissing=1 | pendingAuthority=1 | productionReady=0
```

The report checks local decision, approval proposal, situated approval refs,
production capsule, production bundle, byte descriptor proposal, resource-ref
candidate, rough-cut review posture, render/export candidate posture, render
receipt posture, export receipt posture, and derivative refs. Render receipts
show local preview/render evidence. Export receipts show local delivery evidence
only; ffmpeg MP4 delivery receipts are counted distinctly from package-copy
export receipts. `localProductionPackageComplete=1` means the local Studio
package is complete enough to route onward for review; it still reports missing
render/export/publication authority and does not make the bundle production-ready.
Media summary, operator index, Venice inspection, and Edge-compatible bundles
surface the same export delivery posture as local evidence only.
Row-level export receipt posture includes freshness, source rough-cut/render
refs, delivery refs, and next action; stale rows remain local evidence only and
do not satisfy authority.
The narrow operational proof includes two accepted production items assembled
into one rough cut and carried through local render/export receipts without
granting authority.

## Authority Handoff Candidate

`npm run production:authority-handoff` writes
`media.authority_handoff_candidate.local.v1`. This is the first local contract
for the future authority boundary:

```txt
authority handoff candidate: project=venice-smoke-project | candidates=1 | localPackageComplete=1 | localProductionPackageComplete=1 | pendingAuthority=1 | bundles=1 | proposals=1 | capsules=1 | authorityGaps=7 | productionReady=false
```

The handoff candidate packages the production bundle, approval proposal,
production asset capsule, situated identity refs, export receipt refs, delivery
local refs, source render refs, source rough-cut refs, local package review
decisions, publication/export authority request candidates, and embedded
prerequisite summary so a future authority lane can inspect what it would need
to review. It does not implement that lane and does not grant approval,
ratification, publication authorization, or production readiness.

Both authority commands can carry optional `mesh-ecology-layer` refs:

```bash
npm run production:authority-handoff -- --project-dir examples/venice-smoke \
  --layer-ref layer:operator-local:operator-alpha \
  --layer-profile-ref layer-profile:operator-local:v0:example \
  --layer-continuity-ref layer-continuity-ref:operator-local:decision-family:candidate \
  --layer-desync-posture-ref layer-desync-posture:operator-local:example \
  --layer-rbc-profile-ref rbc-profile:operator-local-default
```

These refs let an operator-local layer or future team layer inspect Studio work
without making Studio a Layer runtime. The handoff still records
`durableAppendApproved=false`, `continuityClaimed=false`, and
`layerProfileIsAuthority=false`.
`npm run media:summary`, `npm run operator:index`, Venice inspection, and
`npm run edge:compat` surface the same Layer interop state and non-claims so
the refs are visible without making them authority, continuity, or a runtime
dependency.
If local authority prerequisite and handoff records carry different Layer refs,
the operator surfaces mark Layer interop attention. The next local action is to
regenerate the stale authority posture records with the intended refs, not to
treat the mismatch as a Layer runtime verdict.

## Rough-Cut Capsule Seed

`npm run production:rough-cut` writes
`media.rough_cut_capsule.local.v1`, the first local rough-cut package over
ordered accepted production items:

```txt
rough cut capsule: project=venice-smoke-project | items=1 | bundles=1 | capsules=1 | authorityPending=1 | rendered=false | productionReady=false
```

The rough-cut capsule reads existing production asset capsules, production
bundles, approval proposals, situated refs, derivative refs, and prerequisite
posture. It records order-only item rows for local review. It does not build an
editor UI, render a timeline, produce an export, publish media, or grant
authority.

When present, rough-cut capsules are surfaced by `npm run media:summary`,
`npm run health:summary`, Venice inspection packets, `npm run operator:index`,
and Edge-compatible source refs. These surfaces expose the rough-cut package for
operator inspection; they do not change its non-rendered or non-authoritative
posture.

`npm run production:rough-cut-review` records a local
`review_rough_cut` operator decision over the rough-cut capsule. The decision
acknowledges local review of the ordered items only. It sets execution,
approval authority, ratifier authority, publication authorization, rendering,
Edge calls, and mesh publication claims to false.

`npm run production:rough-cut-revise` consumes a local `request_changes`
rough-cut decision and regenerates rough-cut refs for another local review
pass. This is a local revision posture only; it does not edit media bytes,
render a timeline, export, publish, approve, or grant production authority.

`npm run production:render-export-candidate` writes
`media.render_export_candidate.local.v1` only after the latest rough-cut
decision is `review_rough_cut`. It records the reviewed rough cut as a candidate
for render/export preparation, but it does not select a renderer, create
rendered bytes by itself, create an export file, authorize publication, call
Edge, or make the cut production-ready.

`npm run production:render-adapter-contract` and
`npm run production:render-plan` make the renderer-neutral input contract and
dry-run plan explicit before execution. The first local render execution
commands are:

```bash
npm run production:render-contact-sheet -- --project-dir examples/venice-smoke
npm run production:render-ffmpeg -- --project-dir examples/venice-smoke
```

Both write `media.render_receipt.local.v1`. The contact-sheet command writes a
PNG preview. The ffmpeg command writes a local MP4 preview by default and can be
disabled with `--disable-ffmpeg` or `MEDIA_STUDIO_FFMPEG=disabled`. These
receipts are local render evidence only; they are not export delivery,
publication authorization, approval authority, or production readiness. The
current ffmpeg lane is image-ref preview evidence only; real video clip
stitching remains deferred.

`npm run production:export-candidate` and `npm run production:export-plan`
create the first dry-run export posture over a reviewed rough cut and optional
render receipt. They resolve refs and planned delivery placement only. They do
not read media bytes, create delivery files, authorize publication, or make the
package production-ready.

`npm run production:export-local-package` consumes the dry-run export plan and
copies the selected local render preview into a delivery-candidate folder with a
manifest and `media.export_receipt.local.v1`. This is local export execution for
review only. It does not publish, authorize publication, grant authority, or
make the package production-ready.

`npm run production:export-ffmpeg` consumes the same export plan but renders the
delivery candidate directly with ffmpeg. ffmpeg remains the default local video
export posture and can be disabled with `--disable-ffmpeg`. The resulting export
receipt remains local delivery evidence only. This does not open a real video
editor lane or multi-clip stitching path.

## Non-Claims

The capsule is local operator guidance only:

```txt
productionReady: false
approvalAuthority: false
ratifierAuthority: false
publicationAuthorization: false
providerTruth: false
byteAvailabilityProof: false
materializationProof: false
resourceAdmission: false
causalTruth: false
meshTruth: false
```

An approval proposal inside a capsule is still only a proposal. It is not
approval, ratifier authority, publication authorization, or production
readiness.

## Deferred Work

Future work may promote this into a richer Studio capsule/edit graph with
timelines, track/layer refs, proxy/waveform refs, frame pins, byte publication
refs, and causal refs. This pass only packages refs from the current local
generated-asset flow.
