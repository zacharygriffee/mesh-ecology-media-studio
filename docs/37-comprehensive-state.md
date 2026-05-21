# Comprehensive State

This document captures the current state of `mesh-ecology-media-studio` after
the local wedge, Edge-inspection hardening, provider-neutral contracts,
production posture, resource posture, and handoff inspection work.

## Current Repo State

Studio is a Mode 0 usable media-domain repo. It can run local media work from a
card through candidate ingest, asset descriptor creation, review evidence,
readiness, and local operator decision. It can also export local inspection
records that later Edge surfaces may inspect.

The repo is still intentionally not a full studio application. There is no UI,
no default live provider flow, no Edge runtime call, no mesh publication, no
active ratifier lane, and no admitted local-layer resource backend.

REPL is not the Studio app target. It remains a transitional lab/debug surface
for adjacent operability work. Studio should target durable CLI/status JSON,
artifacts, refs, inspection packets, operator indexes, handoff candidates,
decision requests, readiness records, and Packs-aligned projections.

Project health now carries per-asset and production attention explanations into
existing health, inspection, handoff, and cross-project operator summaries. The
rows identify the unhealthy subject, issue codes, a safe local next action, and
non-claims. They remain local guidance and do not prove byte availability,
materialization, resource admission, causal truth, publication authorization, or
Edge approval.

`npm run media:import` imports safe project-relative media into `media/source`,
`media/generated`, or `media/references`, writes an asset descriptor with local
metadata probe posture, and exposes derivative readiness guidance for missing
thumbnails, proxies, or waveforms.

`npm run derivatives:thumbnail` uses `sharp` to generate local PNG thumbnails
for image descriptors and writes `media.derivative.local.v1` receipts. These
receipts clear thumbnail readiness for the matching descriptor/situation/
placement only. Proxy and waveform generation remain deferred.

`npm run media:summary` prints a compact operator summary of media intake,
metadata probe posture, derivative readiness, derivative receipts, and the
current byte/resource identity posture. `--print` emits the same summary as
machine-readable JSON. The command remains local-only and does not call Edge,
providers, storage backends, or mesh publication.

## Broad Vector

The repo is moving from local media execution toward inspectable local media
work packets that can later be mediated by Edge and mesh-facing flows.

The vector is:

```text
local media work
-> explicit descriptors and evidence
-> local inspection and health
-> Edge-readable handoff posture
-> future local-layer resource admission
-> future byte references and mesh proposals
-> future ratified/publication flows
```

The important constraint is that every step before a real authority lane stays
honest about being local-only guidance, evidence, cache, receipt, proposal, or
decision.

## Working Surface

The main local wedge is:

```bash
npm run wedge:example
```

That command uses:

```text
examples/card-to-candidate/cards/card.json
examples/card-to-candidate/media/generated/candidate.txt
```

and writes local project records under:

```text
examples/card-to-candidate/records/
```

Those generated runtime records remain ignored by git.

## Local Project Layout

The local layout is:

```text
cards/
media/
  source/
  generated/
  accepted/
  rejected/
  references/
  proxies/
  thumbnails/
  exports/
records/
  work-packets/
  provider-results/
  assets/
  evidence/
  readiness/
  decisions/
  manifests/
  exports/
  bytes/
  resources/
  production/
  approvals/
  requests/
```

Local refs are safe relative refs only. Absolute paths, traversal, home
expansion, URL refs, and backslash paths are rejected.

## Implemented Record Families

The repo currently defines and validates records for:

- media cards, work packets, and local run manifests
- local refs, project layout, and asset lifecycle
- provider-neutral generation requests, profiles, capabilities, and results
- provider shape registry, mappings, adapter contracts, and failure taxonomy
- Venice dry-run and gated live-smoke posture
- asset descriptors, image metadata, reference/media ingest, local metadata
  probe posture, derivative readiness guidance, and provider run ledger
- local candidate review, review evidence, readiness, and operator decisions
- local inspection packets and export bundles
- project status, project health, and readiness/resource summaries
- local continuity evidence
- Packs-aligned control-surface projection
- Edge compatibility bundles, handoff candidates, packet indexes, and operator
  decision requests
- production units, reference primitives, continuity bands, render strategies,
  and local production descriptors
- approval proposals
- byte descriptor proposals
- local-layer resource-ref candidates
- media operation candidates
- rule-resolution traces
- cross-project inspection input lists and operator indexes

The artifact registry is kept in:

```text
docs/artifact-kind-registry.md
src/contracts/artifact-kinds.js
```

## Provider State

