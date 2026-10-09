import type { NextApiRequest, NextApiResponse } from 'next';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../../lib/supabaseClient';

const cronSecret = process.env.CRON_SECRET;
const RETENTION_DAYS = 90;
const COMPLETED_PHOTO_DAYS = 180;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Hard-deletes tasks that were soft-deleted more than 90 days ago, and the photos of
// those tasks and of tasks completed more than 180 days ago. See
// db/migrations/013_soft_delete_tasks.sql and /admin/deleted-tasks.
// Scheduled in vercel.json: Vercel Cron calls with GET and "Authorization: Bearer <CRON_SECRET>".
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method not allowed.' });
  }

  // no fallback secret: an unset CRON_SECRET must not leave a guessable one
  if (!cronSecret) {
    return res.status(500).json({ ok: false, message: 'CRON_SECRET is not configured.' });
  }

  if (req.headers.authorization !== `Bearer ${cronSecret}` && req.headers['x-cron-secret'] !== cronSecret) {
    return res.status(401).json({ ok: false, message: 'Unauthorized.' });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ ok: false, message: 'Supabase admin client not configured.' });
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // photos first, while the tasks are still there to say which folders are due
  let photosPurged: number;
  try {
    photosPurged = await purgePhotos(supabaseAdmin, cutoff);
  } catch (e) {
    return res.status(500).json({ ok: false, message: `Photo purge failed: ${(e as Error).message}` });
  }

  const { data, error } = await supabaseAdmin
    .from('tasks')
    .delete()
    .not('deleted_at', 'is', null)
    .lt('deleted_at', cutoff)
    .select('id');

  if (error) return res.status(500).json({ ok: false, message: error.message });
  return res.status(200).json({ ok: true, purged: data?.length ?? 0, photosPurged, cutoff });
}

// Removes the photos (db/migrations/032_task_photos.sql) of tasks deleted more than 90 days ago,
// tasks completed more than 180 days ago, and tasks that no longer exist. Each folder in the
// bucket is named after its task. Returns how many files went.
async function purgePhotos(db: SupabaseClient, deletedCutoff: string): Promise<number> {
  const bucket = db.storage.from('task-photos');
  const completedCutoff = new Date(Date.now() - COMPLETED_PHOTO_DAYS * 24 * 60 * 60 * 1000);

  const folders: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await bucket.list('', { limit: 1000, offset });
    if (error) throw error;
    folders.push(...data.map((f) => f.name).filter((n) => UUID.test(n)));
    if (data.length < 1000) break;
  }

  let removed = 0;
  // 100 at a time keeps the id list inside a URL
  for (let i = 0; i < folders.length; i += 100) {
    const ids = folders.slice(i, i + 100);
    const { data: tasks, error } = await db.from('tasks').select('id, deleted_at, completed, completed_at').in('id', ids);
    if (error) throw error; // never read a failed lookup as "these tasks are gone"
    const keep = new Set(
      tasks
        .filter((t) => !(t.deleted_at && new Date(t.deleted_at) < new Date(deletedCutoff)) && !(t.completed && t.completed_at && new Date(t.completed_at) < completedCutoff))
        .map((t) => t.id)
    );
    for (const id of ids.filter((x) => !keep.has(x))) {
      // ponytail: first 1000 photos per task per night; the rest go on the following nights
      const { data: files, error: listError } = await bucket.list(id, { limit: 1000 });
      if (listError) throw listError;
      if (!files.length) continue;
      const { error: removeError } = await bucket.remove(files.map((f) => `${id}/${f.name}`));
      if (removeError) throw removeError;
      removed += files.length;
    }
  }
  return removed;
}
