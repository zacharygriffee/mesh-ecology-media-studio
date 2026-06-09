# Current Operational Runbook

Status: operator runbook for Studio's current bounded local proof lane. This is
not a new authority path, runtime activation, adjacent repo request, or feature
approval.

## Objective

Use one local project to prove that Studio can create reviewable local package
evidence, source-pressure evidence, operator inspection surfaces, and adjacent
seam discussion posture without writing adjacent repos or claiming authority.

This is the current operational center:

```text
local package evidence
-> source-pressure adapter evidence
-> local proof rehearsal with drill
-> adjacent seam needs packet
-> read-only Spine discussion readiness
-> operator and Edge-compatible review surfaces
```

## Fast Path

Run the current operation first:

```bash
npm run operation:studio -- --project-dir examples/card-to-candidate --prepare-local-fixture --cross-project-index
```

The command writes its operator review summary to
`records/exports/media-current-operational-runbook.local.json` by default. Use
`--output <relative-json-path>` only when a different local summary path is
needed. Use `--adapter-decision rejected` to exercise the same operation path in
adapter hold posture; Studio should report local attention with skipped
observation, not malformed state or downstream authority.
After writing that summary, the command refreshes `inspect:local-run`,
`control:surface`, `operator:index`, and `edge:compat` so inspection and the
control projection carry the summary ref, while operator surfaces carry
`currentOperation` and `currentOperationPath`. When `--cross-project-index` is
present, the command also refreshes the cross-project index after those surfaces
exist, so the aggregate summary carries
`currentOperations` and `currentOperationReady`.
The compact line and `--print` output include `inspectionRefreshed` and
`inspectionPacket`, so projects that already have local-run evidence can confirm
the refreshed inspection packet without rerunning `--prepare-local-fixture`.
They also include `controlSurfaceRefreshed` and `controlSurface`, so the local
control projection can be inspected for the same current-operation ref without
claiming a UI contract or control-plane authority.
`surfaceFreshness` reports whether the refreshed Studio inspection, control,
operator, Edge-compatible, and optional cross-project surfaces point back to the
current operation summary.
The persisted summary also includes `adjacentFamilyAskSummary`, a compact view
of the Spine, Layer, Edge, Bytes, and Causal discussion rows from
`seam:needs`; it is for operator and Spine repo-agent discussion only.
`operator:index` and `edge:compat` carry the same family ask counts so the
handoff remains visible from the downstream local review surfaces.

`--prepare-local-fixture` writes a tiny local PNG candidate for the bundled
example, runs the accepted first wedge, and seeds the local inspection,
control-surface, byte/resource, approval, capsule, and bundle records before the
proof drill. Use it for the bundled example or other raw local fixtures; omit it
for projects that already have current local package evidence.

`--cross-project-index` writes a one-project explicit input list and refreshes a
local cross-project operator index for the same evidence package. It is still a
local scan only: no project discovery, Edge call, adjacent repo write, or swarm
runtime activation.

Use the compact line as the first decision point:

- `operation=ready_for_spine_discussion` means the local proof, adjacent seam
  declaration, readiness check, operator index, and Edge-compatible bundle agree.
- `crossProjectIndexed=true` means the same local evidence is also visible
  through the cross-project operator index.
- `crossProjectCurrentOperations=1` means the cross-project index picked up the
  persisted current operation summary through the refreshed operator index.
- `output=records/exports/media-current-operational-runbook.local.json` is the
  persisted summary for operator review after the command exits.
- `inspectionRefreshed=true` and
  `inspectionPacket=records/exports/local-run-edge-inspection-packet.local.json`
  mean the local inspection packet was refreshed after the current operation
  summary was written and now carries the summary ref.
- `controlSurfaceRefreshed=true` and
  `controlSurface=records/exports/media-control-surface-projection.local.json`
  mean the local control projection was refreshed after the current operation
  summary was written and now carries a local-only current-operation observation
  ref.
- `surfaceFreshness=fresh` and `surfaceFreshnessIssues=none` mean every expected
  refreshed Studio surface points back to the current operation summary. This is
  local surface coherence only; it is not swarm proof or runtime activation.
- `familyAsks=5` and `familyAsksReady=5` mean the adjacent-family discussion
  rows are present and ready for Spine discussion. This does not write adjacent
  repos, route implementation, or grant authority.
- `proof=ready`, `proofFreshness=fresh`, and `proofDrill=passed` mean Studio's
  local proof surfaces agree.
- `localPackage=complete_review_only_authority_missing` means the local package
  evidence exists, but authority is still missing by design.
- `swarmProof=false` and `activation=false` must remain false.
- any `proofFreshness=stale`, `proofDrill=attention`, or `localPackage=*attention`
  means refresh or repair local Studio evidence before seam discussion.

The expanded command sequence is:

```bash
npm run proof:local -- --project-dir examples/card-to-candidate --drill
npm run seam:needs -- --project-dir examples/card-to-candidate
npm run seam:ready -- --project-dir examples/card-to-candidate
npm run operator:index -- --project-dir examples/card-to-candidate
npm run edge:compat -- --project-dir examples/card-to-candidate
npm run operator:cross-project-index -- --base-dir examples --input-list card-to-candidate/records/exports/media-current-operation-cross-project-input-list.local.json --output card-to-candidate/records/exports/media-current-operation-cross-project-index.local.json
```

`readiness=ready_for_spine_discussion` means the packet is ready to discuss with
the operator and Spine repo agent. It does not mean Layer, Edge, Bytes, Causal,
or any other repo should implement work without that discussion.

## If Blocked

Use the compact next-action fields instead of opening raw JSON first:

- `localPackage` or `packageNextAction`: run or repair `production:local-output`
  and only use `production:package-rework` when the review is request-changes or
  stale.
- `proofFreshness=stale`: rerun `proof:local --drill` after local package or
  adapter inputs change.
- `proofDrill=attention`: resolve the named `drillAttentionReasons`, then rerun
  `proof:local --drill`.
- `adjacentFreshness=stale`: rerun `seam:needs` after the current proof drill is
  fresh and passed.
- `spineReadiness` other than `ready_for_spine_discussion`: follow
  `spineNextAction` before involving adjacent repo implementation work.

If the same blocker repeats twice in a row, stop and summarize that blocker for
the operator instead of adding unrelated hardening work.

## What This Proves

This runbook proves that Studio can locally generate and surface a coherent
review package:

- local production package posture;
- source-pressure adapter candidate, decision, and observation posture;
- local proof rehearsal and drill status;
- adjacent seam needs for operator and Spine repo-agent discussion;
- read-only adjacent seam readiness;
- operator-index and Edge-compatible views over the same local evidence.

## What It Does Not Prove

The runbook must not flip these boundaries:

- no adjacent repo writes;
- no Layer admission or durable append;
- no Edge queue action, dispatch, approval, or runtime verification;
- no Bytes materialization or payload validity proof;
- no Causal truth;
- no accepted continuity;
- no storage selection;
- no publication authorization;
- no production readiness;
- no swarm runtime activation.

Real video editing and multi-clip stitching remain deferred. Current ffmpeg work
is image-ref preview/export evidence only.