Provider-specific work is deliberately narrow.

Implemented:

- provider-neutral request/profile/capability/result records
- provider shape and mapping registry
- Venice dry-run mapping
- gated Venice live smoke path
- provider failure fixture normalization
- local provider run ledger

Venice is an operational provider fixture only. Studio canon remains the
provider-neutral request/result/ingest/review/posture/status path.

Not implemented:

- default live provider execution
- broad provider adapter set
- provider secrets in git
- provider output as Studio authority
- provider truth

Venice live smoke requires explicit opt-in:

```bash
VENICE_LIVE=1 npm run provider:venice:smoke
```

`npm run provider:venice:loop` runs the full local generated-image loop with
an injected Venice-shaped response by default. Add `-- --live-provider` with
`VENICE_LIVE=1` only when intentionally spending provider credits. The loop
selects the latest generated provider candidate unless `--asset-record` is
supplied.

The loop persists a generic `media.provider_loop_status.local.v1` status record
so operators can inspect the last run without treating Venice as provider canon.
Operator packet indexes and cross-project indexes can now surface provider-loop
status refs, including failed or incomplete loops, as local attention guidance.
Provider-loop status can also produce `review-provider-loop` operator decision
requests. Those requests may ask for retry/defer on failed loops, but they do
not execute retries or grant authority.
Provider-loop requests can now produce local operator decisions. A live retry
after a failed loop must pass the retry decision record explicitly; the gate
prevents accidental repeat provider calls, but remains local-only guidance.
`media:summary` distinguishes local provider-loop completion, retry-decision
needs, and broader production-review readiness so a completed provider loop is
not overread as production-ready media.
Accepted generated assets now surface `needs-production-review` or
`production-review-proposed` posture, but neither state grants production
readiness or publication authority.
`media:summary` now includes a compact approval lane over local approval
proposals. The lane shows pending authority work and safe next actions, but
keeps `approvalAuthority`, `ratifierAuthority`, and `publicationAuthorization`
false.
The same summary includes one `safeNextAction` chosen from the current local
attention rows so the operator does not need to inspect raw JSON to continue.

Provider IDs and job IDs remain provenance only.

## Production State

The production model intentionally does not lock Studio into only classic video
terms. It supports scene/shot/clip as one strategy while leaving room for:

- worlds
- panoramas
- entity references
- look variants
- audio-first workflows
- rough cuts
- exports
- reference primitives
- continuity bands
- render strategies

Current production records are local descriptors and strategy guidance. They
are not UI contracts, mesh truth, publication authority, or provider requests.

## Resource And Byte State

Studio now has a clear JSON-exit posture:

```text
device_dependent_scaffold
-> local_layer_resource_ref candidate
-> later admitted local-layer resource ref
-> later replicated pointer ref
-> later causal-reviewable ref
```

Current records stop at candidate posture.

`media.byte_descriptor_proposal.local.v1` previews future byte descriptors but
does not prove byte availability or materialization.

`media.local_layer_resource_ref_candidate.local.v1` now carries explicit
promotion posture:

```text
proposedResourceRef.candidateOnly: true
proposedResourceRef.promotionStatus: candidate-only
proposedResourceRef.promotionAuthority: false
promotionPosture.status: candidate-only
promotionPosture.admissionRequired: true
promotionPosture.byteDescriptorRequired: true
promotionPosture.promotionAuthority: false
```

Resource candidates are not admitted resources, replicated pointers,
causal-reviewable refs, or authority-bearing refs.

## Identity Migration Boundary

Studio is intentionally in a hybrid compatibility state:

- `assetId` remains the descriptor id field for compatibility and is still
  content-derived in active generation paths.
- `contentId` is the explicit byte/content sameness field.
- byte descriptor proposals are keyed by `contentId`.
- resource-ref candidates are keyed by descriptor/situation/placement resource
  subjects.

Changing active `assetId` generation remains deferred until storage/backend
promotion, virtual-drive/materialization work, or a deliberate descriptor-id
schema transition. The current boundary is documented in
[Identity Migration Boundary](44-identity-migration-boundary.md).

## Edge-Seam State

Studio has mature local Edge-inspection artifacts, but no Edge runtime
integration.

Defined and exercised seams:

- `media-edge-operator-seam`
- `media-work-packet-seam`
- `media-evidence-import-seam`
- `media-readiness-guidance-seam`
- `media-operator-decision-seam`
- `media-byte-reference-seam`
- `media-causal-evidence-seam`

Current Edge-readable local artifacts include:

