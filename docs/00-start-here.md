# Start Here

Studio is the media-domain frontier for mesh ecology. It starts local-first and
defines media-specific records that can later be inspected by Edge, mapped to
byte references, and interpreted through causal continuity adapters.

Read in this order:

1. [Charter](01-charter.md)
2. [Boundary and Ownership](02-boundary-and-ownership.md)
3. [Media Studio Doctrine](03-media-studio-doctrine.md)
4. [Edge Seams](04-edge-seams.md)
5. [First Wedge](09-first-wedge.md)
6. [Edge Inspection Preview](10-edge-inspection-preview.md)
7. [Local Project Layout](11-local-project-layout.md)
8. [Asset Lifecycle](12-asset-lifecycle.md)
9. [Provider-Neutral Job Contract](13-provider-neutral-job-contract.md)
10. [Provider Adapter Boundary](14-provider-adapter-boundary.md)
11. [Provider Shape Registry](15-provider-shape-registry.md)
12. [Venice Dry-Run Adapter](16-venice-dry-run-adapter.md)
13. [Venice Live Smoke Gate](17-venice-live-smoke-gate.md)
14. [Venice Smoke Edge Inspection Preview](18-venice-smoke-edge-inspection-preview.md)
15. [Local Inspection Export](19-local-inspection-export.md)
16. [Provider Runbook](20-provider-runbook.md)
17. [Provider Adapter Contracts](21-provider-adapter-contracts.md)
18. [Local Image Metadata](22-local-image-metadata.md)
19. [Adapter Runner And Export Bundles](23-adapter-runner-and-export-bundles.md)
20. [Provider Run Ledger And References](24-provider-run-ledger-and-references.md)
21. [Candidate Review And Project Status](25-candidate-review-and-project-status.md)
22. [Narrow Slice Completion](26-narrow-slice-completion.md)
23. [Packs Control Surface Alignment](27-packs-control-surface-alignment.md)
24. [Edge Compatibility Candidates](28-edge-compatibility-candidates.md)
25. [Production Strategy Posture](29-production-strategy-posture.md)
26. [Production Descriptors](30-production-descriptors.md)
27. [Approval Proposals](31-approval-proposals.md)
28. [Byte Descriptor Proposals](32-byte-descriptor-proposals.md)
29. [Record Folder Conventions](33-record-folder-conventions.md)
30. [JSON Exit And Resolvability Posture](34-json-exit-and-resolvability-posture.md)
31. [Operator Packet Index And Handoff](35-operator-packet-index-and-handoff.md)
32. [Cross Project Inspection Index](36-cross-project-inspection-index.md)
33. [Comprehensive State](37-comprehensive-state.md)
34. [Repo Family Alignment](38-repo-family-alignment.md)
35. [Operation Candidate And Rule Resolution](39-operation-candidate-and-rule-resolution.md)
36. [Edge Mediation Handoff Semantics](40-edge-mediation-handoff-semantics.md)
37. [REPL Posture And Control-Surface Target](40-repl-posture-and-control-surface-target.md)
38. [Command Surface Inventory](41-command-surface-inventory.md)
39. [Media Identity And Storage Posture](42-media-identity-and-storage-posture.md)
40. [AssetId Usage Audit](43-asset-id-usage-audit.md)
41. [Identity Migration Boundary](44-identity-migration-boundary.md)
42. [Local Media Intake And Derivative Readiness](45-local-media-intake-and-derivative-readiness.md)
43. [Production Asset Capsule](46-production-asset-capsule.md)

Spine now uses Rulebook Cascade (RBC) as the family-wide vocabulary for
effective rule-book posture. Studio docs align to RBC as a policy-domain
consumer while keeping Studio's resolver local and non-authoritative.

The first executable path is:

```bash
npm run wedge:example
```

Run tests with:

```bash
npm test
```

Export an existing Venice smoke run for local Edge-readable inspection with:

```bash
npm run inspect:venice-smoke
```

Export a generic manifest-backed local run with:

```bash
npm run inspect:local-run -- --project-dir examples/card-to-candidate
```

Summarize or index local inspection records with:

```bash
npm run inspect:summary -- --project-dir examples/card-to-candidate --packet records/exports/local-run-edge-inspection-packet.local.json
npm run inspect:index -- --project-dir examples/card-to-candidate
npm run inspect:provider-runs -- --project-dir examples/card-to-candidate
npm run operator:index -- --project-dir examples/card-to-candidate
npm run operator:cross-project-index
npm run rule:example
```

Create a local Edge-handoff preview bundle with:

```bash
npm run export:inspection-bundle -- --project-dir examples/card-to-candidate
```

The optional Venice live smoke command is intentionally gated:

```bash
VENICE_LIVE=1 npm run provider:venice:smoke
```

