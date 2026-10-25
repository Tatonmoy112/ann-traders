'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, LockKeyhole } from 'lucide-react';
import { Button, Field } from '@ann/ui';
import { api } from '@/lib/client';
export function AuthForm({ mode = 'login' }: { mode?: 'login' | 'forgot' | 'reset' }) {
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [done, setDone] = useState(false);
  return (
    <div className="auth-page">
      <div className="auth-brand-panel">
        <div className="brand">
          <span className="monogram">
            A<span>n</span>
          </span>
          <div>
            ANN TRADERS<small>TEXTILE & INDUSTRIAL SUPPLY</small>
          </div>
        </div>
        <div className="auth-pitch">
          <span className="eyebrow">YOUR CATALOG, CONNECTED.</span>
          <h1>
            Every detail.
            <br />
            One workspace.
          </h1>
          <p>
            A considered space to manage your products, technical specifications, and the catalog
            your customers see.
          </p>
          <div className="auth-lines" />
        </div>
        <small>Designed for the way your business works.</small>
      </div>
      <div className="auth-form-wrap">
        <form
          className="auth-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            try {
              await api('/api/auth', {
                method: 'POST',
                body: JSON.stringify({
                  action: mode,
                  email,
                  password: mode === 'forgot' ? undefined : password,
                }),
              });
              if (mode === 'login')
                window.location.assign(new URL('/dashboard', window.location.origin).toString());
              else setDone(true);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="auth-lock">
            <LockKeyhole size={23} />
          </div>
          <span className="eyebrow">ADMINISTRATOR ACCESS</span>
          <h1>
            {mode === 'login'
              ? 'Welcome back.'
              : mode === 'forgot'
                ? 'Reset your password.'
                : 'Choose a new password.'}
          </h1>
          <p className="muted">
            {mode === 'login'
              ? 'Sign in to your ANN Traders workspace.'
              : mode === 'forgot'
                ? 'We’ll email a reset link if the address is registered.'
                : 'Use at least 12 characters for your new password.'}
          </p>
          {error && (
            <div role="alert" className="alert">
              {error}
            </div>
          )}
          {done ? (
            <div className="success">
              {mode === 'forgot'
                ? 'Check your inbox for a password reset link.'
                : 'Your password has been updated.'}
              <Link href="/login">Return to sign in</Link>
            </div>
          ) : (
            <>
              {mode !== 'reset' && (
                <Field label="Email address">
                  <input
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    required
                  />
                </Field>
              )}
              {mode !== 'forgot' && (
                <Field label={mode === 'reset' ? 'New password' : 'Password'}>
                  <input
                    type="password"
                    autoComplete={mode === 'reset' ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={12}
                    required
                    placeholder="Enter your password"
                  />
                </Field>
              )}
              {mode === 'login' && (
                <Link href="/forgot-password" className="forgot-link">
                  Forgot password?
                </Link>
              )}
              <Button disabled={busy} type="submit">
                {busy
                  ? 'Please wait…'
                  : mode === 'login'
                    ? 'Sign in to workspace'
                    : mode === 'forgot'
                      ? 'Send reset link'
                      : 'Update password'}
                <ArrowRight size={16} />
              </Button>
            </>
          )}
          <div className="auth-invite">
            Invitation-only access. Contact your administrator if you need an account.
          </div>
        </form>
        <small className="muted">
          © {new Date().getFullYear()} ANN Traders. All rights reserved.
        </small>
      </div>
    </div>
  );
}
