import { getOrUpdateLiveSnapshot } from "./getOrUpdateLiveSnapshot";

let cachedSnapshot = null;
let lastFetchedTime = 0;
const CACHE_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Returns a cached snapshot unless expired or forced.
 *
 * @param {string} uid - Firebase UID
 * @param {boolean} force - Force re-fetch
 * @returns {Promise<Object>} - Live snapshot
 */
export async function getCachedLiveSnapshot(uid, force = false) {
  const now = Date.now();
  const isExpired = now - lastFetchedTime > CACHE_DURATION_MS;

  if (cachedSnapshot && !isExpired && !force) {
    return cachedSnapshot;
  }

  const snapshot = await getOrUpdateLiveSnapshot(uid);
  cachedSnapshot = snapshot;
  lastFetchedTime = now;

  return snapshot;
}
