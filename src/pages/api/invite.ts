import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

// Proper invite: emails the person a join link (Supabase Auth invite), makes sure
// they have a profile row, and adds them to the project. Service-role only, so it
// must run here and not in the browser.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!url || !serviceKey) return res.status(500).json({ error: 'Invites are not configured on the server' });

  const token = (req.headers.authorization ?? '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not signed in' });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: caller } = await admin.auth.getUser(token);
  if (!caller.user) return res.status(401).json({ error: 'Not signed in' });

  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const projectId = String(req.body?.projectId ?? '');
  if (!email || !projectId) return res.status(400).json({ error: 'email and projectId are required' });

  // Caller must belong to the project they're inviting to (creators get an 'owner' row).
  const { data: membership } = await admin
    .from('project_members')
    .select('email')
    .eq('project_id', projectId)
    .eq('profile_id', caller.user.id)
    .maybeSingle();
  if (!membership) return res.status(403).json({ error: 'You are not a member of this project' });

  const origin = req.headers.origin ?? `https://${req.headers.host}`;

  // Invite the auth user, or find them if they already have an account.
  let invitedId: string | null = null;
  let emailSent = false;
  const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/app`,
  });
  if (invited?.user) {
    invitedId = invited.user.id;
    emailSent = true;
  } else {
    // ponytail: listUsers is one page of 50; fine for a small team, paginate if it grows.
    const { data: list } = await admin.auth.admin.listUsers();
    invitedId = list?.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
    if (!invitedId) return res.status(400).json({ error: inviteErr?.message ?? 'Could not invite that address' });
  }

  // A profile row is required for the app to work once they log in.
  await admin.from('profiles').upsert({ id: invitedId, email }, { onConflict: 'id' });

  const { error: memErr } = await admin.from('project_members').upsert(
    { project_id: projectId, email, profile_id: invitedId, invited_at: new Date().toISOString() },
    { onConflict: 'project_id,email' }
  );
  if (memErr) return res.status(400).json({ error: memErr.message });

  return res.status(200).json({ ok: true, emailSent });
}
