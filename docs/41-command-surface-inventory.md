# Command Surface Inventory

This inventory maps current operational commands to their operator and machine
surfaces. It is a maintenance aid for future Edge, Packs, and UI work; command
text is not the durable contract.

## Reading The Table

- `compact`: prints a short human-readable summary by default.
- `artifact`: writes a machine-readable local JSON record or bundle.
- `json`: supports `--print` or `--json` for machine-readable stdout.
- `refs`: records stable local refs to related artifacts.
- `churn`: has known timestamp/id churn when output is regenerated.

## Core Local Work

| Command | compact | artifact | json | refs | churn |
| --- | --- | --- | --- | --- | --- |
| `npm run wedge:example` | yes | yes | no | yes | runtime records use fresh ids/timestamps |
| `npm run promote:candidate` | yes | yes | no | yes | runtime records use fresh ids/timestamps |
| `npm run reference:ingest` | yes | yes | no | yes | runtime records use fresh ids/timestamps |
| `npm run media:import` | yes | yes | no | yes | runtime records use fresh ids/timestamps |
| `npm run media:summary` | yes | no | `--print` | reads local refs | refreshes project status snapshot; includes provider-loop, approval-lane, production-capsule, package-authority freshness, shared local package posture, Layer interop attention, and safe-next posture |
| `npm run health:summary` | yes | yes | `--print` | yes | runtime health uses fresh timestamp; reports shared local package posture without adding package-only health blockers |
| `npm run derivatives:thumbnail` | yes | yes | no | yes | runtime thumbnails and records use fresh timestamps |
| `npm run review:candidates` | yes | yes | no | yes | runtime records use fresh ids/timestamps |
| `npm run approval:proposal` | yes | yes | no | yes | runtime records use fresh ids/timestamps |
| `npm run continuity:draft` | yes | yes | `--print` | yes | runtime records use fresh ids/timestamps |
| `npm run production:from-card` | yes | yes | no | yes | runtime records use fresh ids/timestamps |
| `npm run production:validate` | yes | no | no | reads production refs | no committed output |
| `npm run production:capsule` | yes | yes | `--print` | yes | packages accepted asset refs only; no byte copying or authority |
| `npm run production:bundle` | yes | yes | `--print` | yes | groups production capsule refs only; no byte copying or authority |
| `npm run production:authority-prereqs` | yes | yes | `--print` | yes | writes local/local-production prerequisite posture, render/export delivery evidence counts, optional Layer import refs, and future authority gaps without adding authority |
| `npm run production:authority-handoff` | yes | yes | `--print` | yes | packages bundle/proposal/capsule/situated/export delivery refs, local package review decisions, publication/export authority request candidates, local production package state, and optional Layer import refs as a candidate for future authority review; does not grant authority |
| `npm run production:rough-cut` | yes | yes | `--print` | yes | orders accepted production item refs for review; no editor, render, export, or authority |
| `npm run production:rough-cut-review` | yes | yes | `--print` | yes | records a local rough-cut review decision; no render, export, approval, or authority |
| `npm run production:rough-cut-revise` | yes | yes | `--print` | yes | regenerates rough-cut refs from a local request-changes decision; no editor, render, export, or authority |
| `npm run production:render-export-candidate` | yes | yes | `--print` | yes | creates a candidate over a reviewed rough cut; no renderer selected, no render/export bytes, no authority |
| `npm run production:render-adapter-contract` | yes | yes | `--print` | yes | describes future renderer inputs and output placement; no adapter selected, render, export, or authority |
| `npm run production:render-plan` | yes | yes | `--print` | yes | resolves render/export refs and planned output path only; no media bytes read, render, export, or authority |
| `npm run production:render-contact-sheet` | yes | yes | `--print` | yes | renders a local PNG contact sheet for review; no export delivery, publication, production readiness, or authority |
| `npm run production:render-ffmpeg` | yes | yes | `--print` | yes | renders a local ffmpeg MP4 preview by default; `--disable-ffmpeg` skips execution; no export delivery, publication, production readiness, or authority |
| `npm run production:export-candidate` | yes | yes | `--print` | yes | creates a reviewed rough-cut delivery candidate; no delivery bytes, publication, production readiness, or authority |
| `npm run production:export-plan` | yes | yes | `--print` | yes | resolves export candidate refs and target output path only; no media bytes read, delivery output, publication, or authority |
| `npm run production:export-local-package` | yes | yes | `--print` | yes | copies a local preview into a delivery-candidate package; no publication authorization, production readiness, or authority |
| `npm run production:export-ffmpeg` | yes | yes | `--print` | yes | renders a local MP4 delivery candidate with ffmpeg by default; `--disable-ffmpeg` skips execution; no publication authorization, production readiness, or authority |
| `npm run production:local-package-review` | yes | yes | `--print` | yes | records local operator review of a complete integrity-checked output package; no export/publication authorization, production readiness, or authority |
| `npm run production:package-rework` | yes | updates existing local output artifacts | `--print` | yes | reruns the local output lane when the latest package review requests changes or a reviewed package is stale against rough-cut/output refs; prints rework eligibility plus `localPackagePosture` (`localPackage`, `review`, `integrity`, `nextAction`) after regeneration; no authority, publication, Edge call, or production readiness |
| `npm run production:publication-authority-request` | yes | yes | `--print` | yes | packages reviewed local output evidence as a future publication/export authority request candidate; no ratifier, authority grant, publication, or production readiness |
| `npm run production:local-output` | yes | yes | `--print` | yes | orchestrates existing rough-cut, review, render, export, authority-prereq, local package review, publication/export request candidate, handoff, operator-index, and Edge-compatible bundle commands; `--print` includes shared `localPackagePosture` and compact output shows `localPackage`, `review`, `integrity`, and `nextAction`; `--disable-ffmpeg` keeps execution to contact-sheet and local package-copy evidence; no new authority, publication, Edge call, or production readiness |
| `npm run record-io:stress` | yes | temp project by default | `--print` | yes | runs a bounded overlap of local output writers and summary/index/prereq readers to verify local JSON atomic-write/tolerant-read posture; ffmpeg is disabled by default; no authority, publication, Edge call, or mesh publication |
| `npm run pressure:studio` | yes | yes | `--print` | yes | writes Studio-owned Edge and Layer pressure artifacts by default; `--adapter-chain` also writes the bounded Studio source-pressure adapter candidate, operator decision, and approved observation for Layer's generic `layer_source_pressure_review.v0` seam; `--adapter-decision rejected` writes candidate/decision only; no Layer admission, durable append, Edge authority, queue action, dispatch, or auto-execute |
| `npm run provider:venice:rehearse-production` | yes | yes | `--print` | yes | composes the local Venice loop, approval proposal, capsule, bundle, inspection, operator index, and Edge-compatible bundle; no live provider unless explicitly requested |

