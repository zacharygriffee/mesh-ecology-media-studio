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
production authority prerequisites: project=venice-smoke-project | candidates=1 | localPackageComplete=1 | missingLocalPrerequisites=0 | roughCutReviewed=1 | roughCutChangesRequested=0 | roughCutDeferred=0 | pendingAuthority=1 | productionReady=0
```

The report checks local decision, approval proposal, situated approval refs,
production capsule, production bundle, byte descriptor proposal, resource-ref
candidate, rough-cut review posture, and derivative refs. It does not create an
authority artifact and it
does not make the bundle production-ready.

## Authority Handoff Candidate

`npm run production:authority-handoff` writes
`media.authority_handoff_candidate.local.v1`. This is the first local contract
for the future authority boundary:

```txt
authority handoff candidate: project=venice-smoke-project | candidates=1 | localPackageComplete=1 | pendingAuthority=1 | bundles=1 | proposals=1 | capsules=1 | authorityGaps=5 | productionReady=false
```

The handoff candidate packages the production bundle, approval proposal,
production asset capsule, situated identity refs, and embedded prerequisite
summary so a future authority lane can inspect what it would need to review. It
does not implement that lane and does not grant approval, ratification,
publication authorization, or production readiness.

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
