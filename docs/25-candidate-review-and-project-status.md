# Candidate Review And Project Status

Studio can now write a local comparison record across candidate assets:

```bash
npm run review:candidates -- --project-dir examples/card-to-candidate
```

The record uses:

```text
media.candidate_review.local.v1
```

It names the card, candidate asset refs, selected asset ref, criteria, and
operator ref. It is local evidence only. It is not ratifier authority and does
not accept or reject assets by itself.

Studio can also write a local project status snapshot:

```bash
npm run status:project -- --project-dir examples/card-to-candidate
```

The record uses:

```text
media.project_status.local.v1
```

It summarizes cards, references, provider results, adapter runs, assets,
reviews, candidate reviews, continuity evidence, production records, approval
proposals, byte descriptor proposals, resource-ref candidates, decisions,
manifests, inspection packets, bundles, and provider ledgers. Counts and refs
are local cache state only, not mesh truth, provider truth, byte proof,
authority, local-layer resource admission, or materialization proof.

The status record also includes `assetResourceConsistency`. It summarizes
accepted/reference assets missing byte descriptor proposals, missing resource
ref candidates, or unresolved byte/resource alignment. This is readiness
guidance for later inspection only.