## Byte And Resource Posture

| Command | compact | artifact | json | refs | churn |
| --- | --- | --- | --- | --- | --- |
| `npm run bytes:proposal` | yes | yes | no | yes | runtime records use fresh ids/timestamps |
| `npm run resource:refs` | yes | yes | no | yes | runtime records use fresh ids/timestamps |
| `npm run repair:local-posture` | yes | updates existing local artifacts | `--print` | yes | repaired records and refreshed summaries use fresh ids/timestamps |
| `npm run readiness:edge` | yes | yes | `--print` | yes | runtime records use fresh ids/timestamps |

## Inspection And Operator Surfaces

| Command | compact | artifact | json | refs | churn |
| --- | --- | --- | --- | --- | --- |
| `npm run inspect:local-run` | yes | yes | `--print` | yes | runtime packet uses fresh ids/timestamps; includes production-capsule refs when present |
| `npm run inspect:summary` | yes | no | no | reads packet refs | no committed output |
| `npm run inspect:index` | yes | no | `--json` | reads local refs | no committed output |
| `npm run inspect:provider-runs` | yes | yes | `--print` | yes | runtime ledger uses fresh timestamp |
| `npm run inspect:provider-failure` | yes | yes | `--print` | yes | runtime packet uses fresh ids/timestamps |
| `npm run inspect:venice-smoke` | yes | yes | `--print` | yes | smoke records are ignored runtime output; compact output shows live/local provider posture, raw-provider-byte storage posture, and Layer interop state/attention |
| `npm run inspect:venice-loop` | yes | no | `--print` | reads provider-loop status/request/decision refs | no output mutation; prints retry path, live-provider-called posture, and production blockers |
| `npm run export:inspection-bundle` | yes | yes | `--print` | yes | bundle manifest uses fresh timestamp |
| `npm run control:surface` | yes | yes | `--print` | yes | runtime projection uses fresh timestamp |
| `npm run edge:compat` | yes | yes | `--print` | yes | runtime bundle uses fresh timestamp; includes production-capsule, production-bundle, rough-cut, render/export candidate, authority-prereq, local package posture, and Layer interop source refs/attention when present; no Edge queue, dispatch, approval, or runtime verification |
| `npm run operator:index` | yes | yes | `--print` | yes | runtime index uses fresh timestamp; includes provider-loop, production-capsule, production-bundle, rough-cut, local package posture, and Layer interop refs/attention when present |
| `npm run handoff:edge` | yes | yes | `--print` | yes | runtime handoff uses fresh timestamp |
| `npm run operator:decision-request` | yes | yes | `--print` | yes | runtime request uses fresh timestamp |
| `npm run operator:provider-loop-request` | yes | yes | `--print` | yes | runtime request uses fresh timestamp; retry is request-only |
| `npm run operator:provider-loop-decision` | yes | yes | `--print` | yes | local retry/defer decision only; does not execute provider work |
| `npm run operator:cross-project-index` | yes | yes | `--print` | yes | preserves existing `createdAt` for the same output/index id; can surface provider-loop status/decision refs and Layer interop attention from explicit operator-index refs |

