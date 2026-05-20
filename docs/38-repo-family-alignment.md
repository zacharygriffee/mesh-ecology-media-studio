# Repo Family Alignment

## Purpose

This document aligns Studio with the surrounding mesh-ecology repo family before
new runtime work, UI work, provider expansion, Edge integration, mesh
publication, or local-layer backend implementation.

The pass read these read-only sources:

- `mesh-ecology-spine/README.md`
- `mesh-ecology-spine/docs/rule-book-and-mediation-posture.md`
- `mesh-ecology-spine/docs/local-layer-projection-event.md`
- `mesh-ecology-spine/docs/autobase-storage-lane-direction.md`
- `mesh-ecology-spine/docs/layer-composition.md`
- `mesh-ecology-spine/docs/proof-standards.md`
- `mesh-ecology-edge/README.md`
- `mesh-ecology-edge/docs/operator-loop.md`
- `mesh-ecology-packs/README.md`
- `mesh-ecology-packs/docs/media-intent-map.md`
- `mesh-ecology-packs/docs/media-contract.json`
- `mesh-ecology-packs/docs/local-cache-not-local-truth.md`
- `mesh-ecology-packs/docs/surface-first-doctrine.md`
- `mesh-ecology-packs/docs/control-plane-ui-concept.md`
- `mesh-ecology-packs/docs/mesh-native-interaction-model.md`
- `mesh-ecology-packs/docs/semantic-control-plane-components.md`
- `mesh-ecology-bytes/README.md`
- `causal-substrate/README.md`
- `causal-substrate/docs/consumer-adoption.md`
- `mesh-ecology-platform/README.md`
- `mesh-v0-2/README.md`
- `mesh-v0-2/docs/canonical-mesh-participation.md`
- `mesh-ecology-identity/README.md`
- `mesh-ecology-testbed/README.md`

`mesh-v0-2` is the local checkout for the GitHub repo named
`mesh-ecology`. Studio should refer to it as adjacent mesh-v0-2 when the local
workspace path matters.

## Studio-Owned Domain

Studio owns media-domain semantics:

- cards
- references
- provider-neutral media generation requests
- provider results after normalization
- local media assets
- review evidence
- readiness guidance
- operator decision requests
- production descriptors
- continuity evidence
- media-specific Edge-readable handoff artifacts

Studio does not own Edge operator workbench semantics, Packs control-plane
canon, Bytes transport/materialization infrastructure, causal-substrate
continuity grammar, Platform activation, mesh-v0-2 runtime law, or Identity
authority roots.

The durable split is:

```text
Studio local media layer:
  media bytes
  cards
  references
  provider outputs
  asset descriptors
  candidate reviews
  production descriptors
  local manifests
  byte/resource candidates

Edge local/operator layer:
  operator workbench
  readiness rollups
  next actions
  decision queues
  evidence inbox
  cross-repo handoff review

Spine:
  reusable rule-book posture
  mediation posture
  local-layer projection-event posture
  Autobase/equivalent storage-lane direction
  non-claim doctrine
```

## Spine Concepts Studio Adopts

Studio adopts these Spine concepts directly:

- a rule book is an elected compatibility boundary, not global law
- mediation pressure should be explicit and operator-visible
- rule resolution should eventually produce a trace
- projection events are derived/source-referenced, not truth
- local JSON exports are renderings or scaffolds, not durable local-layer state
- Autobase or an equivalent linearized lane is a direction, not a promoted
  Studio backend
- append success is not acceptance
- linearization is not truth
- replica visibility is not continuity
- wall-clock order is not causal order
- proof type must be named honestly: scaffold, local-layer, mesh-layer,
  deployment, causal-history, or control-surface readiness

This gives Studio a way to evolve from local media records toward local-layer
projection candidates without confusing files, command output, or view state
with shared authority.

## Rule Book And Mediation Posture

A Studio rule book is an elected compatibility boundary for media work.

It is not:

- global law
- truth
- runtime authority
- a scheduler
- an executor
- causal-substrate

