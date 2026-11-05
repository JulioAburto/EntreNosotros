begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

-- Synthetic identities only. The entire file rolls back, including fixtures.
insert into auth.users(id,email) values
  ('10000000-0000-4000-8000-000000000001','player-a@example.invalid'),
  ('10000000-0000-4000-8000-000000000002','player-b@example.invalid'),
  ('10000000-0000-4000-8000-000000000003','player-c@example.invalid'),
  ('10000000-0000-4000-8000-000000000004','player-d@example.invalid'),
  ('10000000-0000-4000-8000-000000000005','outsider@example.invalid');
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
select public.create_private_game('20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','A','B');
select public.create_private_game('20000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000004','C','D');
reset role;

select is((select count(*) from public.questions where game_id = '20000000-0000-4000-8000-000000000001'),100::bigint,'100 originals per game');
select is((select count(*) from public.categories where game_id = '20000000-0000-4000-8000-000000000001'),10::bigint,'10 original categories');
select is((select count(*) from public.game_members where game_id = '20000000-0000-4000-8000-000000000001'),2::bigint,'exactly two members');
select ok(not exists (
  select 1 from private.original_questions() o join public.questions q on q.id = o.id
  where (q.number,q.text,q.category_id,q.created_at,q.source)
    is distinct from (o.number,o.text,o.category_id,o.created_at,'initial'::text)
),'original identifiers, text, category, number and date match exactly');
select ok(not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where (n.nspname = 'private' or (n.nspname = 'public' and p.proname in
    ('create_private_game','get_game_snapshot','reserve_question','complete_question','skip_question','add_question')))
  and not coalesce(p.proconfig @> array['search_path=""'],false)
),'every application SQL function pins an empty search_path');
select ok(not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace,
    lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
  where n.nspname = 'private' and a.grantee = 0 and a.privilege_type = 'EXECUTE'
),'no private function has PUBLIC execute');
select ok(not has_function_privilege('authenticated','private.execute_game_command(uuid,uuid,bigint,text,jsonb)','execute'),'internal command dispatcher is not callable by authenticated');
select ok(not has_function_privilege('authenticated','private.seed_game(uuid)','execute'),'seed helper is not callable by authenticated');
select ok(not has_function_privilege('anon','public.reserve_question(uuid,uuid,bigint)','execute'),'anon cannot reserve');
select ok(not has_function_privilege('authenticated','public.create_private_game(uuid,uuid,uuid,text,text)','execute'),'authenticated cannot create memberships');
select ok(has_function_privilege('service_role','public.create_private_game(uuid,uuid,uuid,text,text)','execute'),'administrative bootstrap is actually executable by service_role');
select ok(not has_table_privilege('service_role','public.games','update'),'even service_role has no direct game update grant');
select ok(not has_table_privilege('authenticated','private.command_receipts','select'),'receipts are private');
select ok(not has_schema_privilege('authenticated','public','create'),'authenticated cannot create shadow functions in public');
select ok(not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace,
    lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
  where n.nspname='public' and p.proname in ('create_private_game','get_game_snapshot',
    'reserve_question','complete_question','skip_question','add_question')
    and a.grantee=0 and a.privilege_type='EXECUTE'
),'no public application RPC inherits PUBLIC execute');
select throws_ok($$do $test$ begin
  insert into public.games(id,current_member_id,enabled_category_ids)
    values ('20000000-0000-4000-8000-000000000099',gen_random_uuid(),'{}');
  set constraints all immediate;
end $test$;$$,'23503',null,'a game cannot commit without its two membership identities');

