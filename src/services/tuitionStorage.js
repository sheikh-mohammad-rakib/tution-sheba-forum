const CACHE_KEY = 'tsf_tuitions_cache_v1';

// Saved listings older than this are treated as stale and no longer shown offline.
const MAX_CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Read the last successful tuition payload from localStorage.
 * Returns null when there is no usable snapshot.
 */
export function readTuitionCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.tuitions) || parsed.tuitions.length === 0) return null;
    if (!parsed?.savedAt) return null;

    const savedAt = new Date(parsed.savedAt);
    if (Number.isNaN(savedAt.getTime())) return null;
    if (Date.now() - savedAt.getTime() > MAX_CACHE_AGE_MS) return null;

    return { tuitions: parsed.tuitions, savedAt };
  } catch {
    // Private mode, quota errors, or corrupt JSON: behave as a cache miss.
    return null;
  }
}

/**
 * Persist the latest successful tuition payload so the dashboard still works
 * while the upstream data service is down.
 */
export function writeTuitionCache(tuitions) {
  if (!Array.isArray(tuitions) || tuitions.length === 0) return;
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ tuitions, savedAt: new Date().toISOString() })
    );
  } catch {
    // Ignore storage errors (quota exceeded / restricted environments).
  }
}

/**
 * Wipe the cached payload. Called on logout so listings never outlive a session.
 */
export function clearTuitionCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // Ignore storage errors.
  }
}
