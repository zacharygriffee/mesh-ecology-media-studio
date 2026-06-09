# Cross Project Inspection Index

`media.cross_project_inspection_input_list.local.v1` names the local project
artifact refs Studio should inspect. It is explicit by design: Studio does not
discover projects, crawl adjacent repos, or infer authority from local files.

`media.cross_project_operator_index.local.v1` summarizes those refs across
projects for later operator attention. It can show health state, handoff state,
operator decision request kind, provider-loop status, blocking issue count, and
next actions. When the explicit refs include `operatorPacketIndex`, it also
prefers that packet's local package posture, source-pressure adapter summary,
and swarm-seam posture; when the operator packet is absent, it falls back to
the same fields from `projectHealth`.

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

The same operator-index ref can also surface Studio's local package and
swarm-seam posture, plus local proof rehearsal posture when present. Compact
output reports:

```text
localPackageComplete=<n> | localPackageAttention=<n> | localProofReady=<n> | localProofAttention=<n> | localProofFresh=<n> | localProofStale=<n> | localProofDrillPassed=<n> | localProofDrillAttention=<n> | adjacentNeeds=<n> | adjacentReady=<n> | adjacentAttention=<n> | adjacentFresh=<n> | adjacentStale=<n> | familyBuildout=<n> | familyReady=<n> | familyAttention=<n> | familyFresh=<n> | familyStale=<n> | familyInherited=<n> | spineDiscussion=<n> | spineReady=<n> | spineAttention=<n> | spineFresh=<n> | spineStale=<n> | spineInherited=<n> | swarmReady=<n> | swarmAttention=<n> | swarmProof=false | activation=false
```

Rejected source-pressure adapter decisions are counted as swarm attention and
shown as `adapter_hold`; rejected local proof rehearsals are counted as
`localProofAttention` with observation `skipped`, not malformed state. A
previously ready proof whose local package, swarm seam, or adapter posture no
longer matches the current operator packet is counted as `localProofStale` and
local proof attention; the selected safe action is to rerun `proof:local`.
Proof drill failures from `proof:local --drill` are counted as
`localProofDrillAttention`; per-project local proof attention lines include
`drillAttentionReasons`, and the selected safe action is a local proof drill
refresh.
Adjacent seam needs packets are counted only when explicit input refs include
them; `familyBuildout` counts packets ready for operator and Spine repo-agent
family seam buildout coordination before any adjacent implementation.
`familyReady` and `familyAttention` count the derived adjacent seam readiness
posture carried from operator indexes or explicit adjacent seam refs; they do
not grant routing or adjacent repo authority. `familyFresh` means the carried
readiness agrees with an explicit adjacent seam ref, `familyStale` means the
explicit ref or current proof posture no longer matches, and `familyInherited`
means the readiness came from an operator index without an explicit adjacent
seam ref in the cross-project input list. Legacy `spineDiscussion`,
`spineReady`, `spineAttention`, `spineFresh`, `spineStale`, and
`spineInherited` mirror these counts for v1 compatibility; they do not mean
Spine routes runtime work. Stale adjacent seam packets are counted as
`adjacentStale` and local
attention; per-project adjacent seam attention lines include `adjacentFreshness`,
`readinessFreshness`, `staleReasons`, and `drillAttentionReasons` so the
operator can see the refresh trigger or proof drill mismatch before opening
JSON. The selected safe action is to refresh `seam:needs` after current proof
surfaces are refreshed.
Missing or drifted local delivery bytes are counted as `integrityBlocked`.
These are local attention signals only. They do not activate swarm runtime,
dispatch Edge work, approve Layer admission, prove public swarm state, or mark a
production package ready.

A committed local-proof fixture is available at:

```text
examples/inspection-fixtures/cross-project-local-proof/
```

It references two compact operator packet records: one fresh ready proof and one
stale proof against current adapter-hold posture. The fixture documents how
local proof posture should be read before any future family swarm seam pressure.

The index also prints one `safeNextAction` selected by local attention
precedence: missing explicit refs, provider or approval attention, Layer interop
attention, operator health, blocking health, local proof attention or stale
proof freshness, then swarm-seam guidance. This is operator guidance only; it
does not execute repair, approval, retry, swarm activation, or publication.

## Boundary

This is a local scanning aid only:

- no Edge runtime call
- no project discovery
- no UI contract
- no mesh publication
- no byte materialization proof
- no ratifier or approval authority
- no swarm runtime activation
- no public swarm proof

Edge may later inspect this index through `media-edge-operator-seam`, but the
index itself remains Studio-owned local guidance.
