# Local Project Layout

Mode 0 uses a local project folder. The folder may store media bytes and local
records, but it is not shared truth.

Recommended layout:

```text
project/
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
    production/
    approvals/
    bytes/
    manifests/
```

## Concepts

- `media.project_layout.v1`: describes the local folder contract for one
  project.
- `media.local_ref.v1`: describes a safe project-relative file reference.
- `media.asset_lifecycle.v1`: describes a local lifecycle state for a media
  asset.

## Local Ref Rules

Local refs must be safe relative refs only. Reject:

- absolute paths
- `../` traversal
- `~` home-directory expansion
- URL refs pretending to be local paths
- backslash-separated paths
- non-normalized paths

Local refs may help Edge inspect later, but they do not prove byte
availability, materialization, authority, or mesh truth.

## Record Folder Conventions

- `records/production/`: local production units, reference primitives,
  continuity bands, render strategies, and production descriptors.
- `records/approvals/`: local approval proposals. These require later
  authority and do not grant ratifier authority or publication authorization.
- `records/bytes/`: local byte descriptor proposals. These preview future byte
  descriptors and do not prove byte availability or materialization.

Inspection commands may include these folders when records are present. The
folders remain local cache/receipt/proposal space, not shared truth.
