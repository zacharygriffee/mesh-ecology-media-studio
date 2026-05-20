# Media Identity And Storage Posture

## Purpose

`repair:local-posture` exposed a deterministic semantic identity collapse:
multiple local asset descriptors can point at the same bytes and therefore
share the same content-derived `assetId`, while still representing different
Studio meanings, workflow roles, and placements.

This is not a cryptographic collision. It is a modeling issue. Studio must not
use one identifier for content identity, descriptor identity,
situation/placement identity, resource identity, byte publication identity,
materialization identity, and causal history.

This pass refines the Studio wording further: `placementRef` is not the
universal ontology layer. `situationRef` is the broader observer/context/surface
position of a referent-like artifact. `placementRef` is one concrete subtype of
`situationRef`, usually path, container, slot, or lifecycle based.

Spine has now adopted this as family-wide doctrine in
`../mesh-ecology-spine/docs/identity-layering-and-storage-posture.md`
(`5bafd47 Add identity layering storage posture`). Studio is the media-domain
application and discovery evidence for that posture, not the owner of the
family-wide rule.

The family rule from Spine is:

```text
content identity
!= byte publication identity
!= artifact descriptor identity
!= situation / placement identity
!= resource identity
!= causal referent identity
!= materialization identity
!= authority state
```

## Layered Identity Model

Studio applies Spine's layered identity model in media-domain terms:

| Layer | Answers | Current posture |
| --- | --- | --- |
| `contentId` | Are these bytes identical? | Usually derived from a content hash. |
| `bytePublicationRef` | Where can these bytes be fetched or replicated from? | Future Bytes/Hyperblob/Hypercore-facing ref, not implemented here. |
| `assetDescriptorId` | What Studio media-domain object is this? | Must not collapse merely because bytes match. |
| `referentRef` | What observer-facing thing is being tracked? | Future causal/media adapter layer; not implemented here. |
| `situationRef` | Where/as-what is this referent-like artifact situated for an observer in a context, surface, branch, device, project, timeline, concern, virtual drive, or Virtualia region? | Broader than filesystem placement; conceptual only here. |
| `placementRef` | What concrete path, container, slot, or lifecycle placement applies when relevant? | Current local-project subtype of `situationRef`. |
| `resourceRefCandidateId` | What exact local-layer resource subject is being proposed? | Should be descriptor/situation/placement-specific. |
| `causalReferentId` / `causalRefs` | What happened across import, copy, fork, transform, publish, materialize, or export? | Future causal-shaped linkage; causal-substrate remains optional. |
| `materializationRef` | Where was this asset materialized for a script, app, or tool? | Local execution/view path only, not truth. |
| `authorityState` | What was admitted, ratified, approved, authorized, or materialized by a valid authority lane? | Not implied by any local Studio record. |

The documentation stack is:

```text
contentId
publicationRef
artifactDescriptorRef
referentRef
situationRef
  -> placementRef as one subtype
resourceRef
materializationRef
authorityRef
causalRefs
```

Core rule:

```text
No master ID.
Layered refs.
Each ref answers one question.
```

## SituationRef And PlacementRef

`situationRef` describes the broad observer/context/surface/role position of a
referent-like artifact. It can involve a Studio project, Edge local-layer
surface, rough-cut timeline, mesh concern, causal branch, virtual drive view, or
Virtualia region.

`placementRef` is a concrete subtype of `situationRef`. In current Mode 0
Studio records it usually means a project-local path, placement class, and
lifecycle state such as `media/accepted/candidate.mp4` with
`placementClass=media-accepted`.

Conceptual future shape only:

```json
{
  "schema": "media.situation_ref.v1",
  "situationId": "situation:<hash>",
  "observerRef": {
    "kind": "operator | agent | device | mesh-participant | studio",
    "id": "operator:zack"
  },
  "contextRef": {
    "kind": "studio-project | local-device | virtual-drive | timeline | mesh-concern | causal-branch | virtualia-region",
    "id": "project:tangential-condition"
  },
  "surfaceRef": {
    "kind": "media-project-local-layer | edge-local-layer | mesh-concern-surface | virtual-drive-view",
    "id": "surface:studio-media-project"
  },
  "role": "accepted-candidate",
  "placement": {
    "kind": "path-placement",
    "path": "media/accepted/candidate.mp4",
    "placementClass": "media-accepted",
    "lifecycleState": "accepted"
  },
  "ruleBookRef": {
    "id": "rule-book:studio-local-media"
  },
  "causalRefs": {
    "branchRefs": [],
    "happeningRefs": [],
    "deferred": true
  },
  "nonClaims": {
    "truthClaimed": false,
    "authorityGranted": false,
    "materializationProven": false
  }
}
```

