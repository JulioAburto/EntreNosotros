import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

// Local only: capture CLI credentials in memory, never print or load .env.local.
const status = spawnSync('cmd.exe', ['/d', '/s', '/c', 'pnpm dlx supabase@3.0.0 status --output json'], { encoding: 'utf8' });
assert.equal(status.status, 0, 'Supabase local must be running.');
const settings = JSON.parse(status.stdout);
assert.equal(new URL(settings.API_URL).hostname, '127.0.0.1');
const admin = createClient(settings.API_URL, settings.SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const base = 'http://127.0.0.1:3211';
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '3211'], {
  env: { ...process.env, LOCAL_INTEGRATION_TEST: '1', NEXT_PUBLIC_SUPABASE_URL: settings.API_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: settings.PUBLISHABLE_KEY },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let startupOutput = '';
server.stdout.on('data', chunk => { startupOutput += chunk.toString(); });
server.stderr.on('data', chunk => { startupOutput += chunk.toString(); });
const users = [];
let checks = 0;
function check(value, label) { assert.ok(value, label); console.log(`ok ${++checks} - ${label}`); }
async function page(path, cookies = '') {
  return fetch(`${base}${path}`, { headers: { Cookie: cookies }, redirect: 'manual', signal: AbortSignal.timeout(30_000) });
}
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try { await page('/'); ready = true; break; } catch { await delay(500); }
  }
  if (!ready) console.error(startupOutput.replaceAll(settings.PUBLISHABLE_KEY, '[public key]').replaceAll(settings.SECRET_KEY, '[secret]'));
  assert.ok(ready, 'Local Next.js server did not start.');
  const denied = await page('/sala');
  check(denied.status === 307 && denied.headers.get('location')?.endsWith('/login'), 'anonymous room access redirects to login');
  check((await page('/sala', 'sb-fake-auth-token=forged')).status === 307, 'forged cookie does not authorize access');
  for (let i = 0; i < 2; i++) {
    const email = `auth-${randomUUID()}@example.invalid`;
    const created = await admin.auth.admin.createUser({ email, email_confirm: true });
    assert.ok(created.data.user, 'Local fixture creation failed.');
    users.push(created.data.user.id);
    const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    assert.ok(link.data.properties?.email_otp, 'Local OTP generation failed.');
    let jar = [];
    const client = createServerClient(settings.API_URL, settings.PUBLISHABLE_KEY, {
      cookies: { getAll: () => jar, setAll(values) { jar = values; } },
    });
    const invalid = await client.auth.verifyOtp({ email, token: '00000000', type: 'email' });
    check(Boolean(invalid.error), 'invalid OTP is rejected by real Auth');
    const verified = await client.auth.verifyOtp({ email, token: link.data.properties.email_otp, type: 'email' });
    check(!verified.error && verified.data.user?.id === created.data.user.id, 'real OTP identifies the correct user');
    const cookie = jar.map(({ name, value }) => `${name}=${value}`).join('; ');
    const response = await page('/sala', cookie);
    check(response.status === 200, 'verified cookie grants private page access');
    check(response.headers.get('cache-control')?.includes('no-store'), 'authenticated response cannot be cached');
    const logout = await client.auth.signOut({ scope: 'local' });
    check(!logout.error, 'real session logout succeeds');
    check((await page('/sala', jar.map(({ name, value }) => `${name}=${value}`).join('; '))).status === 307, 'cleared session cannot access private page');
  }
  console.log(`Auth integration: ${checks} checks passed (local only).`);
} finally {
  for (const id of users) await admin.auth.admin.deleteUser(id);
  // Only terminate the process tree started by this test.
  if (server.pid) spawnSync('taskkill', ['/pid', String(server.pid), '/t', '/f'], { stdio: 'ignore' });
}
