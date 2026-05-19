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
