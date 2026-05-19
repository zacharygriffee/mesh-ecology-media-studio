# Local Layer

The local layer provides a working Studio loop. It may store:

- source media
- generated media
- accepted and rejected candidate bins
- proxies, thumbnails, and waveforms
- rough exports
- draft cards
- local descriptors and receipts

The local layer must not silently become the durable shared truth layer for
control-plane state.

Every local record that could be confused for authority should carry posture
language such as `localOnly`, `localTruthLabel`, or `truthStatus`.

The first executable wedge writes records under an example project folder. That
is a convenience lane and a contract sketch, not mesh publication.

Following Spine's JSON-exit posture, local JSON records and local paths are
`device_dependent_scaffold` unless a later local-layer resource ref, replicated
pointer ref, or causal-reviewable ref is admitted. Studio may write
`media.local_layer_resource_ref_candidate.local.v1` records to show the intended
direction, but those candidates do not claim the resource ref exists.
