/* Almanakk v2 — the sign-in that lives on Cloudflare, not in the browser.

   Alan signs in to Cloudflare Access once (a month, not an hour). This
   function holds Google's refresh token in KV, mints access tokens, and
   proxies the Calendar API. The browser never sees a Google token again.

   Routes (all behind Access; all Alan-only — see who()):
     GET  /api/auth/start      one-time: send Alan to Google consent (offline)
     GET  /api/auth/callback   store the refresh token, go to /v2/
     *    /api/gcal/<path>     proxy to https://www.googleapis.com/calendar/v3/<path>

   Bindings (wrangler.toml / dashboard): KV = KV namespace.
   Secrets: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, ALLOWED_EMAILS (comma list).
   Local dev only: PROVE=<email> stands in for the Access header. */

const GOOGLE_AUTH  = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const GCAL         = 'https://www.googleapis.com/calendar/v3/';
const SCOPE        = 'https://www.googleapis.com/auth/calendar';
const K_REFRESH    = 'google:refresh';
const K_ACCESS     = 'google:access';

const json = (o, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

// Same trust as the boards: Access verified the person before this ran and
// wrote their email into the header. Then one more gate — only Alan.
function who(request, env) {
  const h = request.headers.get('Cf-Access-Authenticated-User-Email');
  const email = ((h || env.PROVE || '') + '').trim().toLowerCase();
  if (!email) return { error: json({ error: 'not signed in to Cloudflare Access' }, 401) };
  const allowed = String(env.ALLOWED_EMAILS || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
  if (!allowed.includes(email)) return { error: json({ error: 'this calendar is not yours' }, 403) };
  return { email };
}

async function accessToken(env) {
  const cached = await env.KV.get(K_ACCESS);
  if (cached) return cached;
  const refresh = await env.KV.get(K_REFRESH);
  if (!refresh) throw Object.assign(new Error('Google er ikke koblet til ennå. Åpne /api/auth/start én gang.'), { status: 503 });
  const r = await fetch(GOOGLE_TOKEN, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refresh,
      client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET }),
  });
  const t = await r.json();
  if (!r.ok || !t.access_token) {
    throw Object.assign(new Error('Google avviste nøkkelen (' + (t.error || r.status) + '). Åpne /api/auth/start igjen.'), { status: 503 });
  }
  // cache it for slightly less than its life, so a stale one is never handed out
  await env.KV.put(K_ACCESS, t.access_token, { expirationTtl: Math.max(60, Number(t.expires_in || 3600) - 120) });
  return t.access_token;
}

async function authStart(request, env) {
  const origin = new URL(request.url).origin;
  const state = crypto.randomUUID();
  await env.KV.put('oauth:state:' + state, '1', { expirationTtl: 600 });
  const u = new URL(GOOGLE_AUTH);
  u.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID, redirect_uri: origin + '/api/auth/callback',
    response_type: 'code', scope: SCOPE, access_type: 'offline', prompt: 'consent',
    include_granted_scopes: 'true', state,
  }).toString();
  return Response.redirect(u.toString(), 302);
}

async function authCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code'), state = url.searchParams.get('state');
  if (!code || !state || !(await env.KV.get('oauth:state:' + state))) return json({ error: 'bad or expired state' }, 400);
  await env.KV.delete('oauth:state:' + state);
  const r = await fetch(GOOGLE_TOKEN, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code,
      redirect_uri: url.origin + '/api/auth/callback',
      client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET }),
  });
  const t = await r.json();
  if (!r.ok || !t.refresh_token) return json({ error: 'no refresh token from Google', detail: t.error || r.status }, 502);
  await env.KV.put(K_REFRESH, t.refresh_token);   // the one secret this whole thing exists to hold
  await env.KV.delete(K_ACCESS);
  return Response.redirect(url.origin + '/v2/', 302);
}

async function proxy(request, env, rest, retried = false) {
  const url = new URL(request.url);
  const target = new URL(GCAL + rest);
  target.search = url.search;
  const token = await accessToken(env);
  const init = { method: request.method, headers: { Authorization: 'Bearer ' + token } };
  if (!['GET', 'HEAD'].includes(request.method)) {
    init.headers['content-type'] = request.headers.get('content-type') || 'application/json';
    init.body = await request.text();
  }
  const r = await fetch(target, init);
  if (r.status === 401 && !retried) {         // token died early: drop it, mint once, retry once
    await env.KV.delete(K_ACCESS);
    return proxy(request, env, rest, true);
  }
  const body = await r.text();
  return new Response(body, { status: r.status, headers: {
    'content-type': r.headers.get('content-type') || 'application/json', 'cache-control': 'no-store' } });
}

export async function onRequest({ request, env }) {
  if (!env.KV) return json({ error: 'KV not bound' }, 500);
  const me = who(request, env);
  if (me.error) return me.error;
  const path = new URL(request.url).pathname.replace(/^\/api\/?/, '');
  try {
    // `return await`, not `return`: a rejected promise handed straight back out
    // of a try block is NOT caught by its catch, and the plain-language errors
    // below would have surfaced as a Cloudflare error page instead
    if (path === 'auth/start')    return await authStart(request, env);
    if (path === 'auth/callback') return await authCallback(request, env);
    if (path.startsWith('gcal/')) return await proxy(request, env, path.slice(5));
    return json({ error: 'no such route' }, 404);
  } catch (e) {
    return json({ error: e.message }, e.status || 500);
  }
}
