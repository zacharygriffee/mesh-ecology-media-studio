# Production Strategy Posture

Studio must support current video practice without freezing its ontology around
today's generator limitations. Scene, shot, and clip are useful production
terms, but they are not the whole domain. New generative systems may work from
worlds, panoramas, entity creators, look libraries, audio-first passes,
reference packs, or future structures that do not resemble a traditional shot
list.

## Adopted Prior Art

Two read-only workflow references informed this posture:

- `/home/zevilz/work/narrative/cpc-story`
- `/media/zevilz/35357b5d-64d3-4959-bd26-7b1e92e5fb05/home/zevilz/Documents/video-projects2`

The useful concepts are:

- lens separation: source truth, render interpretation, and publication output
  are different layers;
- prompt temporal separation: static reference, initial frame, and motion prompt
  carry different meanings;
- reference primitives: characters, environments, props, looks, plates, voices,
  and readable text locks are reusable anchors;
- continuity entropy: drift risk and recovery strategy should be explicit;
- scene/shot/clip planning: useful as one render strategy, not the root
  ontology.

The old workflows are not copied as Studio canon. Provider names, fixed prompt
lengths, camera rules, and current model limits are treated as strategy notes,
not durable truth.

## General Shape

Studio now separates:

```text
source intent
  -> production unit
  -> reference primitives
  -> continuity bands
  -> render strategy
  -> generation request
  -> candidate asset
  -> review evidence
  -> local decision
  -> export/proposal
```

The generalized records are:

- `media.production_unit.v1`
- `media.reference_primitive.v1`
- `media.continuity_band.v1`
- `media.render_strategy.v1`

## Production Units

A production unit is any meaningful unit of media work. Supported initial kinds
include:

```text
project
episode
sequence
scene
shot
clip
still
audio-take
reference-plate
world
panorama
entity-reference
look-variant
rough-cut
export
```

This lets classic video planning coexist with world/panorama and entity-first
workflows.

## Reference Primitives

Reference primitives describe reusable anchors, not authority. Initial kinds:

```text
entity
character
prop
environment
space
world
panorama
look
plate
audio-voice
text-lock
```

Reference primitives may point to local assets, byte-reference previews, or
future portable byte descriptors. They do not prove byte availability,
identity truth, or canon authority.

## Continuity Bands

Continuity bands group state that should remain coherent across production
units:

```text
time
location
appearance
entity-state
world-state
audio-state
render-pass
```

Risk levels are guidance only:

```text
none
low
medium
high
critical
```

They help reviewers and future Edge surfaces understand reference burden,
drift risk, and recovery strategy. They are not pass/fail proof.

## Render Strategies

Render strategies describe how to execute or inspect a production unit. Initial
kinds:

```text
classic-scene-shot-clip
reference-first
frame-chain
world-panorama
entity-look
audio-first
rough-cut
export
```

Input modes are provider-neutral:

```text
text-to-media
reference-to-media
frame-to-media
multi-reference-to-media
world-to-media
audio-to-media
media-transformation
```

Provider adapters may later map these to Venice, OpenArt, Kling, Veo, local
models, or other backends. Provider capability does not become Studio canon.

## Classic Scene/Shot/Clip

Scene, shot, and clip remain important. They are the first concrete render
strategy for conventional video planning:

```text
sequence -> scene -> shot -> clip
```

But Studio should treat that as a strategy projection over production units.
Local production descriptors provide scene, shot, clip, rough-cut, and export
specializations after the generalized records exist.

## Local-Only Status

These records are local drafts and guidance artifacts:

```text
localOnly: true
meshTruth: false
distributedProof: false
ratifiedSharedState: false
```

They do not claim canon truth, provider truth, byte materialization,
publication authorization, causal truth, or ratifier authority.
