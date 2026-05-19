# Card To Candidate Example

Run:

```bash
npm run wedge:example
```

This example is intentionally local-only. The card lives at `cards/card.json`.
The candidate file at `media/generated/candidate.txt` is a text placeholder so
the wedge can run without provider credentials or binary media assets.

Accepted or rejected media is copied under `media/accepted/` or
`media/rejected/`. Records are written under `records/` and labeled as local
records, not mesh truth.
