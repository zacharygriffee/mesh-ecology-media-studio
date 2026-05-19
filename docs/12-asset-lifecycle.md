# Asset Lifecycle

`media.asset_lifecycle.v1` records local lifecycle posture for one asset.

Known states:

- `source`: imported or source material.
- `generated`: provider or local model output before review placement.
- `ingested`: copied into the project layout and described.
- `under-review`: awaiting local review.
- `accepted`: locally accepted by an operator decision.
- `rejected`: locally rejected by an operator decision.
- `proxied`: proxy, thumbnail, waveform, or preview derivative exists.
- `exported`: rough cut or publication artifact was exported locally.

Lifecycle records are local-only. A lifecycle state is not provider truth,
mesh truth, distributed proof, byte materialization proof, causal truth,
ratified shared state, or publication authorization.

The first wedge uses `accepted` or `rejected` to place candidates into
`media/accepted/` or `media/rejected/` and records that state inside the media
asset descriptor provenance.