- `media.edge_inspection_packet.local.v1`
- `media.edge_export_bundle.local.v1`
- `media.control_surface_projection.local.v1`
- `media.edge_review_evidence.local.v1`
- `media.edge_compatibility_bundle.local.v1`
- `media.operator_packet_index.local.v1`
- `media.edge_handoff_candidate.local.v1`
- `media.operator_decision_request.local.v1`
- `media.cross_project_inspection_input_list.local.v1`
- `media.cross_project_operator_index.local.v1`

These artifacts make Studio outputs easier for Edge to inspect later. They do
not call Edge, verify Edge runtime behavior, or grant operator authority.

## Packs And Control Surface State

Studio has a Packs-aligned control-surface projection, but no UI.

Current posture:

- Packs vocabulary informs planes and action vocabulary.
- Studio remains the media-domain owner.
- The projection is readonly observer posture.
- There is no renderer contract.
- There is no authority surface.
- There is no dependency on Edge REPL command text, transcript state, session
  memory, or renderer output.

UI remains deferred until the control-surface and Edge-handback semantics are
stable enough to avoid baking in a premature workflow.

## Causal State

Studio records causal-shaped fields in media records:

- parent refs
- referents
- branch ids
- context ids
- observer/operator refs
- continuity claims
- transition summaries

`causal-substrate` remains optional. There is no `media-causal-adapter`
implementation yet.

## Authority State

Current local records may represent:

- local draft
- local receipt
- local cache
- local evidence
- local proposal
- local decision
- operator guidance
- request-only decision posture

They do not represent:

- mesh truth
- distributed proof
- ratified shared state
- provider truth
- byte availability proof
- materialization proof
- causal truth
- approval authority
- ratifier authority
- publication authorization

## Fixtures And Inspection State

Committed fixtures include:

```text
examples/inspection-fixtures/card-to-candidate/
examples/inspection-fixtures/unhealthy/
examples/inspection-fixtures/cross-project/
examples/provider-fixtures/
examples/provider-shapes/
```

Useful commands:

```bash
npm run fixture:inspection:check
npm run fixture:unhealthy:check
npm run operator:cross-project-index
```

The unhealthy fixtures cover:

- missing byte proposal
- stale resource ref
- stale production descriptor

Health summaries now expand those fixture states into subject-level attention
rows, such as an accepted asset missing byte/resource posture or a stale
production descriptor needing regeneration.

The cross-project fixture aggregates unhealthy project handoff posture through
an explicit input list. It does not discover projects.

## Local Posture Repair

`npm run repair:local-posture -- --project-dir examples/card-to-candidate`
turns safe health explanations into bounded local regeneration. It can repair
missing/stale byte descriptor proposals, missing/stale/unresolved local-layer
resource-ref candidates, and stale card-derived production descriptors.

The command does not create a new artifact family. It rewrites existing
local-only records, refreshes project health plus operator inspection surfaces,
and returns a machine-readable summary for tests/callers. It does not invent
reviews, approvals, provider results, byte availability proof, resource
admission, causal truth, Edge approval, or publication authorization.

`repair:local-posture` also exposed a deterministic semantic identity collapse:
same bytes can produce the same content-derived `assetId` while occupying
different Studio placements. The adopted posture is documented in
[Media Identity And Storage Posture](42-media-identity-and-storage-posture.md):
byte descriptor proposals should be content-oriented, resource-ref candidates
should be descriptor/situation/placement-oriented, and causal records should
link the layers without collapsing them. This now ties directly to Spine's
family-wide
`../mesh-ecology-spine/docs/identity-layering-and-storage-posture.md` posture.
It also aligns with
`../mesh-ecology-spine/docs/virtualia-placement-and-emergence-posture.md`:
Studio owns media-specific projection and asset workflows, while Virtualia is
an emergent cross-repo continuum. Spine's `sourceId`, locus, path, and
projection vocabulary informs future Studio promotion work but is not active
schema or runtime behavior here.
`examples/identity-fixtures/shared-basis-divergent-situations/` is the current
fixture pressure: accepted and reference copies share content/origin/basis but
use distinct situation, placement, and resource candidate identities.

The remaining active `assetId` generation migration is Step 5 and is explicitly
not required for the current Mode 0 wedge.

## Command Surface Inventory

The current command surface map lives at
[Command Surface Inventory](41-command-surface-inventory.md). It tracks compact
human output, machine-readable local artifacts, JSON stdout support, stable
refs, and known churn posture for operational commands.

