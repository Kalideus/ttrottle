import type { NextApiRequest, NextApiResponse } from 'next';
import { requireSiteAdmin } from '../../../lib/adminAuth';
import { avatarInitials } from '@/lib/avatar';

// Lets a super admin fix someone's display name (and the initials derived from it).
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireSiteAdmin(req);
  if ('error' in auth) return res.status(auth.status).json({ error: auth.error });

  const userId = String(req.body?.userId ?? '');
  const name = String(req.body?.name ?? '').trim().replace(/\s+/g, ' ');
  if (!userId || !name) return res.status(400).json({ error: 'userId and name are required' });
  if (name.length > 80) return res.status(400).json({ error: 'Name is too long' });

  const { error } = await auth.admin
    .from('profiles')
    .update({ name, initials: avatarInitials(name) })
    .eq('id', userId);
  if (error) return res.status(400).json({ error: error.message });
  return res.status(200).json({ ok: true });
}
