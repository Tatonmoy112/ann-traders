import { requireAdmin } from '@/lib/auth';
import { failure, json } from '@/lib/http';
import { integrationClient } from '@/lib/privileged';
import {
  R2Store,
  readR2Config,
  cleanupR2Media,
  purgeImageUrls,
  type CleanupPlan,
} from '@ann/storage';

type Job = {
  id: string;
  entity_id: string;
  event_type: string;
  revision: number;
  attempts: number;
  payload: { asset_id?: string; media_id?: string; provider?: string };
};

async function executeWorkerRun() {
  const privileged = integrationClient();

  // 1. Claim catalog jobs from outbox
  const { data: jobs, error: claimErr } = await privileged.rpc('claim_catalog_jobs', {
    batch_size: 10,
  });

  if (claimErr) throw claimErr;

  let completed = 0;
  let failed = 0;
  const jobResults: { id: string; type: string; success: boolean; error?: string }[] = [];

  for (const job of (jobs as unknown as Job[]) ?? []) {
    try {
      if (
        job.event_type === 'r2.cleanup' ||
        (job.event_type === 'image.retired' && job.payload?.provider === 'r2')
      ) {
        const media = job.payload?.media_id;
        if (!media) throw new Error('Missing media ID');
        const { data: plan, error: prepErr } = await privileged.rpc('r2_prepare_cleanup', {
          media,
        });
        if (prepErr) throw new Error('Cleanup is not authorized yet');

        const store = new R2Store(readR2Config(process.env));
        try {
          await cleanupR2Media(store, plan as CleanupPlan, (urls) =>
            purgeImageUrls(urls, process.env),
          );
        } finally {
          store.client.destroy();
        }
      } else if (job.event_type === 'image.detach') {
        const asset = job.payload?.asset_id;
        if (asset) {
          const { data: referenced } = await privileged.rpc('image_asset_referenced', {
            asset,
          });
          if (!referenced) {
            // Unreferenced asset acknowledged
          }
        }
      } else if (job.event_type.startsWith('catalog.')) {
        // Outbox event transition acknowledged
      }

      await privileged.rpc('complete_catalog_job', {
        job: job.id,
        attempt: job.attempts,
        success: true,
      });

      completed++;
      jobResults.push({ id: job.id, type: job.event_type, success: true });
    } catch (err) {
      failed++;
      const errorMsg = (err as Error).message || 'Job failed';
      await privileged.rpc('complete_catalog_job', {
        job: job.id,
        attempt: job.attempts,
        success: false,
        error_text: errorMsg,
      });
      jobResults.push({ id: job.id, type: job.event_type, success: false, error: errorMsg });
    }
  }

  // 2. Sweep orphan staging files in R2 (older than 60 minutes)
  let orphanStats = { scanned: 0, deleted: 0, freedBytes: 0, deletedKeys: [] as string[] };
  try {
    const store = new R2Store(readR2Config(process.env));
    try {
      orphanStats = await store.sweepOrphanStaging(60);
    } finally {
      store.client.destroy();
    }
  } catch (err) {
    console.error('Orphan staging sweep notice:', (err as Error).message);
  }

  return {
    timestamp: new Date().toISOString(),
    outbox: {
      claimed: (jobs as unknown as Job[])?.length ?? 0,
      completed,
      failed,
      jobs: jobResults,
    },
    orphanCleanup: orphanStats,
  };
}

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || process.env.CATALOG_WORKER_SECRET;
    const isSecretAuthorized = cronSecret && authHeader === `Bearer ${cronSecret}`;

    if (!isSecretAuthorized) {
      await requireAdmin(['super_admin', 'admin']);
    }

    const result = await executeWorkerRun();
    return json(result);
  } catch (e) {
    return failure(e);
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || process.env.CATALOG_WORKER_SECRET;
    const isSecretAuthorized = cronSecret && authHeader === `Bearer ${cronSecret}`;

    if (!isSecretAuthorized) {
      await requireAdmin(['super_admin', 'admin']);
    }

    const result = await executeWorkerRun();
    return json(result);
  } catch (e) {
    return failure(e);
  }
}

