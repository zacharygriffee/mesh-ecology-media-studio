# Identity Migration Boundary

## Purpose

Studio is intentionally in a hybrid compatibility state.

`assetId` remains the descriptor id field for compatibility and is still
content-derived in active generation paths.

`contentId` is the explicit byte/content sameness field.

Byte descriptor proposals are keyed by `contentId`.

Resource-ref candidates are keyed by descriptor/situation/placement resource
subjects.

Changing `assetId` generation is still required before storage/backend
promotion, virtual-drive/materialization work, or a deliberate descriptor-id
schema transition, but it is not required for the current Mode 0 wedge.

## Completed Migration Steps

The active identity migration has completed the important Mode 0 safety steps:

1. Layered identity fields are present on active asset descriptors.
2. Byte descriptor proposals are keyed by `contentId`.
3. Resource-ref candidates are keyed by descriptor/situation/placement resource
   subject.
4. Health, readiness, repair, and operator summaries report byte posture as
   `byteContent` and resource posture as `resourceSituations`.
5. High-risk `assetId` compatibility paths were hardened: reference ingest
   filenames no longer key only on `assetId`, candidate review rejects ambiguous
   `selectedAssetId`, and project status warns when one content-derived
   `assetId` appears in multiple situations.

## Current Hybrid Compatibility State

The current state is deliberate:

- `assetId` remains compatible with existing schemas, validators, records, and
  local fixtures.
- `contentId` carries byte sameness.
- `assetDescriptorRef`, `situationRef`, and `placementRef` carry the local
  media-domain identity layers needed for resource posture.
- compatibility refs back to `assetId` may still appear in records, but new
  behavior must not use `assetId` as the primary byte or resource key.

This lets the current local wedge remain stable while avoiding the known
semantic identity collapse in the places that affect current operations.

## What assetId Means Right Now

`assetId` is a compatibility descriptor id field.

It is still content-derived in active generation paths. Therefore, the same
bytes may still produce the same `assetId` even when Studio meaning, situation,
placement, or workflow role differs.

Do not treat `assetId` as:

- byte identity
- resource identity
- placement identity
- situation identity
- causal identity
- materialization identity
- authority state

## What contentId Means

`contentId` means byte/content sameness.

Use `contentId` when asking whether two local records point at identical bytes.
Byte descriptor proposals are keyed by this layer because byte posture is about
content, not about Studio role or placement.

`contentId` does not prove byte availability, materialization, resource
admission, mesh truth, or authority.

## What situationRef / placementRef Means

`situationRef` identifies where/as-what an artifact-like referent is situated in
a Studio context, surface, role, and rule-book basis.

`placementRef` is the current local concrete subtype of `situationRef`, usually
path, placement class, and lifecycle state.

Use these refs when local behavior depends on role or placement, such as
accepted candidate versus reference asset.

Spine's Virtualia placement posture adds broader family vocabulary such as
`sourceId`, `originLocusId`, `dreamRefId`, `emergenceLocusId`,
`emergencePathId`, `placementId`, and `projectionId`. Those terms are
directional alignment vocabulary for future lifting/projection work. They do
not change the current Studio identity boundary and are not active Studio
schemas in this pass.

## What resourceRefCandidateId Means

`resourceRefCandidateId` identifies a proposed local-layer resource subject for
a specific descriptor/situation/placement basis.

It is candidate-only. It is not resource admission, materialization proof, byte
availability proof, mesh truth, or authority.

## Why Step 5 Is Deferred

Changing active `assetId` generation is a schema/descriptor identity transition,
not a cleanup patch.

The current Mode 0 wedge can operate safely because the behaviorally important
paths no longer depend on `assetId` alone:

- byte posture uses `contentId`
- resource posture uses descriptor/situation/placement subjects
- review selection fails on ambiguous compatibility ids
- operator status warns on duplicate content-derived `assetId` across
  situations

Migrating `assetId` generation now would create fixture and schema churn without
unlocking a required current operation.

## When Step 5 Becomes Necessary

Step 5 becomes necessary before:

- storage/backend promotion
- virtual-drive or materialization work
- a deliberate descriptor-id schema transition
- workflows where descriptor identity itself must be durable and
  non-content-derived
- any authority or resource-admission lane that needs descriptor identity to be
  distinct from byte sameness

The likely transition is to add or promote an explicit descriptor id field while
keeping `assetId` as a compatibility alias for existing records.

## What Future Agents Must Not Do

Do not treat `assetId` as byte identity in new behavior. Use `contentId` for
byte sameness.

Do not use `assetId` alone for resource posture. Use descriptor/situation/
placement resource-subject identity.

Do not migrate `assetId` generation opportunistically. Only migrate it as a
deliberate schema/descriptor-id transition.

Do not remove `assetId` compatibility refs casually. Existing records, schemas,
fixtures, and local tools still expect them.

Do not use Spine's Virtualia locus/path/projection vocabulary as an excuse to
add runtime coupling, schema migration, or Virtualia integration before a
specific promotion packet requires it.

## Guardrails

This boundary does not implement:

- `assetId` generation changes
- schema migration
- byte proposal behavior changes
- resource candidate behavior changes
- repair behavior changes
- storage backend
- virtual drive
- Hyperblob, Hyperdrive, Hypercore, Hyperbee, or Autobase
- causal-substrate adapter
- Edge runtime calls
- mesh publication
- provider expansion

Current records remain local-only unless a later authority lane explicitly
promotes them.