## Provider Commands

| Command | compact | artifact | json | refs | churn |
| --- | --- | --- | --- | --- | --- |
| `npm run provider:venice:smoke` | yes | yes | no | yes | gated runtime output under ignored smoke paths |
| `npm run provider:venice:loop` | yes | yes | `--print` | yes | selects latest generated candidate; live API only with `--live-provider` |
| `npm run rule:example` | yes | yes | no | yes | deterministic example ids; runtime output is ignored |

## Fixture Commands

| Command | compact | artifact | json | refs | churn |
| --- | --- | --- | --- | --- | --- |
| `npm run fixture:inspection` | yes | yes | no | yes | normalizes timestamps and UUIDs |
| `npm run fixture:inspection:check` | yes | no | no | checks fixture shape | no output mutation |
| `npm run fixture:unhealthy` | yes | yes | no | yes | normalizes timestamps and UUIDs |
| `npm run fixture:unhealthy:check` | yes | no | no | checks fixture shape | no output mutation |

## Current Churn Posture

Most runtime commands intentionally write fresh local records. Those outputs are
local cache, receipt, draft, or guidance records and are normally ignored by
git.

Critical production/status record writers use atomic same-directory temp writes
followed by rename. JSON discovery skips temporary files. Operator/status
surfaces report malformed final records as local retry-safe record IO attention
instead of treating partial JSON as a command crash.

Committed fixture commands normalize timestamps and UUIDs. The cross-project
operator index preserves `createdAt` for the same output/index id so repeated
default scans do not produce timestamp-only diffs.

## Local Package Posture

`production:local-output`, `production:package-rework`, `media:summary`,
`health:summary`, `operator:index`, and `edge:compat` now expose the same shared
`localPackagePosture` summary. The
stable compact fields are `localPackage=<state>`, `review=<posture>`,
`integrity=<posture>`, and `nextAction=<safe action>`. Valid package states are
`complete_review_only_authority_missing`, `incomplete_local_package`,
`output_integrity_blocked`, `review_requested_changes`, `stale_review`, and
`no_package_review`.

For the local proof stage, run:

```bash
npm run production:local-output -- --project-dir examples/card-to-candidate
npm run production:package-rework -- --project-dir examples/card-to-candidate # optional when eligible
npm run operator:index -- --project-dir examples/card-to-candidate
npm run edge:compat -- --project-dir examples/card-to-candidate
```

`production:package-rework` is optional and only eligible when the latest local
package review requested changes or the reviewed package is stale. These
summaries prepare Studio evidence for future swarm seam pressure; they do not
activate swarm runtime, Edge dispatch, Layer admission, durable append, storage
selection, materialization proof, causal truth, publication authority, or
production readiness.

## Bundle Completeness Posture

`inspect:local-run` includes optional records that exist before the inspection
packet is regenerated, including Studio source-pressure adapter records when
`pressure:studio --adapter-chain` has been run. `operator:index` and
`edge:compat` summarize those adapter refs, counts, decision status, observation
presence, and generic Layer envelope as review-only local evidence.
`export:inspection-bundle` copies records referenced by the selected inspection
packet.

When the operator wants a complete handoff-era bundle, the safe order is:

```bash
npm run inspect:local-run -- --project-dir examples/card-to-candidate
npm run control:surface -- --project-dir examples/card-to-candidate
npm run edge:compat -- --project-dir examples/card-to-candidate
npm run operator:index -- --project-dir examples/card-to-candidate
npm run handoff:edge -- --project-dir examples/card-to-candidate
npm run operator:decision-request -- --project-dir examples/card-to-candidate
npm run edge:compat -- --project-dir examples/card-to-candidate
npm run inspect:local-run -- --project-dir examples/card-to-candidate
npm run export:inspection-bundle -- --project-dir examples/card-to-candidate
```

The second `edge:compat` and `inspect:local-run` runs pick up optional operator
records created by the first pass. This remains local-only and does not call
Edge.

Studio source-pressure adapter artifacts are runtime handoff evidence and are
not committed in `examples/card-to-candidate`. Generate them before the
inspection sequence when Layer review source evidence is needed.
