# Production Descriptors

Production descriptors are local planning records that specialize a generalized
production unit for common media workflows.

The descriptor artifact is:

```text
media.production_descriptor.local.v1
```

Initial descriptor kinds are:

```text
scene
shot
clip
rough-cut
export
```

These descriptors do not replace `media.production_unit.v1`. Each descriptor
must point back to the production unit it describes. Scene, shot, and clip
remain useful for conventional video planning, but they are a projection over
production units, not the root Studio ontology.

## Scene, Shot, Clip

Scene, shot, and clip descriptors are ergonomic local records for familiar
planning lanes:

```text
sequence -> scene -> shot -> clip
```

Their purpose is to keep story/video work usable without making future
world-first, panorama-first, entity-first, audio-first, or transformation-first
workflows second-class.

Create a local scene/shot/render-pass set from the current card with:

```bash
npm run production:from-card -- --project-dir examples/card-to-candidate
```

The command writes local records under `records/production/`. It does not call
providers, Edge, mesh publication, or ratifiers.

The local constructor validates descriptor parentage before writing generated
records. A descriptor must describe an existing production unit, parent unit
refs must exist in the same local record set, and scene/shot/clip descriptor
parent refs must match the parent refs on the production unit they specialize.
This is consistency checking for local planning only, not an authority claim.

## Rough Cuts

Rough-cut descriptors describe local assembly intent. They may reference source
production units and local asset refs, but they do not authorize publication.

```text
publicationAuthorization: false
```

## Exports

Export descriptors describe a local export target and delivery posture. They
may become inputs to future proposal or publication lanes, but an export
descriptor is not itself a mesh publication, approval, or ratified shared state.

```text
publicationAuthorization: false
```

## Doctrine

Generated production descriptors are local-only:

```text
localOnly: true
meshTruth: false
distributedProof: false
ratifiedSharedState: false
```

They do not claim provider truth, byte availability, materialization proof,
causal truth, publication authority, or Edge runtime integration.

## Edge Inspection

When these records are present under `records/production/`, Studio's local
inspection packet and Edge compatibility bundle can include them for later
operator review. This is inspection posture only. Edge can see the records, but
Studio still owns the media-domain meaning and Edge still owns any future
operator-facing boundary.