Studio should use composable rule dimensions instead of bespoke policy names:

- `artifactClass`
- `operationClass`
- `scopeDelta`
- `riskTier`
- `reversibility`
- `authorityBoundary`
- `evidenceRequirement`
- `escalationMode`
- `deliveryMode`

Studio adopts Spine precedence:

```text
forbid > ask_operator > auto_prepare > auto_execute
```

Current posture:

- `auto_execute` is not implemented.
- Loosening requires explicit operator approval.
- Stricter rules win by default.
- CSS-like rule-book inheritance is the preferred future model:

```text
operator baseline rule book
-> local layer rule book
-> device rule book
-> project/context rule book
-> media operation constraints
= effective Studio media rule book
```

Studio now produces these candidate local artifacts:

- `media.operation_candidate.local.v1`
- `media.rule_resolution_trace.local.v1`

Those artifacts should describe media operation candidates and rule-resolution
results. They should not execute work, grant authority, or turn Studio into the
mediation cockpit. Edge delivers mediation pressure to the operator.

## Local-Layer Posture

Studio needs a local media layer, but it must follow Spine and Edge posture
rather than inventing a competing local-layer doctrine.

Use these terms:

- `media-project-local-layer`
- `media-operator-projection-layer`

The `media-project-local-layer` owns local files and media-domain records:

- source media
- generated media
- accepted/rejected bins
- references
- proxies
- thumbnails
- exports
- cards
- asset descriptors
- review records
- manifests

The `media-operator-projection-layer` owns derived summaries and projection
candidates that Edge may inspect later:

- project status
- project health
- operator packet indexes
- cross-project operator indexes
- Edge compatibility bundles
- handoff candidates
- decision requests

Studio should not depend on Edge for its local media files. Studio should also
not create promoted Spine projection events yet.

Future candidate:

```text
media.local_layer_projection_candidate.local.v1
```

That candidate should remain candidate-only and not promoted. It should include:

- `producerRepo`
- `projectionKind`
- `projectionSchema`
- `sourceRefs`
- `causalRefs` or explicit causal deferral
- `payloadHash`
- `identityHash`
- `derivedOnly: true`
- `promotionPosture`
- `writerPolicy`
- `readerPolicy`
- `nonClaims`

Required non-claims:

```text
truthClaimed: false
completionClaimed: false
authorityGranted: false
rendererOwnsAuthority: false
edgeCalled: false
meshPublished: false
```

## Autobase / Pointer-Lane Direction

Studio acknowledges Spine's Autobase/equivalent storage lane direction.

Studio may later produce projection candidates suitable for an
Autobase/equivalent linearized local-layer lane.

Studio does not:

- promote an Autobase backend
- implement Hypercore/Corestore storage
- implement Hyperdrive/Hyperblob storage
- require Hyperbee indexes
- migrate local JSON into durable local-layer state
- treat append success as acceptance
- treat linearization as truth
- treat replica visibility as continuity
- treat wall-clock order as causal order

The current Studio lane remains:

```text
local media work
-> explicit local records
-> derived local projection candidates
-> later Edge-readable inspection
-> future local-layer projection candidate
-> future promoted lane only after a repo-family decision
```

## Edge Relationship

Edge is the operator-facing boundary/control plane between a local execution
domain and a shared mesh. Studio is Edge-compatible, not Edge-dependent.

Studio should expose Edge-readable artifacts. Studio should not become Edge.
Edge should not become Studio.

Current Studio outputs may later feed:

- `media-edge-operator-seam`
- `media-work-packet-seam`
- `media-evidence-import-seam`
- `media-readiness-guidance-seam`
- `media-operator-decision-seam`
- `media-byte-reference-seam`
- `media-causal-evidence-seam`

Edge's operator loop is:

```text
observe -> update state -> present cockpit frame -> accept input
-> emit bounded action -> repeat
```

Studio should help that loop by providing explicit artifacts that show:

