'use client';
import { useState } from 'react';
import { evaluationAuth } from '@/lib/evaluation';

export function EvaluationLogin() {
  const [mode, setMode] = useState<'login' | 'signup' | 'reset' | 'link'>('login');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [username, setUsername] = useState(''); const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(''); const [error, setError] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const auth = evaluationAuth()!;
      const redirectTo = `${location.origin}/evaluate/`;
      const result = mode === 'signup' ? await auth.auth.signUp({ email, password, options: { data: { username }, emailRedirectTo: redirectTo } })
        : mode === 'reset' ? await auth.auth.resetPasswordForEmail(email, { redirectTo })
        : mode === 'link' ? await auth.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } })
        : await auth.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      setPassword('');
      if (mode !== 'login') setMessage(mode === 'signup' ? 'Check your email to confirm your account, then log in to request workspace access.' : 'Check your email for the link.');
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <section className="evaluation-login">
    <p className="eval-kicker">Your workspace</p><h2>{mode === 'signup' ? 'Create an account' : mode === 'reset' ? 'Reset your password' : 'Welcome back'}</h2>
    <p>Keep your evaluations together. Publish results when you’re ready.</p>
    <form className="evaluation-form" onSubmit={submit}>
      {mode === 'signup' && <label>Username<input required minLength={2} maxLength={40} pattern="[a-zA-Z0-9_.-]+" autoComplete="nickname" value={username} onChange={e => setUsername(e.target.value)} /><small>A display name. Use your email to log in.</small></label>}
      <label>Email<input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
      {(mode === 'login' || mode === 'signup') && <label>Password<input required type="password" minLength={mode === 'signup' ? 12 : 1} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} /></label>}
      {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
      <button className="button-primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send reset link' : mode === 'link' ? 'Email sign-in link' : 'Log in'}</button>
    </form>
    <div className="eval-actions">{mode !== 'login' && <button onClick={() => setMode('login')}>Log in</button>}{mode !== 'signup' && <button onClick={() => setMode('signup')}>Create account</button>}{mode !== 'reset' && <button onClick={() => setMode('reset')}>Forgot password?</button>}{mode !== 'link' && <button onClick={() => setMode('link')}>Use an email link</button>}</div>
  </section>;
}
