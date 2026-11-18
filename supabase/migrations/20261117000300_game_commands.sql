create or replace function private.execute_game_command(
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
  if (select count(*) from public.game_members where game_id = p_game_id and revoked_at is null) <> 2 then
    raise exception using errcode = '23514', message = 'Waiting for partner';
  end if;
  select id into strict v_responder from public.game_members
    where game_id = p_game_id and id <> v_game.current_member_id;
  if p_command in ('reserve','skip','turn','reset') and v_actor <> v_game.current_member_id then
    raise exception using errcode='42501', message='Asker required';
  end if;
  if p_command = 'complete' and v_actor <> v_responder then
    raise exception using errcode='42501', message='Responder required';
  end if;
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

  elsif p_command = 'settings' then
    if jsonb_typeof(p_payload->'categoryIds') <> 'array' or jsonb_array_length(p_payload->'categoryIds') > 100 then
      raise exception using errcode='22023', message='Invalid categories';
    end if;
    update public.games set enabled_category_ids = array(select jsonb_array_elements_text(p_payload->'categoryIds')), revision=revision+1 where id=p_game_id returning * into v_game;
  elsif p_command = 'recover_skipped' then
    update public.games set skipped_question_ids='{}',last_skipped_question_id=null,revision=revision+1 where id=p_game_id returning * into v_game;
  elsif p_command in ('turn','reset') then
    if not exists(select 1 from public.game_members where game_id=p_game_id and id=(p_payload->>'memberId')::uuid and revoked_at is null) then
      raise exception using errcode='22023', message='Invalid member';
    end if;
    if p_command='turn' and v_game.active_question_id is not null then
      raise exception using errcode='23514', message='Active question must be completed or skipped first';
    end if;
    if p_command='reset' then
      if jsonb_typeof(p_payload->'clearProgress') <> 'boolean' then raise exception using errcode='22023',message='Invalid reset'; end if;
      if (p_payload->>'clearProgress')::boolean then delete from public.completions where game_id=p_game_id; end if;
    end if;
    update public.games set current_member_id=(p_payload->>'memberId')::uuid,
      active_question_id=null,skipped_question_ids='{}',last_skipped_question_id=null,revision=revision+1
      where id=p_game_id returning * into v_game;
  elsif p_command in ('uncomplete','mark_complete') then
    if not exists(select 1 from public.questions where game_id=p_game_id and id=v_question) then
      raise exception using errcode='22023',message='Unknown question';
    end if;
    if p_command='uncomplete' then delete from public.completions where game_id=p_game_id and question_id=v_question;
    elsif v_question=v_game.active_question_id then
      if v_actor<>v_responder then raise exception using errcode='42501',message='Responder required'; end if;
      insert into public.completions(game_id,question_id,completed_at,responder_member_id,recorded_by_member_id)
        values(p_game_id,v_question,clock_timestamp(),v_responder,v_actor);
      update public.games set current_member_id=v_responder,active_question_id=null where id=p_game_id;
    else
      insert into public.completions(game_id,question_id,completed_at,recorded_by_member_id,provenance)
        values(p_game_id,v_question,clock_timestamp(),v_actor,'manual') on conflict do nothing;
    end if;
    update public.games set revision=revision+1 where id=p_game_id returning * into v_game;
  elsif p_command='add_category' then
    insert into public.categories(game_id,id,name,color,source)
      values(p_game_id,p_payload->>'id',btrim(p_payload->>'name'),p_payload->>'color','custom');
    update public.games set enabled_category_ids=array_append(enabled_category_ids,p_payload->>'id'),revision=revision+1
      where id=p_game_id returning * into v_game;
  elsif p_command='edit_question' then
    if not exists(select 1 from public.questions where game_id=p_game_id and id=v_question) then raise exception using errcode='22023',message='Unknown question'; end if;
    update public.questions set text=p_payload->>'text',category_id=p_payload->>'categoryId',
      intended_responder_member_id=(p_payload->>'responderId')::uuid,is_active=(p_payload->>'isActive')::boolean
      where game_id=p_game_id and id=v_question;
    update public.games set revision=revision+1 where id=p_game_id returning * into v_game;
  elsif p_command='delete_question' then
    if not exists(select 1 from public.questions where game_id=p_game_id and id=v_question and source='custom') then raise exception using errcode='23514',message='Only custom questions can be deleted'; end if;
    if v_question=v_game.active_question_id then raise exception using errcode='23514',message='Active question cannot be deleted'; end if;
    update public.games set skipped_question_ids=array_remove(skipped_question_ids,v_question),
      last_skipped_question_id=case when last_skipped_question_id=v_question then null else last_skipped_question_id end,
      revision=revision+1 where id=p_game_id returning * into v_game;
    delete from public.questions where game_id=p_game_id and id=v_question;
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


create function public.game_command(p_game_id uuid,p_command_id uuid,p_expected_revision bigint,p_command text,p_payload jsonb)
returns jsonb language sql volatile security definer set search_path='' as $$
  select private.execute_game_command(p_game_id,p_command_id,p_expected_revision,p_command,p_payload);
$$;
revoke all on function public.game_command(uuid,uuid,bigint,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.game_command(uuid,uuid,bigint,text,jsonb) to authenticated;
create or replace function public.get_game_snapshot(p_game_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'gameId', g.id, 'name', g.name, 'viewerMemberId', (select id from public.game_members where game_id=g.id and user_id=auth.uid() and revoked_at is null), 'revision', g.revision, 'currentMemberId', g.current_member_id,
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

