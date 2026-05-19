# Local Inspection Export

Local inspection export creates an Edge-readable packet from records that
already exist in a local Studio project folder.

It does not:

- call Venice or any provider
- call Edge
- publish to mesh
- prove byte availability
- create ratifier authority
- authorize publication

## Venice Smoke Command

After a successful gated Venice smoke run, export an inspection packet with:

```bash
npm run inspect:venice-smoke
```

The command reads:

- the Venice smoke manifest
- work packet
- generation request
- provider result
- asset descriptor
- review evidence
- readiness
- operator decision

It writes:

```text
examples/venice-smoke/records/exports/venice-smoke-edge-inspection-packet.local.json
```

## Generic Local Run Command

Export any local run manifest that follows the current project layout:

```bash
npm run inspect:local-run -- --project-dir examples/card-to-candidate
```

The generic command reads `records/manifests/media-local-run-manifest.local.json`
by default and follows the manifest's generated record refs.

## Provider Failure Command

Export a failed provider result posture without requiring generated assets:

```bash
npm run inspect:provider-failure
```

This is useful when a provider returned an auth, quota, rate-limit, or malformed
response. The packet includes no generated asset refs and makes no review
decision claims.

## Packet Shape

The packet schema is:

```text
media.edge_inspection_packet.local.v1
```

The packet groups local refs for later Edge inspection through
`media-edge-operator-seam`.

All refs are local paths. They are useful for operator-facing inspection, but
they are not mesh truth, provider truth, distributed proof, byte availability
proof, materialization proof, ratified shared state, or publication
authorization.

Generated artifact refs may include `byteRefPreview`. These fields describe how
a future byte reference could be derived from local hash/size/content-type
metadata. They are previews only and are not byte materialization proof.

## Committed Fixture

A committed inspection fixture lives at:

```text
examples/inspection-fixtures/card-to-candidate/
```

It includes a completed local run plus:

```text
inspection-packets/local-run-edge-inspection-packet.local.json
```
