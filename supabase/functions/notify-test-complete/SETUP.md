# Email-нотифікації — налаштування (15 хв)

## Що це робить
Коли кандидат завершує будь-який з 4 тестів — ви (HR) автоматично отримуєте email з посиланням на результат.

---

## Крок 1. Створити Resend акаунт (3 хв)

Resend — модерний email-сервіс. Безкоштовно 100 листів/день (3000/місяць) — більш ніж достатньо.

1. Відкрийте https://resend.com → **Sign up**
2. Підтвердьте email
3. У дашборді → **API Keys** → **Create API Key**:
   - Name: `AI-HRconnect`
   - Permission: **Sending access**
   - Press **Add**
4. Скопіюйте ключ (виду `re_xxxxxxxxxxxxxxxx`) — зберігайте, він показується раз!

### (Опціонально) Додати свій домен
Без свого домену листи приходять від `onboarding@resend.dev` — це працює, але не професійно.

Якщо хочете щоб листи приходили від вашого домену (наприклад `noreply@hrconnect.com.ua`):
1. Resend → **Domains** → **Add Domain**
2. Введіть домен → отримаєте DNS-записи
3. Додайте їх у вашого реєстратора домену
4. Зачекайте 5-15 хв перевірки

---

## Крок 2. Деплой Edge Function у Supabase (5 хв)

### Варіант A — через Supabase Dashboard (без CLI)

1. Відкрийте https://supabase.com/dashboard/project/tfxodvhqlilqlfviosxx/functions
2. **Create a new function** → ім'я: `notify-test-complete`
3. Скопіюйте весь вміст файлу `index.ts` (з цієї папки) у редактор
4. **Deploy function**

### Варіант B — через Supabase CLI

```bash
npm install -g supabase
supabase login
cd C:\Users\HP\Desktop\AI BRAIN\PROJECTS\HRconnect\website
supabase functions deploy notify-test-complete --project-ref tfxodvhqlilqlfviosxx
```

---

## Крок 3. Додати секрети (2 хв)

У Supabase Dashboard:
**Edge Functions** → ваша функція `notify-test-complete` → таб **Secrets** → **Add new secret**

Додайте 3 секрети:

| Name | Value |
|---|---|
| `RESEND_API_KEY` | `re_xxxxxxxxxxxxxxxx` (з кроку 1) |
| `SITE_URL` | `https://hrconnect-website.vercel.app` (ваш Vercel URL) |
| `FROM_EMAIL` | `AI-HRconnect <onboarding@resend.dev>` (або ваш домен) |

Натисніть **Save**.

---

## Крок 4. Перевірити налаштування JWT

У Supabase Dashboard → Edge Functions → `notify-test-complete` → **Settings**:

**«Verify JWT with legacy secret» — ЗАЛИШТЕ УВІМКНЕНИМ** ✅ (зеленим).

Чому: наш фронт викликає функцію через Supabase JS-клієнт, який автоматично прикріплює anon-ключ як JWT — він задовольняє цю перевірку. Якщо вимкнути, функцію зможе викликати будь-хто з інтернету без жодних ключів.

---

## Крок 5. Деплой website (30 сек)

Сайт уже оновлений — усі 4 тести викликають функцію після успішного збереження. Просто запустіть:

```
deploy-website.bat
```

---

## Тестовий прохід

1. Створіть тестового кандидата у вашому кабінеті
2. Скопіюйте посилання на будь-який тест
3. Відкрийте в інкогніто
4. Пройдіть до кінця, натисніть «Завершити»
5. Через 5-10 секунд перевірте свою пошту — має прийти лист з кнопкою «Переглянути результат →»

## Логи функції

Якщо лист не прийшов — у Supabase Dashboard → **Edge Functions** → `notify-test-complete` → **Logs** видно стек викликів і помилки.

Найчастіші проблеми:
- `RESEND_API_KEY not configured` — забули додати секрет
- `403 Forbidden` від Resend — невірний ключ або без верифікованого домену намагаєтесь надсилати з кастомного домену
- Лист у спамі — нормально для `onboarding@resend.dev`, поправиться після верифікації власного домену
