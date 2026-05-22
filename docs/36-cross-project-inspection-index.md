# Cross Project Inspection Index

`media.cross_project_inspection_input_list.local.v1` names the local project
artifact refs Studio should inspect. It is explicit by design: Studio does not
discover projects, crawl adjacent repos, or infer authority from local files.

`media.cross_project_operator_index.local.v1` summarizes those refs across
projects for later operator attention. It can show health state, handoff state,
operator decision request kind, provider-loop status, blocking issue count, and
next actions.

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

A separate missing-artifact fixture is available at:

```text
examples/inspection-fixtures/cross-project-missing-artifact/
```

It intentionally points one artifact ref at a missing local file so the index
shows `missingArtifacts` and `missingArtifactRefs` separately from ordinary
unhealthy project posture.

The compact command output prints missing artifact rows under the affected
project:

```text
missing: operatorDecisionRequest | expected=... | nextAction=Run npm run operator:decision-request for the project.
```

Missing-artifact rows are local repair guidance only. They do not prove Edge
runtime state, operator authorization, mesh truth, or ratified shared state.

If an input project includes a `providerLoopStatus` artifact ref, the index
also surfaces failed or incomplete provider loops as attention rows. These rows
are local review guidance only: provider IDs and provider job posture remain
provenance, not authority or truth.

Provider-loop rows also expose production blockers. A `complete_review_only`
loop can therefore be complete as a local provider loop while still blocked
from production use until the proper review or authority lane exists.

If an input project includes an `approvalProposal` artifact ref, the index
summarizes it as pending authority work. The row does not grant approval,
ratifier authority, or publication authorization.

If an input project includes an `operatorPacketIndex` artifact ref, the index
can surface that project's Layer interop state and attention rows. This is
useful for seeing mismatched authority prerequisite/handoff Layer refs across
projects without opening raw JSON. It remains local consistency guidance only:
no Layer runtime is called, no durable append is approved, and no continuity or
authority is claimed.

The index also prints one `safeNextAction` selected from the first current
attention row. This is operator guidance only; it does not execute repair,
approval, retry, or publication.

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