`npm run production:capsule` writes
`media.production_asset_capsule.local.v1`, a local-only package of refs around
one accepted asset. It includes content, situation/placement, derivative,
byte/resource, provider-loop, local decision, and approval proposal refs where
present. It does not copy bytes or grant production authority.
`npm run media:summary` and `npm run operator:index` surface capsule counts and
capsule state so an operator can see whether accepted generated assets have a
local production package without opening raw JSON. Project health now reports
missing production capsules as local attention, and regenerated local inspection
packets, export bundles, and Edge compatibility bundles include capsule refs
when the records exist.
`npm run production:bundle` writes `media.production_bundle.local.v1`, a
local-only grouping over production capsule refs. Bundles are for operator
handoff/review readability only; they do not copy bytes, grant production use,
or replace the capsule as the per-asset package.
`npm run media:summary` and `npm run operator:index` now include a production
approval lane that distinguishes local decisions, approval proposals, production
capsules, production bundles, and missing authority. The lane is operator
readability over existing local refs only; it does not add approval authority or
production readiness.
Approval proposal records keep the compatibility `subjectRef` from the local
decision and now include situated asset descriptor/content/situation/placement
refs when the asset descriptor is available.
`npm run provider:venice:rehearse-production` composes the current Venice local
loop through that lane and writes the local inspection, operator index, and
Edge-compatible bundle surfaces. It is a rehearsal path, not an authority or
publication path.
`npm run production:authority-prereqs` reports the local prerequisite state for
accepted production candidates: local decision, approval proposal, situated
approval refs, capsule, bundle, byte/resource posture, derivative refs, and the
remaining authority gap. It does not write a new authority artifact.

## Current Verification Baseline

The expected baseline is:

```bash
npm test
npm run wedge:example
npm run fixture:unhealthy:check
npm run operator:cross-project-index
npm run rule:example
```

The repo also uses schema JSON parse checks and secret scans before commit.

## Repo Family Alignment

The current alignment map is:

```text
Studio:
  media-domain semantics and local media records

Spine:
  Rulebook Cascade (RBC), rule-book posture, mediation posture,
  projection-event posture, storage-lane direction, and proof standards

Edge:
  operator workbench/control loop and later inspection of Studio handoff
  artifacts

Packs:
  media intent families and control-surface semantic vocabulary

Bytes:
  portable byte descriptors, byte references, and materialization request
  posture

Causal Substrate:
  optional continuity interpretation grammar

Platform:
  host-local activation and lifecycle consequences

mesh-v0-2:
  canonical mesh participation and actor hygiene
```

RBC is the shared Spine vocabulary for deriving effective rule-book posture.
Studio remains a media policy-domain owner inside that cascade; it does not
implement the shared RBC engine or redefine rule-book semantics.

See [Repo Family Alignment](38-repo-family-alignment.md).

## Deferred Work

Deferred deliberately:

- UI
- Electron or app shell
- full provider adapter set
- default live provider execution
- provider secret management beyond ignored `.env`
- Edge runtime calls
- mesh publication
- Hypercore, Hyperdrive, Hyperblob, or Autobase implementation
- admitted local-layer resource refs
- byte materialization proof
- active organisms
- active ratifiers
- causal-substrate adapter
- publication lane

## Risks

Current risks to manage:

- JSON record volume can grow too large if every future concept is modeled as
  hand-authored schema first.
- Local fixture generation can become noisy unless command output is made more
  compact.
- Edge-facing artifacts can look more authoritative than they are unless
  local-only flags and warnings stay strict.
- Provider-specific semantics can leak into Studio if adapters are allowed to
  define canonical media shapes.
- Production vocabulary can become too rigid if scene/shot/clip becomes the
  assumed root instead of one supported strategy.
- Resource refs can be misread as admitted unless promotion posture remains
  explicit.

## Next Objectives

Recommended next objectives:

1. Keep broad production strategy moving without adding UI.
2. Add compact production/operator summaries where existing commands are still
   too verbose.
3. Exercise the committed missing-artifact cross-project fixture in review
   workflows.
4. Keep Venice provider posture stable before adding another provider.
5. Continue avoiding new artifact kinds unless a command or test consumes them.
6. Defer UI, Edge runtime calls, mesh publication, and broader provider
   expansion until operator inspection remains boring under repeated local runs.

## Repo Vector Statement

Studio is doing meaningful work toward becoming the mesh-facing media
production frontier: it performs local media work, records media-specific
meaning, exposes Edge-inspectable operator posture, and keeps every authority
boundary explicit. The next work should continue improving inspectability and
operator clarity before introducing UI, broad provider support, or runtime
integration.
