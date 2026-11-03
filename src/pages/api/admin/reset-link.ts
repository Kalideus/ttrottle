import type { NextApiRequest, NextApiResponse } from 'next';
import { requireSiteAdmin } from '../../../lib/adminAuth';

// A password-reset link for one person, for a super admin to send them by hand (emails don't go out yet).
// Opening it signs that person in, which is why only a super admin can make one: /api/invite won't for an
// account that has been used. Same /login?token_hash= link as an invite, so a chat app's link preview
// can't use it up before they click.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireSiteAdmin(req);
  if ('error' in auth) return res.status(auth.status).json({ error: auth.error });

  const userId = String(req.body?.userId ?? '');
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  const { data: found } = await auth.admin.auth.admin.getUserById(userId);
  const email = found?.user?.email;
  if (!email) return res.status(404).json({ error: 'No account for that person' });

  const origin = req.headers.origin ?? `https://${req.headers.host}`;
  const { data, error } = await auth.admin.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo: `${origin}/login` } });
  if (error || !data.properties?.hashed_token) return res.status(400).json({ error: error?.message ?? 'Could not make a link' });

  return res.status(200).json({ link: `${origin}/login?token_hash=${data.properties.hashed_token}&type=recovery` });
}
