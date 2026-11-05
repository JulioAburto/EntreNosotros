-- Domain tables. Apply as the database migration owner, never as an app user.
create schema if not exists private;
revoke create on schema public from public, anon, authenticated, service_role;
revoke all on schema private from public, anon, authenticated, service_role;
grant usage on schema private to authenticated;

create table public.games (
  id uuid primary key default gen_random_uuid(),
  revision bigint not null default 0 check (revision >= 0),
  current_member_id uuid not null,
  active_question_id text,
  next_question_number integer not null default 101
    check (next_question_number between 101 and 1000000000),
  enabled_category_ids text[] not null default array[
    'amor','distancia','historia','gratitud','admiracion',
    'conocernos','intimidad','futuro','complicidad'
  ],
  skipped_question_ids text[] not null default '{}',
  last_skipped_question_id text,
  created_at timestamptz not null default now(),
  check (cardinality(enabled_category_ids) <= 100),
  check (cardinality(skipped_question_ids) <= 10000),
  check (array_position(enabled_category_ids, null) is null),
  check (array_position(skipped_question_ids, null) is null),
  check (coalesce(array_ndims(enabled_category_ids), 1) = 1),
  check (coalesce(array_ndims(skipped_question_ids), 1) = 1)
);

create table public.game_members (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  position smallint not null check (position in (0, 1)),
  display_name text not null check (length(btrim(display_name)) between 1 and 30),
  revoked_at timestamptz,
  unique (game_id, position),
  unique (game_id, user_id),
  unique (game_id, id)
);
create index game_members_user_game_idx on public.game_members(user_id, game_id)
  where revoked_at is null;

