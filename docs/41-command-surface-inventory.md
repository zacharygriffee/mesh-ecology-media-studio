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
| `npm run media:summary` | yes | no | `--print` | reads local refs | refreshes project status snapshot; includes provider-loop posture |
| `npm run derivatives:thumbnail` | yes | yes | no | yes | runtime thumbnails and records use fresh timestamps |
| `npm run review:candidates` | yes | yes | no | yes | runtime records use fresh ids/timestamps |
| `npm run approval:proposal` | yes | yes | no | yes | runtime records use fresh ids/timestamps |
| `npm run continuity:draft` | yes | yes | `--print` | yes | runtime records use fresh ids/timestamps |
| `npm run production:from-card` | yes | yes | no | yes | runtime records use fresh ids/timestamps |
| `npm run production:validate` | yes | no | no | reads production refs | no committed output |

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
| `npm run inspect:local-run` | yes | yes | `--print` | yes | runtime packet uses fresh ids/timestamps |
| `npm run inspect:summary` | yes | no | no | reads packet refs | no committed output |
| `npm run inspect:index` | yes | no | `--json` | reads local refs | no committed output |
| `npm run inspect:provider-runs` | yes | yes | `--print` | yes | runtime ledger uses fresh timestamp |
| `npm run inspect:provider-failure` | yes | yes | `--print` | yes | runtime packet uses fresh ids/timestamps |
| `npm run inspect:venice-smoke` | yes | yes | `--print` | yes | smoke records are ignored runtime output |
| `npm run inspect:venice-loop` | yes | no | `--print` | reads provider-loop status/request/decision refs | no output mutation; prints retry path |
| `npm run export:inspection-bundle` | yes | yes | `--print` | yes | bundle manifest uses fresh timestamp |
| `npm run control:surface` | yes | yes | `--print` | yes | runtime projection uses fresh timestamp |
| `npm run edge:compat` | yes | yes | `--print` | yes | runtime bundle uses fresh timestamp |
| `npm run operator:index` | yes | yes | `--print` | yes | runtime index uses fresh timestamp; includes provider-loop status refs when present |
| `npm run handoff:edge` | yes | yes | `--print` | yes | runtime handoff uses fresh timestamp |
| `npm run operator:decision-request` | yes | yes | `--print` | yes | runtime request uses fresh timestamp |
| `npm run operator:provider-loop-request` | yes | yes | `--print` | yes | runtime request uses fresh timestamp; retry is request-only |
| `npm run operator:provider-loop-decision` | yes | yes | `--print` | yes | local retry/defer decision only; does not execute provider work |
| `npm run operator:cross-project-index` | yes | yes | `--print` | yes | preserves existing `createdAt` for the same output/index id; can surface provider-loop status refs |

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

Committed fixture commands normalize timestamps and UUIDs. The cross-project
operator index preserves `createdAt` for the same output/index id so repeated
default scans do not produce timestamp-only diffs.

## Bundle Completeness Posture

`inspect:local-run` includes optional records that exist before the inspection
packet is regenerated. `edge:compat` includes optional source records that exist
before the compatibility bundle is regenerated. `export:inspection-bundle`
copies records referenced by the selected inspection packet.

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
