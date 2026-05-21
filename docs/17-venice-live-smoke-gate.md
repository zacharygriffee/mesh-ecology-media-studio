# Venice Live Smoke Gate

The Venice live smoke gate is the first optional provider-network path. It is
not part of the local wedge and it does not run during tests.

Run it only when spending Venice credits is intentional:

```bash
VENICE_LIVE=1 npm run provider:venice:smoke
```

The script reads `VENICE_INFERENCE_KEY` from the shell environment or ignored
`.env`. It never writes the key to generated records.

## Guardrails

The smoke gate:

- refuses to run unless `VENICE_LIVE=1`
- requires `VENICE_INFERENCE_KEY`
- allows only `venice-sd35` for now
- caps the request at `512x512`
- requests one variant
- disables web search
- requests JSON/base64 response shape instead of provider-hosted bytes
- writes decoded output bytes under ignored
  `examples/venice-smoke/media/generated/provider-smoke/`
- writes local work packet, generation request, provider result, asset
  descriptor, review evidence, readiness, operator decision, and manifest
  records under ignored `examples/venice-smoke/records/`

## Record Posture

The normalized live response becomes `media.provider_result.v1`. The decoded
image bytes are placed as `media.local_ref.v1` and described by
`media.asset.descriptor.v1`. A local smoke review then records
`media.evidence.v1`, `media.readiness.v1`, and
`media.operator_decision.v1`.

A successful run also writes a `media.local_run_manifest.v1` summary that lists
the generated local records, generated output hash, doctrine labels, and
warnings.

That record is:

- `localOnly: true`
- `meshTruth: false`
- `distributedProof: false`
- `ratifiedSharedState: false`
- `providerTruth: false`

It is not byte availability proof, materialization proof, publication
authorization, causal truth, or ratified shared state.

## Boundary

This phase decodes live provider bytes into the local generated-media placement
class, hashes them, writes a local asset descriptor, and records a local smoke
review decision.

The smoke review is not ratifier authority, publication authorization, provider
truth, or mesh truth.

`npm run inspect:venice-smoke` and `npm run inspect:venice-loop` expose the
observed provider posture in compact form. They can show whether the pass used
the live provider path and whether raw provider bytes were stored, while still
preserving `providerTruth: false` and local-only posture.

## Fixtures

The smoke gate has local fixtures for:

- Venice provider profile/capability: `examples/provider-shapes/venice-provider-profile.json`
- auth failure: `examples/provider-fixtures/venice-image-auth-failure.fixture.json`
- rate limit: `examples/provider-fixtures/venice-image-rate-limit.fixture.json`
- malformed image payload: `examples/provider-fixtures/venice-image-malformed.fixture.json`

Failed provider responses persist a failed `media.provider_result.v1` and do
not create generated assets or review decisions.
