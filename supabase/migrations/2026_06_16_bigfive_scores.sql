-- Add bigfive_scores JSONB column for AI-analyzed candidates
alter table candidates
  add column if not exists bigfive_scores jsonb;

comment on column candidates.bigfive_scores is
'Bigfive детальні бали 0-100 для OCEAN: {O: 75, C: 80, E: 60, A: 70, N: 30}. Заповнюється AI-аналізом резюме.';
