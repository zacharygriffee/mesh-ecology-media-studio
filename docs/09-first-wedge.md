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

- input card: `examples/card-to-candidate/cards/card.json`
- local generated candidate: `examples/card-to-candidate/media/generated/candidate.txt`
- accepted/rejected media: `examples/card-to-candidate/media/accepted/` or
  `examples/card-to-candidate/media/rejected/`
- output records: `examples/card-to-candidate/records/`

The provider job result descriptor is local and synthetic in this first pass.
No provider API is called.

Generated outputs are local-only:

- `records/work-packets/media-work-packet.local.json`
- `records/provider-results/provider-job-result.local.json`
- `records/assets/media-asset-descriptor.local.json`
- `records/evidence/media-evidence.local.json`
- `records/readiness/media-readiness.local.json`
- `records/decisions/media-operator-decision.local.json`
- `records/manifests/media-local-run-manifest.local.json`

These are local drafts, local receipts, local caches, or local decisions. They
are not mesh truth, distributed proof, or ratified shared state.

The local run manifest summarizes one wedge run for later inspection. It is
operator guidance only and keeps `localOnly=true`, `meshTruth=false`,
`distributedProof=false`, and `ratifiedSharedState=false`.
