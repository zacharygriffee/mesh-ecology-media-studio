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
