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

The first executable path is:

```bash
npm run wedge:example
```

Run tests with:

```bash
npm test
```

The optional Venice live smoke command is intentionally gated:

```bash
VENICE_LIVE=1 npm run provider:venice:smoke
```

Phase 2 hardened the local wedge with a local run manifest, artifact-kind
registry, and modest malformed-record checks. Phase 3 defines the local project
layout, safe local refs, placement classes, and asset lifecycle states. Phase 4
adds provider-neutral request/profile/capability/result records without calling
provider APIs. Phase 5 adds provider shape and mapping fixtures without
promoting provider payloads into Studio canon. Phase 6 adds a Venice dry-run
adapter with fixture-only response normalization. Phase 7 adds an explicit
Venice live smoke gate for controlled provider testing. The wedge remains
local-only. It creates local records and does not claim mesh truth, distributed
proof, byte materialization proof, provider truth, causal truth, publication
authorization, or ratifier authority.
