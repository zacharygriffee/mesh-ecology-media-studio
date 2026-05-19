# Provider Adapter Boundary

Provider adapters translate between Studio records and provider APIs.

They may:

- read `media.generation_request.v1`
- read provider profile and capability records
- call a provider API in a later phase
- normalize provider responses into `media.provider_result.v1`

They must not:

- define Studio media semantics
- make provider response shapes Studio canon
- store secrets in Studio records
- claim provider truth, mesh truth, distributed proof, byte availability, or
  ratified shared state
- bypass local ingest, asset descriptor creation, evidence recording, review,
  and local decisions

Phase 4 does not implement Venice, OpenArt, Kling, Veo, or any provider API.
It only creates the provider-neutral contract that future adapters must target.
