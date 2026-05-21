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
```

`npm run health:summary` reports missing production capsules as project
attention when accepted provider-generated assets do not yet have a capsule.
That health row is operator guidance only; it does not make the asset
production-ready.

`npm run operator:index` includes capsule refs and prints compact capsule rows
when records exist. Regenerated inspection packets, export bundles, and Edge
compatibility bundles include production capsule record refs so Edge-compatible
surfaces can inspect the package later without Studio calling Edge.

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
