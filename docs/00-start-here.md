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
```

Create a local Edge-handoff preview bundle with:

```bash
npm run export:inspection-bundle -- --project-dir examples/card-to-candidate
```

The optional Venice live smoke command is intentionally gated:

```bash
VENICE_LIVE=1 npm run provider:venice:smoke
```

That command writes ignored local smoke artifacts under
`examples/venice-smoke/`. It does not run as part of `npm test`. Venice
provider capability and failure fixtures are local-only and validate without
calling the provider.

Check committed fixture freshness with:

```bash
npm run fixture:inspection:check
```

Ingest a project-local reference asset with:

```bash
npm run reference:ingest -- --project-dir examples/card-to-candidate --source media/generated/candidate.txt --filename candidate-reference.txt
```

Record a local candidate comparison and project status snapshot with:

```bash
npm run review:candidates -- --project-dir examples/card-to-candidate
npm run status:project -- --project-dir examples/card-to-candidate
npm run continuity:draft -- --project-dir examples/card-to-candidate
npm run approval:proposal -- --project-dir examples/card-to-candidate
npm run bytes:proposal -- --project-dir examples/card-to-candidate
```

Write a local Packs-aligned control-surface projection without adding UI:

```bash
npm run control:surface -- --project-dir examples/card-to-candidate
```

Write a local Edge compatibility bundle without calling Edge:

```bash
npm run edge:compat -- --project-dir examples/card-to-candidate
```

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
These records do not claim mesh truth, distributed proof, byte materialization
proof, provider truth, causal truth, publication authorization, or ratifier
authority.
