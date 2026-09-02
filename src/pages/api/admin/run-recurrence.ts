import type { NextApiRequest, NextApiResponse } from 'next';
import { runRecurrenceGeneration } from '../../../lib/recurrence';

const defaultCronSecret = process.env.CRON_SECRET ?? 'dev-cron-secret';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method not allowed.' });
  }

  if (process.env.NODE_ENV === 'production') {
    const providedSecret = req.headers['x-admin-secret'];
    if (!providedSecret || String(providedSecret) !== defaultCronSecret) {
      return res.status(401).json({ ok: false, message: 'Unauthorized.' });
    }
  }

  try {
    const result = await runRecurrenceGeneration();
    return res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Recurrence generation failed.';
    return res.status(500).json({ ok: false, message });
  }
}
