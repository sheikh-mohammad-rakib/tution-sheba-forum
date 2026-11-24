import { parseCookies, verifyJwt } from './lib/auth-helper.js';

const COOKIE_NAME = 'admin_session';
const UPSTREAM_TIMEOUT_MS = 15000;
const UNAVAILABLE_STATUSES = new Set([502, 503, 504]);
const UNAVAILABLE_CODE = 'UPSTREAM_UNAVAILABLE';
const UNAVAILABLE_MESSAGE =
  'The teacher data service is temporarily unavailable. Please try again shortly.';

export async function handleTeachersRequest({ method, queryStringParameters, headers }) {
  if (method !== 'GET') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  const jwtSecret = process.env.JWT_SECRET;
  const upstreamBase = process.env.UPSTREAM_API_BASE || 'https://api.tuitionsebaforum.com';

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

  // 2. Extract pagination query params
  const page = queryStringParameters?.page || '1';
  const limit = queryStringParameters?.limit || '1000';

  // 3. Fetch from private upstream
  try {
    const upstreamUrl = `${upstreamBase.replace(/\/+$/, '')}/api/regTeacher/public-teachers?page=${encodeURIComponent(page)}&limit=${encodeURIComponent(limit)}`;
    const response = await fetch(upstreamUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) TuitionSheba/1.0',
      },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    if (!response.ok) {
      const unavailable = UNAVAILABLE_STATUSES.has(response.status);
      return {
        statusCode: unavailable ? 503 : response.status,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
        body: JSON.stringify(
          unavailable
            ? { error: UNAVAILABLE_MESSAGE, code: UNAVAILABLE_CODE, upstreamStatus: response.status }
            : { error: `Upstream error: ${response.statusText || response.status}`, code: 'UPSTREAM_ERROR', upstreamStatus: response.status }
        ),
      };
    }

    const data = await response.text();
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
      body: data,
    };
  } catch (err) {
    const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    return {
      statusCode: timedOut ? 504 : 502,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
      body: JSON.stringify({
        error: timedOut
          ? 'The teacher data service took too long to respond. Please try again shortly.'
          : 'The teacher data service is unreachable right now. Please try again shortly.',
        code: UNAVAILABLE_CODE,
        details: err.message,
      }),
    };
  }
}

export async function handler(event, context) {
  return await handleTeachersRequest({
    method: event.httpMethod,
    queryStringParameters: event.queryStringParameters || {},
    headers: event.headers || {},
  });
}

export default async function (req, context) {
  const url = new URL(req.url);
  const queryStringParameters = Object.fromEntries(url.searchParams.entries());
  const headers = Object.fromEntries(req.headers.entries());

  const result = await handleTeachersRequest({
    method: req.method,
    queryStringParameters,
    headers,
  });

  return new Response(result.body, {
    status: result.statusCode,
    headers: new Headers(result.headers),
  });
}

