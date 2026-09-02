import { useState } from 'react';
import Protected from '../../components/Protected';

export default function RecurrenceAdminPage() {
  const [result, setResult] = useState<null | { businessToday: string; generated: string[]; leadDays: number; note: string }>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/run-recurrence', { method: 'POST' });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.message ?? 'Recurrence run failed.');
      }

      setResult({
        businessToday: payload.businessToday,
        generated: payload.generated,
        leadDays: payload.leadDays,
        note: payload.note,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Recurrence run failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Protected>
      <div className="mx-auto max-w-4xl px-6 py-8">
        <header className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Admin</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Recurrence</h1>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Manual run</h2>
              <p className="mt-1 text-sm text-slate-600">Generates the next due dates using the schedule-driven recurrence engine.</p>
            </div>
            <button
              type="button"
              onClick={handleRun}
              disabled={loading}
              className="rounded-lg bg-sky-600 px-4 py-2.5 font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Running…' : 'Run now'}
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {result && (
            <div className="mt-6 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-600">Business date: <span className="font-semibold text-slate-900">{result.businessToday}</span></p>
              <p className="text-sm text-slate-600">Lead days: <span className="font-semibold text-slate-900">{result.leadDays}</span></p>
              <p className="text-sm text-slate-600">Generated: <span className="font-semibold text-slate-900">{result.generated.join(', ') || 'None'}</span></p>
              <p className="text-sm text-slate-600">{result.note}</p>
            </div>
          )}
        </section>
      </div>
    </Protected>
  );
}
