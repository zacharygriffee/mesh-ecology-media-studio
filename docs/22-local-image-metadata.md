# Local Image Metadata

Local image metadata records describe dimensions observed from local image
bytes.

Current draft schema:

```text
media.image_metadata.local.v1
```

The first implementation probes PNG width and height from local bytes.

These records are local-only:

- not mesh truth
- not distributed proof
- not byte availability proof
- not materialization proof
- not publication authorization

Image metadata may help operator review and future Edge inspection, but it does
not prove the bytes are durable or portable.