- what media work happened locally
- which refs connect records
- which evidence is missing
- which assets are accepted or rejected locally
- which readiness blockers remain
- which operator decisions are being requested
- which boundaries are still active

Studio must not infer Edge state, call Edge in Mode 0, write Edge records, or
treat Edge inspection as approval.

## Packs And Control-Surface Doctrine

Studio reuses Packs vocabulary for media intent and control-surface posture.
Packs does not own Studio media semantics.

Preserved media intent families:

- `image-generation`
- `video-generation`
- `audio-generation`
- `media-transformation`
- `media-evidence`

Packs also adds pressure that Studio media state should prefer referenced or
hybrid carrier patterns and preserve provenance.

Control-surface implications:

- UI should not come before semantic records and projection posture.
- The renderer owns presentation only.
- Surface actions, subjects, planes, policy, authority requirements, receipts,
  and evidence are the real contract.
- Local UI storage may be cache or draft, not durable shared truth.
- Semantic components such as `evidence-panel`, `action-console`, and
  `approval-gate` are useful future fit points.

Studio should continue producing Packs-aligned control-surface projections
without implementing a UI until Edge/operator handback semantics are clearer.

## Bytes And Media Artifact Storage

Studio owns media meaning. Bytes owns portable byte descriptor/reference and
materialization posture.

Studio may store large media bytes locally in Mode 0. That local storage is not
shared truth and not byte availability proof.

Bytes concepts Studio should map to later:

- `ByteDescriptor`
- `ByteReference`
- `MaterializationRequest`

Important boundaries:

- byte descriptors do not own artifact meaning
- byte references do not prove availability by themselves
- materialization hints are non-authoritative
- shared descriptors must not include host paths
- Studio byte descriptor proposals are proposals only
- local files are not materialization proof

Studio should keep using `media.byte_descriptor_proposal.local.v1` as a preview
record until a real Bytes publication/materialization lane exists.

## Causal-Substrate Relationship

Causal-substrate is continuity grammar, not a policy engine, workflow engine,
mesh runtime, event log, or truth engine.

Studio may emit causal-shaped fields:

- parent refs
- referents
- branch ids
- context ids
- observer/operator refs
- continuity claims
- transition summaries

Future `media-causal-adapter` work may let causal-substrate interpret:

- what happened
- which branch/context saw it
- which rule book was active
- which rule was applied
- whether histories stayed compatible

Causal-substrate must not execute Studio policy, own Studio workflow, decide
media acceptance, grant authority, publish to mesh, or become the Studio
database.

## Platform Boundary

Platform owns host-local lifecycle and activation. Studio does not activate
services directly.

Platform-owned concepts include:

- artifact intake
- stage/install/activate/retire semantics
- host-local activation consequences
- receipts
- audit/status/explain surfaces
- local service scaffolds for bounded device actions

Studio should not imply platform deployment readiness. Any future Studio media
runtime, sidecar, provider worker, or renderer that needs host activation must
go through Platform-owned lifecycle posture or an explicit later boundary.

## mesh-v0-2 Participation Boundary

Adjacent mesh-v0-2 owns primitive runtime and coordination semantics.

Studio must preserve these participation rules:

- canonical mesh-facing actors obtain cross-runtime truth only through mesh
  participation on supported surfaces or supported SDK/operator APIs
- direct cross-runtime store reads are not actor truth
- copied local storage is not actor truth
- filesystem inspection is not actor truth
- readonly does not mean safe
- readonly does not mean permitted
- side channels are out of canonical posture unless explicitly declared as
  exceptions

Studio Mode 0 is not canonical mesh participation. It is a local media work
lane that prepares future mesh-facing proposals, evidence, and references.

## What Studio Must Not Reimplement

Studio must not reimplement:

- Edge's operator workbench or cockpit
- Packs control-plane canon
- Bytes byte-store authority
- causal-substrate continuity kernel
- Platform activation or lifecycle enforcement
- mesh-v0-2 runtime surfaces
- Identity authority roots or signer verification
- Testbed proof scope
- a local-layer storage doctrine that contradicts Spine
- a provider-specific API as Studio canon
- UI-local durable truth

