# Narrow Slice Completion

This closes the remaining Mode 0 foundation slice before broader work.

New local-only surfaces:

- `media.continuity_evidence.local.v1`
- byte descriptor preview fields inside `media.byte_reference.preview.local.v1`
- provider run ledger grouping by card
- candidate review and continuity records in local inspection packets
- committed local Edge export bundle fixture

Create continuity evidence:

```bash
npm run continuity:draft -- --project-dir examples/card-to-candidate
```

Regenerate committed inspection fixtures:

```bash
npm run fixture:inspection
```

The fixture now includes:

```text
inspection-packets/local-run-edge-inspection-packet.local.json
inspection-bundle/local-run/
```

These records remain local evidence and local cache. They are not mesh truth,
provider truth, causal truth, byte availability proof, materialization proof,
publication authorization, or ratifier authority.
