# Media Identity And Storage Posture

## Purpose

`repair:local-posture` exposed a deterministic semantic identity collapse:
multiple local asset descriptors can point at the same bytes and therefore
share the same content-derived `assetId`, while still representing different
Studio meanings, workflow roles, and placements.

This is not a cryptographic collision. It is a modeling issue. Studio must not
use one identifier for content identity, descriptor identity, placement
identity, resource identity, byte publication identity, materialization
identity, and causal history.

## Layered Identity Model

Studio adopts a layered identity model:

| Layer | Answers | Current posture |
| --- | --- | --- |
| `contentId` | Are these bytes identical? | Usually derived from a content hash. |
| `bytePublicationRef` | Where can these bytes be fetched or replicated from? | Future Bytes/Hyperblob/Hypercore-facing ref, not implemented here. |
| `assetDescriptorId` | What Studio media-domain object is this? | Must not collapse merely because bytes match. |
| `placementRef` | Where and in what workflow role does this asset live? | Project-local or future virtual-drive placement. |
| `resourceRefCandidateId` | What exact local-layer resource subject is being proposed? | Should be descriptor/placement-specific. |
| `causalReferentId` / `causalRefs` | What happened across import, copy, fork, transform, publish, materialize, or export? | Future causal-shaped linkage; causal-substrate remains optional. |
| `materializationRef` | Where was this asset materialized for a script, app, or tool? | Local execution/view path only, not truth. |

## Byte And Resource Posture

Byte descriptor proposals should be keyed by content identity. They describe
bytes and content-derived digest posture. The same `contentId` may appear in
multiple placements and may have multiple byte publication refs over time.

Resource-ref candidates should be keyed by asset descriptor and placement
identity. They propose a resource subject for a specific Studio object in a
specific role/path/lifecycle position. One resource candidate must not
accidentally satisfy two placements unless it explicitly models both subjects.

Causal records should link content, descriptor, placement, byte publication,
and materialization histories without collapsing them.

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
two placementRefs
two resourceRefCandidateIds
causal relation showing shared origin or copy/fork relationship
```

The same content does not imply the same Studio meaning. An accepted candidate
and a reference asset may share bytes while carrying different review,
production, and handoff semantics.

## Current Migration Note

Current Studio records still derive `assetId` from content hash in several
paths. Current byte/resource proposal writers and health checks map too much by
`assetId`. This is known and should be migrated deliberately rather than patched
opportunistically.

The preferred future test fixture is:

```text
same content copied to accepted and reference placements
```

Expected result:

```text
one contentId
two asset descriptors
two placement refs
one shared byte descriptor proposal where appropriate
two resource-ref candidates
repair does not collapse one placement into the other
causal/linkage fields are shaped or explicitly deferred
```

That fixture is deferred until the descriptor/resource schema migration can be
done cleanly.

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

Repo: `mesh-ecology-spine`
Concept: Identity layering across content, byte publication, artifact meaning,
resource subject, and materialization.
Current issue: Studio needs the distinction so local projection/resource lanes
do not collapse meaning into hash identity.
Suggested owner: Spine doctrine.
Suggested file/doc: local-layer/proof/local-resource posture docs.
Blocking status: Optional for Studio docs; important before shared
local-layer promotion.
Risk: Different repos may use `id`, `hash`, and `resourceRef` with incompatible
meanings.

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
Concept: Control-surface rendering of content identity and placement identity.
Current issue: Future surfaces should show that same bytes can appear in
different Studio roles.
Suggested owner: Packs control-surface vocabulary.
Suggested file/doc: media intent / semantic component docs.
Blocking status: Optional.
Risk: Operator UI may imply the same content means the same approval,
placement, or production role.

Repo: `causal-substrate`
Concept: Distinct media referents for content, descriptor, placement,
publication, and materialization histories.
Current issue: Studio needs causal interpretation without making causal
substrate a storage engine or policy executor.
Suggested owner: Future media-causal-adapter guidance.
Suggested file/doc: consumer adoption / referent docs.
Blocking status: Optional until adapter work begins.
Risk: Causal history may collapse copy/fork/materialization events into one
artifact identity.

## Non-Claims

This posture does not claim byte availability proof, materialization proof,
resource admission, mesh truth, distributed proof, ratified shared state,
provider truth, causal truth, publication authorization, or Edge approval.
