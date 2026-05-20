# Cross Project Missing Artifact Fixture

This fixture shows a cross-project input list with one intentionally missing
operator decision request artifact.

It is useful for checking that `npm run operator:cross-project-index` reports
missing local refs separately from normal unhealthy project posture. The records
are local-only and do not call Edge, discover projects, publish mesh state, or
claim authority.