For the full local generated-image loop without a provider call:

```bash
npm run provider:venice:loop
```

Failed provider loops can produce local retry/defer requests and decisions:

```bash
npm run operator:provider-loop-request
npm run operator:provider-loop-decision -- --decision retry_provider_loop
```

The provider loop writes ignored local smoke artifacts under
`examples/venice-smoke/`. It does not run as part of `npm test`. Venice
provider capability and failure fixtures are local-only and validate without
calling the provider.

Check committed fixture freshness with:

```bash
npm run fixture:inspection:check
npm run fixture:unhealthy:check
```

Ingest a project-local reference asset with:

```bash
npm run reference:ingest -- --project-dir examples/card-to-candidate --source media/generated/candidate.txt --filename candidate-reference.txt
npm run media:import -- --project-dir examples/card-to-candidate --source media/generated/candidate.txt --placement source
```

`media:import` writes a local asset descriptor with metadata probe posture and
derivative readiness guidance. Image thumbnails are generated explicitly:

```bash
npm run derivatives:thumbnail -- --project-dir examples/card-to-candidate
```

Thumbnail receipts remain local-only. Proxy and waveform generation remain
deferred.

Summarize local media intake, derivative readiness, and identity posture with:

```bash
npm run media:summary -- --project-dir examples/card-to-candidate
npm run --silent media:summary -- --project-dir examples/card-to-candidate --print
```

Record a local candidate comparison and project status snapshot with:

```bash
npm run review:candidates -- --project-dir examples/card-to-candidate
npm run status:project -- --project-dir examples/card-to-candidate
npm run health:project -- --project-dir examples/card-to-candidate
npm run health:summary -- --project-dir examples/card-to-candidate
npm run continuity:draft -- --project-dir examples/card-to-candidate
npm run production:from-card -- --project-dir examples/card-to-candidate
npm run production:validate -- --project-dir examples/card-to-candidate
npm run production:capsule -- --project-dir examples/venice-smoke
npm run approval:proposal -- --project-dir examples/card-to-candidate
npm run bytes:proposal -- --project-dir examples/card-to-candidate
npm run resource:refs -- --project-dir examples/card-to-candidate
npm run readiness:edge -- --project-dir examples/card-to-candidate
```

`npm run health:summary`, `npm run inspect:summary`, handoff candidates, and
`npm run operator:cross-project-index` surface per-asset attention rows for
missing byte proposals, missing or stale resource-ref candidates, accepted
assets without byte/resource posture, and stale production descriptors. These
rows are operator guidance only and do not prove byte availability,
materialization, resource admission, or authority.
`npm run media:summary` also includes a compact approval lane so pending local
approval proposals are visible without treating them as approval authority.

Write a local Packs-aligned control-surface projection without adding UI:

```bash
npm run control:surface -- --project-dir examples/card-to-candidate
```

Write a local Edge compatibility bundle without calling Edge:

```bash
npm run edge:compat -- --project-dir examples/card-to-candidate
npm run operator:index -- --project-dir examples/card-to-candidate
npm run handoff:edge -- --project-dir examples/card-to-candidate
npm run operator:decision-request -- --project-dir examples/card-to-candidate
```

For the command-level meaning of local mediation traces in handoff surfaces,
read [Edge Mediation Handoff Semantics](40-edge-mediation-handoff-semantics.md).
For the durable control-surface target, read
[REPL Posture And Control-Surface Target](40-repl-posture-and-control-surface-target.md):
Studio should project over machine-readable artifacts, refs, status views, and
operator-loop contracts rather than Edge REPL command text or transcript state.
For current Edge app-facing integration posture, use
`../mesh-ecology-edge/docs/app-facing-seams.md`; old Edge phase docs are history
unless a current posture doc explicitly points at them.
For a compact map of command outputs, JSON modes, ref posture, and fixture
churn, read [Command Surface Inventory](41-command-surface-inventory.md).
For the identity split behind future byte/resource repair work, read
[Media Identity And Storage Posture](42-media-identity-and-storage-posture.md).
It applies Spine's family-wide
`../mesh-ecology-spine/docs/identity-layering-and-storage-posture.md` posture
and `../mesh-ecology-spine/docs/virtualia-placement-and-emergence-posture.md`
posture to Studio media assets. Studio uses `situationRef` and `placementRef`
for current media identity pressure, while Spine's `sourceId`, locus, path, and
projection terms remain directional vocabulary rather than active Studio
schemas.
For the current hybrid identity boundary, read
[Identity Migration Boundary](44-identity-migration-boundary.md): `assetId`
remains content-derived for compatibility, `contentId` keys byte sameness, and
resource posture uses descriptor/situation/placement resource subjects. Do not
migrate `assetId` generation until storage/backend promotion,
virtual-drive/materialization work, or a deliberate descriptor-id schema
transition.

