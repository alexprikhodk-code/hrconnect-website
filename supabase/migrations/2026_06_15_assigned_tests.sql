-- =============================================================
-- Migration: Add assigned_tests to candidates
-- HR обирає в формі «Запросити кандидата», які з 6 тестів
-- призначити. Значення зберігається масивом ідентифікаторів.
-- За замовчуванням — усі 6 тестів (backward compat).
-- =============================================================

ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS assigned_tests TEXT[]
  DEFAULT ARRAY['productivity','enneagram','disc','bigfive','iq','reproduction'];

-- Оновлюємо існуючих кандидатів — їм усі 6 (як було):
UPDATE candidates
SET assigned_tests = ARRAY['productivity','enneagram','disc','bigfive','iq','reproduction']
WHERE assigned_tests IS NULL;

-- Дозволити публічний SELECT по token (для хабу тестів кандидата):
-- Політика вже існує — assigned_tests читається тією ж політикою.
COMMENT ON COLUMN candidates.assigned_tests IS
'Масив ідентифікаторів призначених тестів: productivity, enneagram, disc, bigfive, iq, reproduction';

-- productivity_completed_at — щоб уніфікувати з іншими тестами
ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS productivity_completed_at TIMESTAMPTZ;

-- Беклог: позначити старих кандидатів, у яких є points, що продуктивність пройдена
UPDATE candidates
SET productivity_completed_at = COALESCE(test_completed_at, NOW())
WHERE points IS NOT NULL AND productivity_completed_at IS NULL;
