import { useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage('Signing in...');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage(String(error.message));
      } else {
        setMessage('Signed in');
        window.location.href = '/app';
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setMessage(errorMessage);
    }
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-header">
          <p className="kicker">TukTukRental</p>
          <h1 className="page-title" style={{ fontSize: '2rem' }}>Welcome back</h1>
          <p className="login-subtitle">Sign in to continue managing your work.</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '16px' }}>
          <label className="form-group">
            <span className="field-label">Email</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required className="text-field" />
          </label>

          <label className="form-group">
            <span className="field-label">Password</span>
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required className="text-field" />
          </label>

          <button type="submit" className="primary-button" style={{ width: '100%' }}>
            Sign in
          </button>
        </form>

        {message && (
          <p className="task-meta" style={{ marginTop: '16px', color: message === 'Signed in' ? '#15803d' : '#b91c1c' }}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
