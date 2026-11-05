import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHmac, randomBytes, randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';

// Intentionally cannot accept a database URL or a remote Supabase project.
const database = 'supabase_db_entre-nosotros';
const container = `entre-nosotros-rpc-test-${randomUUID()}`;
const image = 'public.ecr.aws/supabase/postgrest:v16.5';
const baseUrl = 'http://127.0.0.1:54329';
const secret = randomBytes(48).toString('base64url');
const users = Array.from({length: 3}, () => randomUUID());
const game = randomUUID();
let started = false;
let fixtures = false;
let checks = 0;

function docker(args, options = {}) {
  const result = spawnSync('docker', args, {
    encoding: 'utf8',
    timeout: 60_000,
    ...options,
  });
  if (result.error || result.status !== 0) {
    // Never echo command args/env/status JSON that could include credentials.
    throw new Error(`Local Docker operation failed (${args[0]}).`);
  }
  return result.stdout.trim();
}

function sql(statement) {
  return docker(
    [
      'exec',
      '-i',
      database,
      'psql',
      '-X',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-At',
    ],
    {input: statement},
  );
}

function token(role, subject) {
  const header = Buffer.from(
    JSON.stringify({alg: 'HS256', typ: 'JWT'}),
  ).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      role,
      ...(subject ? {sub: subject} : {}),
      exp: Math.floor(Date.now() / 1000) + 600,
    }),
  ).toString('base64url');
  const unsigned = `${header}.${payload}`;
  return `${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`;
}

async function request(path, bearer, body, method = 'POST') {
  const response = await fetch(`${baseUrl}/${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bearer}`,
    },
    ...(body === undefined ? {} : {body: JSON.stringify(body)}),
    signal: AbortSignal.timeout(10_000),
  });
  const text = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    body: text ? JSON.parse(text) : null,
  };
}

function check(condition, message) {
  assert.ok(condition, message);
  checks++;
  console.log(`ok ${checks} - ${message}`);
}

