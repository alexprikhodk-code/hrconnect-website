-- HRconnect — Row Level Security
-- Run AFTER 01_schema.sql

alter table profiles enable row level security;
alter table subscriptions enable row level security;
alter table candidates enable row level security;
alter table test_responses enable row level security;

-- profiles: each user sees/edits only own
create policy "profiles_select_own" on profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);

-- subscriptions: each user reads own (only admin can modify directly via service role)
create policy "subs_select_own" on subscriptions for select using (auth.uid() = user_id);

-- candidates: each user has full CRUD on own
create policy "cand_select_own" on candidates for select using (auth.uid() = user_id);
create policy "cand_insert_own" on candidates for insert with check (auth.uid() = user_id);
create policy "cand_update_own" on candidates for update using (auth.uid() = user_id);
create policy "cand_delete_own" on candidates for delete using (auth.uid() = user_id);

-- candidates: PUBLIC read via test_link_token (for candidate to take the test without login)
create policy "cand_public_by_token" on candidates for select using (test_link_token is not null);

-- test_responses: candidates can insert (no auth) using token; users see own candidate responses
create policy "tr_insert_via_token" on test_responses for insert with check (true);
create policy "tr_select_own" on test_responses for select using (
  exists(select 1 from candidates c where c.id = test_responses.candidate_id and c.user_id = auth.uid())
);