create table public.categories (
  game_id uuid not null references public.games(id) on delete cascade,
  id text not null check (id ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$'),
  name text not null check (length(btrim(name)) between 1 and 80),
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  source text not null check (source in ('initial', 'custom')),
  primary key (game_id, id)
);

create table public.questions (
  game_id uuid not null references public.games(id) on delete cascade,
  id text not null check (id ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$'),
  number integer not null check (number between 1 and 999999999),
  text text not null check (length(btrim(text)) between 1 and 2000),
  category_id text not null,
  is_active boolean not null default true,
  source text not null check (source in ('initial', 'custom')),
  created_at timestamptz not null default now(),
  intended_responder_member_id uuid,
  primary key (game_id, id),
  unique (game_id, number),
  foreign key (game_id, category_id) references public.categories(game_id, id),
  foreign key (game_id, intended_responder_member_id)
    references public.game_members(game_id, id) deferrable initially deferred,
  check (source <> 'custom' or number > 100)
);
create index questions_category_idx on public.questions(game_id, category_id);
create index questions_recipient_idx on public.questions(game_id, intended_responder_member_id)
  where intended_responder_member_id is not null;

create table public.completions (
  game_id uuid not null references public.games(id) on delete cascade,
  question_id text not null,
  completed_at timestamptz,
  responder_member_id uuid,
  recorded_by_member_id uuid,
  provenance text not null default 'live' check (provenance in ('live','manual','legacy')),
  primary key (game_id, question_id),
  foreign key (game_id, question_id) references public.questions(game_id, id)
    on delete cascade,
  foreign key (game_id, responder_member_id) references public.game_members(game_id, id),
  foreign key (game_id, recorded_by_member_id) references public.game_members(game_id, id),
  check (provenance <> 'live' or
    (completed_at is not null and responder_member_id is not null and recorded_by_member_id is not null)),
  check (completed_at is null or completed_at <> '1970-01-01T00:00:00Z'::timestamptz)
);
create index completions_responder_idx on public.completions(game_id, responder_member_id);
create index completions_actor_idx on public.completions(game_id, recorded_by_member_id);

alter table public.games add constraint games_current_member_fk
  foreign key (id, current_member_id) references public.game_members(game_id, id)
  deferrable initially deferred;
alter table public.games add constraint games_active_question_fk
  foreign key (id, active_question_id) references public.questions(game_id, id)
  deferrable initially deferred;
alter table public.games add constraint games_last_skipped_question_fk
  foreign key (id, last_skipped_question_id) references public.questions(game_id, id)
  deferrable initially deferred;

-- Technical receipts only: no question texts, backup payloads, or credentials.
create table private.command_receipts (
  game_id uuid not null references public.games(id) on delete cascade,
  command_id uuid not null,
  actor_member_id uuid not null,
  command_name text not null,
  payload_hash bytea not null check (octet_length(payload_hash) = 32),
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default now(),
  primary key (game_id, command_id),
  foreign key (game_id, actor_member_id) references public.game_members(game_id, id)
);

-- RLS helper has no caller-supplied user ID. Avoids recursive member policies.
create function private.is_game_member(p_game_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.game_members m
    where m.game_id = p_game_id and m.user_id = (select auth.uid())
      and m.revoked_at is null
  );
$$;
revoke all on function private.is_game_member(uuid) from public, anon, authenticated, service_role;
grant execute on function private.is_game_member(uuid) to authenticated;

alter table public.games enable row level security;
alter table public.game_members enable row level security;
alter table public.categories enable row level security;
alter table public.questions enable row level security;
alter table public.completions enable row level security;
alter table private.command_receipts enable row level security;

create policy games_read on public.games for select to authenticated
  using (private.is_game_member(id));
create policy members_read on public.game_members for select to authenticated
  using (private.is_game_member(game_id));
create policy categories_read on public.categories for select to authenticated
  using (private.is_game_member(game_id));
create policy questions_read on public.questions for select to authenticated
  using (private.is_game_member(game_id));
create policy completions_read on public.completions for select to authenticated
  using (private.is_game_member(game_id));

revoke all on public.games, public.game_members, public.categories,
  public.questions, public.completions from public, anon, authenticated, service_role;
grant select on public.games, public.game_members, public.categories,
  public.questions, public.completions to authenticated;
revoke all on private.command_receipts from public, anon, authenticated, service_role;

-- Serialize even privileged maintenance of child rows with the parent game.
create function private.lock_game_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_game_id uuid;
begin
  if tg_op = 'UPDATE' and new.game_id is distinct from old.game_id then
    raise exception using errcode = '23514', message = 'game_id is immutable';
  end if;
  v_game_id := case when tg_op = 'DELETE' then old.game_id else new.game_id end;
  perform 1 from public.games where id = v_game_id for update;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.lock_game_row() from public, anon, authenticated, service_role;

create trigger members_lock before insert or update or delete on public.game_members
  for each row execute function private.lock_game_row();
create trigger categories_lock before insert or update or delete on public.categories
  for each row execute function private.lock_game_row();
create trigger questions_lock before insert or update or delete on public.questions
  for each row execute function private.lock_game_row();
create trigger completions_lock before insert or update or delete on public.completions
  for each row execute function private.lock_game_row();

-- Deferred constraints allow atomic bootstrap of the circular game/member FKs.
create function private.check_game_invariants() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_game_id uuid; v_game public.games; v_count integer;
begin
  if tg_table_name = 'games' then
    v_game_id := case when tg_op = 'DELETE' then old.id else new.id end;
  else
    v_game_id := case when tg_op = 'DELETE' then old.game_id else new.game_id end;
  end if;
  select * into v_game from public.games where id = v_game_id for update;
  if not found then return null; end if;
  select count(*) into v_count from public.game_members where game_id = v_game_id;
  if v_count <> 2 then
    raise exception using errcode = '23514', message = 'A game requires exactly positions 0 and 1';
  end if;
  if (select count(*) from public.questions where game_id = v_game_id) > 10000
    or (select count(*) from public.categories where game_id = v_game_id) > 100 then
    raise exception using errcode = '23514', message = 'Game bank limit exceeded';
  end if;
  if exists (select 1 from public.questions where game_id = v_game_id
    and number >= v_game.next_question_number) then
    raise exception using errcode = '23514', message = 'next_question_number must exceed all numbers';
  end if;
  if cardinality(v_game.enabled_category_ids) <> (select count(distinct x) from unnest(v_game.enabled_category_ids) x)
    or exists (select 1 from unnest(v_game.enabled_category_ids) x where not exists
      (select 1 from public.categories c where c.game_id = v_game_id and c.id = x))
    or cardinality(v_game.skipped_question_ids) <> (select count(distinct x) from unnest(v_game.skipped_question_ids) x)
    or exists (select 1 from unnest(v_game.skipped_question_ids) x where not exists
      (select 1 from public.questions q where q.game_id = v_game_id and q.id = x)) then
    raise exception using errcode = '23514', message = 'Invalid shared filters or skipped questions';
  end if;
  if exists (select 1 from public.completions where game_id = v_game_id
    and question_id = v_game.active_question_id)
    or exists (select 1 from public.questions where game_id = v_game_id
      and id = v_game.active_question_id and intended_responder_member_id = v_game.current_member_id) then
    raise exception using errcode = '23514', message = 'Invalid active question';
  end if;
  return null;
end;
$$;
revoke all on function private.check_game_invariants() from public, anon, authenticated, service_role;

create constraint trigger games_invariants after insert or update on public.games
  deferrable initially deferred for each row execute function private.check_game_invariants();
create constraint trigger members_invariants after insert or update or delete on public.game_members
  deferrable initially deferred for each row execute function private.check_game_invariants();
create constraint trigger questions_invariants after insert or update or delete on public.questions
  deferrable initially deferred for each row execute function private.check_game_invariants();
create constraint trigger categories_invariants after insert or update or delete on public.categories
  deferrable initially deferred for each row execute function private.check_game_invariants();
create constraint trigger completions_invariants after insert or update or delete on public.completions
  deferrable initially deferred for each row execute function private.check_game_invariants();

create function private.protect_member_identity() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (new.id, new.game_id, new.user_id, new.position)
    is distinct from (old.id, old.game_id, old.user_id, old.position) then
    raise exception using errcode = '23514', message = 'Membership identity is immutable';
  end if;
  return new;
end;
$$;
revoke all on function private.protect_member_identity() from public, anon, authenticated, service_role;
create trigger members_identity before update on public.game_members
  for each row execute function private.protect_member_identity();

create function private.protect_game_identity() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.id <> old.id or new.created_at <> old.created_at or new.revision < old.revision
    or new.next_question_number < old.next_question_number then
    raise exception using errcode = '23514', message = 'Game identity and counters cannot move backwards';
  end if;
  return new;
end;
$$;
revoke all on function private.protect_game_identity() from public, anon, authenticated, service_role;
create trigger games_identity before update on public.games
  for each row execute function private.protect_game_identity();