Examples:

- Local project situation: context is a Studio project, surface is
  `media-project-local-layer`, role is `accepted-candidate`, placement subtype
  is path `media/accepted/candidate.mp4` with lifecycle state `accepted`.
- Timeline situation: context is a rough-cut timeline, role is `clip segment`,
  placement subtype is track `video-1` and time range `00:12-00:18`.
- Virtual drive situation: context is a future virtual drive, role is
  `first-frame-reference`, placement subtype is path
  `shots/014/references/first-frame.png`.
- Mesh concern situation: context is a `media-candidates` concern, role is
  `proposed accepted candidate resource`, and `resourceRef` remains candidate
  only.
- Virtualia situation: context is a Virtualia region or projected world layer,
  role is visual referent / projection layer, and causal refs remain
  observer-relative branch refs.

Non-claims:

- `situationRef` is not truth.
- `placementRef` is not authority.
- local path is not durable identity.
- `resourceRef` is not admission.
- `byteRef` is not availability proof.
- `materializationRef` is not ratification.
- causal refs are not storage.
- Edge inspection is not approval.

## Byte And Resource Posture

Byte descriptor proposals should be keyed by content identity. They describe
bytes and content-derived digest posture. The same `contentId` may appear in
multiple placements and may have multiple byte publication refs over time.

Resource-ref candidates should be keyed by artifact descriptor and
situation/placement identity. They propose a resource subject for a specific
Studio object in a specific observer/context/surface role and concrete
path/slot/lifecycle position when applicable. One resource candidate must not
accidentally satisfy two placements unless it explicitly models both subjects.

Causal records should link content, descriptor, referent, situation, placement,
byte publication, and materialization histories without collapsing them.

## Example

The same MP4 bytes may be copied into two placements:

```text
media/accepted/candidate.mp4
media/references/candidate.mp4
```

Expected future posture:

```text
one shared contentId
one or more bytePublicationRefs
two assetDescriptorIds
two situationRefs
two placementRefs
two resourceRefCandidateIds
causal relation showing shared origin or copy/fork relationship
```

The same content does not imply the same Studio meaning. An accepted candidate
and a reference asset may share bytes while carrying different review,
production, and handoff semantics.

## Shared Basis, Fork, And Divergence

A fork may share content and origin, but once its situation branch diverges it
must receive its own situation/resource identity.

Studio uses this framing:

- `contentId`: same bytes.
- `basisRef` / `originRef`: shared basis or source ancestry.
- `situationRef`: deterministic identity of the referent/artifact situated in a
  context, role, surface, and rule-book basis.
- `observerSituationViewRef`: optional future observer-specific view when
  visibility, affordances, permissions, or local materialization differ.
- `placementRef`: concrete local path/container/slot/lifecycle subtype of
  `situationRef`.
- `resourceRefCandidateId`: proposed resource subject for the specific
  descriptor/situation/placement.

The fixture at
`examples/identity-fixtures/shared-basis-divergent-situations/` captures this
pressure with identical test bytes copied into accepted and reference roles. It
keeps one shared `contentId`, `originRef`, `basisRef`, and byte descriptor
proposal while assigning separate `situationRef`, `placementRef`, and
`resourceRefCandidateId` values.

Observer view identity is separate from situation identity. Two operators
inspecting the same accepted candidate in the same Studio project can share the
same `situationRef`; they only need distinct `observerSituationViewRef` values
when the observer-specific view changes. Importing the same content into a
different project, role, surface, or rule-book basis creates a new
`situationRef`.

## Current Migration Note

Current Studio records still derive `assetId` from content hash in active
generation paths. That compatibility state is deliberate for now and is
stabilized in [Identity Migration Boundary](44-identity-migration-boundary.md).

The important current behavior has already moved to layered identity:

