# Provider Run Ledger And References

Studio now has two additional local-only Mode 0 surfaces:

- `media.provider_run_ledger.local.v1`
- `media.reference_ingest.local.v1`

The provider run ledger indexes normalized provider results, adapter-run
receipts, and provider-failure evidence across one local project:

```bash
npm run inspect:provider-runs -- --project-dir examples/card-to-candidate
```

The ledger helps operators and later Edge inspection answer which provider
attempts happened, which succeeded or failed, and which local records explain
the outcome. It is not provider truth, mesh truth, or distributed proof.

Reference ingest copies a safe project-relative source file into
`media/references/`, hashes it, creates a media asset descriptor, and writes a
local ingest receipt:

```bash
npm run reference:ingest -- --project-dir examples/card-to-candidate --source media/generated/candidate.txt --filename candidate-reference.txt
```

Image references get local image metadata when the lightweight PNG probe can
read dimensions.

Reference assets remain local cache/receipt records. Local file existence,
hashes, and metadata are not byte availability proof or materialization proof.
