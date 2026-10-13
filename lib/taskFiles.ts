// Documents attached in descriptions and comments: PDF, Word and Excel. They live beside the photos
// (lib/taskPhotos.ts: same bucket, same folder per task, same access rules and clean-up); the bucket's
// size and type limits are in db/migrations/039_task_files.sql.
// In the text a file is [file:<its name>](task-photo:<task id>/<file id>.<ext>) -- a path in our own
// bucket, never a web address. No imports here, so the check file can run it under plain node.
export const ID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

// extension -> the content type it is stored (and allowed by the bucket) as
export const FILE_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};
export const FILE_ACCEPT = Object.keys(FILE_TYPES).map((ext) => `.${ext}`).join(',');
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export const FILE_PATTERN = `\\[file:[^\\]\\n]*\\]\\(task-photo:${ID}/${ID}\\.(?:${Object.keys(FILE_TYPES).join('|')})\\)`;

// "Report.PDF" -> "pdf"; null for anything that can't be attached
export function fileExt(name: string): string | null {
  const dot = name.lastIndexOf('.');
  const ext = dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
  return Object.hasOwn(FILE_TYPES, ext) ? ext : null;
}

// brackets and line breaks in a name would end the token early
export const fileToken = (name: string, path: string) => `[file:${name.replace(/[[\]\r\n]+/g, ' ').trim()}](task-photo:${path})`;

export const parseFileToken = (token: string) => ({
  name: token.slice(6, token.indexOf('](task-photo:')),
  path: token.slice(token.indexOf('](task-photo:') + 13, -1),
});

// What a notification shows in place of the file.
export const filesAsText = (text: string) => text.replace(new RegExp(FILE_PATTERN, 'g'), (token) => `[file: ${parseFileToken(token).name}]`);
