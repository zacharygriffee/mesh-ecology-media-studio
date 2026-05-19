# Venice Smoke Edge Inspection Preview

This preview describes what Edge may inspect later from a Venice smoke run. It
does not implement Edge integration, Edge runtime calls, evidence inbox writes,
mesh publication, byte materialization, or ratification.

The smoke run writes local records under `examples/venice-smoke/records/`:

- `records/work-packets/venice-live-smoke-work-packet.local.json`
- `records/work-packets/venice-live-smoke-generation-request.local.json`
- `records/provider-results/venice-live-smoke-provider-result.local.json`
- `records/assets/venice-live-smoke-asset-0.local.json`
- `records/evidence/venice-live-smoke-0-evidence.local.json`
- `records/readiness/venice-live-smoke-0-readiness.local.json`
- `records/decisions/venice-live-smoke-0-decision.local.json`
- `records/manifests/venice-live-smoke-manifest.local.json`

The smoke run writes generated media under:

```text
media/generated/provider-smoke/
```

## Seams

Edge may later inspect these records through:

- `media-edge-operator-seam`: locate the smoke manifest and summarize local posture.
- `media-work-packet-seam`: inspect the work packet and generation request.
- `media-evidence-import-seam`: import local review evidence as evidence, not truth.
- `media-readiness-guidance-seam`: read readiness as operator guidance only.
- `media-operator-decision-seam`: display the local accept/reject decision without treating it as ratifier authority.
- `media-byte-reference-seam`: see local refs and hashes while avoiding byte availability claims.
- `media-causal-evidence-seam`: inspect lineage fields for later causal mapping.

## Doctrine

All Venice smoke records remain local-only:

- not mesh truth
- not provider truth
- not distributed proof
- not ratified shared state
- not byte availability proof
- not materialization proof
- not publication authorization

The generated PNG path and hash are useful for local inspection. They are not a
portable byte reference and do not prove durable availability.
