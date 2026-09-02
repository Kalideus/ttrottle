// First initial + last initial from a name, e.g. "Tom Cornish" -> "TC".
// Falls back to the email local-part, then "?".
export function avatarInitials(name?: string | null, email?: string | null): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  if (email) return email.slice(0, 2).toUpperCase();
  return '?';
}

export const AVATAR_COLORS: string[] = [
  '#4573D2', // blue
  '#F06A6A', // coral
  '#A970D1', // purple
  '#4ECBC4', // teal
  '#E8A5C8', // pink
  '#F1BD6C', // amber
  '#5DA283', // green
  '#6D6E6F', // slate
];

export const DEFAULT_AVATAR_COLOR = AVATAR_COLORS[0];
