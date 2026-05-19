# Providers

Provider adapters will translate Studio media job requests into
provider-specific API calls and provider result descriptors.

Provider adapters must not own Studio semantics. They must not treat provider
results as mesh truth or ratified shared state.
