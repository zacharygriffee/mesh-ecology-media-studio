# Studio Comprehensive Objective List

Status: Studio planning list; not implementation approval, runtime state,
authority, acceptance, publication, or family routing.

Owner: `mesh-ecology-media-studio`.

Purpose: keep Studio's next work coherent after the local production, operator
inspection, and source-pressure adapter lanes became reviewable. This list names
bounded objectives Studio can advance without claiming Edge authority, Layer
admission, mesh truth, durable continuity, production authority, or publication
authorization.

## Current Center

Studio is the media-domain frontier for local-first media work. The current
center is:

```text
local media production evidence
-> operator-readable package posture
-> Edge-compatible review surfaces
-> generic Layer source-pressure evidence
```

The next Studio work should improve repeatability, review clarity, and local
evidence quality. It should not move authority, routing, admission, or durable
storage decisions into Studio.

## Priority Objectives

1. **Local Production Package Completeness**

   Make the local production lane easy to run from accepted media asset through
   rough cut, render preview, export receipt, package review, publication
   authority request candidate, authority prerequisites, handoff candidate,
   operator index, and Edge-compatible bundle.

   Acceptance signals:

   - `production:local-output` remains the primary local orchestration path.
   - approved and rework paths both preserve local-only, no-authority posture.
   - summaries expose missing, stale, blocked, and complete local package state
     without requiring an operator to inspect raw JSON first.
   - multi-item accepted production bundles remain covered by tests.

2. **Operator Surface Clarity**

   Keep `media:summary`, `health:summary`, `operator:index`, `edge:compat`, and
   inspection surfaces aligned so each reports the same local posture with
   compact, stable language.

   Acceptance signals:

   - compact output names safe next actions without overclaiming authority.
   - `--print` output carries machine-readable counts, refs, and non-claims.
   - malformed final records are retry-safe local attention, not command
     crashes.
   - rejected or skipped local paths are visible as expected posture, not
     malformed state.

3. **Source-Pressure Evidence Hygiene**

   Keep `pressure:studio --adapter-chain` useful as local evidence for Layer's
   generic `layer_source_pressure_review.v0` seam while preserving Studio's
   source-evidence role only. Surface review-only swarm seam posture so future
   family swarm pressure can inspect local readiness without treating Studio as
   a swarm runtime.

   Acceptance signals:

   - adapter candidate, decision, and approved observation validate against
     their Studio schemas.
   - rejected adapter decisions produce candidate and decision refs only, with
     observation skipped.
   - source-ref discovery excludes prior pressure outputs to avoid recursive
     stale citations.
   - `inspect:local-run`, `operator:index`, and `edge:compat` expose adapter
     refs and counts without Layer admission, Edge action, queue action,
     dispatch, append, continuity, or production storage claims.
   - `media:summary`, `health:summary`, `pressure:studio`, `operator:index`,
     and `edge:compat` report `swarmSeamPosture` with `swarmProof=false` and
     `activation=false`.
   - `operator:cross-project-index` aggregates local package completeness,
     swarm-seam readiness, adapter holds, and integrity blocks from explicit
     project refs without claiming swarm activation or public swarm proof.
   - `proof:local` can rehearse the safe local proof order and write one
     review-only summary, then surface that proof through inspection,
     operator-index, Edge-compatible, and cross-project views without claiming
     Edge dispatch, Layer admission, publication authorization, public swarm
     proof, or activation.
   - operator and Edge-compatible proof summaries report `proofFreshness`;
     stale proof records are local attention that asks for `proof:local`
     refresh, not malformed state.
   - operator and Edge-compatible compact proof summaries name
     `proofStaleReasons` so the refresh trigger is visible without opening
     raw JSON.
   - `proof:local --drill` checks local inspection/operator/Edge-compatible
     surface coherence and reports `proofDrill` without claiming family runtime
     activation.
   - operator and Edge-compatible compact proof summaries name
     `drillAttentionReasons` when proof drill checks need a refresh.
   - `operator:cross-project-index` per-project local proof attention lines
     preserve drill attention reasons from explicit operator-index refs.
   - `seam:ready` compact output names proof drill attention reasons while
     remaining read-only.
   - `seam:needs` turns a fresh local proof drill into an adjacent-repo
     discussion packet for the operator and Spine repo agent, without writing
     adjacent repos or routing implementation.
   - `seam:ready` reads existing proof and seam-needs records to report Spine
     discussion readiness without writing another artifact or activating swarm
     runtime.
   - `operator:index`, `edge:compat`, and `operator:cross-project-index`
     surface adjacent seam readiness without treating it as routing authority.
   - cross-project adjacent seam readiness reports whether readiness is fresh,
     stale, or inherited from an operator index without an explicit seam ref.
   - stale adjacent seam needs packets are local attention in operator, Edge,
     and cross-project surfaces; they ask for a `seam:needs` refresh instead
     of being treated as current Spine discussion readiness.
   - `operator:index` and `edge:compat` compact output names adjacent stale
     reasons so the same refresh trigger is visible on the inspection path.
   - `operator:cross-project-index` per-project adjacent seam attention lines
     name adjacent freshness, readiness freshness, and stale reasons before
     any adjacent implementation discussion.
   - `seam:ready` compact output names adjacent packet count and stale reasons
     so operators can see the refresh trigger without opening raw JSON.

