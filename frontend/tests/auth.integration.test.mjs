import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { readFile } from 'node:fs/promises';

// Exercise the production Next.js server against an isolated fake Go API.
// No real Discord accounts, sessions, or external services are used.
const states = new Map([['test-member', true], ['test-nonmember', false]]);
let app, backend, base, buildID;
let output = '';

before(async () => {
  buildID = (await readFile('.next/BUILD_ID', 'utf8')).trim();
  backend = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (req.url === '/auth/discord' && req.method === 'POST') {
      let input = ''; for await (const chunk of req) input += chunk;
      const code = JSON.parse(input).code;
      if (!['member-code', 'nonmember-code'].includes(code)) { res.writeHead(401); return res.end('{}'); }
      const member = code === 'member-code';
      return res.end(JSON.stringify({ token: member ? 'test-member' : 'test-nonmember', in_guild: member, expires_in: 3600 }));
    }
    if (req.url === '/auth/logout' && req.method === 'POST') { states.delete(token); res.writeHead(204); return res.end(); }
    if (req.url !== '/me') { res.writeHead(404); return res.end('{}'); }
    if (token === 'test-unavailable') { res.writeHead(503); return res.end('{}'); }
    if (!states.has(token)) { res.writeHead(401); return res.end('{}'); }
    if (!states.get(token)) { res.writeHead(403); return res.end(JSON.stringify({ error: 'discord_membership_required', in_guild: false })); }
    res.end(JSON.stringify({ id: '123456789', username: 'test_member', email: 'test@example.com', avatar: null, in_guild: true }));
  });
  await new Promise(resolve => backend.listen(0, '127.0.0.1', resolve));
  // Ask the OS for an available local port for the production server.
  const reservation = http.createServer();
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  base = `http://127.0.0.1:${port}`;
  app = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', String(port)], {
    env: { ...process.env, API_BASE_URL: `http://127.0.0.1:${backend.address().port}`, DISCORD_REDIRECT_URI: `${base}/oauth/discord` },
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  app.stdout.on('data', chunk => { output += chunk; });
  app.stderr.on('data', chunk => { output += chunk; });
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${base}/login`)).ok) return; } catch { /* Startup is still in progress. */ }
    if (app.exitCode !== null) throw new Error(output);
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`Next.js did not become ready: ${output}`);
});

after(async () => {
  app?.kill();
  if (backend) await new Promise(resolve => backend.close(resolve));
});

const request = (path, token, options = {}) => fetch(base + path, {
  redirect: 'manual', ...options,
  headers: { ...(token ? { Cookie: `mc_session=${token}` } : {}), ...options.headers },
});

test('public pages stay accessible without login, membership, or a working auth service', async () => {
  for (const path of ['/', '/wiki', '/wiki/getting-started', '/wiki/guides/grief-prevention', '/faq']) {
    for (const token of [undefined, 'test-nonmember', 'test-unavailable', 'expired']) {
      const result = await request(path, token);
      assert.equal(result.status, 200, `${path} was blocked for ${token || 'anonymous visitor'}`);
      assert.equal(result.headers.get('location'), null);
      assert.ok(!(await result.text()).includes('Checking your access'), 'public content was hidden behind the client gate');
    }
  }
});

test('account pages still require a verified member', async () => {
  for (const path of ['/me', '/me/settings']) {
    for (const [token, destination] of [[undefined, '/login'], ['test-nonmember', '/join-discord']]) {
      const result = await request(path, token);
      assert.equal(result.status, 307, `${path}: ${await result.text()}`);
      assert.equal(new URL(result.headers.get('location'), base).pathname, destination);
    }
  }
});

test('public wiki data is available without membership', async () => {
  for (const token of [undefined, 'test-nonmember']) {
    const result = await request(`/_next/data/${buildID}/wiki/getting-started.json`, token, { headers: { 'x-nextjs-data': '1' } });
    assert.equal(result.status, 200);
    assert.match((await result.json()).pageProps.article.html, /First Join/);
  }
});

test('account data requests cannot bypass membership checks', async () => {
  for (const token of [undefined, 'test-nonmember']) {
    const result = await request(`/_next/data/${buildID}/me.json`, token, { headers: { 'x-nextjs-data': '1' } });
    const text = await result.text();
    assert.ok(result.status === 307 || (result.status === 200 && text.includes('__N_REDIRECT')), `account data was not gated: ${result.status} ${text}`);
  }
});

test('server-resource links work without login', async () => {
  for (const [path, destination] of [['/discord', 'https://discord.gg/57E8HMCnGw'], ['/map', 'https://map.mountaineercraft.net/'], ['/analytics', 'https://analytics.mountaineercraft.net/']]) {
    const result = await request(path);
    assert.equal(result.status, 307);
    assert.equal(new URL(result.headers.get('location')).href, destination);
  }
});

test('wiki pages and nested guides render correctly', async () => {
  for (const path of ['/wiki', '/wiki/getting-started', '/wiki/guides/grief-prevention']) {
    const result = await request(path, 'test-member');
    assert.equal(result.status, 200);
    assert.match(result.headers.get('cache-control'), /private/);
    assert.match(result.headers.get('cache-control'), /no-store/);
  }
  const article = await request(`/_next/data/${buildID}/wiki/getting-started.json`, 'test-member', { headers: { 'x-nextjs-data': '1' } });
  assert.equal(article.status, 200);
  assert.match((await article.json()).pageProps.article.html, /First Join/);
  assert.equal((await request('/wiki/missing', 'test-member')).status, 404);
});

test('session endpoint returns only membership-approved profile data', async () => {
  assert.equal((await request('/api/auth/session')).status, 401);
  const forbidden = await request('/api/auth/session', 'test-nonmember');
  assert.equal(forbidden.status, 403);
  assert.ok(!JSON.stringify(await forbidden.json()).includes('test@example.com'));
  const member = await request('/api/auth/session', 'test-member');
  assert.equal(member.status, 200);
  assert.equal((await member.json()).username, 'test_member');
  assert.equal((await request('/api/auth/session', 'test-unavailable')).status, 503);
});

test('expired sessions and outages fail closed without a redirect loop', async () => {
  const expired = await request('/me', 'expired');
  assert.equal(new URL(expired.headers.get('location'), base).pathname, '/login');
  assert.match(expired.headers.get('set-cookie'), /Max-Age=0/);
  const unavailable = await request('/me', 'test-unavailable');
  assert.equal(new URL(unavailable.headers.get('location'), base).pathname, '/access-unavailable');
  assert.equal(unavailable.headers.get('set-cookie'), null);
  for (const path of ['/login', '/join-discord', '/access-unavailable']) assert.equal((await request(path)).status, 200);
});

test('joining and leaving update access on the same session', async () => {
  states.set('test-nonmember', true);
  assert.equal((await request('/me', 'test-nonmember')).status, 200);
  assert.equal((await request('/api/auth/session', 'test-nonmember')).status, 200);
  states.set('test-nonmember', false);
  assert.equal((await request('/api/auth/session', 'test-nonmember')).status, 403);
});

async function beginLogin(next = '/me') {
  const response = await request(`/api/auth/login?next=${encodeURIComponent(next)}`);
  assert.equal(response.status, 302);
  const destination = new URL(response.headers.get('location'));
  assert.equal(destination.origin, 'https://discord.com');
  assert.ok(destination.searchParams.get('scope').split(' ').includes('guilds'));
  const setCookies = response.headers.getSetCookie();
  assert.ok(setCookies.every(value => /HttpOnly/.test(value) && /SameSite=Lax/.test(value)));
  return { state: destination.searchParams.get('state'), cookies: setCookies.map(value => value.split(';')[0]).join('; ') };
}

test('OAuth rejects missing or mismatched state before accepting a session', async () => {
  for (const state of ['', 'wrong-state']) {
    const login = await beginLogin();
    const result = await request(`/oauth/discord?code=member-code&state=${state}`, undefined, { headers: { Cookie: login.cookies } });
    assert.equal(result.status, 200);
    assert.ok(!result.headers.getSetCookie().some(value => value.startsWith('mc_session=')));
  }
});

test('OAuth uses HttpOnly cookies and only requires membership for account destinations', async () => {
  for (const [code, next, expected] of [['member-code', '/wiki/getting-started', '/wiki/getting-started'], ['nonmember-code', '/wiki/getting-started', '/wiki/getting-started'], ['nonmember-code', '/me', '/join-discord']]) {
    const login = await beginLogin(next);
    const result = await request(`/oauth/discord?code=${code}&state=${encodeURIComponent(login.state)}`, undefined, { headers: { Cookie: login.cookies } });
    assert.equal(result.status, 307);
    assert.equal(new URL(result.headers.get('location'), base).pathname, expected);
    const session = result.headers.getSetCookie().find(value => value.startsWith('mc_session='));
    assert.ok(session && /HttpOnly/.test(session) && /Secure/.test(session) && /SameSite=Lax/.test(session));
  }
  const login = await beginLogin('//example.com');
  assert.ok(login.cookies.includes('mc_oauth_return=%2Fme'), 'external return URL was not rejected');
});

test('logout rejects cross-site requests and revokes nonmember sessions', async () => {
  assert.equal((await request('/api/auth/logout', 'test-nonmember')).status, 405);
  assert.equal((await request('/api/auth/logout', 'test-nonmember', { method: 'POST', headers: { Origin: 'https://example.com' } })).status, 403);
  const result = await request('/api/auth/logout', 'test-nonmember', { method: 'POST', headers: { Origin: base } });
  assert.equal(result.status, 204);
  assert.ok(result.headers.getSetCookie().some(value => value.startsWith('mc_session=') && value.includes('Max-Age=0')));
  assert.equal((await request('/api/auth/session', 'test-nonmember')).status, 401);
});