```text
byte descriptor proposals:
  keyed by contentId

resource-ref candidates:
  keyed by descriptor/situation/placement resource subject

operator health/readiness/repair summaries:
  byteContent by contentId
  resourceSituations by situation/placement subject
```

Step 5, changing active `assetId` generation, should be migrated deliberately
rather than patched opportunistically.

The collision happened because one content-derived ID was being asked to answer
too many questions:

```text
same bytes?
same artifact?
same situation?
same local placement?
same resource?
same causal referent?
same authority state?
```

The fix is not simply to replace `assetId` with `placementRef`. The fix is to
separate layered refs: `contentId`, `artifactDescriptorRef`, `referentRef`,
`situationRef`, `placementRef`, `resourceRef`, and `causalRefs`.

High-risk compatibility paths have been hardened without changing active
`assetId` generation: reference ingest filenames no longer key only on
`assetId`, candidate review rejects ambiguous `selectedAssetId`, and project
status warns when one content-derived `assetId` appears in multiple situations.

The preferred future test fixture is:

```text
same content copied to accepted and reference placements
```

Expected result:

```text
one contentId
two asset descriptors
two situation refs
two placement refs
one shared byte descriptor proposal where appropriate
two resource-ref candidates
repair does not collapse one placement into the other
causal/linkage fields are shaped or explicitly deferred
```

The committed fixture proves the model shape. Runtime byte/resource writers
still need a later migration before `repair:local-posture` can repair every
same-content divergent-situation project without residual attention.

## Storage Stack Posture

The mature storage direction may eventually involve:

- Hyperblob / Hypercore for byte storage and replication.
- Hyperbee for pointer, index, and catalog lookup.
- Autobase for multiwriter catalog or pointer-state coordination.
- Hyperdrive for project, capsule, or virtual-drive layout where useful.
- Concern surfaces for proposals, descriptors, availability observations,
  resource posture, admission, and ratification flows.
- Causal Substrate for lineage, referents, origin, fork, transform,
  materialization, and export history.
- Studio for media meaning, cards, assets, placements, provider results,
  review, continuity, and production descriptors.
- Edge for operator inspection, repair guidance, mediation, and decision
  requests.
- Platform/local runner for eventual execution against materialized paths.

This document does not implement that stack.

## Virtual Drive Posture

Studio should treat the filesystem as a compatibility projection, not durable
truth.

```text
refs + manifests + causal records + byte publications + materialization receipts
  are the durable model.

local filesystem paths
  are materialized views, execution workspaces, caches, mirrors, or human
  inspection surfaces.
```

Future virtual drives may present media/project files at paths for existing
programs, scripts, AI tools, and editors. The rule remains:

```text
paths are views
refs are identity
receipts are evidence
ratification/admission is authority
```

## Media Format Posture

Studio should not choose one universal media format and should not make
Hyperbee, Hyperdrive, or any index layer into a codec.

Original media bytes should remain in appropriate source or delivery formats:

```text
mp4, mov, webm, png, jpg, wav, flac, and similar native containers
```

Studio creates descriptors, indexes, capsules, timelines, and causal refs
around those bytes. Exports create delivery/master formats as needed.

## Studio Working Format

A future Studio working format should be a capsule, index, or edit graph rather
than a video container replacement. A future candidate may be:

```text
media.studio_capsule.v1
```

It may include manifests, asset descriptors, content ids, byte publication refs,
timeline/edit graphs, track/layer refs, proxy refs, thumbnail refs, waveform
refs, frame/segment refs, causal refs, review refs, and provenance refs.

This pass does not implement `media.studio_capsule.v1`.

## Sparse Frame And Layer Indexing

Frame explosion is a known risk. Studio should not explode every video into
every frame by default.

Use sparse/lazy indexing:

```text
Tier 0:
  whole media object

Tier 1:
  compact metadata and media index
  duration, codec, dimensions, fps estimate, keyframe hints, waveform/proxy/thumbnail refs

Tier 2:
  selected frame refs
  first frame, last frame, scene changes, operator-pinned frames, continuity frames, masks, reference frames

Tier 3:
  full frame sequence
  opt-in only for workflows that require it
```

Hyperbee may later index content, placements, timelines, frame pins, layer
ranges, waveform chunks, and referent occurrences. That does not make frame
indexing mandatory.

## Causal History For Files

Do not require every cache/temp file to carry full causal history.

Use event significance:

