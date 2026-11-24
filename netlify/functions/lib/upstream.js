// Shared upstream client for the Tuition Seba backend.
//
// The primary host is configurable via UPSTREAM_API_BASE. Because the original
// Render service has been suspended, the Railway deployment is kept as a
// built-in fallback so the dashboard keeps working while the host moves.

const DEFAULT_UPSTREAM_BASE = 'https://tuition-seba-backend-production-49a7d084.up.railway.app';
const UPSTREAM_TIMEOUT_MS = 15000;
const UNAVAILABLE_STATUSES = new Set([502, 503, 504]);

const UPSTREAM_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) TuitionSheba/1.0',
};

// The host that answered most recently on this warm lambda instance.
let healthyBase = null;

/**
 * Ordered, de-duplicated list of upstream hosts to try.
 * UPSTREAM_API_BASE wins when set; UPSTREAM_API_BASE_FALLBACK can add another.
 */
function getUpstreamBases() {
  const candidates = [
    process.env.UPSTREAM_API_BASE,
    DEFAULT_UPSTREAM_BASE,
    process.env.UPSTREAM_API_BASE_FALLBACK,
  ];

  const seen = new Set();
  const bases = [];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const base = String(candidate).trim().replace(/\/+$/, '');
    if (!base || seen.has(base)) continue;
    seen.add(base);
    bases.push(base);
  }

  return bases;
}

/**
 * GET a path from the first upstream host that answers successfully.
 * Resolves with { ok: true, body } or { ok: false, status, statusText, timedOut }.
 */
export async function fetchUpstream(path) {
  const bases = getUpstreamBases();

  if (bases.length === 0) {
    return { ok: false, status: 0, statusText: 'No upstream host configured', timedOut: false };
  }

  // Warm lambda instances remember the host that answered last time, so a
  // suspended primary does not cost a failed round-trip on every request.
  const ordered =
    healthyBase && bases.includes(healthyBase)
      ? [healthyBase, ...bases.filter((base) => base !== healthyBase)]
      : bases;

  let lastFailure = { status: 0, statusText: 'Unknown upstream error', timedOut: false };

  for (const base of ordered) {
    try {
      const response = await fetch(`${base}${path}`, {
        headers: UPSTREAM_HEADERS,
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });

      if (response.ok) {
        healthyBase = base;
        return { ok: true, body: await response.text() };
      }

      if (base === healthyBase) {
        healthyBase = null;
      }

      lastFailure = {
        status: response.status,
        statusText: response.statusText || `HTTP ${response.status}`,
        timedOut: false,
      };

      // A suspended or missing deployment answers 502/503/504 (or 404 when the
      // path does not exist on that host): try the next candidate instead.
      if (UNAVAILABLE_STATUSES.has(response.status) || response.status === 404) {
        continue;
      }

      return { ok: false, ...lastFailure };
    } catch (err) {
      if (base === healthyBase) {
        healthyBase = null;
      }

      lastFailure = {
        status: 0,
        statusText: err?.message || 'Upstream request failed',
        timedOut: err?.name === 'TimeoutError' || err?.name === 'AbortError',
      };
    }
  }

  return { ok: false, ...lastFailure };
}
