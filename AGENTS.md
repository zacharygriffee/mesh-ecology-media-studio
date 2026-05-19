# AGENTS.md

## Writable Boundary

Agents may write only inside:

```text
./mesh-ecology-media-studio
```

Adjacent repositories are read-only context unless the user explicitly changes
the task boundary.

## Read-Only Adjacent Repos

Examples include:

```text
./mesh-ecology
./mesh-ecology-edge
./mesh-ecology-packs
./mesh-ecology-bytes
./causal-substrate
./mesh-ecology-platform
./mesh-ecology-spine
```

Do not mutate adjacent repos. Do not create patches for adjacent repos. Do not
assume adjacent repos are wrong because Studio needs media-specific language.

## Doctrine Guardrails

- Local execution is not mesh truth.
- Provider API results are not mesh truth.
- Local file existence is not mesh truth.
- UI selection is not truth.
- Publication is not truth.
- Receipts and evidence are not truth by themselves.
- Operator review is not authorization unless backed by the proper
  ratification or authority artifact.

## Edge Boundary

Studio may expose Edge-compatible seams. It must not assume Edge is required for
Mode 0 operation, and it must not reinvent Edge's operator boundary.

## First-Pass Scope

Prefer small schemas, local descriptors, local receipts, examples, and tests.
Do not add provider API integrations, mesh publication, mandatory byte
infrastructure, mandatory causal-substrate integration, or a full Studio UI in
the first pass.