## What Studio May Produce Locally

Studio may produce local-only records for:

- media cards
- media work packets
- provider-neutral generation requests
- provider profiles/capabilities/results
- provider adapter runs and ledgers
- local media asset descriptors
- reference ingest receipts
- local review evidence
- candidate review comparisons
- readiness guidance
- operator decisions and decision requests
- project status and health
- production units/descriptors
- approval proposals
- byte descriptor proposals
- local-layer resource-ref candidates
- Edge inspection packets
- Edge compatibility bundles
- operator packet indexes
- cross-project operator indexes

These are local drafts, receipts, caches, evidence, proposals, decisions, or
guidance. They are not shared authority.

## Future Promotion Candidates

Current local mediation artifact names:

- `media.operation_candidate.local.v1`
- `media.rule_resolution_trace.local.v1`

Future projection candidate artifact name:

- `media.local_layer_projection_candidate.local.v1`

Candidate promotion path:

```text
local media record
-> derived operator projection candidate
-> local-layer projection candidate
-> explicit repo-family promotion decision
-> admitted local-layer projection event
-> later storage-lane/backend decision
```

Required promotion posture:

- candidate-only until admitted
- source refs required
- payload and identity hashes required
- causal refs required or explicitly deferred
- writer/reader policy required
- local paths and HTTP URLs cannot define shared identity
- renderer output cannot define authority

## Adjacent Repo Gaps Or Recommendations

No blocking adjacent repo changes were found for the current Studio phase.

Repo: `mesh-ecology-edge`

Concept: media-specific Edge import profile

Current issue: Edge has strong generic cross-project, evidence, readiness, and
operator loop posture, but no Studio-specific import profile for media handoff
records yet.

Why Studio cares: Studio can already produce Edge-readable local artifacts, but
later Edge inspection would benefit from a named profile for media packets,
media evidence, readiness guidance, byte/resource candidates, and operator
decision requests.

Suggested owner: Edge

Suggested file/doc: a future Edge docs packet for `media-edge-operator-seam`

Blocking status: optional

Risk: Without a named Edge-side profile, Studio may keep growing local
compatibility bundles without knowing which subset Edge will actually prefer.

Repo: `mesh-ecology-spine`

Concept: adjacent product projection candidate guidance

Current issue: Spine defines promoted local-layer projection event posture, but
Studio needs a pre-promotion candidate shape for derived product projections.

Why Studio cares: Studio should align its
`media.local_layer_projection_candidate.local.v1` with Spine without promoting
it prematurely.

Suggested owner: Spine

Suggested file/doc: an adjacent-product projection candidate note near
`docs/local-layer-projection-event.md`

Blocking status: optional

Risk: Product repos may each invent slightly different pre-promotion candidate
fields before a shared candidate convention exists.

Repo: `mesh-ecology-packs`

Concept: media control-surface semantic component fit

Current issue: Packs has reusable semantic components, but no media-production
specific component mapping yet.

Why Studio cares: Studio should not invent UI widgets as contracts, but later
media review may need shared semantic fit for candidate comparison, continuity
bands, provider runs, rough cuts, and approval gates.

Suggested owner: Packs, with Studio as a consumer/source of domain pressure

Suggested file/doc: a future media control-surface component fit note

Blocking status: optional

Risk: UI work could start with Studio-specific widgets before semantic action
and evidence contracts are stable.

## Current Non-Claims

Studio currently does not claim:

- mesh truth
- distributed proof
- ratified shared state
- provider truth
- byte availability proof
- materialization proof
- causal truth
- publication authorization
- ratifier authority
- Edge runtime verification
- Platform deployment readiness
- canonical mesh participation
- local-layer backend promotion
- Autobase storage promotion
- renderer authority

Current Mode 0 records remain local-only unless and until a later explicit
promotion lane says otherwise.
