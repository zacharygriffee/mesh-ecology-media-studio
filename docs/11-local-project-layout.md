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
