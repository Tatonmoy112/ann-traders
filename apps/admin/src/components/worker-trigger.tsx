'use client';
import { useState } from 'react';
import { RefreshCw, CheckCircle2, AlertCircle, HardDrive } from 'lucide-react';
import { Button } from '@ann/ui';
import { api } from '@/lib/client';

type WorkerResult = {
  timestamp: string;
  outbox: {
    claimed: number;
    completed: number;
    failed: number;
    jobs: { id: string; type: string; success: boolean; error?: string }[];
  };
  orphanCleanup: {
    scanned: number;
    deleted: number;
    freedBytes: number;
  };
};

export function WorkerTrigger() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<WorkerResult | null>(null);
  const [error, setError] = useState('');

  const runWorker = async () => {
    setRunning(true);
    setError('');
    try {
      const data = await api<WorkerResult>('/api/cron/catalog-worker', {
        method: 'POST',
      });
      setResult(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div
      style={{
        marginTop: 14,
        padding: '12px 14px',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <HardDrive size={16} style={{ color: '#2563eb' }} />
          <strong style={{ fontSize: '0.82rem', color: '#1e293b' }}>
            Background Worker & Storage
          </strong>
        </div>
        <Button
          variant="outline"
          disabled={running}
          style={{ minHeight: 28, fontSize: '0.75rem', padding: '2px 8px' }}
          onClick={runWorker}
        >
          <RefreshCw size={12} className={running ? 'animate-spin' : ''} />
          {running ? 'Running…' : 'Run Cleanup'}
        </Button>
      </div>

      {error && (
        <div
          style={{
            fontSize: '0.75rem',
            color: '#dc2626',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <AlertCircle size={13} /> {error}
        </div>
      )}

      {result && (
        <div
          style={{
            fontSize: '0.75rem',
            color: '#166534',
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            padding: '6px 8px',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <CheckCircle2 size={13} />
          <span>
            Outbox: {result.outbox.completed} jobs processed · Swept {result.orphanCleanup.deleted}{' '}
            orphans ({result.orphanCleanup.scanned} scanned)
          </span>
        </div>
      )}
    </div>
  );
}

