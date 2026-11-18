-- Allow a private room to wait for its second authenticated member.
create or replace function private.check_game_invariants() returns trigger
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
  if v_count not between 1 and 2 or not exists (select 1 from public.game_members where game_id = v_game_id and position = 0) or (v_count = 1 and v_game.active_question_id is not null) then
    raise exception using errcode = '23514', message = 'A game requires its creator and at most one partner; play requires two members';
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

-- A joined partner cannot be silently removed and replaced; use revocation.
create function private.protect_member_deletion() returns trigger
language plpgsql set search_path='' as $$
begin
  if exists(select 1 from public.games where id=old.game_id) then
    raise exception using errcode='23514', message='Revoke memberships instead of deleting them';
  end if;
  return old;
end;
$$;
revoke all on function private.protect_member_deletion() from public,anon,authenticated,service_role;
create trigger members_no_delete before delete on public.game_members
  for each row execute function private.protect_member_deletion();