select throws_ok($$update public.questions set text = 'altered' where game_id = '20000000-0000-4000-8000-000000000001' and id = 'initial-001'$$,'23514',null,'original question cannot be changed even by maintenance writes');
select throws_ok($$delete from public.questions where game_id = '20000000-0000-4000-8000-000000000001' and id = 'initial-001'$$,'23514',null,'original question cannot be deleted');
select throws_ok($$update public.categories set color = '#ffffff' where game_id = '20000000-0000-4000-8000-000000000001' and id = 'amor'$$,'23514',null,'original category cannot be changed');
select throws_ok($$insert into public.game_members(game_id,user_id,position,display_name) values ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000005',2,'E')$$,'23514',null,'third position is forbidden');
select throws_ok($$insert into public.game_members(game_id,user_id,position,display_name) values ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000005',1,'E')$$,'23505',null,'occupied position cannot be reused');
select throws_ok($$update public.game_members set user_id = '10000000-0000-4000-8000-000000000005' where game_id = '20000000-0000-4000-8000-000000000001' and position = 1$$,'23514',null,'stable membership cannot be reassigned');
select throws_ok($$do $test$ begin
  delete from public.game_members where game_id = '20000000-0000-4000-8000-000000000001' and position = 1;
  set constraints all immediate;
end $test$;$$,'23514',null,'deferred constraint rejects a game with only one member');
select throws_ok($$do $test$ begin
  update public.games set current_member_id = (select id from public.game_members
    where game_id = '20000000-0000-4000-8000-000000000002' and position = 0)
    where id = '20000000-0000-4000-8000-000000000001';
  set constraints all immediate;
end $test$;$$,'23503',null,'turn cannot reference a different game');
select throws_ok($$do $test$ begin
  update public.games set enabled_category_ids = array['unknown']
    where id = '20000000-0000-4000-8000-000000000001';
  set constraints all immediate;
end $test$;$$,'23514',null,'shared filters must reference real categories');

select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
select throws_ok($$select * from public.games$$,'42501',null,'anonymous cannot read games');
select throws_ok($$select * from public.questions$$,'42501',null,'anonymous cannot read questions');
select throws_ok($$select public.get_game_snapshot('20000000-0000-4000-8000-000000000001')$$,'42501',null,'anonymous cannot read snapshots');
reset role;

select set_config('request.jwt.claims','{"role":"authenticated","sub":"10000000-0000-4000-8000-000000000005"}',true);
set local role authenticated;
select is((select count(*) from public.games),0::bigint,'outsider sees no games');
select is((select count(*) from public.game_members),0::bigint,'outsider sees no memberships');
select is((select count(*) from public.categories),0::bigint,'outsider sees no categories');
select is((select count(*) from public.questions),0::bigint,'outsider sees no questions');
select is((select count(*) from public.completions),0::bigint,'outsider sees no completions');
select is(public.get_game_snapshot('20000000-0000-4000-8000-000000000001'),null::jsonb,'outsider snapshot reveals nothing');
select throws_ok($$select public.reserve_question('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',1)$$,'42501','Game access denied','outsider cannot invoke a privileged command for another game');
reset role;

create temporary table command_results(kind text primary key,body jsonb);
grant all on command_results to authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"10000000-0000-4000-8000-000000000001"}',true);
set local role authenticated;
select is((select count(*) from public.games),1::bigint,'member sees only own game');
select is((select count(*) from public.questions),100::bigint,'member sees only own question bank');
select is((select count(*) from public.game_members),2::bigint,'member sees own pair without policy recursion');
select throws_ok($$update public.games set current_member_id = current_member_id$$,'42501',null,'member cannot update turn directly');
select throws_ok($$update public.games set active_question_id = 'initial-001'$$,'42501',null,'member cannot update reservation directly');
select throws_ok($$update public.game_members set display_name = 'hijack'$$,'42501',null,'member cannot modify memberships directly');
select throws_ok($$update public.questions set is_active = false$$,'42501',null,'member cannot bypass question commands');
select throws_ok($$insert into public.completions(game_id,question_id,provenance) values ('20000000-0000-4000-8000-000000000001','initial-001','legacy')$$,'42501',null,'member cannot forge completions directly');
select throws_ok($$select public.create_private_game('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000005','A','E')$$,'42501',null,'member cannot self-enrol another user');
insert into command_results select 'reserve', public.reserve_question(
  '20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',1);
select is((select body->>'revision' from command_results where kind='reserve'),'2','reserve increments revision exactly once');
select ok((select active_question_id is not null from public.games),'reserve persists active question');
select is(public.reserve_question('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',1),
  (select body from command_results where kind='reserve'),'reserve retry returns the same receipt');
select throws_ok($$select public.reserve_question('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002',1)$$,'40001','Game revision conflict','stale reserve is rejected');
insert into command_results select 'complete',public.complete_question(
  '20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000003',2,
  (select body->>'questionId' from command_results where kind='reserve'));
select is((select count(*) from public.completions),1::bigint,'complete inserts exactly one completion');
select is((select m.position::integer from public.games g join public.game_members m on m.id=g.current_member_id),1,'complete alternates turn');
select is((select m.position::integer from public.completions c join public.game_members m on m.id=c.responder_member_id),1,'respondent is the opposite member, not the command actor');
select is(public.complete_question('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000003',2,
  (select body->>'questionId' from command_results where kind='reserve')),
  (select body from command_results where kind='complete'),'complete retry does not alternate again');
select throws_ok($$select public.complete_question('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000003',2,'different')$$,'22023','Command ID reused with different input','idempotency ID cannot be reused for different input');
select throws_ok($$select public.add_question('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000004',3,'custom-test','Question','unknown')$$,'23503',null,'invalid category rolls back the command');
select is((select revision from public.games),3::bigint,'failed command does not advance revision');
insert into command_results select 'add',public.add_question(
  '20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000004',3,
  'custom-test','Synthetic test question','amor');
select is((select number from public.questions where id='custom-test'),101,'custom questions extend the bank');
select is((select next_question_number from public.games),102,'number allocation advances');
insert into command_results select 'reserve2',public.reserve_question(
  '20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000005',4);
select is(public.skip_question('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000006',5,
  (select body->>'questionId' from command_results where kind='reserve2'))->>'revision','6','skip commits one revision');
select is((select m.position::integer from public.games g join public.game_members m on m.id=g.current_member_id),1,'skip preserves turn');
select is((select cardinality(skipped_question_ids) from public.games),1,'skip is shared and persistent');
reset role;

update public.questions set is_active=false, intended_responder_member_id=(
  select id from public.game_members where game_id='20000000-0000-4000-8000-000000000001' and position=1)
  where game_id='20000000-0000-4000-8000-000000000001' and id='initial-010';
select lives_ok($$select private.seed_game('20000000-0000-4000-8000-000000000001'); select private.seed_game('20000000-0000-4000-8000-000000000001')$$,'seed may run repeatedly');
select is((select revision from public.games where id='20000000-0000-4000-8000-000000000001'),6::bigint,'repeated seed does not change revision or turn');
select is((select count(*) from public.questions where game_id='20000000-0000-4000-8000-000000000001'),101::bigint,'seed preserves custom question');
select is((select count(*) from public.completions where game_id='20000000-0000-4000-8000-000000000001'),1::bigint,'seed preserves progress');
select ok((select not is_active and intended_responder_member_id is not null from public.questions
  where game_id='20000000-0000-4000-8000-000000000001' and id='initial-010'),'seed preserves activation and recipient');
select throws_ok($$do $test$ begin
  update public.games set next_question_number=103,revision=revision+1
    where id='20000000-0000-4000-8000-000000000001';
  insert into public.questions(game_id,id,number,text,category_id,source,intended_responder_member_id)
    select '20000000-0000-4000-8000-000000000001','custom-cross-member',102,'Synthetic','amor','custom',id
    from public.game_members where game_id='20000000-0000-4000-8000-000000000002' and position=0;
  set constraints all immediate;
end $test$;$$,'23503',null,'question recipient cannot belong to another game');
select throws_ok($$do $test$ begin
  insert into public.completions(game_id,question_id,responder_member_id,provenance)
    select '20000000-0000-4000-8000-000000000001','initial-100',id,'legacy'
    from public.game_members where game_id='20000000-0000-4000-8000-000000000002' and position=0;
  set constraints all immediate;
end $test$;$$,'23503',null,'completion respondent cannot come from another game');
select throws_ok($$insert into public.completions(game_id,question_id,completed_at,provenance)
  values ('20000000-0000-4000-8000-000000000001','initial-099','1970-01-01T00:00:00Z','legacy')$$,'23514',null,'epoch marker is not a real completion date');
select lives_ok($$insert into public.completions(game_id,question_id,completed_at,responder_member_id,provenance)
  values ('20000000-0000-4000-8000-000000000001','initial-098',null,null,'legacy')$$,'legacy unknown date and respondent remain unknown');
select throws_ok($$insert into public.completions(game_id,question_id,provenance)
  select game_id,question_id,'legacy' from public.completions where question_id='initial-098'$$,'23505',null,'completion is unique per game and question');

update public.game_members set revoked_at=now()
  where game_id='20000000-0000-4000-8000-000000000001' and position=0;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"10000000-0000-4000-8000-000000000001"}',true);
set local role authenticated;
select is((select count(*) from public.games),0::bigint,'revoked membership no longer grants reads');
select throws_ok($$select public.reserve_question('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000007',6)$$,'42501','Game access denied','revoked member cannot replay or mutate');
reset role;

-- Flush every deferred invariant before rollback; avoids false green tests.
set constraints all immediate;
select * from finish();
rollback;
