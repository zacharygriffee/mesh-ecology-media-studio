# First Wedge

The first wedge is:

```text
Given one media card and optional reference asset,
create a provider job request,
record a provider job result descriptor,
ingest a resulting local media file,
hash it,
create a media asset descriptor,
record review evidence,
and mark it accepted or rejected locally.
```

Run it with:

```bash
npm run wedge:example
```

The example uses:

- input card: `examples/card-to-candidate/input/card.json`
- local generated candidate: `examples/card-to-candidate/local-media/candidate.txt`
- output records: `examples/card-to-candidate/out/`

The provider job result descriptor is local and synthetic in this first pass.
No provider API is called.

Generated outputs are local-only:

- `media-work-packet.local.json`
- `provider-job-result.local.json`
- `media-asset-descriptor.local.json`
- `media-evidence.local.json`
- `media-readiness.local.json`
- `media-operator-decision.local.json`

These are local drafts, local receipts, local caches, or local decisions. They
are not mesh truth, distributed proof, or ratified shared state.
