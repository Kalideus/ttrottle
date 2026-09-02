import { useState, useEffect, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  // ponytail: recovery mode is just a boolean; Supabase fires PASSWORD_RECOVERY
  // after the browser client parses the reset link's URL hash.
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

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

  async function sendReset() {
    if (!email) return setMessage('Enter your email first');
    setMessage('Sending reset link...');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    setMessage(error ? String(error.message) : 'Check your email for the reset link');
  }

  async function setNewPassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage('Updating password...');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return setMessage(String(error.message));
    setMessage('Password updated');
    window.location.href = '/app';
  }

  if (recovering) {
    return (
      <div className="login-shell">
        <div className="login-card">
          <div className="login-header">
            <p className="kicker">TukTukRental</p>
            <h1 className="page-title" style={{ fontSize: '2rem' }}>Set a new password</h1>
          </div>
          <form onSubmit={setNewPassword} style={{ display: 'grid', gap: '16px' }}>
            <label className="form-group">
              <span className="field-label">New password</span>
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required minLength={6} className="text-field" />
            </label>
            <button type="submit" className="primary-button" style={{ width: '100%' }}>Update password</button>
          </form>
          {message && <p className="task-meta" style={{ marginTop: '16px' }}>{message}</p>}
        </div>
      </div>
    );
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

        <button type="button" onClick={sendReset} className="task-meta" style={{ marginTop: '12px', background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}>
          Forgot password?
        </button>

        {message && (
          <p className="task-meta" style={{ marginTop: '16px', color: message === 'Signed in' ? '#15803d' : '#b91c1c' }}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
