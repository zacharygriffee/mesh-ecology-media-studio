# AssetId Usage Audit After Layered Identity Migration

## Purpose

This audit classifies remaining `assetId` usage after the layered identity
migration.

The audit is intentionally non-implementation work. It does not change
`assetId` generation, runtime behavior, storage posture, resource admission,
Edge integration, or causal posture.

The current implementation boundary after Step 4.5 is summarized in
[Identity Migration Boundary](44-identity-migration-boundary.md).

## Current Conclusion

Step 5, meaning active `assetId` generation migration, is still needed later,
but it is not required immediately for the current Mode 0 local wedge or
Edge-inspectable summaries.

The recommended timing is:

```txt
Defer active assetId generation migration until before storage/backend
promotion, virtual-drive/materialization work, or any workflow where
same-content descriptors may be created repeatedly in multiple roles and must
coexist as first-class records.
```

The repo is now protected in the most important current paths:

```txt
byte posture:
  contentId keyed

resource posture:
  assetDescriptorRef + situationRef + placementRef keyed

operator summaries:
  byteContent by contentId
  resourceSituations by situation/placement subject
```

`assetId` remains as a compatibility and legacy descriptor id. It should not be
treated as content identity, resource identity, placement identity, causal
identity, materialization identity, or authority.

## Classification Summary

| Usage class | Current status | Risk |
| --- | --- | --- |
| Descriptor compatibility id | still active | acceptable for now |
| Content-derived id generation | still active | medium, must migrate before storage promotion |
| Byte proposal compatibility refs | retained only for compatibility | acceptable |
| Resource candidate compatibility refs | retained only for compatibility | acceptable |
| Operator health legacy arrays | retained with content/resource posture added | acceptable |
| Review selection by `assetId` | compatibility only; ambiguous matches rejected | acceptable for now |
| File naming by `assetId` | high-risk reference ingest paths hardened | lower; still avoid new assetId-only paths |
| Schema id field | still active | acceptable until schema migration |

## Active Generation Sites

### First Wedge / Shared Constructor

`src/contracts/constructors.js` still derives:

```txt
assetId = asset-<first 16 sha256 hex chars>
```

This means same bytes still produce the same active `assetId`.

Current mitigation:

```txt
contentId, assetDescriptorRef, situationRef, placementRef, originRef, basisRef,
and deferred causalRefs are present on the descriptor.
```

Risk:

```txt
same content in different roles can still share assetId.
```

Current severity:

```txt
Medium. Safe for the current wedge because byte/resource posture no longer
uses assetId as the primary key. Not safe as a durable descriptor identity for
storage/backend promotion.
```

### Reference Ingest

`src/assets/ingest-reference.js` derives the same content-based `assetId`, but
Step 4.5 stopped using only that `assetId` for reference output record paths.
Reference record filenames now include a deterministic project/source/target
token.

Old risky shape:

```txt
records/assets/reference-${assetId}.local.json
records/assets/reference-ingest-${assetId}.local.json
records/assets/reference-${assetId}-image-metadata.local.json
```

Risk:

```txt
The same bytes can still share `assetId`, but repeated reference ingest no
longer overwrites those local JSON paths merely because content matches.
```

Current severity:

```txt
Lower after Step 4.5. The remaining descriptor identity concern belongs to the
deferred Step 5 migration, not to current reference file output safety.
```

Recommended Step 5 target:

```txt
derive assetDescriptorId/assetId from descriptor/situation basis, not only
content hash; keep contentId for byte sameness.
```

### Provider Output Ingest

`src/assets/provider-output-ingest.js` still computes a content-derived
`assetId`, but its output record path uses provider output index:

```txt
records/assets/${recordPrefix}-asset-${index}.local.json
```

Risk:

```txt
same bytes can still share assetId, but record path collision is less likely in
this path.
```

Current severity:

```txt
Medium. Descriptor identity still collapses, but file output is not keyed only
by assetId.
```

### Candidate Promotion

`src/local/promote-candidate.js` creates promoted descriptors through the same
content-derived constructor path.

Risk:

```txt
accepted/rejected/reference copies of identical bytes can continue to share
assetId even when situationRef and placementRef differ.
```

Current severity:

```txt
Medium. Current resource posture separates the situations, but future workflows
that select or mutate promoted descriptors by assetId may be ambiguous.
```

## Compatibility Reference Sites

### Byte Descriptor Proposals

`src/assets/byte-descriptor-proposal.js` now keys proposals by `contentId`.
It still writes:

```txt
sourceAssetRef
sourceAssetRefs[]
```

Classification:

```txt
Compatibility refs back to asset descriptors.
```

Risk:

```txt
Low. This is intentionally retained compatibility, not primary identity.
```

### Resource Ref Candidates

`src/local/resource-ref-candidates.js` now keys resource identity by:

```txt
contentId
assetDescriptorRef
situationRef
placementRef
placement path
```

It still writes:

```txt
sourceRef: media-asset:<assetId>
```

