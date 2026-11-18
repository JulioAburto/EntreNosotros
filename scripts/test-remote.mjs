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
const base = 'http://127.0.0.1:3212';
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '3212'], {
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

const games = [];
const sessions = [];
let browser;
async function api(index, path, body, origin = base) {
  const response = await fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Cookie: sessions[index]?.cookie ?? '', ...(body === undefined ? {} : { 'Content-Type': 'application/json', Origin: origin }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(30_000),
  });
  return { status: response.status, data: await response.json() };
}
async function snapshot(index, game) {
  const result = await api(index, '/api/games/' + game);
  assert.equal(result.status, 200, result.data.message);
  return result.data;
}
async function command(index, game, action, extra = {}, revision) {
  const current = revision ?? (await snapshot(index, game)).revision;
  return api(index, '/api/games/' + game, { action, commandId: randomUUID(), revision: current, ...extra });
}
async function pair() {
  const game = randomUUID(); games.push(game);
  assert.equal((await api(0, '/api/games', { action: 'create', id: game, name: 'Synthetic room', displayName: 'Fixture A' })).status, 200);
  const invitation = await api(0, '/api/games', { action: 'invite', gameId: game });
  const request = await api(1, '/api/games', { action: 'join', token: invitation.data.token, displayName: 'Fixture B' });
  assert.equal((await api(0, '/api/games', { action: 'decide', gameId: game, requestId: request.data.requestId, approve: true })).status, 200);
  return game;
}
try {
  let ready = false;
  for (let i = 0; i < 60; i++) { try { await page('/'); ready = true; break; } catch { await delay(500); } }
  if (!ready) console.error(startupOutput.replaceAll(settings.PUBLISHABLE_KEY, '[public key]').replaceAll(settings.SECRET_KEY, '[secret]'));
  assert.ok(ready);
  check((await api(-1, '/api/games')).status === 401, 'anonymous API access is rejected');
  for (let i = 0; i < 3; i++) {
    const email = 'remote-' + randomUUID() + '@example.invalid';
    const created = await admin.auth.admin.createUser({ email, email_confirm: true });
    assert.ok(created.data.user); users.push(created.data.user.id);
    const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    let jar = [];
    const client = createServerClient(settings.API_URL, settings.PUBLISHABLE_KEY, {
      cookies: { getAll: () => jar, setAll(values) { jar = values; } },
    });
    assert.ok(!(await client.auth.verifyOtp({ email, token: link.data.properties.email_otp, type: 'email' })).error);
    sessions.push({ client, jar, cookie: jar.map(({ name, value }) => name + '=' + value).join('; ') });
  }
  check((await api(0, '/api/games', { action: 'create' }, 'https://attacker.invalid')).status === 403, 'cross-origin mutations are rejected');
  const game = randomUUID(); games.push(game);
  const create = { action: 'create', id: game, name: 'Synthetic room', displayName: 'Fixture A' };
  const createdRoom = await api(0, '/api/games', create);
  if (createdRoom.status !== 200) { console.error(createdRoom); const direct = await sessions[0].client.rpc('create_room', {p_game_id: game, p_name: 'Synthetic room', p_display_name: 'Fixture A'}); console.error({sqlCode: direct.error?.code, sqlMessage: direct.error?.message}); }
  check(createdRoom.status === 200, 'creator creates a waiting room');
  check((await api(0, '/api/games', create)).status === 200, 'creation retry is idempotent');
  check((await snapshot(0, game)).members.length === 1, 'waiting room has one real member');
  check((await command(0, game, 'reserve')).status === 409, 'waiting room cannot reserve a question');
  check((await api(1, '/api/games/' + game)).status === 404, 'unapproved user cannot read room');
  const invitation = (await api(0, '/api/games', { action: 'invite', gameId: game })).data.token;
  check(/^[a-f0-9]{64}$/.test(invitation), 'invitation has 256 random bits');
  check((await api(2, '/api/games', { action: 'invite', gameId: game })).status === 403, 'outsider cannot invite');
  const pending = await api(1, '/api/games', { action: 'join', token: invitation, displayName: 'Fixture B' });
  check(pending.status === 200, 'authenticated invitee requests access');
  check((await api(1, '/api/games/' + game)).status === 404, 'invitation alone grants no read access');
  const third = await api(2, '/api/games', { action: 'join', token: invitation, displayName: 'Fixture C' });
  check((await api(2, '/api/games', { action: 'decide', gameId: game, requestId: third.data.requestId, approve: true })).status === 403, 'requester cannot approve itself');
  check((await api(0, '/api/games', { action: 'decide', gameId: game, requestId: pending.data.requestId, approve: true })).status === 200, 'creator approves partner');
  check((await api(0, '/api/games', { action: 'decide', gameId: game, requestId: third.data.requestId, approve: true })).status !== 200, 'third request cannot replace approved partner');
  check((await snapshot(1, game)).members.length === 2, 'approved partner reads room');
  check((await api(2, '/api/games/' + game)).status === 404, 'third identity remains isolated');
  let current = await snapshot(0, game);
  check((await command(1, game, 'reserve', {}, current.revision)).status === 403, 'responder cannot reserve');
  const reserve = { action: 'reserve', commandId: randomUUID(), revision: current.revision };
  const race = await Promise.all([api(0, '/api/games/' + game, reserve), api(0, '/api/games/' + game, { ...reserve, commandId: randomUUID() })]);
  check(race.filter(r => r.status === 200).length === 1 && race.some(r => r.status === 409), 'simultaneous valid reservations have one winner');
  current = await snapshot(0, game);
  const partnerView = await snapshot(1, game);
  check(partnerView.activeQuestionId === current.activeQuestionId && partnerView.revision === current.revision, 'manual reads converge on the reserved question');
  check((await command(0, game, 'complete', { questionId: current.activeQuestionId }, current.revision)).status === 403, 'asker cannot complete for partner');
  const complete = { action: 'complete', questionId: current.activeQuestionId, revision: current.revision, commandId: randomUUID() };
  check((await api(1, '/api/games/' + game, complete)).status === 200, 'designated responder completes');
  check((await api(1, '/api/games/' + game, complete)).status === 200, 'completion replay is idempotent');
  const after = await snapshot(0, game);
  check(after.completions.length === 1 && after.currentMemberId !== current.currentMemberId && after.revision === current.revision + 1, 'completion advances exactly one turn and revision');
  check((await command(0, game, 'settings', { categoryIds: ['amor'] }, current.revision)).status === 409, 'stale settings cannot overwrite newer state');
  const maliciousText = "Synthetic <script>alert('x')</script> '); drop table games; --";
  check((await command(0, game, 'add_question', { id: 'custom-' + randomUUID(), text: maliciousText, categoryId: 'amor', responderId: null })).status === 200, 'question text is stored as data');
  check((await snapshot(1, game)).questions.some(q => q.text === maliciousText), 'stored text remains intact');
  check((await command(1, game, 'reset', { memberId: after.members.find(m => m.position === 0).id, clearProgress: true })).status === 200, 'current asker can explicitly reset progress');
  const importGame = await pair();
  const original = await snapshot(0, importGame);
  const state = {
    schemaVersion: 2, categories: original.categories,
    questions: original.questions.map(q => ({ id: q.id, number: q.number, text: q.text, categoryId: q.category_id, isActive: q.is_active, createdAt: new Date(q.created_at).toISOString(), source: q.source })),
    completed: { 'initial-001': '1970-01-01T00:00:00.000Z' },
    players: ['Old A', 'Old B'], currentPlayer: 1,
    enabledCategoryIds: original.enabledCategoryIds, activeQuestionId: null, lastSkippedId: null,
    nextQuestionNumber: 101, theme: 'system',
  };
  check((await command(1, importGame, 'import_backup', { document: state })).status === 403, 'only creator can migrate local progress');
  check((await command(0, importGame, 'import_backup', { document: state })).status === 200, 'valid backup imports atomically');
  const imported = await snapshot(0, importGame);
  check(imported.completions[0].completed_at === null && imported.completions[0].responder_member_id === null, 'unknown legacy date and respondent remain unknown');
  check((await command(0, importGame, 'import_backup', { document: state })).status === 200, 'same import with a new command is idempotent');
  check((await snapshot(0, importGame)).revision === imported.revision, 'repeated import does not advance revision');
  const changed = structuredClone(state); changed.completed['initial-002'] = '2026-11-17T00:00:00.000Z';
  check((await command(0, importGame, 'import_backup', { document: changed })).status === 409, 'different backup cannot overwrite used room');
  const bank = { format: 'entre-nosotros-bank', version: 1, categories: original.categories, questions: [
    { id: 'custom-rollback-a', number: 101, text: 'Synthetic first', categoryId: 'amor', isActive: true, source: 'custom', createdAt: '2026-11-17T00:00:00.000Z' },
    { id: 'custom-rollback-b', number: 101, text: 'Synthetic second', categoryId: 'amor', isActive: true, source: 'custom', createdAt: '2026-11-17T00:00:00.000Z' },
  ] };
  check((await command(0, importGame, 'merge_bank', { document: bank })).status !== 200, 'number collision rejects bank');
  check((await snapshot(0, importGame)).questions.length === 100, 'failed import leaves no partial rows');
  bank.questions.pop();
  check((await command(0, importGame, 'merge_bank', { document: bank })).status === 200, 'bank merges without replacing progress');
  check((await snapshot(0, importGame)).completions.length === 1, 'bank merge preserves remote completions');
  const beforeProfile = await snapshot(0, game);
  const profile = { action: 'profile', name: 'Fixture A Updated', commandId: randomUUID(), revision: beforeProfile.revision };
  check((await api(0, '/api/games/' + game, profile)).status === 200, 'member can rename only its own profile');
  const afterProfile = await snapshot(0, game);
  check(afterProfile.viewerMemberId === beforeProfile.viewerMemberId && afterProfile.currentMemberId === beforeProfile.currentMemberId, 'renaming preserves identity and turn');
  check((await api(0, '/api/games/' + game, profile)).status === 200 && (await snapshot(0, game)).revision === afterProfile.revision, 'profile replay is idempotent');
  check((await api(2, '/api/games/' + game, { ...profile, commandId: randomUUID(), revision: afterProfile.revision })).status === 403, 'outsider cannot rename a member');
  assert.equal((await command(0, game, 'profile', { name: 'Fixture A' })).status, 200);
  const { chromium, expect } = await import('@playwright/test');
  browser = await chromium.launch({ headless: true });
  const contexts = await Promise.all([browser.newContext({ viewport: { width: 390, height: 844 } }), browser.newContext({ viewport: { width: 320, height: 740 } })]);
  for (let i = 0; i < 2; i++) await contexts[i].addCookies(sessions[i].jar.map(({ name, value }) => ({ name, value, url: base, sameSite: 'Lax' })));
  const [a, b] = await Promise.all(contexts.map(c => c.newPage()));
  await Promise.all([a.goto(base + '/sala/' + game), b.goto(base + '/sala/' + game)]);
  await expect(a.getByRole('button', { name: 'Girar la ruleta' })).toBeEnabled();
  await expect(b.getByRole('button', { name: 'Girar la ruleta' })).toBeDisabled();
  await a.getByRole('button', { name: 'Girar la ruleta' }).click();
  await expect(a.getByRole('region', { name: 'Pregunta seleccionada' })).toBeVisible();
  check(await b.getByRole('region', { name: 'Pregunta seleccionada' }).count() === 0, 'other browser remains unchanged until manual refresh');
  await b.getByRole('button', { name: 'Actualizar partida', exact: true }).click();
  await expect(b.getByRole('region', { name: 'Pregunta seleccionada' })).toBeVisible();
  const questionA = await a.getByRole('region', { name: 'Pregunta seleccionada' }).getByRole('heading').textContent();
  check(await b.getByRole('region', { name: 'Pregunta seleccionada' }).getByRole('heading').textContent() === questionA, 'two browser contexts show identical question after refresh');
  await expect(a.getByRole('button', { name: 'Fixture B ya respondió' })).toBeDisabled();
  await b.getByRole('button', { name: 'Fixture B ya respondió' }).click();
  await expect(b.getByRole('region', { name: 'Pregunta seleccionada' })).toHaveCount(0);
  await a.getByRole('button', { name: 'Actualizar partida', exact: true }).click();
  await expect(a.getByRole('region', { name: 'Pregunta seleccionada' })).toHaveCount(0);
  await Promise.all([a.reload(), b.reload()]);
  await expect(b.getByRole('button', { name: 'Girar la ruleta' })).toBeEnabled();
  check(true, 'completion and changed roles survive reload in both browsers');
  check(await b.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'shared UI fits a 320px viewport');
  await b.screenshot({ path: 'test-results/shared-game-mobile.png', fullPage: true });
  console.log('Remote integration: ' + checks + ' checks passed (real local Auth, Next.js, PostgreSQL and two browsers).');
} finally {
  if (browser) await browser.close();
  for (const game of games) {
    assert.match(game, /^[a-f0-9-]{36}$/);
    const deleted = spawnSync('docker', ['exec', '-i', 'supabase_db_entre-nosotros', 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'], { input: "delete from public.games where id='" + game + "';", encoding: 'utf8' });
    if (deleted.status !== 0) console.error('Local fixture cleanup failed for a test room.');
  }
  for (const id of users) await admin.auth.admin.deleteUser(id);
  if (server.pid) spawnSync('taskkill', ['/pid', String(server.pid), '/t', '/f'], { stdio: 'ignore' });
}
