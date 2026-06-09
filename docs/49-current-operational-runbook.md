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

Run the consolidated proof first:

```bash
npm run proof:local -- --project-dir examples/card-to-candidate --drill
```

Use the compact line as the first decision point:

- `proof=ready`, `proofFreshness=fresh`, and `proofDrill=passed` mean Studio's
  local proof surfaces agree.
- `localPackage=complete_review_only_authority_missing` means the local package
  evidence exists, but authority is still missing by design.
- `swarmProof=false` and `activation=false` must remain false.
- any `proofFreshness=stale`, `proofDrill=attention`, or `localPackage=*attention`
  means refresh or repair local Studio evidence before seam discussion.

When proof passes and an adjacent discussion is needed, declare the discussion
packet:

```bash
npm run seam:needs -- --project-dir examples/card-to-candidate
```

Then inspect readiness without writing another artifact:

```bash
npm run seam:ready -- --project-dir examples/card-to-candidate
```

`readiness=ready_for_spine_discussion` means the packet is ready to discuss with
the operator and Spine repo agent. It does not mean Layer, Edge, Bytes, Causal,
or any other repo should implement work without that discussion.

Finally refresh the review surfaces that other operators inspect:

```bash
npm run operator:index -- --project-dir examples/card-to-candidate
npm run edge:compat -- --project-dir examples/card-to-candidate
```

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
