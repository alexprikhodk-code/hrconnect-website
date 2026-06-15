-- =============================================================
-- КРИТИЧНИЙ ФІКС БЕЗПЕКИ
-- Поточна політика cand_public_by_token дозволяла будь-якому
-- залогіненому користувачу бачити ВСІХ кандидатів усіх інших
-- акаунтів, бо в RLS політики SELECT OR'аться між собою.
--
-- Виправлення:
--  1. Видаляємо широку публічну політику SELECT за наявністю токена.
--  2. Створюємо SECURITY DEFINER функції для тест-сторінок, щоб
--     кандидат міг прочитати/оновити СВІЙ рядок за точним токеном.
-- =============================================================

-- Drop dangerous policies
drop policy if exists cand_public_by_token on candidates;
drop policy if exists cand_public_update_by_token on candidates;
drop policy if exists cand_update_by_token on candidates;

-- =============================================================
-- 1) RPC: отримати кандидата за точним токеном (для тест-сторінок)
-- =============================================================
create or replace function get_candidate_by_token(p_token text)
returns candidates
language plpgsql
security definer
set search_path = public
as $$
declare
  result candidates;
begin
  if p_token is null or length(p_token) < 8 then
    raise exception 'invalid token';
  end if;
  select * into result from candidates where test_link_token = p_token limit 1;
  return result;
end;
$$;

revoke all on function get_candidate_by_token(text) from public;
grant execute on function get_candidate_by_token(text) to anon, authenticated;

-- =============================================================
-- 2) RPC: оновити поля кандидата за точним токеном (для збереження
--    відповідей тестів). Дозволяємо тільки безпечні поля.
-- =============================================================
create or replace function update_candidate_by_token(
  p_token text,
  p_data jsonb
) returns candidates
language plpgsql
security definer
set search_path = public
as $$
declare
  result candidates;
  c_id uuid;
  -- Whitelist of allowed fields the candidate may modify
  allowed_keys text[] := array[
    'raw_answers','product_self','points','verdict','verdict_confidence',
    'verdict_score','verdict_reasons','test_status','test_completed_at',
    'productivity_completed_at',
    'enneagram_type','enneagram_wing','enneagram_summary','enneagram_completed_at',
    'disc_dominant','disc_secondary','disc_profile','disc_summary','disc_completed_at',
    'bigfive_dominant','bigfive_scores','bigfive_summary','bigfive_completed_at',
    'iq','iq_band','iq_correct','iq_summary','iq_completed_at',
    'reproduction','reproduction_band','reproduction_summary','reproduction_completed_at'
  ];
  k text;
  cleaned jsonb := '{}'::jsonb;
begin
  if p_token is null or length(p_token) < 8 then
    raise exception 'invalid token';
  end if;

  -- Find candidate by token
  select id into c_id from candidates where test_link_token = p_token limit 1;
  if c_id is null then
    raise exception 'candidate not found';
  end if;

  -- Build cleaned payload from whitelist
  for k in select jsonb_object_keys(p_data) loop
    if k = any(allowed_keys) then
      cleaned := cleaned || jsonb_build_object(k, p_data->k);
    end if;
  end loop;

  -- Apply update by merging only whitelisted fields
  update candidates
  set
    raw_answers              = coalesce((cleaned->'raw_answers'), raw_answers),
    product_self             = coalesce(cleaned->>'product_self', product_self),
    points                   = coalesce(cleaned->'points', points),
    verdict                  = coalesce(cleaned->>'verdict', verdict),
    verdict_confidence       = coalesce(cleaned->>'verdict_confidence', verdict_confidence),
    verdict_score            = coalesce((cleaned->>'verdict_score')::int, verdict_score),
    verdict_reasons          = coalesce(cleaned->'verdict_reasons', verdict_reasons),
    test_status              = coalesce(cleaned->>'test_status', test_status),
    test_completed_at        = coalesce((cleaned->>'test_completed_at')::timestamptz, test_completed_at),
    productivity_completed_at= coalesce((cleaned->>'productivity_completed_at')::timestamptz, productivity_completed_at),
    enneagram_type           = coalesce((cleaned->>'enneagram_type')::int, enneagram_type),
    enneagram_wing           = coalesce((cleaned->>'enneagram_wing')::int, enneagram_wing),
    enneagram_summary        = coalesce(cleaned->>'enneagram_summary', enneagram_summary),
    enneagram_completed_at   = coalesce((cleaned->>'enneagram_completed_at')::timestamptz, enneagram_completed_at),
    disc_dominant            = coalesce(cleaned->>'disc_dominant', disc_dominant),
    disc_secondary           = coalesce(cleaned->>'disc_secondary', disc_secondary),
    disc_profile             = coalesce(cleaned->>'disc_profile', disc_profile),
    disc_summary             = coalesce(cleaned->>'disc_summary', disc_summary),
    disc_completed_at        = coalesce((cleaned->>'disc_completed_at')::timestamptz, disc_completed_at),
    bigfive_dominant         = coalesce(cleaned->>'bigfive_dominant', bigfive_dominant),
    bigfive_scores           = coalesce(cleaned->'bigfive_scores', bigfive_scores),
    bigfive_summary          = coalesce(cleaned->>'bigfive_summary', bigfive_summary),
    bigfive_completed_at     = coalesce((cleaned->>'bigfive_completed_at')::timestamptz, bigfive_completed_at),
    iq                       = coalesce((cleaned->>'iq')::int, iq),
    iq_band                  = coalesce(cleaned->>'iq_band', iq_band),
    iq_correct               = coalesce((cleaned->>'iq_correct')::int, iq_correct),
    iq_summary               = coalesce(cleaned->>'iq_summary', iq_summary),
    iq_completed_at          = coalesce((cleaned->>'iq_completed_at')::timestamptz, iq_completed_at),
    reproduction             = coalesce((cleaned->>'reproduction')::int, reproduction),
    reproduction_band        = coalesce(cleaned->>'reproduction_band', reproduction_band),
    reproduction_summary     = coalesce(cleaned->>'reproduction_summary', reproduction_summary),
    reproduction_completed_at= coalesce((cleaned->>'reproduction_completed_at')::timestamptz, reproduction_completed_at)
  where id = c_id
  returning * into result;

  return result;
end;
$$;

revoke all on function update_candidate_by_token(text, jsonb) from public;
grant execute on function update_candidate_by_token(text, jsonb) to anon, authenticated;

-- =============================================================
-- Re-verify the safe SELECT policy (each user sees only own)
-- =============================================================
drop policy if exists cand_select_own on candidates;
create policy cand_select_own on candidates for select using (auth.uid() = user_id);

-- Force RLS even for table owner (extra safety)
alter table candidates force row level security;
