# Organisms

Organisms are candidate actors for media production workflows. This first pass
defines them conceptually only.

Initial candidates:

- `media-ingest-organism`: imports local media, records hashes, and creates
  media asset descriptors.
- `provider-job-organism`: creates provider job requests and records provider
  result descriptors.
- `reference-prep-organism`: prepares reference assets, proxies, and metadata
  for generation or transformation work.
- `continuity-analysis-organism`: produces continuity evidence and causal-
  shaped fields for later interpretation.
- `proxy-render-organism`: creates thumbnails, proxies, waveforms, or preview
  artifacts.
- `sequence-assembly-organism`: assembles rough cuts or ordered candidate
  sequences.
- `metadata-repair-organism`: normalizes content type, duration, dimensions,
  and descriptor metadata.

Future provider-specific organisms may include:

- `venice-video-organism`
- `openart-image-organism`
- `kling-video-organism`
- `veo-video-organism`
- `elevenlabs-audio-organism`
- `local-model-organism`

Provider organisms translate requests and results. They do not own media-studio
semantics.
