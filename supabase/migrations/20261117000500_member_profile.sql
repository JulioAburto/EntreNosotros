create function private.set_member_name(p_game_id uuid,p_command_id uuid,p_expected_revision bigint,p_name text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_actor uuid; v_revision bigint; v_receipt private.command_receipts; v_hash bytea; v_result jsonb;
begin
  if not private.is_game_member(p_game_id) then raise exception using errcode='42501',message='Game access denied'; end if;
  select revision into v_revision from public.games where id=p_game_id for update;
  select id into v_actor from public.game_members where game_id=p_game_id and user_id=auth.uid() and revoked_at is null;
  if v_actor is null then raise exception using errcode='42501',message='Game access denied'; end if;
  if p_command_id is null or p_expected_revision is null or p_name is null or length(btrim(p_name)) not between 1 and 30 then
    raise exception using errcode='22023',message='Invalid profile';
  end if;
  v_hash := sha256(convert_to(jsonb_build_object('name',p_name,'revision',p_expected_revision)::text,'UTF8'));
  select * into v_receipt from private.command_receipts where game_id=p_game_id and command_id=p_command_id;
  if found then
    if v_receipt.actor_member_id<>v_actor or v_receipt.command_name<>'profile' or v_receipt.payload_hash<>v_hash then
      raise exception using errcode='22023',message='Command ID reused with different input';
    end if;
    return v_receipt.result;
  end if;
  if v_revision<>p_expected_revision then raise exception using errcode='40001',message='Game revision conflict'; end if;
  update public.game_members set display_name=btrim(p_name) where id=v_actor;
  update public.games set revision=revision+1 where id=p_game_id returning revision into v_revision;
  v_result := jsonb_build_object('status','ok','revision',v_revision);
  insert into private.command_receipts(game_id,command_id,actor_member_id,command_name,payload_hash,result)
    values(p_game_id,p_command_id,v_actor,'profile',v_hash,v_result);
  return v_result;
end;
$$;
create function public.set_member_name(p_game_id uuid,p_command_id uuid,p_expected_revision bigint,p_name text) returns jsonb
language sql security invoker set search_path='' as $$ select private.set_member_name(p_game_id,p_command_id,p_expected_revision,p_name); $$;
revoke all on function private.set_member_name(uuid,uuid,bigint,text),public.set_member_name(uuid,uuid,bigint,text) from public,anon,authenticated,service_role;
grant execute on function private.set_member_name(uuid,uuid,bigint,text),public.set_member_name(uuid,uuid,bigint,text) to authenticated;
