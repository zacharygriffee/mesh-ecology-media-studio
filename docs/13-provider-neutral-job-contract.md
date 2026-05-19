# Provider-Neutral Job Contract

Studio owns media job semantics. Providers are replaceable execution backends.
Provider APIs are not truth, and provider job ids are provenance rather than
authority.

Phase 4 defines provider-neutral records before any provider-specific API
integration:

- `media.provider_profile.v1`
- `media.provider_capability.v1`
- `media.generation_request.v1`
- `media.provider_result.v1`

## Intent Families

Provider-neutral intent families:

- `image-generation`
- `video-generation`
- `audio-generation`
- `media-transformation`
- `media-evidence`

Provider profiles declare capabilities against these families. A provider-
specific adapter may support only a subset.

## Generation Request

`media.generation_request.v1` is the Studio-owned request shape derived from a
card. It carries project id, card ref, prompt fields, reference asset refs,
target, provider hints, and local-only doctrine flags.

The request is not a provider API payload. Provider adapters translate from it
into provider-specific calls later.

## Provider Result

`media.provider_result.v1` normalizes provider output into a Studio-readable
record:

- request ref
- provider id
- provider job ref
- status
- output refs
- optional cost/timing/raw provider refs

A provider result is still not Studio truth. It becomes useful only after local
ingest, descriptor creation, evidence recording, and review.
