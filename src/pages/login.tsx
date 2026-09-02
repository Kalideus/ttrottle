import { useState, useEffect, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';

// Captured before the Supabase client parses and clears the URL hash. Invite and
// recovery links both drop the user here needing to choose a password.
const ARRIVED_TO_SET_PASSWORD =
  typeof window !== 'undefined' &&
  /[#?&]type=(invite|recovery)\b/.test(window.location.hash + window.location.search);

const supabase = createClient();

const SUCCESS_MESSAGES = ['Signed in', 'Password updated', 'Check your email for the reset link'];
const PROGRESS_MESSAGES = ['Signing in...', 'Sending reset link...', 'Updating password...'];

function messageClass(message: string) {
  if (SUCCESS_MESSAGES.includes(message)) return 'login-message is-success';
  if (PROGRESS_MESSAGES.includes(message)) return 'login-message';
  return 'login-message is-error';
}

function Brand() {
  return (
    <div className="login-brand">
      <div className="login-brand-mark">τ</div>
      <span className="login-brand-word">TukTuk</span>
    </div>
  );
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  // "Set a password" mode: entered from an invite/recovery link. The hash check
  // catches invites; the PASSWORD_RECOVERY event is the backup for reset links.
  const [recovering, setRecovering] = useState(ARRIVED_TO_SET_PASSWORD);

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
          <Brand />
          <div className="login-header">
            <h1 className="login-title">Set your password</h1>
            <p className="login-subtitle">Choose a password so you can sign in from now on.</p>
          </div>
          <form onSubmit={setNewPassword} className="login-form">
            <label className="form-group">
              <span className="field-label">New password</span>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
                minLength={6}
                className="text-field"
              />
            </label>
            <button type="submit" className="login-submit">Update password</button>
          </form>
          {message && <p className={messageClass(message)}>{message}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <Brand />
        <div className="login-header">
          <h1 className="login-title">Welcome back</h1>
          <p className="login-subtitle">Sign in to continue managing your work.</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <label className="form-group">
            <span className="field-label">Email</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required className="text-field" />
          </label>

          <label className="form-group">
            <span className="field-label">Password</span>
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required className="text-field" />
          </label>

          <button type="submit" className="login-submit">Sign in</button>
        </form>

        <button type="button" onClick={sendReset} className="login-link">
          Forgot password?
        </button>

        {message && <p className={messageClass(message)}>{message}</p>}
      </div>
    </div>
  );
}
