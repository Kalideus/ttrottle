// "@name" is a single word: first name plus last initial ("@TomC"), so two Toms
// don't get each other's mentions. A bare first name ("@Tom", and every mention
// written before the initial was added) still works, going to the first person with that name.
// ponytail: same first name and same last initial still clash; use the full surname if that ever happens

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? '';
}

export function handle(name: string): string {
  const parts = name.trim().split(/\s+/);
  const initial = parts.length > 1 ? parts[parts.length - 1][0] : '';
  // only a letter: "Tom (Marketing)" is "@Tom", not "@Tom("
  return parts[0] + (/[a-z]/i.test(initial) ? initial.toUpperCase() : '');
}

// Who an "@token" means, if anyone.
export function mentioned<T extends { name: string }>(token: string, users: T[]): T | undefined {
  const needle = token.slice(1).toLowerCase();
  return users.find((u) => handle(u.name).toLowerCase() === needle) ?? users.find((u) => firstName(u.name).toLowerCase() === needle);
}

export function extractMentions(body: string, users: { id: string; name: string }[]): string[] {
  const tokens = body.match(/@([a-zA-Z][\w'-]*)/g) ?? [];
  const ids = new Set<string>();
  for (const token of tokens) {
    const match = mentioned(token, users);
    if (match) ids.add(match.id);
  }
  return Array.from(ids);
}