Classification:

```txt
Compatibility ref back to existing asset descriptors.
```

Risk:

```txt
Low. Resource candidate identity no longer collapses by assetId.
```

## Operator And Readiness Sites

`src/seams/project-status.js` and `src/seams/edge-readiness-guidance.js`
still retain arrays such as:

```txt
missingByteDescriptorProposalAssetIds
missingResourceRefCandidateAssetIds
```

They now also expose:

```txt
bytePosture.keyKind = contentId
resourcePosture.keyKind = assetDescriptorRef+situationRef+placementRef
missingByteDescriptorProposalContentIds
missingResourceRefCandidateSubjectRefs
```

Classification:

```txt
Legacy compatibility plus new layered summaries.
```

Risk:

```txt
Low. Operator-readable posture now uses the correct identity split. The legacy
arrays can remain until external consumers stop relying on them.
```

## Review And Selection Sites

`src/review/candidate-review.js` accepts:

```txt
--selected-asset-id
--selected-asset-descriptor-ref
--selected-situation-ref
```

`selectedAssetId` remains as a compatibility selector. If the same content-derived
`assetId` appears in more than one descriptor/situation, selection by
`selectedAssetId` is rejected as ambiguous. `assetDescriptorRef` is also rejected
if legacy records still collapse it to the same content-derived id. Operators and
scripts should prefer `situationRef` when descriptor identity is not unique yet.

Risk:

```txt
If a caller continues to rely on `selectedAssetId`, same-content descriptors can
force an ambiguity error. This is deliberate; it prevents silent first-match
selection.
```

Current severity:

```txt
Lower after Step 4.5 because ambiguity is blocked, but richer review workflows
should still prefer descriptor/situation selectors.
```

Recommended migration:

```txt
Keep `selectedAssetId` as compatibility only. Prefer `situationRef` until Step 5
gives active descriptors non-content-derived descriptor identity.
```

This does not need to happen before every next step, but it should happen before
review workflows become more operational.

## Schema And Validator Sites

Schemas still require `assetId` for:

```txt
media.asset.descriptor.v1
media.asset_lifecycle.v1
```

The validator still treats `assetId` as the id field for those schemas.

Classification:

```txt
Schema compatibility.
```

Risk:

```txt
Medium only when migrating active descriptor identity. This should be handled in
a deliberate schema/version transition rather than patched casually.
```

Recommended migration:

```txt
Introduce or promote an explicit descriptor id field, such as
assetDescriptorId, while keeping assetId as a compatibility alias during a
transition.
```

## Behaviorally Dangerous Remaining Uses

The remaining behaviorally dangerous uses after Step 4.5 are:

1. Active descriptor generation from content hash.
   This is not immediately breaking after the byte/resource migration, but it is
   not suitable for durable descriptor identity.

2. Schema/validator treatment of `assetId` as primary id.
   This is safe as compatibility, but it will block a clean descriptor-id
   migration unless handled deliberately.

Step 4.5 hardened the most operationally risky compatibility paths without
changing `assetId` generation:

```txt
reference ingest filenames no longer key only on assetId
candidate review rejects ambiguous selectedAssetId matches
project status reports duplicate content-derived assetIds across situations
```

## Step 5 Recommendation

Step 5 is still needed, but not now. Step 4.5 removed the immediate operational
hazards around repeated same-content reference ingest and same-content review
selection. The remaining reason to change active `assetId` generation is
storage/backend promotion or a schema/version transition that needs descriptor
identity to stop being content-derived.

Recommended timing:

```txt
Now:
  Do not migrate assetId generation.
  Keep current compatibility.
  Continue using contentId for byte posture.
  Continue using situation/placement subject refs for resource posture.

Soon, before richer review workflows:
  Keep selectedAssetId as compatibility.
  Prefer descriptor/situation-based selection in commands and docs.

Before storage/backend promotion:
  Migrate active descriptor identity generation away from content hash.
  Add or promote assetDescriptorId.
  Keep assetId as compatibility alias for existing records.
  Stop writing new record paths that are keyed only by content-derived assetId.
```

## Smallest Safe Migration Sequence

1. Add `assetDescriptorId` as an explicit field on new descriptors while keeping
   existing `assetId` unchanged.

2. Update reference ingest and promotion record filenames to use
   descriptor/situation-safe ids, not content-derived assetId.
   Status: partially done for reference ingest in Step 4.5.

3. Add review selection by `assetDescriptorRef` or `situationRef`; keep
   `selectedAssetId` as compatibility.
   Status: done in Step 4.5.

4. Update schemas to require `assetDescriptorRef` or `assetDescriptorId` while
   retaining `assetId` during transition.

5. After compatibility has settled, decide whether `assetId` remains a legacy
   alias or is replaced by `assetDescriptorId` in a future schema version.

## Non-Claims

This audit does not claim:

```txt
mesh truth
distributed proof
ratified shared state
byte availability proof
materialization proof
resource admission
causal truth
publication authorization
Edge approval
```
