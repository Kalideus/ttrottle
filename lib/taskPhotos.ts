import { createClient } from '@/lib/supabase/client';
import { ID, FILE_PATTERN, FILE_TYPES, MAX_FILE_BYTES, fileExt, fileToken, filesAsText } from './taskFiles';

// Photos in descriptions and comments (bucket + access rules: db/migrations/032_task_photos.sql).
// In the text a photo is ![photo](task-photo:<task id>/<file id>.jpg) -- a path in our own
// bucket, never a web address, so nobody can embed an image from somewhere else.
const BUCKET = 'task-photos';
const MAX_SIDE = 800;
export const PHOTO_PATTERN = `!\\[[^\\]\\n]*\\]\\(task-photo:${ID}/${ID}\\.jpg\\)`;
// a photo or an attached document (lib/taskFiles.ts): anything in the text that points into a task's folder
export const ATTACHMENT_PATTERN = `(?:${PHOTO_PATTERN}|${FILE_PATTERN})`;

export const photoPath = (token: string) => token.slice(token.indexOf('task-photo:') + 11, -1);

// What a notification shows in place of the photo (or the attached file).
export const photosAsText = (text: string) => filesAsText(text.replace(new RegExp(PHOTO_PATTERN, 'g'), '[photo]'));

// Shrinks a picked image so its longest side is at most MAX_SIDE, as a JPEG.
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff'; // a see-through PNG would otherwise turn black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not read that image'))), 'image/jpeg', 0.85)
  );
}

// Uploads a photo into the task's folder and returns the text to put in the description/comment.
export async function uploadTaskPhoto(taskId: string, file: File): Promise<string> {
  const path = `${taskId}/${crypto.randomUUID()}.jpg`;
  const { error } = await createClient().storage.from(BUCKET).upload(path, await shrink(file), { contentType: 'image/jpeg' });
  if (error) throw new Error(error.message);
  return `![photo](task-photo:${path})`;
}

// Uploads a PDF, Word or Excel file as it is into the task's folder and returns the text to put in.
export async function uploadTaskFile(taskId: string, file: File): Promise<string> {
  const ext = fileExt(file.name);
  if (!ext) throw new Error('only PDF, Word and Excel files can be attached');
  if (file.size > MAX_FILE_BYTES) throw new Error(`it is over the ${MAX_FILE_BYTES / 1024 / 1024} MB limit`);
  const path = `${taskId}/${crypto.randomUUID()}.${ext}`;
  // the type comes from the extension: Windows often hands over an empty or generic one
  const { error } = await createClient().storage.from(BUCKET).upload(path, file, { contentType: FILE_TYPES[ext] });
  if (error) throw new Error(error.message);
  return fileToken(file.name, path);
}

// Signed links last an hour; one is reused for 50 minutes so re-renders don't re-sign (or re-download).
// downloadAs: the link saves the file under that name instead of opening it (a stored file is named by its id).
const links = new Map<string, { at: number; url: Promise<string> }>();
export function taskPhotoUrl(path: string, downloadAs?: string): Promise<string> {
  const hit = links.get(path);
  if (hit && Date.now() - hit.at < 50 * 60_000) return hit.url;
  const url = createClient()
    .storage.from(BUCKET)
    .createSignedUrl(path, 3600, downloadAs ? { download: downloadAs } : undefined)
    .then(({ data, error }) => {
      if (error || !data) throw new Error(error?.message ?? 'No link');
      return data.signedUrl;
    });
  url.catch(() => links.delete(path));
  links.set(path, { at: Date.now(), url });
  return url;
}
