// Ticked filters, grouped by kind: a task must match one filter of every kind.
// So the same kind widens (High or Medium) and different kinds narrow (High and Overdue).
export function filterKinds<F extends string>(filters: F[]): F[][] {
  const kindOf = (f: string) =>
    f.startsWith('priority:') ? 'priority' : f.startsWith('tag:') ? 'tag' : f.startsWith('created') ? 'created' : f.startsWith('completed') ? 'completed' : 'due';
  const kinds = new Map<string, F[]>();
  for (const f of filters) kinds.set(kindOf(f), [...(kinds.get(kindOf(f)) ?? []), f]);
  return [...kinds.values()];
}
