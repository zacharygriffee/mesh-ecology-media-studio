# Operator Packet Index And Handoff

This phase adds two local-only control-surface artifacts:

- `media.operator_packet_index.local.v1`
- `media.edge_handoff_candidate.local.v1`

The packet index is a compact scanning record for local inspection packets,
export bundles, compatibility bundles, project health records, and handoff
candidates. It is an operator aid, not a UI contract and not shared truth.
When project health has asset or production attention rows, the packet index
also carries those `operatorHealthExplanations` and prints compact attention
rows with subject, issue codes, and safe local next action.

The handoff candidate gathers the local inspection packet, Edge compatibility
bundle, project health snapshot, and packet index into one Edge-facing review
descriptor. It also carries a local `readinessDiagnosis` explaining why the
handoff is ready or why it needs local attention. It is Studio-built and
remains local-only. It does not call Edge, verify Edge runtime behavior, grant
operator authority, publish to the mesh, or ratify state.

## Commands

```bash
npm run operator:index -- --project-dir examples/card-to-candidate
npm run handoff:edge -- --project-dir examples/card-to-candidate
npm run operator:decision-request -- --project-dir examples/card-to-candidate
```

If the handoff candidate is created after the first index, run the index again
to include the handoff candidate in the packet index:

```bash
npm run operator:index -- --project-dir examples/card-to-candidate
```

The compact `operator:index` output follows the same local attention pattern as
health, handoff, and cross-project summaries:

```text
attention: media/accepted/candidate.txt | state=needs-local-attention | issues=... | nextAction=...
```

Attention rows remain operator guidance only. They do not prove Edge runtime
state, byte availability, materialization, resource admission, mesh truth, or
operator authorization.

## Doctrine

These records are deliberately narrow:

- local-only scanning and handoff descriptors
- no Edge runtime calls
- no UI surface
- no provider calls
- no mesh publication
- no byte materialization proof
- no ratifier authority

Edge may later inspect these records through `media-edge-operator-seam`, but
Edge remains the operator boundary and Studio remains the media-domain owner.

## Freshness

Production validation now includes a freshness summary. A descriptor is stale
when it is older than the production unit it describes, or older than a parent
production unit it references. Staleness is local operator guidance only: it
does not prove the descriptor is wrong, and it does not authorize automatic
repair.

## Decision Requests

`media.operator_decision_request.local.v1` records describe the operator
attention Studio will eventually ask Edge to mediate. A ready handoff produces
a `review-ready-handoff` request. A blocked or stale handoff produces a
`resolve-local-attention` request carrying the diagnosis next actions.

These records are not approvals, ratifier outputs, or Edge decisions. They are
request-only local guidance and require a later operator boundary.

## Unhealthy Fixtures

Compact unhealthy examples live under:

```text
examples/inspection-fixtures/unhealthy/
```

Regenerate or check them with:

```bash
npm run fixture:unhealthy
npm run fixture:unhealthy:check
```

## Cross-Project Scan

For an explicit multi-project input list, use:

```bash
npm run operator:cross-project-index
```

This writes `media.cross_project_operator_index.local.v1`. It summarizes
listed local project artifacts, but does not discover projects, call Edge, or
turn local records into shared truth.
