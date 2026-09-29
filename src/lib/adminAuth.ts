import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { NextApiRequest } from 'next';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

type AdminAuthResult =
  | { error: string; status: number }
  | { admin: SupabaseClient; callerId: string };

// Shared by every /api/admin/* route: verifies the request's bearer token
// belongs to a signed-in, is_super_admin user, and hands back a service-role
// client to act with. Site-wide admin, separate from per-project owner/admin
// -- see db/migrations/013/014.
export async function requireSiteAdmin(req: NextApiRequest): Promise<AdminAuthResult> {
  if (!url || !serviceKey) return { error: 'Admin routes are not configured on the server.', status: 500 };

  const token = (req.headers.authorization ?? '').replace('Bearer ', '');
  if (!token) return { error: 'Not signed in.', status: 401 };

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: caller } = await admin.auth.getUser(token);
  if (!caller.user) return { error: 'Not signed in.', status: 401 };

  const { data: profile } = await admin.from('profiles').select('is_super_admin').eq('id', caller.user.id).maybeSingle();
  if (!profile?.is_super_admin) return { error: 'Admin access required.', status: 403 };

  return { admin, callerId: caller.user.id };
}
