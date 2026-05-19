# Providers

Provider adapters will translate Studio media job requests into
provider-specific API calls and provider result descriptors.

Provider adapters must not own Studio semantics. They must not treat provider
results as mesh truth or ratified shared state.

Phase 4 defines provider-neutral helpers in `provider-neutral.js`. Provider-
specific adapters should map into those shapes before Studio records ingest,
evidence, review, or decisions.

`adapter-runner.js` defines the local runner interface. It creates
`media.provider_adapter_run.local.v1` receipts that identify the adapter and
normalized result without claiming provider truth.

Phase 5 defines provider shape registry helpers in `provider-shapes.js`. These
describe provider endpoint shapes and mappings without calling provider APIs or
making provider payloads Studio canon.

`venice-dry-run.js` maps Studio generation requests to Venice-shaped image
payloads and maps fixture responses back into `media.provider_result.v1`. It
does not make network calls.

`venice-live-smoke.js` is an explicit opt-in live test gate. It refuses to run
unless `VENICE_LIVE=1` is set, reads `VENICE_INFERENCE_KEY` from the environment
or ignored `.env`, constrains the request to a small allowed model shape, and
writes only local non-truth-bearing provider result records.
