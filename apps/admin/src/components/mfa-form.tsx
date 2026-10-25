'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Field } from '@ann/ui';
import { ShieldCheck } from 'lucide-react';
import { api } from '@/lib/client';
export function MfaForm() {
  const [factor, setFactor] = useState(''),
    [qr, setQr] = useState(''),
    [secret, setSecret] = useState(''),
    [code, setCode] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: ['mfa-factors'],
    queryFn: () =>
      api<{ factors: { id: string; friendly_name?: string }[] }>('/api/auth/mfa', {
        method: 'POST',
        body: JSON.stringify({ action: 'list' }),
      }),
  });
  return (
    <div className="center-page">
      <form
        className="panel"
        style={{ maxWidth: 460, width: '100%', textAlign: 'left' }}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            await api('/api/auth/mfa', {
              method: 'POST',
              body: JSON.stringify({
                action: 'verify',
                factor: factor || query.data?.factors[0]?.id,
                code,
              }),
            });
            window.location.assign(new URL('/dashboard', window.location.origin).toString());
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="panel-heading">
          <div>
            <ShieldCheck />
            <h1 style={{ fontSize: 23, marginTop: 14 }}>Secure your workspace</h1>
            <p>Administrators verify an authenticator code before accessing the catalog.</p>
          </div>
        </div>
        <div className="form-body">
          {(error || query.error) && (
            <div className="alert" role="alert">
              {error || query.error?.message}
            </div>
          )}
          {query.isPending ? (
            <p>Loading authenticators…</p>
          ) : query.data?.factors.length || factor ? (
            <>
              {qr && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    width={220}
                    height={220}
                    alt="Scan with your authenticator app"
                    src={qr}
                    style={{ margin: '0 auto', display: 'block' }}
                  />
                  <Field label="Manual setup key">
                    <code style={{ overflowWrap: 'anywhere' }}>{secret}</code>
                  </Field>
                </>
              )}
              {!factor && query.data?.factors && query.data.factors.length > 1 && (
                <Field label="Authenticator">
                  <select onChange={(e) => setFactor(e.target.value)}>
                    {query.data.factors.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.friendly_name ?? f.id}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label="Six-digit code">
                <input
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </Field>
              <Button disabled={busy} type="submit">
                {busy ? 'Verifying…' : 'Verify and continue'}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const result = await api<{ factor: string; qr: string; secret: string }>(
                    '/api/auth/mfa',
                    { method: 'POST', body: JSON.stringify({ action: 'enroll' }) },
                  );
                  setFactor(result.factor);
                  setQr(result.qr);
                  setSecret(result.secret);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Set up authenticator
            </Button>
          )}
          <small className="muted">
            Lost your authenticator? Contact another super administrator. Recovery requires an
            identity check through the workspace operator.
          </small>
        </div>
      </form>
    </div>
  );
}
