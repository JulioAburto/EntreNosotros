alter table public.games add column name text not null default 'Nuestra partida'
  check (length(btrim(name)) between 1 and 80);

create table private.game_invitations (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  token_hash bytea not null unique,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  revoked_at timestamptz,
  used_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index invitations_game_idx on private.game_invitations(game_id);
create table private.join_requests (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references private.game_invitations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (length(btrim(display_name)) between 1 and 30),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  unique (invitation_id, user_id)
);
alter table private.game_invitations enable row level security;
alter table private.join_requests enable row level security;
revoke all on private.game_invitations, private.join_requests from public, anon, authenticated, service_role;

create function private.create_room(p_game_id uuid, p_name text, p_display_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_member uuid := gen_random_uuid();
begin
  if v_user is null then raise exception using errcode='42501', message='Authentication required'; end if;
  if p_game_id is null or p_name is null or length(btrim(p_name)) not between 1 and 80
    or p_display_name is null or length(btrim(p_display_name)) not between 1 and 30 then
    raise exception using errcode='22023', message='Invalid room input';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 1));
  if exists(select 1 from public.games where id=p_game_id) then
    if exists(select 1 from public.game_members where game_id=p_game_id and user_id=v_user and position=0 and revoked_at is null)
      then return p_game_id; end if;
    raise exception using errcode='42501', message='Room unavailable';
  end if;
  if (select count(*) from public.game_members where user_id=v_user and position=0) >= 10 then
    raise exception using errcode='23514', message='Room limit reached';
  end if;
  insert into public.games(id,current_member_id,name) values(p_game_id,v_member,btrim(p_name));
  insert into public.game_members(id,game_id,user_id,position,display_name)
    values(v_member,p_game_id,v_user,0,btrim(p_display_name));
  perform private.seed_game(p_game_id);
  return p_game_id;
end;
$$;

-- Tokens are generated with 256 random bits by the caller; only hashes persist.
create function private.create_invitation(p_game_id uuid, p_token text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.games where id=p_game_id for update;
  if not exists(select 1 from public.game_members where game_id=p_game_id and user_id=auth.uid() and position=0 and revoked_at is null) then
    raise exception using errcode='42501', message='Creator required';
  end if;
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' then raise exception using errcode='22023', message='Invalid token'; end if;
  if exists(select 1 from public.game_members where game_id=p_game_id and position=1) then
    raise exception using errcode='23514', message='Room is full';
  end if;
  if exists(select 1 from private.game_invitations where game_id=p_game_id and token_hash=sha256(convert_to(p_token,'UTF8')) and revoked_at is null) then return; end if;
  if (select count(*) from private.game_invitations where game_id=p_game_id and created_at > now()-interval '1 hour') >= 10 then
    raise exception using errcode='23514', message='Invitation rate limit';
  end if;
  update private.game_invitations set revoked_at=now() where game_id=p_game_id and revoked_at is null and used_by is null;
  insert into private.game_invitations(game_id,token_hash) values(p_game_id,sha256(convert_to(p_token,'UTF8')));
end;
$$;

create function private.request_join(p_token text, p_display_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_inv private.game_invitations; v_id uuid; v_user uuid := auth.uid();
begin
  if v_user is null then raise exception using errcode='42501', message='Authentication required'; end if;
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' or p_display_name is null or length(btrim(p_display_name)) not between 1 and 30 then
    raise exception using errcode='22023', message='Invalid request';
  end if;
  -- Read the game ID first, then lock in the same order as approval/revocation.
  select * into v_inv from private.game_invitations where token_hash=sha256(convert_to(p_token,'UTF8'));
  if not found then raise exception using errcode='42501', message='Invitation unavailable'; end if;
  perform 1 from public.games where id=v_inv.game_id for update;
  select * into v_inv from private.game_invitations where id=v_inv.id for update;
  if v_inv.revoked_at is not null or v_inv.expires_at <= now() or v_inv.used_by is not null then
    raise exception using errcode='42501', message='Invitation unavailable';
  end if;
  if exists(select 1 from public.game_members where game_id=v_inv.game_id and (user_id=v_user or position=1)) then
    raise exception using errcode='23514', message='Already a member or room full';
  end if;
  if (select count(*) from private.join_requests where invitation_id=v_inv.id) >= 20
    and not exists(select 1 from private.join_requests where invitation_id=v_inv.id and user_id=v_user) then
    raise exception using errcode='23514', message='Request limit reached';
  end if;
  insert into private.join_requests(invitation_id,user_id,display_name) values(v_inv.id,v_user,btrim(p_display_name))
    on conflict(invitation_id,user_id) do nothing;
  select id into v_id from private.join_requests where invitation_id=v_inv.id and user_id=v_user;
  return v_id;
end;
$$;

create function private.decide_join(p_game_id uuid, p_request_id uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_req private.join_requests; v_inv private.game_invitations;
begin
  perform 1 from public.games where id=p_game_id for update;
  if not exists(select 1 from public.game_members where game_id=p_game_id and user_id=auth.uid() and position=0 and revoked_at is null) then
    raise exception using errcode='42501', message='Creator required';
  end if;
  select r.* into v_req from private.join_requests r join private.game_invitations i on i.id=r.invitation_id where r.id=p_request_id and i.game_id=p_game_id;
  if not found or p_approve is null then raise exception using errcode='22023', message='Unknown request'; end if;
  if v_req.status = (case when p_approve then 'approved' else 'rejected' end) then return; end if;
  if v_req.status <> 'pending' then raise exception using errcode='23514', message='Request already decided'; end if;
  select * into v_inv from private.game_invitations where id=v_req.invitation_id for update;
  if p_approve then
    if v_inv.revoked_at is not null or v_inv.expires_at <= now() or v_inv.used_by is not null then
      raise exception using errcode='42501', message='Invitation unavailable';
    end if;
    if exists(select 1 from public.game_members where game_id=p_game_id and position=1) then
      raise exception using errcode='23514', message='Room is full';
    end if;
    insert into public.game_members(game_id,user_id,position,display_name) values(p_game_id,v_req.user_id,1,v_req.display_name);
    update private.game_invitations set used_by=v_req.user_id where id=v_inv.id;
    update private.game_invitations set revoked_at=now() where game_id=p_game_id and id<>v_inv.id and revoked_at is null;
    update private.join_requests set status='rejected' where invitation_id in (select id from private.game_invitations where game_id=p_game_id) and status='pending' and id<>p_request_id;
    update public.games set revision=revision+1 where id=p_game_id;
  end if;
  update private.join_requests set status=case when p_approve then 'approved' else 'rejected' end where id=p_request_id;
end;
$$;

create function private.revoke_invitations(p_game_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.games where id=p_game_id for update;
  if not exists(select 1 from public.game_members where game_id=p_game_id and user_id=auth.uid() and position=0 and revoked_at is null) then
    raise exception using errcode='42501', message='Creator required';
  end if;
  update private.game_invitations set revoked_at=now() where game_id=p_game_id and revoked_at is null and used_by is null;
end;
$$;

create function private.get_room_lobby() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'games',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'name',g.name,'memberId',m.id,'position',m.position,'displayName',m.display_name) order by g.created_at)
      from public.games g join public.game_members m on m.game_id=g.id where m.user_id=auth.uid() and m.revoked_at is null),'[]'::jsonb),
    'requests',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'gameId',i.game_id,'displayName',r.display_name,'status',r.status,'expired',i.expires_at<=now(),'revoked',i.revoked_at is not null,'mine',r.user_id=auth.uid()))
      from private.join_requests r join private.game_invitations i on i.id=r.invitation_id
      where r.user_id=auth.uid() or exists(select 1 from public.game_members m where m.game_id=i.game_id and m.user_id=auth.uid() and m.position=0 and m.revoked_at is null)),'[]'::jsonb));
