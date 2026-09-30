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
  const sendEmail = req.body?.sendEmail !== false;
  if (!email || !projectId) return res.status(400).json({ error: 'email and projectId are required' });

  // Caller must be the project's owner or a manager ('admin' role) of it, or a
  // site super admin (who can invite to any project from /admin/team).
  const [{ data: membership }, { data: callerProfile }] = await Promise.all([
    admin.from('project_members').select('role').eq('project_id', projectId).eq('profile_id', caller.user.id).maybeSingle(),
    admin.from('profiles').select('is_super_admin').eq('id', caller.user.id).maybeSingle(),
  ]);
  const isManager = !!membership && ['owner', 'admin'].includes(membership.role);
  if (!isManager && !callerProfile?.is_super_admin) {
    return res.status(403).json({ error: "Only this project's owner or managers can invite people to it" });
  }

  const { data: project } = await admin.from('projects').select('is_private').eq('id', projectId).maybeSingle();
  if (project?.is_private) return res.status(403).json({ error: 'Private projects cannot be shared' });

  const origin = req.headers.origin ?? `https://${req.headers.host}`;

  // Invite the auth user, or find them if they already have an account.
  let invitedId: string | null = null;
  let emailSent = false;
  let link: string | undefined;
  // Land on /login so they're forced to set a password before entering the app.
  const redirectTo = `${origin}/login`;

  if (sendEmail) {
    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
    if (invited?.user) {
      invitedId = invited.user.id;
      emailSent = true;
    } else {
      // ponytail: listUsers is one page of 50; fine for a small team, paginate if it grows.
      const { data: list } = await admin.auth.admin.listUsers();
      invitedId = list?.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
      if (!invitedId) return res.status(400).json({ error: inviteErr?.message ?? 'Could not invite that address' });
    }
  } else {
    // No email -- hand back a link the caller can send themselves (Slack, text,
    // whatever). `invite` type creates the account; falls back to `recovery` if
    // they already have one (e.g. re-sharing a link for someone who never
    // finished setting a password).
    //
    // generateLink()'s own action_link points at Supabase's /auth/v1/verify,
    // which consumes the one-time token on ANY GET -- not just an email
    // scanner, also e.g. Slack's link-unfurl bot fetching it to build a
    // preview the moment it's pasted into a message, before the real person
    // ever clicks. So we build our own link straight to /login with the raw
    // token_hash instead; login.tsx redeems it itself via verifyOtp() from
    // React, which a bot fetching the page's HTML never triggers.
    const { data: gen, error: genErr } = await admin.auth.admin.generateLink({ type: 'invite', email, options: { redirectTo } });
    if (gen?.user) {
      invitedId = gen.user.id;
      link = `${origin}/login?token_hash=${gen.properties?.hashed_token}&type=invite`;
    } else {
      const { data: recGen, error: recErr } = await admin.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo } });
      if (!recGen?.user) return res.status(400).json({ error: recErr?.message ?? genErr?.message ?? 'Could not generate a link' });
      invitedId = recGen.user.id;
      link = `${origin}/login?token_hash=${recGen.properties?.hashed_token}&type=recovery`;
    }
  }

  // A profile row is required for the app to work once they log in. The
  // on-signup trigger normally creates it; this covers the case where it isn't
  // there. name/initials are NOT NULL, so derive them from the address.
  const local = email.split('@')[0];
  await admin.from('profiles').upsert(
    { id: invitedId, email, name: local, initials: local.slice(0, 2).toUpperCase() },
    { onConflict: 'id', ignoreDuplicates: true }
  );

  const { error: memErr } = await admin.from('project_members').upsert(
    { project_id: projectId, email, profile_id: invitedId, invited_at: new Date().toISOString() },
    { onConflict: 'project_id,email' }
  );
  if (memErr) return res.status(400).json({ error: memErr.message });

  return res.status(200).json({ ok: true, emailSent, link });
}
