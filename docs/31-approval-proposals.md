# Approval Proposals

Approval proposals are local records that ask for later authority without
claiming that authority.

The artifact is:

```text
media.approval_proposal.local.v1
```

It is distinct from:

- `media.operator_decision.v1`: a local operator decision record
- ratifier output: future authority-bearing mesh-facing decision
- publication authorization: a future explicit approval lane

## Shape

An approval proposal points to:

- the subject being proposed for approval
- the local operator decision that motivated the proposal
- evidence refs used by that local decision

It must preserve these flags:

```text
authorityRequired: true
proposalOnly: true
operatorGuidanceOnly: true
approvalAuthority: false
ratifierAuthority: false
publicationAuthorization: false
localOnly: true
meshTruth: false
distributedProof: false
ratifiedSharedState: false
```

## Command

After running the local wedge, write a proposal with:

```bash
npm run approval:proposal -- --project-dir examples/card-to-candidate
```

The default output is:

```text
records/approvals/media-approval-proposal.local.json
```

Local inspection packets and Edge compatibility bundles include this record
when present. Edge can inspect it later, but Studio does not claim that Edge,
a ratifier, or a mesh-facing approval lane accepted it.
