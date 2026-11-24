import { parseCookies, verifyJwt } from './lib/auth-helper.js';
import { fetchUpstream } from './lib/upstream.js';

const COOKIE_NAME = 'admin_session';
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

  // 3. Fetch from the private upstream (with host failover)
  const upstream = await fetchUpstream(
    `/api/regTeacher/public-teachers?page=${encodeURIComponent(page)}&limit=${encodeURIComponent(limit)}`
  );

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
        ? 'The teacher data service took too long to respond. Please try again shortly.'
        : UNAVAILABLE_MESSAGE,
      code: UNAVAILABLE_CODE,
      upstreamStatus: upstream.status || undefined,
    }),
  };
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

