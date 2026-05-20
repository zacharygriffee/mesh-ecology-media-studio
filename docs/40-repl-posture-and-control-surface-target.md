# REPL Posture And Control-Surface Target

## Purpose

This note corrects Studio's control-surface posture around REPL use.

REPL can be useful for current Edge operability, live command-path testing,
advanced operator trials, and debug workflows. It is not Studio's long-term app
surface and it is not a contract Studio should build against.

## REPL Is Transitional

REPL is a transitional lab/debug/advanced compatibility surface.

Studio must not treat REPL command text, transcript state, session memory, or
renderer output as a durable API. Edge may use REPL to prove a loop today, but
Studio should not consume Edge by wrapping Edge REPL commands.

## Durable Low-Level Surface

CLI plus machine-readable status is the durable low-level operator and agent
surface.

When Studio adds command output, it should prefer:

- compact human-readable summaries
- machine-readable JSON modes where practical
- stable refs
- local-only and non-claim flags
- explicit status views and inspection packets

## Future UI/DX Target

Future Studio UI/DX should be a control-surface projection over durable seams,
not a REPL wrapper.

The app surface should project over artifacts, refs, status views,
operator-loop contracts, readiness summaries, handoff candidates, decision
requests, and Packs-aligned control-surface projections.

## Studio Must Not Build Around REPL

Studio must not depend on:

- Edge REPL command strings
- Edge REPL transcript format
- Edge REPL session memory
- Edge REPL renderer output
- human UI flows built around REPL command text

If Studio needs Edge compatibility, it should target machine-readable artifacts,
status records, explicit refs, and handoff seams.

Current Edge integration guidance lives in
`../mesh-ecology-edge/docs/app-facing-seams.md`. Older Edge `docs/phase-*.md`
files are implementation history unless a current posture document explicitly
promotes one for a specific current seam.

## Edge Compatibility Without REPL Dependency

Studio should continue emitting or consuming local-only, Edge-inspectable
artifacts such as:

- `media.edge_inspection_packet.local.v1`
- `media.edge_export_bundle.local.v1`
- `media.edge_compatibility_bundle.local.v1`
- `media.operator_packet_index.local.v1`
- `media.edge_handoff_candidate.local.v1`
- `media.operator_decision_request.local.v1`
- `media.rule_resolution_trace.local.v1`
- `media.local_layer_projection_candidate.local.v1`

These artifacts remain local-only unless a later authority lane promotes them.
They do not call Edge, prove Edge runtime behavior, grant approval, or publish
to mesh.

## Packs Control-Surface Projection Target

Packs remains the preferred source of shared control-surface vocabulary and
semantic component posture.

Studio UI/DX should align with Packs concepts such as evidence panels, action
consoles, approval gates, control-plane view models, local-cache-not-truth
posture, and machine-readable surface contracts.

Studio should not derive UI contracts from REPL output.

## Machine-Readable Outputs To Prefer

Prefer stable outputs such as:

- JSON artifacts
- JSON summaries
- status views
- inspection packets
- operator indexes
- handoff candidates
- decision requests
- readiness records
- rule-resolution traces
- health summaries
- control-surface projections

Command text may explain these records, but it should not become the durable
contract.

## Non-Claims

This posture does not implement UI, Edge runtime calls, provider APIs, mesh
publication, Hypercore, Autobase, Hyperdrive, Hyperschema, Hyperdispatch, active
organisms, or active ratifiers.

It does not make local records mesh truth, provider truth, byte availability
proof, causal truth, publication authority, or ratifier authority.

## Deferred Work

Deferred work includes:

- a future Studio app/control surface
- Packs media-specific semantic component mapping
- Edge-side media import profiles
- machine-readable status output conventions beyond current local commands
- promoted local-layer projection events
- mesh-facing publication or ratification lanes
