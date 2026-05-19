# Assets

Asset helpers will manage media asset descriptors, local refs, optional byte
refs, proxies, thumbnails, imports, and exports.

Large bytes should stay in byte stores or local media folders, not embedded in
ordinary concern state.

`provider-output-ingest.js` writes provider output bytes into the local project
layout, hashes them, and creates local-only asset descriptors. It does not
claim byte availability proof, provider truth, or mesh truth.

`image-metadata.js` reads lightweight local PNG metadata without claiming byte
availability or materialization proof.

`ingest-reference.js` copies project-local reference media into
`media/references/` and writes local reference ingest records.