4. **Example And Fixture Discipline**

   Keep committed examples small, readable, and deterministic while runtime
   artifacts remain generated on demand.

   Acceptance signals:

   - `examples/card-to-candidate` remains a compact local wedge, not a dump of
     fresh runtime pressure artifacts.
   - fixture commands normalize timestamps and ids where committed fixture churn
     would otherwise obscure behavior.
   - docs clearly distinguish committed examples, ignored runtime outputs, and
     test-generated temp projects.
   - no broad example refresh happens unless the changed artifact is part of the
     committed contract.

5. **Provider Boundary Stability**

   Keep provider work provider-neutral while preserving the Venice smoke path as
   the narrow operational proof.

   Acceptance signals:

   - provider results remain non-truth-bearing Studio records.
   - adapter runs identify mapping and normalization posture without leaking
     provider authority into Studio.
   - live provider execution stays explicitly gated.
   - provider-loop decisions request operator review or retry only; they do not
     execute provider work by implication.

6. **Byte, Resource, And Identity Separation**

   Continue separating content identity, descriptor identity, local placement,
   resource-ref candidates, byte descriptor proposals, materialization posture,
   and future causal referents.

   Acceptance signals:

   - accepted assets with missing byte/resource posture remain visible as local
     attention.
   - byte descriptor proposals and resource-ref candidates stay candidate-only.
   - `assetId` compatibility posture remains documented until a deliberate
     descriptor-id migration is approved.
   - no local file, thumbnail, export receipt, or provider output becomes byte
     availability proof by naming alone.

7. **Render And Export Review Evidence**

   Keep render/export work reviewable without turning local preview or delivery
   files into publication authority.

   Acceptance signals:

   - render adapter contracts, render plans, render receipts, export candidates,
     export plans, and export receipts remain visible in production summaries.
   - output integrity checks verify local package evidence before package review
     and authority request candidates.
   - contact-sheet, ffmpeg preview, local-package copy, and ffmpeg delivery
     paths preserve distinct posture.
   - production readiness remains false without future authority.

8. **Cross-Project And Family-Readable Inspection**

   Keep Studio records easy for adjacent repos to inspect without giving those
   repos Studio semantics or authority.

   Acceptance signals:

   - cross-project indexes surface project status, attention, provider-loop
     posture, production posture, and Layer interop/source-pressure posture.
   - Edge-compatible bundles remain read-only source collections.
   - Studio docs continue to name family boundaries with Spine vocabulary.
   - no Studio command writes to Spine, Layer, Edge, Virtualia, RBC, Causal,
     Bytes, Packs, or Platform.

9. **Local Record IO Robustness**

   Maintain atomic writes and tolerant reads for high-churn local operator
   surfaces.

   Acceptance signals:

   - critical production/status writers use same-directory temp writes followed
     by rename.
   - JSON discovery skips temp files.
   - stress tests cover overlapping local output writers and summary/index
     readers.
   - malformed final records surface diagnostics and safe retry posture.

10. **Documentation And Command Inventory Currency**

    Keep the command inventory, artifact registry, start-here map, and posture
    docs synchronized whenever commands or schemas change.

    Acceptance signals:

    - every public command addition or meaningful option appears in
      `docs/41-command-surface-inventory.md`.
    - new artifact kinds appear in `docs/artifact-kind-registry.md`.
    - operator-facing safe command order is documented where order affects
      bundle completeness.
    - docs preserve non-claims as part of the contract, not afterthoughts.

## Deferred Or Blocked Objectives

These remain out of scope for Studio until a future family packet or owning repo
approves them:

- Layer admission, durable append, accepted continuity, production storage
  selection, or Layer runtime consumption.
- Edge queue action, dispatch, runtime verification, operator authority, or
  Edge-owned swarm proof.
- mesh publication, ratifier authority, shared truth, or production authority.
- UI contracts or app surfaces built from compact CLI output.
- broad provider expansion beyond controlled provider-neutral contracts and
  explicitly gated smoke paths.
- full byte/materialization backend promotion.
- causal-substrate adapter implementation.
- `assetId` descriptor-id migration.

## Next Safe Studio Work

The current Studio lane is to prove local package and operator clarity before
pressing the family swarm seams. Preferred order:

1. run `production:local-output` to create review-only package evidence;
2. run `production:package-rework` only when the latest package review requested
   changes or went stale;
3. keep `media:summary`, `health:summary`, `operator:index`, and `edge:compat`
   aligned with the shared local package and swarm-seam postures;
4. preserve source-pressure adapter evidence and swarm-seam posture as
   runtime-only review material;
5. use `proof:local` when a reviewer needs one consolidated local proof summary
   and surfaced proof refs in the operator/Edge-compatible views, then rerun it
   when `proofFreshness=stale` or use `proof:local --drill` when surface
   coherence needs an explicit local check;
6. run `seam:needs` after a fresh proof drill only when Studio needs to declare
   adjacent Layer, Edge, Bytes, Causal, or Spine discussion needs, then use
   `seam:ready` as the read-only check before operator/Spine discussion;
7. refresh docs/tests whenever an operator-visible command surface changes.

Success means a reviewer can run one local project through production evidence,
source-pressure evidence, inspection, operator index, and Edge-compatible review
without needing any family repo to accept, admit, dispatch, append, publish, or
ratify the result.
