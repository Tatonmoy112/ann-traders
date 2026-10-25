import 'server-only';
import { R2Store, readR2Config, resolveMediaDelivery } from '@ann/storage';
import { HttpError } from './auth';
function r2Config() {
  try {
    return readR2Config(process.env);
  } catch {
    throw new HttpError(503, 'Image storage is not configured. Contact your administrator.');
  }
}
export function r2Store() {
  return new R2Store(r2Config());
}
export function mediaDelivery<
  T extends { provider?: string; delivery_url?: string | null; object_manifest?: unknown },
>(media: T): T {
  if (media.provider !== 'r2') return media;
  return resolveMediaDelivery(media, r2Config().publicOrigin);
}
