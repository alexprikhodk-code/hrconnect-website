-- =============================================================
-- AI-аналіз резюме: розширення candidates
-- =============================================================

alter table candidates
  add column if not exists source text default 'test',           -- 'test' | 'resume_ai'
  add column if not exists resume_text text,                      -- сирий витяг тексту з PDF/DOCX
  add column if not exists ai_analysis_meta jsonb;                -- модель, токени, час, prompt_version

-- Додаємо в whitelist update_candidate_by_token нові поля (через CREATE OR REPLACE)
-- Це робиться в окремому файлі rls_security_fix — тут лише схема.

comment on column candidates.source is 'Джерело даних: test (пройшов тест) | resume_ai (AI-аналіз резюме)';
comment on column candidates.resume_text is 'Сирий текст резюме (PDF/DOCX), на основі якого AI робив аналіз';
comment on column candidates.ai_analysis_meta is 'Метадані AI-виклику: модель, токени, версія промпта, час';

-- Індекс для швидкого фільтру по джерелу
create index if not exists idx_candidates_source on candidates(source);
