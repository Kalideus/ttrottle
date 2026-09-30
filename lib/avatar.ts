// First initial + last initial from a name, e.g. "Tom Cornish" -> "TC".
// Falls back to the email local-part, then "?".
export function avatarInitials(name?: string | null, email?: string | null): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  if (email) return email.slice(0, 2).toUpperCase();
  return '?';
}

// Keep in sync with the random default in db/migrations/019_random_avatar_color.sql.
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

// Background + text colour for an avatar circle: the photo if there is one
// (initials stay in the DOM for screen readers but go transparent), else the colour.
export function avatarStyle(url?: string | null, color?: string | null) {
  return url
    ? { background: `center / cover no-repeat url("${url}")`, color: 'transparent' }
    : { background: color || 'var(--accent)', color: 'white' };
}

// Center-crops and shrinks a picked image to a small square JPEG so avatars
// stay light no matter what size photo someone uploads.
export async function squareAvatarBlob(file: File, size = 256): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  canvas
    .getContext('2d')!
    .drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not read that image'))), 'image/jpeg', 0.85)
  );
}
