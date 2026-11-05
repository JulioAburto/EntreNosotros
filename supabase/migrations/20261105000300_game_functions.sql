-- Immutable catalog identities; mutable activation and recipient remain allowed.
create function private.protect_catalog() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_id text; v_game_id uuid; v_original record; v_active text;
begin
  v_id := case when tg_op = 'DELETE' then old.id else new.id end;
  v_game_id := case when tg_op = 'DELETE' then old.game_id else new.game_id end;
  if tg_op = 'DELETE' then
    if old.source = 'initial' and exists (select 1 from public.games where id = v_game_id) then
      raise exception using errcode = '23514', message = 'Original catalog entries cannot be deleted';
    end if;
    if tg_table_name = 'questions' and exists
      (select 1 from public.games where id = v_game_id and active_question_id = old.id) then
      raise exception using errcode = '23514', message = 'The active question cannot be deleted';
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and (new.id, new.source) is distinct from (old.id, old.source) then
    raise exception using errcode = '23514', message = 'Catalog identity is immutable';
  end if;
  if tg_table_name = 'categories' then
    select * into v_original from private.original_categories() where id = v_id;
    if found then
      if (new.name, new.color, new.source) is distinct from
        (v_original.name, v_original.color, 'initial'::text) then
        raise exception using errcode = '23514', message = 'Original category content is immutable';
      end if;
    elsif new.source = 'initial' then
      raise exception using errcode = '23514', message = 'Unknown original category';
    end if;
  else
    select * into v_original from private.original_questions() where id = v_id;
    if found then
      if (new.number, new.text, new.category_id, new.created_at, new.source) is distinct from
        (v_original.number, v_original.text, v_original.category_id, v_original.created_at, 'initial'::text) then
        raise exception using errcode = '23514', message = 'Original question content is immutable';
      end if;
    elsif new.source = 'initial' then
      raise exception using errcode = '23514', message = 'Unknown original question';
    end if;
    if tg_op = 'UPDATE' then
      if (new.number, new.created_at) is distinct from (old.number, old.created_at) then
        raise exception using errcode = '23514', message = 'Question number and creation date are immutable';
      end if;
      select active_question_id into v_active from public.games where id = v_game_id;
      if old.id = v_active and (new.text, new.category_id, new.intended_responder_member_id)
        is distinct from (old.text, old.category_id, old.intended_responder_member_id) then
        raise exception using errcode = '23514', message = 'The active question cannot be edited or reassigned';
      end if;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.protect_catalog() from public, anon, authenticated, service_role;
create trigger categories_catalog before insert or update or delete on public.categories
  for each row execute function private.protect_catalog();
create trigger questions_catalog before insert or update or delete on public.questions
  for each row execute function private.protect_catalog();

create function private.seed_game(p_game_id uuid) returns void
language plpgsql set search_path = '' as $$
declare v_added integer; v_categories integer;
begin
  perform 1 from public.games where id = p_game_id for update;
  if not found then raise exception using errcode = '22023', message = 'Unknown game'; end if;
  insert into public.categories(game_id, id, name, color, source)
    select p_game_id, id, name, color, source from private.original_categories()
    on conflict (game_id, id) do nothing;
  get diagnostics v_categories = row_count;
  insert into public.questions(game_id, id, number, text, category_id, source, created_at)
    select p_game_id, id, number, text, category_id, 'initial', created_at
    from private.original_questions() on conflict (game_id, id) do nothing;
  get diagnostics v_added = row_count;
  if exists (select 1 from private.original_categories() o
    left join public.categories c on c.game_id = p_game_id and c.id = o.id
    where c.id is null or (c.name,c.color,c.source) is distinct from (o.name,o.color,o.source))
    or exists (select 1 from private.original_questions() o
      left join public.questions q on q.game_id = p_game_id and q.id = o.id
      where q.id is null or (q.number,q.text,q.category_id,q.created_at,q.source)
        is distinct from (o.number,o.text,o.category_id,o.created_at,'initial'::text)) then
    raise exception using errcode = '23514', message = 'Catalog conflicts with canonical originals';
  end if;
  if v_added + v_categories > 0 then
    update public.games set revision = revision + 1 where id = p_game_id;
  end if;
