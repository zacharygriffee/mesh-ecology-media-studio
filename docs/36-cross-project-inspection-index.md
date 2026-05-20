# Cross Project Inspection Index

`media.cross_project_inspection_input_list.local.v1` names the local project
artifact refs Studio should inspect. It is explicit by design: Studio does not
discover projects, crawl adjacent repos, or infer authority from local files.

`media.cross_project_operator_index.local.v1` summarizes those refs across
projects for later operator attention. It can show health state, handoff state,
operator decision request kind, blocking issue count, and next actions.

## Command

```bash
npm run operator:cross-project-index
```

The default fixture input is:

```text
examples/inspection-fixtures/cross-project/input-list.local.json
```

The default output is:

```text
examples/inspection-fixtures/cross-project/media-cross-project-operator-index.local.json
```

## Boundary

This is a local scanning aid only:

- no Edge runtime call
- no project discovery
- no UI contract
- no mesh publication
- no byte materialization proof
- no ratifier or approval authority

Edge may later inspect this index through `media-edge-operator-seam`, but the
index itself remains Studio-owned local guidance.
