import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

// A password-reset link for one person, to send them by hand (emails don't go out yet). Opening it signs
// that person in, so: a super admin can make one for anyone; someone given "can send reset links"
// (migration 046) only for people who share a project with them, and never for a super admin.
// Same /login?token_hash= link as an invite, so a chat app's link preview can't use it up before they click.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!url || !serviceKey) return res.status(500).json({ error: 'Admin routes are not configured on the server.' });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const token = (req.headers.authorization ?? '').replace('Bearer ', '');
  const { data: caller } = token ? await admin.auth.getUser(token) : { data: { user: null } };
  if (!caller.user) return res.status(401).json({ error: 'Not signed in.' });

  const userId = String(req.body?.userId ?? '');
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  const { data: rows } = await admin.from('profiles').select('id, is_super_admin, can_reset_passwords').in('id', [caller.user.id, userId]);
  const me = rows?.find((r) => r.id === caller.user.id);
  const them = rows?.find((r) => r.id === userId);
  if (!me?.is_super_admin) {
    if (!me?.can_reset_passwords) return res.status(403).json({ error: 'You can’t send reset links.' });
    if (them?.is_super_admin) return res.status(403).json({ error: 'Only a super admin can send a super admin a reset link.' });
    const { data: mine } = await admin.from('project_members').select('project_id').eq('profile_id', caller.user.id);
    const { data: shared } = await admin
      .from('project_members')
      .select('project_id')
      .eq('profile_id', userId)
      .in('project_id', (mine ?? []).map((m) => m.project_id))
      .limit(1);
    if (!shared?.length) return res.status(403).json({ error: 'You can only send reset links to people in your projects.' });
  }

  const { data: found } = await admin.auth.admin.getUserById(userId);
  const email = found?.user?.email;
  if (!email) return res.status(404).json({ error: 'No account for that person' });

  const origin = req.headers.origin ?? `https://${req.headers.host}`;
  const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo: `${origin}/login` } });
  if (error || !data.properties?.hashed_token) return res.status(400).json({ error: error?.message ?? 'Could not make a link' });

  return res.status(200).json({ link: `${origin}/login?token_hash=${data.properties.hashed_token}&type=recovery` });
}
