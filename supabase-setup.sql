alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.predictions enable row level security;
alter table public.prediction_reactions enable row level security;

grant usage on schema public to anon;
grant select on public.players to anon;
grant select on public.matches to anon;
grant select, insert, update on public.predictions to anon;
grant select, insert, update, delete on public.prediction_reactions to anon;

drop policy if exists "Players are readable by app" on public.players;
create policy "Players are readable by app"
on public.players for select
to anon
using (true);

drop policy if exists "Matches are readable by app" on public.matches;
create policy "Matches are readable by app"
on public.matches for select
to anon
using (true);

drop policy if exists "Predictions are readable by app" on public.predictions;
create policy "Predictions are readable by app"
on public.predictions for select
to anon
using (true);

drop policy if exists "Predictions can be inserted by app" on public.predictions;
create policy "Predictions can be inserted by app"
on public.predictions for insert
to anon
with check (true);

drop policy if exists "Predictions can be updated by app" on public.predictions;
create policy "Predictions can be updated by app"
on public.predictions for update
to anon
using (true)
with check (true);

drop policy if exists "Reactions are readable by app" on public.prediction_reactions;
create policy "Reactions are readable by app"
on public.prediction_reactions for select
to anon
using (true);

drop policy if exists "Reactions can be inserted by app" on public.prediction_reactions;
create policy "Reactions can be inserted by app"
on public.prediction_reactions for insert
to anon
with check (true);

drop policy if exists "Reactions can be updated by app" on public.prediction_reactions;
create policy "Reactions can be updated by app"
on public.prediction_reactions for update
to anon
using (true)
with check (true);

drop policy if exists "Reactions can be deleted by app" on public.prediction_reactions;
create policy "Reactions can be deleted by app"
on public.prediction_reactions for delete
to anon
using (true);

insert into public.players (nickname, pin_code)
values
  ('Pasha', '6743'),
  ('Fedor', '1708')
on conflict (nickname) do update
set pin_code = excluded.pin_code;

insert into public.matches (
  id,
  home_team,
  away_team,
  kickoff_time,
  status,
  final_home_score,
  final_away_score,
  round_name
)
values
  ('wc2026-001', 'Mexico', 'Portugal', '2026-06-11T20:00:00.000Z', 'scheduled', null, null, 'Group A'),
  ('wc2026-002', 'Canada', 'Japan', '2026-06-12T00:00:00.000Z', 'scheduled', null, null, 'Group B'),
  ('wc2026-003', 'United States', 'Ghana', '2026-06-02T10:00:00.000Z', 'live', null, null, 'Group C'),
  ('wc2026-004', 'Brazil', 'Germany', '2026-06-01T19:00:00.000Z', 'finished', 2, 1, 'Group A'),
  ('wc2026-005', 'Argentina', 'France', '2026-05-31T19:00:00.000Z', 'finished', 1, 1, 'Group B'),
  ('wc2026-006', 'Spain', 'Morocco', '2026-06-15T18:00:00.000Z', 'scheduled', null, null, 'Group C')
on conflict (id) do update
set
  home_team = excluded.home_team,
  away_team = excluded.away_team,
  kickoff_time = excluded.kickoff_time,
  status = excluded.status,
  final_home_score = excluded.final_home_score,
  final_away_score = excluded.final_away_score,
  round_name = excluded.round_name;