end;
$$;
revoke all on function private.seed_game(uuid) from public, anon, authenticated, service_role;

-- Administrative bootstrap ONLY. Auth invitation delivery is outside SQL.
-- RPC is exposed in public (the PostgREST schema); only service_role can call it.
create function public.create_private_game(
  p_game_id uuid, p_first_user_id uuid, p_second_user_id uuid,
  p_first_name text, p_second_name text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_first uuid := gen_random_uuid(); v_second uuid := gen_random_uuid(); v_existing public.games;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'Administrative role required';
  end if;
  if p_game_id is null or p_first_user_id is null or p_second_user_id is null
    or p_first_user_id = p_second_user_id
    or p_first_name is null or length(btrim(p_first_name)) not between 1 and 30
    or p_second_name is null or length(btrim(p_second_name)) not between 1 and 30 then
    raise exception using errcode = '22023', message = 'Two distinct users and valid names are required';
  end if;
  -- Serializes concurrent retries, even before the parent row exists.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_game_id::text, 0));
  select * into v_existing from public.games where id = p_game_id for update;
  if found then
    if not exists (select 1 from public.game_members where game_id = p_game_id
      and position = 0 and user_id = p_first_user_id)
      or not exists (select 1 from public.game_members where game_id = p_game_id
      and position = 1 and user_id = p_second_user_id) then
      raise exception using errcode = '23514', message = 'Game already belongs to different users';
    end if;
    return p_game_id;
  end if;
  insert into public.games(id, current_member_id) values (p_game_id, v_first);
  insert into public.game_members(id, game_id, user_id, position, display_name) values
    (v_first, p_game_id, p_first_user_id, 0, btrim(p_first_name)),
    (v_second, p_game_id, p_second_user_id, 1, btrim(p_second_name));
  perform private.seed_game(p_game_id);
  return p_game_id;
end;
$$;
revoke all on function public.create_private_game(uuid,uuid,uuid,text,text)
  from public, anon, authenticated, service_role;
grant execute on function public.create_private_game(uuid,uuid,uuid,text,text) to service_role;

create function public.get_game_snapshot(p_game_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'gameId', g.id, 'revision', g.revision, 'currentMemberId', g.current_member_id,
    'activeQuestionId', g.active_question_id, 'nextQuestionNumber', g.next_question_number,
    'enabledCategoryIds', g.enabled_category_ids, 'skippedQuestionIds', g.skipped_question_ids,
    'lastSkippedQuestionId', g.last_skipped_question_id,
    'members', (select coalesce(jsonb_agg(jsonb_build_object(
      'id',m.id,'position',m.position,'displayName',m.display_name) order by m.position),'[]')
      from public.game_members m where m.game_id = g.id),
    'categories', (select coalesce(jsonb_agg(to_jsonb(c) - 'game_id' order by c.id),'[]')
      from public.categories c where c.game_id = g.id),
    'questions', (select coalesce(jsonb_agg(to_jsonb(q) - 'game_id' order by q.number),'[]')
      from public.questions q where q.game_id = g.id),
    'completions', (select coalesce(jsonb_agg(to_jsonb(c) - 'game_id' order by c.question_id),'[]')
      from public.completions c where c.game_id = g.id)
  ) from public.games g where g.id = p_game_id;
