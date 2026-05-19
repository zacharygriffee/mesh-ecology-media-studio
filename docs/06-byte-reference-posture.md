# Byte Reference Posture

Large media bytes should not be embedded in ordinary concern state.

Storage responsibilities:

- local filesystem, Hyperdrive, Hyperblob, or equivalent stores large bytes,
  proxies, thumbnails, imports, and exports
- `mesh-ecology-bytes` defines portable byte descriptors, byte references, and
  materialization requests
- Studio defines media asset meaning, provider job lineage, card lineage,
  review posture, acceptance, rejection, and continuity evidence

`media.asset.descriptor.v1` includes an optional `byteRef`. That field is a
reference hook only. It does not prove availability, placement, authority, or
ratification.

Studio can also write local byte descriptor proposals:

```text
media.byte_descriptor_proposal.local.v1
```

These proposals are generated from accepted or reference asset descriptors and
preview a future `media.byte_descriptor.v1` shape. They remain local proposals:

```text
byteAvailabilityProof: false
materializationProof: false
byteAuthority: false
localOnly: true
meshTruth: false
```

Run:

```bash
npm run bytes:proposal -- --project-dir examples/card-to-candidate
```

The command writes proposal records under `records/bytes/`. It does not call
Bytes, Hyperdrive, Hyperblob, Edge, or a mesh publication lane.
