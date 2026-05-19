# Provider Adapter Contracts

Provider adapter contracts describe the boundary a provider-specific adapter
must satisfy before it can participate in Studio flows.

Current draft schema:

```text
media.provider_adapter_contract.v1
```

The contract names:

- provider id
- endpoint id
- intent family
- Studio input schema
- Studio output schema
- failure taxonomy ref

Contracts are local-only. They do not make provider payloads Studio canon and
do not claim provider truth.

Venice examples:

- `examples/provider-shapes/venice-adapter-contract.json`
- `examples/provider-shapes/venice-failure-taxonomy.json`

Provider failures use:

```text
media.provider_failure_taxonomy.v1
```

The taxonomy is descriptive. A provider error classification is evidence for
operator inspection, not authority and not mesh truth.