```text
A file crossing a workflow boundary should gain causal posture.
```

Workflow boundaries include imported, generated, copied, accepted, rejected,
referenced, transformed, published, mirrored, materialized, exported, retired,
and deleted.

Causal-substrate may later interpret the history. It must not become Studio's
storage engine, policy engine, or workflow executor.

## Local And Mesh Storage Motivation

Replicating media across local-layer and mesh-layer devices is not redundant.
It supports availability, durability, faster materialization, WAN bandwidth
strategy, reduced single-device upload bottlenecks, hot/cold storage posture,
and sparse or full replication across devices.

Storage actors make bytes available. They do not make bytes meaningful,
accepted, admitted, ratified, or published.

Possible future actor roles:

- `byte-publisher-organism`
- `byte-mirror-organism`
- `availability-observer-organism`
- `media-catalog-indexer-organism`
- `virtual-drive-materializer-organism`
- `causal-linker-organism`
- `resource-ratifier`

These are not implemented here.

## Future Health Issue Codes

Future health/repair passes may need issue codes such as:

```text
resource_candidate_collapses_distinct_placements
content_identity_reused_as_resource_identity
ambiguous_content_identity_resource_candidate
```

They are documented as future-only here. They should not be emitted until
health/repair code consumes them directly.

## Adjacent Repo Recommendations

Spine has resolved the family-wide doctrine location in
`docs/identity-layering-and-storage-posture.md`. Remaining recommendations are
repo-specific adoption work, not blockers for this Studio posture document.

Repo: `mesh-ecology-bytes`
Concept: Multiple byte references/publications for the same content hash.
Current issue: Studio needs content identity to differ from publication and
availability identity.
Suggested owner: Bytes descriptor/reference posture.
Suggested file/doc: ByteDescriptor / ByteReference docs.
Blocking status: Optional until Studio emits real byte refs.
Risk: A byte descriptor may be mistaken for availability, materialization, or
artifact meaning.

Repo: `mesh-ecology-packs`
Concept: Control-surface rendering of content identity, situation identity, and
placement identity.
Current issue: Future surfaces should show that same bytes can appear in
different observer contexts, surfaces, roles, and concrete placements.
Suggested owner: Packs control-surface vocabulary.
Suggested file/doc: media intent / semantic component docs.
Blocking status: Optional.
Risk: Operator UI may imply the same content means the same situation,
placement, approval, or production role.

Repo: `causal-substrate`
Concept: Distinct media referents for content, descriptor, situation,
placement, publication, and materialization histories.
Current issue: Studio needs causal interpretation without making causal
substrate a storage engine or policy executor.
Suggested owner: Future media-causal-adapter guidance.
Suggested file/doc: consumer adoption / referent docs.
Blocking status: Optional until adapter work begins.
Risk: Causal history may collapse copy/fork/materialization events into one
artifact identity.

Repo: `mesh-ecology-spine`
Concept: `situationRef` as a broader observer/context/surface identity layer,
with `placementRef` as a subtype.
Current issue: Spine has family-wide identity layering posture, but Studio's
media identity pressure shows that placement alone is too path-shaped for
observer/context/surface reality.
Suggested owner: Spine doctrine.
Suggested file/doc: identity layering and storage posture, or a future
situation/reference posture doc.
Blocking status: Optional for current Studio docs; important before cross-repo
local-layer promotion.
Risk: Repos may model local path placement as the universal context identity
and lose observer/surface/branch semantics.

Repo: `mesh-ecology-media-studio`
Concept: Migration from content-derived `assetId` as catch-all identity toward
content-oriented byte proposals and descriptor/situation/placement-oriented
resource candidates.
Current issue: Active `assetId` generation remains content-derived for
compatibility, while byte and resource posture now use layered identity.
Suggested owner: Studio.
Suggested file/doc: [Identity Migration Boundary](44-identity-migration-boundary.md)
and a future descriptor-id schema transition.
Blocking status: Does not block the current Mode 0 local wedge.
Risk: A future storage/backend or authority lane may treat descriptor identity
as content identity if Step 5 is not handled deliberately before promotion.

## Non-Claims

This posture does not claim byte availability proof, materialization proof,
resource admission, mesh truth, distributed proof, ratified shared state,
provider truth, causal truth, publication authorization, or Edge approval.
