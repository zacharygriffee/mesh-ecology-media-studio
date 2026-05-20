# Shared Basis Divergent Situations Fixture

This fixture pressures the Studio identity model without introducing a runtime
storage backend or causal-substrate adapter.

The three local media files intentionally contain identical bytes:

- `media/generated/candidate.txt`
- `media/accepted/candidate.txt`
- `media/references/candidate.txt`

The accepted and reference copies share one `contentId`, `originRef`, and
`basisRef`, but they diverge into different `situationRef`, `placementRef`, and
`resourceRefCandidateId` values. The byte descriptor proposal is content keyed
and shared. Resource-ref candidates remain descriptor/situation/placement
specific.

Non-claims:

- local fixture records are not mesh truth
- shared content is not shared Studio meaning
- byte descriptor proposal is not byte availability proof
- resource-ref candidates are not resource admission
- causal linkage is shaped only and remains deferred