To normalize safe local media posture after health inspection, run:

```bash
npm run repair:local-posture -- --project-dir examples/card-to-candidate
```

This command regenerates existing local-only byte proposal, resource-ref
candidate, and card-derived production descriptor records when health
explanations show they are missing or stale. It does not invent review
decisions, call providers, call Edge, publish to mesh, or prove byte
availability/materialization.

Phase 2 hardened the local wedge with a local run manifest, artifact-kind
registry, and modest malformed-record checks. Phase 3 defines the local project
layout, safe local refs, placement classes, and asset lifecycle states. Phase 4
adds provider-neutral request/profile/capability/result records without calling
provider APIs. Phase 5 adds provider shape and mapping fixtures without
promoting provider payloads into Studio canon. Phase 6 adds a Venice dry-run
adapter with fixture-only response normalization. Phase 7 adds an explicit
Venice live smoke gate for controlled provider testing. Phase 8 adds adapter-run
receipts, local failure evidence, image metadata inspection, fixture freshness,
and local export bundles. Phase 9 adds the provider-run ledger and reference
asset ingest. Phase 10 adds candidate comparison records and project status
snapshots. Phase 11 completes the narrow Mode 0 slice with continuity drafts,
byte descriptor preview alignment, candidate-review inspection export,
card-grouped provider attempts, and committed Edge bundle fixtures. The wedge
remains local-only. Phase 12 adds a Packs-aligned control-surface projection
for future inspection without defining UI or Edge runtime messages. Phase 13
adds Studio-built Edge compatibility candidates for documented Edge review
shapes without claiming Edge runtime verification. Phase 14 adds generalized
production-unit, reference-primitive, continuity-band, and render-strategy
records so scene/shot/clip remains one strategy rather than the root ontology.
Phase 15 adds local production descriptors for scene, shot, clip, rough-cut,
and export specializations without making those descriptors authoritative.
Phase 16 adds local approval proposals that require later authority without
granting it. Phase 17 adds byte descriptor proposals for accepted/reference
assets without claiming byte availability, materialization, or byte authority.
Phase 18 documents the new local record folders and extends local status and
inspection summaries around them. Phase 19 adds a local production-from-card
CLI without adding UI or provider work. Phase 20 adopts Spine's JSON-exit
posture by marking local JSON/path refs as scaffold and adding local-layer
resource-ref candidates. Phase 21 adds readiness guidance for unresolved
resource refs, byte proposal alignment for resource candidates, and production
descriptor parentage validation. Phase 22 carries readiness/resource summaries
into Edge compatibility bundles, adds stale byte descriptor detection, and adds
a local project health snapshot. Phase 23 adds local operator packet indexes
and Edge handoff candidates so the same records are easier to scan without
adding UI or Edge runtime calls. These records do not claim mesh truth,
distributed proof, byte materialization proof, provider truth, causal truth,
publication authorization, or ratifier authority. Phase 24 adds production
descriptor freshness checks and handoff readiness diagnosis so stale local
production records are visible before broader integration work.
Phase 25 adds request-only operator decision request records for future
Edge-mediated attention without granting approval, ratifier, or publication
authority.
Phase 26 adds compact unhealthy inspection fixtures for missing byte proposals,
stale resource refs, and stale production descriptors.
Phase 27 adds an explicit cross-project inspection input list and local
operator index so several project handoff postures can be scanned without
project discovery or Edge runtime calls.
Phase 28 makes resource promotion posture explicit so local resource-ref
candidates remain candidate-only and cannot be mistaken for admitted resource
identity.
Phase 29 aligns Studio with Spine, Edge, Packs, Bytes, causal-substrate,
Platform, mesh-v0-2, Identity, and Testbed without adding runtime behavior.
Phase 39 adds local media operation candidates and rule-resolution traces for
`auto_prepare`, `ask_operator`, and `forbid` mediation pressure without
implementing `auto_execute`, provider calls, Edge calls, mesh publication, or
deletion execution.
Per-asset health explanations now improve existing health and inspection
surfaces without adding a new record family.
Local posture repair now closes the safe local loop for missing/stale byte,
resource, and production posture while preserving the same local-only
non-claims.
The media identity posture now ties Studio's same-byte asset issue to Spine's
family-wide identity layering doctrine: content, byte publication, descriptor,
situation, placement, resource, causal, materialization, and authority layers
must remain distinct. `placementRef` is now documented as a concrete subtype of
the broader `situationRef` concept. The shared-basis identity fixture shows one
content basis diverging into accepted and reference situations without making
one resource candidate satisfy both.
Spine's Virtualia placement posture adds family-level locus/path/projection
vocabulary. Studio aligns to it without implementing Virtualia schemas,
runtime coupling, or a claim that media projections are reality by themselves.
