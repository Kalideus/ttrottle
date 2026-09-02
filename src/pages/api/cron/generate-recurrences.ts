import type { NextApiRequest, NextApiResponse } from 'next';
import { runRecurrenceGeneration } from '../../../lib/recurrence';

const cronSecret = process.env.CRON_SECRET ?? 'dev-cron-secret';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method not allowed.' });
  }

  const secret = req.headers['x-cron-secret'];
  if (!secret || String(secret) !== cronSecret) {
    return res.status(401).json({ ok: false, message: 'Unauthorized.' });
  }

  try {
    const result = await runRecurrenceGeneration();
    return res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Recurrence generation failed.';
    return res.status(500).json({ ok: false, message });
  }
}
