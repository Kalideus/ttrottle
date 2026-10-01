// Background saves for optimistic UI. Writes run one at a time in the order they were added, so a create
// always lands before an edit of the same row. A failed write goes to onError and the queue carries on.
// When the last pending write settles, onDrain gets every key the writes were tagged with (what to reload).
export function createSaveQueue<K>(onDrain: (keys: K[]) => void, onError: (e: unknown) => void) {
  let tail: Promise<void> = Promise.resolve();
  let pending = 0;
  const dirty = new Set<K>();

  return {
    get pending() {
      return pending;
    },
    add(write: () => Promise<unknown>, keys: K[] = []) {
      pending++;
      keys.forEach((k) => dirty.add(k));
      tail = tail
        .then(async () => void (await write()))
        .catch(onError)
        .finally(() => {
          if (--pending > 0) return;
          const drained = [...dirty];
          dirty.clear();
          onDrain(drained);
        });
      return tail;
    },
  };
}
