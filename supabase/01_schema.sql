-- HRconnect — Supabase schema
-- Run this in Supabase SQL Editor after creating the project

-- ============ profiles ============
create table if not exists profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text unique not null,
  full_name text,
  phone text,
  company text,
  created_at timestamptz default now()
);

-- ============ subscriptions ============
create type subscription_tier as enum ('free', 'pro', 'enterprise');

create table if not exists subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade unique not null,
  tier subscription_tier not null default 'free',
  tests_quota int not null default 2,        -- monthly quota (free=2, pro=50, enterprise=unlimited via 99999)
  tests_used_this_month int not null default 0,
  valid_until date,                          -- null for free; date for paid
  activated_by_admin boolean default false,
  notes text,
  updated_at timestamptz default now()
);

-- ============ candidates ============
create table if not exists candidates (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  email text,
  phone text,
  age int,
  sex text,
  position text,
  product_self text,
  verdict text,                              -- Перформер / Делатель / null
  verdict_confidence text,                   -- висока / помірна
  verdict_score int,
  verdict_reasons jsonb,
  iq int,
  iq_band text,
  reproduction int,
  reproduction_band text,
  points jsonb,                              -- {A:{score,level,thesis,full}, B:{...}, ...}
  raw_answers jsonb,
  test_status text default 'pending',        -- pending / completed / cancelled
  test_link_token text unique,               -- public token for candidate to take the test
  test_completed_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_candidates_user on candidates(user_id);
create index if not exists idx_candidates_token on candidates(test_link_token);

-- ============ test_responses ============
-- Raw answers from candidates as they progress through the test
create table if not exists test_responses (
  id uuid default gen_random_uuid() primary key,
  candidate_id uuid references candidates(id) on delete cascade not null,
  question_key text not null,                -- e.g. 'q1_agrees_product'
  answer text,
  created_at timestamptz default now()
);

-- ============ trigger: auto-create profile + free subscription on signup ============
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email)
  values (new.id, new.email);
  
  insert into subscriptions (user_id, tier, tests_quota)
  values (new.id, 'free', 2);
  
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
