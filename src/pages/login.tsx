import { useState, useEffect, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';

// Captured before the Supabase client parses and clears the URL hash. Invite and
// recovery links both drop the user here needing to choose a password.
const ARRIVED_TO_SET_PASSWORD =
  typeof window !== 'undefined' &&
  /[#?&]type=(invite|recovery)\b/.test(window.location.hash + window.location.search);

const supabase = createClient();

// Reads token_hash/type off either the query string or the hash fragment --
// Supabase's default invite/recovery link goes to /auth/v1/verify first
// (consumed by any GET, including corporate email link-scanners) and only
// then redirects here with tokens in the hash. Once the email template is
// updated to link straight here with ?token_hash=...&type=..., we redeem it
// ourselves via verifyOtp so a scanner's plain fetch can't burn the link --
// it doesn't run our JS. Both formats are handled so this works either way.
function getInviteParams() {
  if (typeof window === 'undefined') return null;
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const token_hash = search.get('token_hash') ?? hash.get('token_hash');
  const type = search.get('type') ?? hash.get('type');
  if (!token_hash || (type !== 'invite' && type !== 'recovery')) return null;
  return { token_hash, type: type as 'invite' | 'recovery' };
}

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
      <div className="login-brand-mark">
        <img src="/logo.svg" alt="" />
      </div>
      <span className="login-brand-word brand-word">ttrottle</span>
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
  // Only meaningful while recovering: whether we actually have a usable session
  // to set a password against, so a dead/reused link fails clearly up front
  // instead of on submit.
  const [linkStatus, setLinkStatus] = useState<'checking' | 'ready' | 'invalid'>('checking');

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!recovering) return;
    let cancelled = false;

    async function establishSession() {
      const invite = getInviteParams();
      const { data, error } = invite
        ? await supabase.auth.verifyOtp(invite)
        : await supabase.auth.getSession();

      if (cancelled) return;
      const hasSession = invite ? !error && !!data.session : !!data.session;
      setLinkStatus(hasSession ? 'ready' : 'invalid');
    }

    establishSession();
    return () => {
      cancelled = true;
    };
  }, [recovering]);

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
          {linkStatus === 'invalid' ? (
            <>
              <p className="login-message is-error">
                This link has expired or was already used (links only work once). Enter your email
                and we&rsquo;ll send you a fresh one.
              </p>
              <form
                className="login-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void sendReset();
                }}
              >
                <label className="form-group">
                  <span className="field-label">Your email</span>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    required
                    autoComplete="email"
                    className="text-field"
                  />
                </label>
                <button type="submit" className="login-submit" disabled={message === 'Sending reset link...'}>
                  Email me a new link
                </button>
              </form>
              <p className="login-subtitle" style={{ marginTop: 12 }}>
                No email arriving? Ask whoever invited you to copy you a new link.
              </p>
            </>
          ) : (
            <form onSubmit={setNewPassword} className="login-form">
              <label className="form-group">
                <span className="field-label">New password</span>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  required
                  minLength={6}
                  disabled={linkStatus === 'checking'}
                  className="text-field"
                />
              </label>
              <button type="submit" className="login-submit" disabled={linkStatus === 'checking'}>
                {linkStatus === 'checking' ? 'Checking link...' : 'Update password'}
              </button>
            </form>
          )}
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
