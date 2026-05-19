export const resolvabilityCategories = Object.freeze([
  'device_dependent_scaffold',
  'session_local_ref',
  'local_layer_resource_ref',
  'replicated_pointer_ref',
  'causal_reviewable_ref'
])

export function assertResolvabilityCategory(category) {
  if (!resolvabilityCategories.includes(category)) {
    throw new Error(`Invalid resolvability category: ${category}`)
  }

  return true
}

export function createScaffoldResolvabilityPosture({
  currentCategory = 'device_dependent_scaffold',
  targetCategory = 'local_layer_resource_ref',
  reason = 'Local JSON/path output is useful scaffold, not an operator-grade identity boundary.'
} = {}) {
  assertResolvabilityCategory(currentCategory)
  assertResolvabilityCategory(targetCategory)

  return {
    currentCategory,
    targetCategory,
    reason,
    localJsonIsScaffold: true,
    localPathIsScaffold: true,
    operatorFacingIdentityBoundary: false,
    spineDoctrineRef: '../mesh-ecology-spine/docs/heavy-json-exit-and-local-layer-resolvability.md'
  }
}
