# Venice Dry-Run Adapter

The Venice dry-run adapter maps Studio records to Venice-shaped image payloads
without making network calls.

It owns two local transformations:

- `media.generation_request.v1` -> Venice-shaped image request fixture
- Venice-shaped fixture response -> `media.provider_result.v1`

The adapter does not:

- read API keys
- call Venice
- spend credits
- write provider bytes
- claim provider truth
- claim byte availability
- bypass local ingest, asset descriptor creation, evidence, review, or decision

Live Venice testing should be added behind a separate explicit opt-in gate.
