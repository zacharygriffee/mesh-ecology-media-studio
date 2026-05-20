# Byte Descriptor Proposals

Byte descriptor proposals bridge local Studio assets toward future portable
byte descriptors without claiming materialization or byte authority.

The artifact is:

```text
media.byte_descriptor_proposal.local.v1
```

It is produced from accepted or reference `media.asset.descriptor.v1` records
and previews a future:

```text
media.byte_descriptor.v1
```

## Command

After the local wedge has accepted a candidate, run:

```bash
npm run bytes:proposal -- --project-dir examples/card-to-candidate
```

The command writes records under:

```text
records/bytes/
```

## Boundary

These records do not call `mesh-ecology-bytes`, Hyperdrive, Hyperblob, Edge, or
mesh publication. They must keep:

```text
status: proposed
byteAvailabilityProof: false
materializationProof: false
byteAuthority: false
localOnly: true
meshTruth: false
distributedProof: false
ratifiedSharedState: false
```

They make later inspection easier by carrying the asset ref, local ref, hash,
size, and content type in one proposal record.

Byte descriptor proposal alignment is required before a resource-ref candidate
can be considered ready for a future admission lane. Alignment still does not
promote the candidate: `media.local_layer_resource_ref_candidate.local.v1`
remains `candidate-only` until another layer admits it.
