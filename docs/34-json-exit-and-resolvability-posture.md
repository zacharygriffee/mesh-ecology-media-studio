# JSON Exit And Resolvability Posture

Studio uses JSON records and project-local paths for Mode 0 scaffolding. Spine
now treats heavy JSON, local paths, copied blobs, and session-only refs as
temporary ingress/debug surfaces unless they are represented by resolvable
local-layer resource refs.

Studio adopts that posture directly:

```text
local JSON/path record
-> resource-ref candidate
-> local-layer resource ref
-> replicated pointer ref
-> causal-reviewable ref
```

The current target artifact is:

```text
media.local_layer_resource_ref_candidate.local.v1
```

## Categories

Studio uses Spine's resolvability categories:

```text
device_dependent_scaffold
session_local_ref
local_layer_resource_ref
replicated_pointer_ref
causal_reviewable_ref
```

Mode 0 JSON records and local file paths begin as
`device_dependent_scaffold`. A resource-ref candidate points toward
`local_layer_resource_ref`, but it does not claim that ref has been admitted or
replicated.

## Command

After a local asset exists, write candidates with:

```bash
npm run bytes:proposal -- --project-dir examples/card-to-candidate
npm run resource:refs -- --project-dir examples/card-to-candidate
npm run readiness:edge -- --project-dir examples/card-to-candidate
```

The command writes records under:

```text
records/resources/
```

When a matching `media.byte_descriptor_proposal.local.v1` exists, the
resource-ref candidate records byte descriptor alignment. Missing alignment is
kept visible as operator guidance and must be resolved before any future
promotion to an admitted local-layer resource ref.

`npm run readiness:edge` writes `media.readiness.v1` guidance under
`records/readiness/`. It is only an Edge-inspection preview: it summarizes
unresolved scaffold refs, missing byte descriptor proposals, and resource-ref
candidate coverage without calling Edge or proving any resource exists outside
the local project.

## Non-Claims

Resource-ref candidates must keep:

```text
localLayerResourceRef: false
replicatedPointerRef: false
causalReviewableRef: false
localOnly: true
meshTruth: false
distributedProof: false
ratifiedSharedState: false
```

They do not call Edge, Bytes, Hyperdrive, Hyperblob, Autobase, a replicated
local-layer lane, or causal-substrate.
