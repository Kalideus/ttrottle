import type { NextApiRequest, NextApiResponse } from 'next';
import { requireSiteAdmin } from '../../../lib/adminAuth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireSiteAdmin(req);
  if ('error' in auth) return res.status(auth.status).json({ error: auth.error });

  const projectId = String(req.body?.projectId ?? '');
  const action = String(req.body?.action ?? '');
  if (!projectId || !['archive', 'unarchive', 'delete'].includes(action)) {
    return res.status(400).json({ error: 'projectId and a valid action are required' });
  }

  const { error } =
    action === 'delete'
      ? await auth.admin.from('projects').delete().eq('id', projectId)
      : await auth.admin.from('projects').update({ archived: action === 'archive' }).eq('id', projectId);

  if (error) return res.status(400).json({ error: error.message });
  return res.status(200).json({ ok: true });
}
