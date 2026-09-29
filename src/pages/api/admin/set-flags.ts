import type { NextApiRequest, NextApiResponse } from 'next';
import { requireSiteAdmin } from '../../../lib/adminAuth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireSiteAdmin(req);
  if ('error' in auth) return res.status(auth.status).json({ error: auth.error });

  const userId = String(req.body?.userId ?? '');
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  const updates: { is_super_admin?: boolean; can_create_projects?: boolean } = {};
  if (typeof req.body?.is_super_admin === 'boolean') updates.is_super_admin = req.body.is_super_admin;
  if (typeof req.body?.can_create_projects === 'boolean') updates.can_create_projects = req.body.can_create_projects;
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'Nothing to update' });

  // ponytail: simplest guard against locking everyone out, not a real
  // last-admin count -- if that ever matters, add one.
  if (userId === auth.callerId && updates.is_super_admin === false) {
    return res.status(400).json({ error: "You can't remove your own admin access. Ask another admin to do it." });
  }

  const { error } = await auth.admin.from('profiles').update(updates).eq('id', userId);
  if (error) return res.status(400).json({ error: error.message });
  return res.status(200).json({ ok: true });
}
