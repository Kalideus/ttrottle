import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabaseClient';

const cronSecret = process.env.CRON_SECRET;
const RETENTION_DAYS = 90;

// Hard-deletes tasks that were soft-deleted more than 90 days ago. See
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
  const { data, error } = await supabaseAdmin
    .from('tasks')
    .delete()
    .not('deleted_at', 'is', null)
    .lt('deleted_at', cutoff)
    .select('id');

  if (error) return res.status(500).json({ ok: false, message: error.message });
  return res.status(200).json({ ok: true, purged: data?.length ?? 0, cutoff });
}
