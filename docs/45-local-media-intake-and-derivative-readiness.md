# Local Media Intake And Derivative Readiness

## Purpose

Studio can import project-local media files into the Mode 0 project layout and
make derivative readiness visible to operators. Provider-generated image outputs
enter the same local metadata and derivative readiness path after provider
result normalization.

This is an operational local-media slice. It does not add provider APIs, Edge
runtime calls, storage backends, virtual drives, causal adapters, proxy
generation, waveform generation, or video derivative generation.

## Command

Import a safe project-relative file:

```bash
npm run media:import -- --project-dir examples/card-to-candidate --source media/generated/candidate.txt --placement source
```

Supported placements:

```text
source -> media/source/
generated -> media/generated/
reference -> media/references/
```

Optional flags:

```text
--filename <safe filename>
--operator-ref <operator id>
```

The command rejects absolute paths, traversal, URL-like refs, home expansion,
backslash paths, and filenames with path separators.

The committed fixture at `examples/media-import-fixtures/tiny-png/` contains a
tiny PNG source for deterministic import tests. Runtime import outputs remain
ignored.

## Records Written

`media:import` and provider-output ingest write normal
`media.asset.descriptor.v1` records under `records/assets/`.

The descriptor includes the current layered identity fields:

```text
contentId
assetDescriptorRef / artifactDescriptorRef
originRef
basisRef
situationRef
placementRef
causalRefs deferred
```

`assetId` remains content-derived for compatibility. Do not use it as byte or
resource identity in new behavior.

PNG imports and generated provider PNG outputs may also write
`media.image_metadata.local.v1` when dimensions can be probed by the existing
lightweight PNG reader.

## Thumbnail Generation

Image thumbnail generation is explicit and local:

```bash
npm run derivatives:thumbnail -- --project-dir examples/media-import-fixtures/tiny-png
```

The command uses `sharp` to write PNG thumbnails under `media/thumbnails/` and
records `media.derivative.local.v1` receipts under `records/assets/`. The
receipt lets status and health summaries clear `missing_thumbnail` for that
specific descriptor/situation/placement when the derivative is current.

Thumbnail receipts use descriptor/situation/placement identity, not `assetId`
alone. Same-content assets in different situations may share `contentId`, but
they receive distinct derivative subject refs and distinct thumbnail receipts.

This is still local derivative work. A generated thumbnail is not byte
availability proof, materialization proof, resource admission, publication
authorization, or mesh truth.

## Metadata Posture

Imported descriptors and generated provider-output descriptors carry a
descriptor-level `metadataProbe` object with:

```text
mediaKind
contentType
size
hash
metadataProbeState
warnings
optional image dimensions
optional ffprobe summary for video/audio when ffprobe is available
```

`ffprobe` is optional. Missing or failed `ffprobe` records local guidance and
does not fail import.

## Derivative Readiness

Imported descriptors and generated provider-output descriptors also carry
`derivativeReadiness`.

Initial issue codes:

```text
missing_thumbnail
missing_proxy
missing_waveform
metadata_probe_unavailable
unsupported_media_type
```

These issue codes appear in project status and health summaries as operator
guidance. They do not generate derivatives.

Unsupported media types are reported as guidance, not errors. They mean Studio
does not yet know which local derivative preparation applies.

## Operator Surfaces

These commands surface derivative readiness rows:

```bash
npm run status:project -- --project-dir examples/card-to-candidate
npm run health:summary -- --project-dir examples/card-to-candidate
```

Example row shape:

```text
media-asset-derivative-readiness: media/source/source-pixel.png | state=needs-local-attention | issues=missing_thumbnail | nextAction=Run npm run derivatives:thumbnail for image thumbnails.
```

`repair:local-posture` treats derivative readiness issues as non-blocking
skips. Thumbnail generation is handled by `npm run derivatives:thumbnail`;
proxy and waveform generation remain deferred.

When a thumbnail receipt satisfies readiness, `status:project` prints a compact
`derivative ready` row with the local derivative ref. That row is operator
guidance only.

## Media Summary

Use `media:summary` when the operator needs the media posture without raw JSON:

```bash
npm run media:summary -- --project-dir examples/card-to-candidate
npm run media:summary -- --project-dir examples/card-to-candidate --print
npm run --silent media:summary -- --project-dir examples/card-to-candidate --print
```

The compact output shows asset counts by media kind, derivative readiness,
thumbnail/proxy/waveform counts, metadata probe attention, byte content posture,
resource situation posture, provider-generated candidate review/promotion
posture, and attention rows only when attention is needed. `--print` emits
machine-readable JSON for agents and future control surfaces. Use
`npm run --silent` when redirecting JSON stdout so npm's script banner is not
included.

The summary reads local records and refreshes the project status snapshot. It
does not generate derivatives, call providers, call Edge, publish to mesh, or
claim byte/materialization proof.

## Generated Candidate Promotion

Provider-generated image candidates land under `media/generated/` first.
Use `promote:candidate` to copy one into `media/accepted/` or
`media/rejected/` with an explicit local decision:

```bash
npm run promote:candidate -- --project-dir examples/venice-smoke --asset-record records/assets/venice-live-smoke-asset-0.local.json --provider-result-record records/provider-results/venice-live-smoke-provider-result.local.json --decision accepted
```

Promotion does not rerun provider work. Promoted image descriptors get fresh
metadata probe and derivative readiness for the new placement, because
derivative identity is descriptor/situation/placement-specific. A thumbnail
receipt for the generated candidate does not automatically satisfy the promoted
accepted/rejected placement.

## Full Local Generated-Image Loop

The current operational loop for one Venice-generated image is:

```bash
VENICE_LIVE=1 npm run provider:venice:smoke
npm run media:summary -- --project-dir examples/venice-smoke
npm run derivatives:thumbnail -- --project-dir examples/venice-smoke
npm run promote:candidate -- --project-dir examples/venice-smoke --asset-record records/assets/venice-live-smoke-asset-0.local.json --provider-result-record records/provider-results/venice-live-smoke-provider-result.local.json --decision accepted
npm run derivatives:thumbnail -- --project-dir examples/venice-smoke
npm run bytes:proposal -- --project-dir examples/venice-smoke
npm run resource:refs -- --project-dir examples/venice-smoke
npm run repair:local-posture -- --project-dir examples/venice-smoke
npm run inspect:venice-smoke
npm run media:summary -- --project-dir examples/venice-smoke
```

Expected final summary shape:

```text
derivatives: ready=2/2
generated candidates: total=1 | reviewed=1 | pending=0 | promotedAccepted=1
identity: byteContent=1/1 | resourceSituations=1/1
```

`repair:local-posture` may report that local-run inspection refresh was skipped
for Venice smoke projects. That is non-blocking when `inspect:venice-smoke`
is the intended inspection surface.

## Non-Claims

Local media intake and derivative readiness do not claim:

```text
mesh truth
distributed proof
ratified shared state
byte availability proof
materialization proof
resource admission
provider truth
causal truth
publication authorization
Edge approval
```

## Deferred Work

Deferred deliberately:

- proxy generation
- waveform generation
- video thumbnail generation
- media preview UI
- provider expansion
- storage backend
- virtual drive
- causal adapter
- Edge runtime integration
- `assetId` generation migration
