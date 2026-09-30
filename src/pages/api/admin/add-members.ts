import type { NextApiRequest, NextApiResponse } from 'next';
import { requireSiteAdmin } from '../../../lib/adminAuth';

const ROLES = ['owner', 'admin', 'member'];

// Adds an existing user to several projects at once -- no invite email/link,
// they just see the projects next time they load the app.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireSiteAdmin(req);
  if ('error' in auth) return res.status(auth.status).json({ error: auth.error });

  const userId = String(req.body?.userId ?? '');
  const role = String(req.body?.role ?? 'member');
  const projectIds: string[] = Array.isArray(req.body?.projectIds) ? req.body.projectIds.map(String) : [];
  if (!userId || projectIds.length === 0) return res.status(400).json({ error: 'userId and projectIds are required' });
  if (!ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' });

  const { data: profile } = await auth.admin.from('profiles').select('email').eq('id', userId).maybeSingle();
  if (!profile?.email) return res.status(404).json({ error: 'No such user' });

  // Private projects are one-person only (see migration 016).
  const { data: privateRows } = await auth.admin.from('projects').select('id').in('id', projectIds).eq('is_private', true);
  if (privateRows?.length) return res.status(400).json({ error: "Private projects can't have other members" });

  const now = new Date().toISOString();
  const { error } = await auth.admin.from('project_members').upsert(
    projectIds.map((project_id) => ({
      project_id,
      profile_id: userId,
      email: profile.email.toLowerCase(),
      role,
      invited_at: now,
      joined_at: now,
    })),
    // already a member of one of them: leave that membership (and its role) alone
    { onConflict: 'project_id,email', ignoreDuplicates: true }
  );
  if (error) return res.status(400).json({ error: error.message });

  return res.status(200).json({ ok: true });
}