$$;

create function public.create_room(p_game_id uuid,p_name text,p_display_name text) returns uuid
language sql security invoker set search_path='' as $$ select private.create_room(p_game_id,p_name,p_display_name); $$;
create function public.create_invitation(p_game_id uuid,p_token text) returns void
language sql security invoker set search_path='' as $$ select private.create_invitation(p_game_id,p_token); $$;
create function public.request_join(p_token text,p_display_name text) returns uuid
language sql security invoker set search_path='' as $$ select private.request_join(p_token,p_display_name); $$;
create function public.decide_join(p_game_id uuid,p_request_id uuid,p_approve boolean) returns void
language sql security invoker set search_path='' as $$ select private.decide_join(p_game_id,p_request_id,p_approve); $$;
create function public.revoke_invitations(p_game_id uuid) returns void
language sql security invoker set search_path='' as $$ select private.revoke_invitations(p_game_id); $$;
create function public.get_room_lobby() returns jsonb
language sql stable security invoker set search_path='' as $$ select private.get_room_lobby(); $$;

revoke all on function private.create_room(uuid,text,text),private.create_invitation(uuid,text),private.request_join(text,text),private.decide_join(uuid,uuid,boolean),private.revoke_invitations(uuid),private.get_room_lobby(),
  public.create_room(uuid,text,text),public.create_invitation(uuid,text),public.request_join(text,text),public.decide_join(uuid,uuid,boolean),public.revoke_invitations(uuid),public.get_room_lobby() from public,anon,authenticated,service_role;
grant execute on function private.create_room(uuid,text,text),private.create_invitation(uuid,text),private.request_join(text,text),private.decide_join(uuid,uuid,boolean),private.revoke_invitations(uuid),private.get_room_lobby(),
  public.create_room(uuid,text,text),public.create_invitation(uuid,text),public.request_join(text,text),public.decide_join(uuid,uuid,boolean),public.revoke_invitations(uuid),public.get_room_lobby() to authenticated;
