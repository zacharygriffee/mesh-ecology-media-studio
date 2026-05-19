# Adapter Runner And Export Bundles

This phase adds two local-only surfaces:

- `media.provider_adapter_run.local.v1`
- `media.edge_export_bundle.local.v1`

The provider adapter runner gives Studio one narrow shape for provider
execution: generation request in, provider-specific call or fixture execution
inside the adapter, normalized `media.provider_result.v1` out.

Adapter run records are local receipts. They record which adapter ran and what
normalized result it produced. They do not claim provider truth, mesh truth, or
ratifier authority.

Local export bundles copy an inspection packet, its referenced local records,
and referenced local artifacts into a bundle directory:

```bash
npm run export:inspection-bundle -- --project-dir examples/card-to-candidate
```

The bundle is an Edge handoff preview only. It does not call Edge, publish to
mesh, prove byte availability, prove materialization, or authorize publication.

Fixture freshness can be checked with:

```bash
npm run fixture:inspection:check
```
