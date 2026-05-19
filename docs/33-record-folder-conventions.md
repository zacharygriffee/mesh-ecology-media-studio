# Record Folder Conventions

Mode 0 projects keep JSON records under `records/`. These folders are local
organization only. They do not define mesh truth or durable shared state.

Recommended record folders:

```text
records/
  work-packets/
  provider-results/
  assets/
  evidence/
  readiness/
  decisions/
  production/
  approvals/
  bytes/
  manifests/
  exports/
```

## Production

`records/production/` contains local production planning records:

- `media.production_unit.v1`
- `media.reference_primitive.v1`
- `media.continuity_band.v1`
- `media.render_strategy.v1`
- `media.production_descriptor.local.v1`

## Approvals

`records/approvals/` contains proposal-only approval records:

- `media.approval_proposal.local.v1`

These records require later authority and do not grant ratifier authority,
publication authorization, or mesh approval.

## Bytes

`records/bytes/` contains byte descriptor proposals:

- `media.byte_descriptor_proposal.local.v1`

These records preview future byte descriptor posture. They do not prove byte
availability, materialization, or byte authority.

## Inspection

Local inspection packets and Edge compatibility bundles may include these
folders when records exist. Inclusion means "available for inspection", not
"accepted by Edge" or "ratified by mesh".
