# Edge Mediation Handoff Semantics

This note describes current command behavior. It does not add Edge integration,
new authority, or new artifact kinds.

Studio writes local mediation records with `npm run rule:example`. Those records
can appear in local inspection packets, operator packet indexes, and Edge
compatibility bundles as operator-readable pressure.

The handoff path is:

```txt
npm run inspect:local-run
npm run edge:compat
npm run operator:index
npm run handoff:edge
npm run operator:decision-request
```

`handoff:edge` summarizes whether the local project is ready for future
Edge-style inspection. `operator:decision-request` turns that handoff state into
a local request for operator attention.

These commands do not execute media operations. They do not call Edge, submit
provider jobs, approve work, publish to mesh, prove byte availability, or grant
publication authorization. They only expose local records that Edge may inspect
later.

When mediation traces are present, the operator-facing meaning is:

```txt
auto_prepare: local preparation can be recorded, with no execution
ask_operator: operator attention is required before preparation proceeds
forbid: the operation should not be prepared under current local evidence
```

The current CLI summaries intentionally show only the handoff state, blocker
count, and first next action. Use `--print` on the relevant commands when the
full JSON record is needed.