try {
  const [info] = JSON.parse(docker(['inspect', database]));
  assert.ok(info.State.Running, 'Start the local database first.');
  const network = Object.keys(info.NetworkSettings.Networks)[0];
  const env = Object.fromEntries(
    info.Config.Env.map(entry => {
      const index = entry.indexOf('=');
      return [entry.slice(0, index), entry.slice(index + 1)];
    }),
  );
  assert.ok(env.POSTGRES_PASSWORD, 'Local database password unavailable.');
  const dbUri = `postgresql://authenticator:${encodeURIComponent(env.POSTGRES_PASSWORD)}@${database}:5432/postgres`;
  docker(
    [
      'run',
      '--rm',
      '-d',
      '--name',
      container,
      '--network',
      network,
      '-p',
      '127.0.0.1:54329:3000',
      '-e',
      'PGRST_DB_URI',
      '-e',
      'PGRST_JWT_SECRET',
      '-e',
      'PGRST_DB_SCHEMAS=public',
      '-e',
      'PGRST_DB_ANON_ROLE=anon',
      image,
    ],
    {
      env: {...process.env, PGRST_DB_URI: dbUri, PGRST_JWT_SECRET: secret},
    },
  );
  started = true;
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      await fetch(baseUrl, {signal: AbortSignal.timeout(1000)});
      ready = true;
      break;
    } catch {
      await delay(250);
    }
  }
  assert.ok(ready, 'Local PostgREST did not become ready.');
  sql(
    `insert into auth.users(id) values ${users.map(id => `('${id}')`).join(',')};`,
  );
  fixtures = true;
  const admin = token('service_role');
  const member = token('authenticated', users[0]);
  const partner = token('authenticated', users[1]);
  const outsider = token('authenticated', users[2]);
  const bootstrap = {
    p_game_id: game,
    p_first_user_id: users[0],
    p_second_user_id: users[1],
    p_first_name: 'Fixture A',
    p_second_name: 'Fixture B',
  };
  check(
    !(await request('rpc/create_private_game', member, bootstrap)).ok,
    'member cannot call administrative bootstrap over HTTP',
  );
  check(
    (await request('rpc/create_private_game', admin, bootstrap)).ok,
    'service_role can invoke bootstrap through the exposed public RPC',
  );
  check(
    (await request('rpc/create_private_game', admin, bootstrap)).ok,
    'bootstrap retry is idempotent',
  );
  check(
    !(await request('games', admin, {current_member_id: randomUUID()}, 'PATCH'))
      .ok,
    'service_role cannot bypass commands with direct UPDATE',
  );
  check(
    !(await request('questions', token('anon'), undefined, 'GET')).ok,
    'anonymous HTTP request cannot read private questions',
  );
  check(
    (await request('questions', outsider, undefined, 'GET')).body.length === 0,
    'RLS hides questions from an unrelated authenticated HTTP user',
  );
  check(
    (await request('rpc/get_game_snapshot', outsider, {p_game_id: game}))
      .body === null,
    'snapshot RPC reveals nothing to outsiders',
  );
  check(
    !(
      await request('rpc/reserve_question', outsider, {
        p_game_id: game,
        p_command_id: randomUUID(),
        p_expected_revision: 1,
      })
    ).ok,
    'privileged RPC rejects outsider membership',
  );
  check(
    !(await request('rpc/execute_game_command', member, {})).ok,
    'private dispatcher has no PostgREST endpoint',
  );
  const initial = (
    await request('rpc/get_game_snapshot', member, {p_game_id: game})
  ).body;
  check(
    initial.questions.length === 100 && initial.members.length === 2,
    'authorized HTTP snapshot includes exactly the canonical bank and pair',
  );
  const reserve = {
    p_game_id: game,
    p_command_id: randomUUID(),
    p_expected_revision: initial.revision,
  };
  const reservations = await Promise.all([
    request('rpc/reserve_question', member, reserve),
    request('rpc/reserve_question', partner, {
      ...reserve,
      p_command_id: randomUUID(),
    }),
  ]);
  check(
    reservations.filter(result => result.ok).length === 1,
    'two simultaneous reservations produce one winner',
  );
  check(
    reservations.some(result => result.body?.code === '40001'),
    'losing reservation reports a revision conflict',
  );
  const reserved = (
    await request('rpc/get_game_snapshot', member, {p_game_id: game})
  ).body;
  check(
    reserved.revision === initial.revision + 1 && reserved.activeQuestionId,
    'reservation advances exactly one revision and persists active question',
  );
  const command = {
    p_game_id: game,
    p_command_id: randomUUID(),
    p_expected_revision: reserved.revision,
    p_question_id: reserved.activeQuestionId,
  };
  const partnerCommand = {...command, p_command_id: randomUUID()};
  const completed = await Promise.all([
    request('rpc/complete_question', member, command),
    request('rpc/complete_question', partner, partnerCommand),
  ]);
  check(
    completed.filter(result => result.ok).length === 1,
    'two simultaneous completions produce one transition',
  );
  const winner = completed.findIndex(result => result.ok);
  const winnerCommand = winner === 0 ? command : partnerCommand;
  const after = (
    await request('rpc/get_game_snapshot', member, {p_game_id: game})
  ).body;
  check(
    after.completions.length === 1 &&
      after.revision === reserved.revision + 1 &&
      after.currentMemberId !== reserved.currentMemberId &&
      after.activeQuestionId === null,
    'completion records one answer, clears reservation, and alternates only once',
  );
  check(
    (
      await request(
        'rpc/complete_question',
        winner === 0 ? member : partner,
        winnerCommand,
      )
    ).ok,
    'retry after commit succeeds without a second completion',
  );
  const next = await request('rpc/reserve_question', member, {
    p_game_id: game,
    p_command_id: randomUUID(),
    p_expected_revision: after.revision,
  });
  const race = {
    p_game_id: game,
    p_command_id: randomUUID(),
    p_expected_revision: next.body.revision,
    p_question_id: next.body.questionId,
  };
  const mixed = await Promise.all([
    request('rpc/complete_question', member, race),
    request('rpc/skip_question', partner, {
      ...race,
      p_command_id: randomUUID(),
    }),
  ]);
  check(
    mixed.filter(result => result.ok).length === 1,
    'simultaneous complete versus skip has a single winner',
  );
  const final = (
    await request('rpc/get_game_snapshot', partner, {p_game_id: game})
  ).body;
  check(
    final.revision === next.body.revision + 1 &&
      final.activeQuestionId === null,
    'both members converge on the committed state after the race',
  );
  console.log(`RPC integration: ${checks} checks passed.`);
} finally {
  try {
    if (fixtures) {
      sql(`begin; delete from public.games where id = '${game}';
        delete from auth.users where id in (${users.map(id => `'${id}'`).join(',')}); commit;`);
    }
  } finally {
    if (started) docker(['stop', container]);
  }
}
