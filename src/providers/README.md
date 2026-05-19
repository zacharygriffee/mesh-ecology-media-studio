# Providers

Provider adapters will translate Studio media job requests into
provider-specific API calls and provider result descriptors.

Provider adapters must not own Studio semantics. They must not treat provider
results as mesh truth or ratified shared state.

Phase 4 defines provider-neutral helpers in `provider-neutral.js`. Provider-
specific adapters should map into those shapes before Studio records ingest,
evidence, review, or decisions.

Phase 5 defines provider shape registry helpers in `provider-shapes.js`. These
describe provider endpoint shapes and mappings without calling provider APIs or
making provider payloads Studio canon.
