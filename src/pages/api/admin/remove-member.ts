import type { NextApiRequest, NextApiResponse } from 'next';
import { requireSiteAdmin } from '../../../lib/adminAuth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireSiteAdmin(req);
  if ('error' in auth) return res.status(auth.status).json({ error: auth.error });

  const projectId = String(req.body?.projectId ?? '');
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  if (!projectId || !email) return res.status(400).json({ error: 'projectId and email are required' });

  const { error } = await auth.admin.from('project_members').delete().eq('project_id', projectId).eq('email', email);
  if (error) return res.status(400).json({ error: error.message });
  return res.status(200).json({ ok: true });
}
