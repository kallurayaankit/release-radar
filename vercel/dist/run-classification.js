const isFailure = outcome => outcome === 'failure' || outcome === 'error';
export function classify(before, after) {
  if (!after) return 'Missing in candidate';
  if (!before) return isFailure(after) ? 'Added with failure' : 'Added test';
  if (after === 'skipped' && before !== after) return 'Now skipped';
  if (isFailure(after)) return isFailure(before) ? 'Still failing' : 'New failure';
  if (isFailure(before) && after === 'passed') return 'Recovered';
  return before === after ? 'Unchanged' : 'Now passing';
}
