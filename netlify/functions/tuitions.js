import { parseCookies, verifyJwt } from './lib/auth-helper.js';
import { fetchUpstream } from './lib/upstream.js';

const COOKIE_NAME = 'admin_session';
const UNAVAILABLE_CODE = 'UPSTREAM_UNAVAILABLE';
const UNAVAILABLE_MESSAGE =
  'The tuition data service is temporarily unavailable. Please try again shortly.';

export async function handleTuitionsRequest({ method, headers }) {
  if (method !== 'GET') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  const jwtSecret = process.env.JWT_SECRET;

  // 1. Authorize Request
  const cookies = parseCookies(headers.cookie || headers.Cookie);
  const token = cookies[COOKIE_NAME];
  const session = verifyJwt(token, jwtSecret);

  if (!session) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Unauthorized: Authentication required to access data' }),
    };
  }

  // 2. Fetch from the private upstream (with host failover)
  const upstream = await fetchUpstream('/api/tuition/available-web');

  if (upstream.ok) {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
      body: upstream.body,
    };
  }

  return {
    statusCode: upstream.timedOut ? 504 : 503,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify({
      error: upstream.timedOut
        ? 'The tuition data service took too long to respond. Please try again shortly.'
        : UNAVAILABLE_MESSAGE,
      code: UNAVAILABLE_CODE,
      upstreamStatus: upstream.status || undefined,
    }),
  };
}

export async function handler(event, context) {
  return await handleTuitionsRequest({
    method: event.httpMethod,
    headers: event.headers || {},
  });
}

export default async function (req, context) {
  const headers = Object.fromEntries(req.headers.entries());
  const result = await handleTuitionsRequest({
    method: req.method,
    headers,
  });

  return new Response(result.body, {
    status: result.statusCode,
    headers: new Headers(result.headers),
  });
}

