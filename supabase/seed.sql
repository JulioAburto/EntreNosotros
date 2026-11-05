-- Idempotent catalog repair for existing games. Never creates identities or
-- resets progress, members, recipients, activation, turn, or custom questions.
do $$
declare v_id uuid;
begin
  for v_id in select id from public.games order by id loop
    perform private.seed_game(v_id);
  end loop;
end;
$$;
