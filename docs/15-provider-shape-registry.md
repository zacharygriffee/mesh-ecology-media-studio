# Provider Shape Registry

Provider shape records describe provider endpoint quirks without making
provider payloads Studio canon.

The registry sits below Studio's provider-neutral contract:

```text
Studio canon:
  media.generation_request.v1
  media.provider_result.v1
  media.asset.descriptor.v1

Provider shape registry:
  media.provider_shape.v1
  media.provider_endpoint_shape.v1
  media.provider_mapping.v1
```

## Shapes

`media.provider_shape.v1` describes a provider family, auth posture, and the
endpoint shapes known locally.

`media.provider_endpoint_shape.v1` describes one endpoint's intent family,
operation kind, request shape, response shape, async pattern, output delivery,
and known failure modes.

`media.provider_mapping.v1` explains how a Studio request maps to provider
input and how provider output maps back into `media.provider_result.v1`.

All provider shape records are local-only. They are not provider truth, mesh
truth, byte availability proof, or adapter implementation proof.

## Operation Kinds

- `generate-image`
- `edit-image`
- `generate-video`
- `extend-video`
- `remix-video`
- `text-to-speech`
- `transcribe-audio`
- `transform-media`

## Async Patterns

- `synchronous`
- `async-job-poll`
- `async-webhook`
- `streaming`
- `batch`

## Output Delivery

- `inline-base64`
- `file-id`
- `temporary-url`
- `download-endpoint`
- `provider-hosted-asset`
- `local-file`

## Boundary

Do not place API keys, provider secrets, live URLs with credentials, or
provider-specific authority claims in provider shape records.

Future provider adapters should declare which provider shapes they implement.
They should translate provider payloads into Studio records instead of
promoting provider payloads into Studio canon.