$$;
revoke all on function public.get_game_snapshot(uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_game_snapshot(uuid) to authenticated;

create function private.random_index(p_length integer) returns integer
language plpgsql volatile set search_path = '' as $$
declare v_value bigint; v_limit bigint;
begin
  if p_length < 1 or p_length is null then
    raise exception using errcode = '22023', message = 'Invalid selection size';
  end if;
  v_limit := 4294967296 - (4294967296 % p_length);
  loop
    -- UUID v4's first 32 bits are random; version/variant bits are elsewhere.
    v_value := ('x' || substr(gen_random_uuid()::text, 1, 8))::bit(32)::bigint;
    exit when v_value < v_limit;
  end loop;
  return (v_value % p_length)::integer;
end;
$$;
revoke all on function private.random_index(integer) from public, anon, authenticated, service_role;

-- Not executable by app roles. Public typed wrappers below are the real RPC API.
create function private.execute_game_command(
  p_game_id uuid, p_command_id uuid, p_expected_revision bigint,
  p_command text, p_payload jsonb
) returns jsonb language plpgsql set search_path = '' as $$
declare
  v_game public.games; v_actor uuid; v_responder uuid; v_question text;
  v_receipt private.command_receipts; v_hash bytea; v_result jsonb;
  v_count integer; v_number integer; v_no_eligible boolean := false;
begin
  -- Same error for an absent game and a game owned by somebody else.
  if not private.is_game_member(p_game_id) then
    raise exception using errcode = '42501', message = 'Game access denied';
  end if;
  if p_command_id is null or p_expected_revision is null or p_expected_revision < 0 then
    raise exception using errcode = '22023', message = 'Command ID and expected revision required';
  end if;
  select * into v_game from public.games where id = p_game_id for update;
  -- Recheck after waiting for the lock: membership may have been revoked.
  select id into v_actor from public.game_members where game_id = p_game_id
    and user_id = (select auth.uid()) and revoked_at is null;
  if not found or exists (select 1 from public.game_members
    where game_id = p_game_id and revoked_at is not null) then
    raise exception using errcode = '42501', message = 'Game access denied';
  end if;
  v_hash := pg_catalog.sha256(pg_catalog.convert_to(
    jsonb_build_object('command',p_command,'revision',p_expected_revision,'payload',p_payload)::text,'UTF8'));
  select * into v_receipt from private.command_receipts
    where game_id = p_game_id and command_id = p_command_id;
  if found then
    if v_receipt.actor_member_id <> v_actor or v_receipt.payload_hash <> v_hash then
      raise exception using errcode = '22023', message = 'Command ID reused with different input';
    end if;
    return v_receipt.result;
  end if;
  if v_game.revision <> p_expected_revision then
    raise exception using errcode = '40001', message = 'Game revision conflict';
  end if;
  select id into strict v_responder from public.game_members
    where game_id = p_game_id and id <> v_game.current_member_id;
  v_question := p_payload->>'questionId';
  if p_command = 'reserve' then
    if v_game.active_question_id is not null then
      raise exception using errcode = '23514', message = 'A question is already active';
    end if;
    select count(*) into v_count from public.questions q where q.game_id = p_game_id
      and q.is_active and q.category_id = any(v_game.enabled_category_ids)
      and not (q.id = any(v_game.skipped_question_ids))
      and q.id is distinct from v_game.last_skipped_question_id
      and (q.intended_responder_member_id is null or q.intended_responder_member_id = v_responder)
      and not exists (select 1 from public.completions c where c.game_id = p_game_id and c.question_id = q.id);
    if v_count = 0 then v_no_eligible := true;
    else
      select q.id into strict v_question from public.questions q where q.game_id = p_game_id
        and q.is_active and q.category_id = any(v_game.enabled_category_ids)
        and not (q.id = any(v_game.skipped_question_ids))
        and q.id is distinct from v_game.last_skipped_question_id
        and (q.intended_responder_member_id is null or q.intended_responder_member_id = v_responder)
        and not exists (select 1 from public.completions c where c.game_id = p_game_id and c.question_id = q.id)
        order by q.id offset private.random_index(v_count) limit 1;
      update public.games set active_question_id = v_question, revision = revision + 1
        where id = p_game_id returning * into v_game;
    end if;
  elsif p_command in ('complete','skip') then
    if v_question is null or v_question is distinct from v_game.active_question_id then
      raise exception using errcode = '23514', message = 'Active question does not match';
    end if;
    if p_command = 'complete' then
      insert into public.completions(game_id,question_id,completed_at,responder_member_id,recorded_by_member_id)
        values (p_game_id,v_question,clock_timestamp(),v_responder,v_actor);
      update public.games set current_member_id = v_responder, active_question_id = null,
        revision = revision + 1 where id = p_game_id returning * into v_game;
    else
      update public.games set active_question_id = null, last_skipped_question_id = v_question,
        skipped_question_ids = array_append(skipped_question_ids,v_question), revision = revision + 1
        where id = p_game_id returning * into v_game;
    end if;
  elsif p_command = 'add_question' then
    v_question := p_payload->>'id';
    if v_question is null or v_question !~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$'
      or p_payload->>'text' is null or length(btrim(p_payload->>'text')) not between 1 and 2000
      or p_payload->>'categoryId' is null then
      raise exception using errcode = '22023', message = 'Invalid question input';
    end if;
    if (select count(*) from public.questions where game_id = p_game_id) >= 10000 then
      raise exception using errcode = '23514', message = 'Game bank limit exceeded';
    end if;
    v_number := v_game.next_question_number;
    insert into public.questions(game_id,id,number,text,category_id,source,intended_responder_member_id)
      values (p_game_id,v_question,v_number,btrim(p_payload->>'text'),p_payload->>'categoryId',
        'custom',(p_payload->>'intendedResponderMemberId')::uuid);
    update public.games set next_question_number = next_question_number + 1, revision = revision + 1
      where id = p_game_id returning * into v_game;
  else
    raise exception using errcode = '22023', message = 'Unknown game command';
  end if;
  v_result := jsonb_build_object('gameId',p_game_id,'commandId',p_command_id,
    'revision',v_game.revision,'questionId',v_question,'activeQuestionId',v_game.active_question_id,
    'number',v_number,'status',case when v_no_eligible then 'no_eligible' else 'ok' end);
  insert into private.command_receipts(game_id,command_id,actor_member_id,command_name,payload_hash,result)
    values (p_game_id,p_command_id,v_actor,p_command,v_hash,v_result);
  return v_result;
end;
$$;
revoke all on function private.execute_game_command(uuid,uuid,bigint,text,jsonb)
  from public, anon, authenticated, service_role;

create function public.reserve_question(p_game_id uuid,p_command_id uuid,p_expected_revision bigint)
returns jsonb language sql volatile security definer set search_path = '' as $$
  select private.execute_game_command(p_game_id,p_command_id,p_expected_revision,'reserve','{}');
$$;
create function public.complete_question(p_game_id uuid,p_command_id uuid,p_expected_revision bigint,p_question_id text)
returns jsonb language sql volatile security definer set search_path = '' as $$
  select private.execute_game_command(p_game_id,p_command_id,p_expected_revision,'complete',
    jsonb_build_object('questionId',p_question_id));
$$;
create function public.skip_question(p_game_id uuid,p_command_id uuid,p_expected_revision bigint,p_question_id text)
returns jsonb language sql volatile security definer set search_path = '' as $$
  select private.execute_game_command(p_game_id,p_command_id,p_expected_revision,'skip',
    jsonb_build_object('questionId',p_question_id));
$$;
create function public.add_question(p_game_id uuid,p_command_id uuid,p_expected_revision bigint,
  p_id text,p_text text,p_category_id text,p_intended_responder_member_id uuid default null)
returns jsonb language sql volatile security definer set search_path = '' as $$
  select private.execute_game_command(p_game_id,p_command_id,p_expected_revision,'add_question',
    jsonb_build_object('id',p_id,'text',p_text,'categoryId',p_category_id,
      'intendedResponderMemberId',p_intended_responder_member_id));
$$;
revoke all on function public.reserve_question(uuid,uuid,bigint),
  public.complete_question(uuid,uuid,bigint,text), public.skip_question(uuid,uuid,bigint,text),
  public.add_question(uuid,uuid,bigint,text,text,text,uuid) from public, anon, authenticated, service_role;
grant execute on function public.reserve_question(uuid,uuid,bigint),
  public.complete_question(uuid,uuid,bigint,text), public.skip_question(uuid,uuid,bigint,text),
  public.add_question(uuid,uuid,bigint,text,text,text,uuid) to authenticated;

-- Harden future functions created by this migration owner in our own schema.
alter default privileges in schema private revoke execute on functions from public;
alter default privileges in schema private revoke all on tables from anon, authenticated, service_role;
