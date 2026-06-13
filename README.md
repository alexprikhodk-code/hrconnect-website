# AI-HRconnect — SaaS платформа AI-тестування кандидатів

Multi-tenant веб-застосунок: лендинг + кабінет користувача з ізольованими даними по підписці.

## Структура

```
website/
├── index.html              ← публічний лендинг
├── login.html / register.html / forgot.html / reset.html  ← auth
├── app/                    ← приватний кабінет (потребує login)
│   ├── index.html              дашборд кандидатів
│   ├── candidates.html         управління (запросити, переглянути)
│   ├── upload.html             завантаження готового PDF
│   ├── settings.html           профіль
│   └── subscription.html       тариф
├── assets/
│   ├── css/main.css
│   ├── js/env.js              ← КЛЮЧОВИЙ файл — ваші Supabase ключі
│   ├── js/supabase.js
│   └── js/auth.js
├── supabase/
│   ├── 01_schema.sql          ← таблиці
│   └── 02_policies.sql        ← Row Level Security
└── vercel.json
```

## Налаштування (≈30 хв вперше)

### Крок 1. Створити Supabase-проект (5 хв)

1. Відкрийте https://supabase.com → **Sign in with GitHub**
2. **New project**:
   - Name: `hrconnect`
   - Database password: придумайте, збережіть
   - Region: `West Europe` (Дублін) або `Central EU`
3. Проект створюється ~2 хв.
4. Після створення відкрийте **Settings → API**:
   - Скопіюйте **Project URL** (виду `https://abcdef.supabase.co`)
   - Скопіюйте **anon public** key (довгий рядок)

### Крок 2. Створити таблиці і RLS (3 хв)

1. У Supabase: **SQL Editor → New query**
2. Скопіюйте вміст `supabase/01_schema.sql`, вставте, натисніть **RUN**
3. Створіть ще один query, скопіюйте `supabase/02_policies.sql`, **RUN**

### Крок 3. Додати ключі у `env.js` (1 хв)

Відредагуйте `assets/js/env.js`:
```js
window.HRC_CONFIG = {
  SUPABASE_URL: "https://YOUR-PROJECT-REF.supabase.co",
  SUPABASE_ANON_KEY: "YOUR-ANON-PUBLIC-KEY",
  SITE_NAME: "AI-HRconnect"
};
```

### Крок 4. Локальний тест (1 хв)

```bash
cd website
python -m http.server 8000
```
Відкрийте http://localhost:8000 → лендинг.
Зареєструйтесь → перевірте email → увійдіть → ви в кабінеті.

### Крок 5. Деплой на Vercel (5 хв)

1. Запушити `website/` як новий GitHub-репо `hrconnect-website` (окремо від `hrconnect-dashboard`):
   ```bash
   cd website
   git init && git branch -M main
   git add . && git commit -m "Initial AI-HRconnect website"
   git remote add origin https://github.com/alexprikhodk-code/hrconnect-website.git
   git push -u origin main
   ```
2. Відкрийте https://vercel.com → **Sign in with GitHub**
3. **Add New → Project** → виберіть `hrconnect-website` → **Import**
4. **Deploy** (нічого не змінюйте, дефолти OK)
5. Vercel дає URL виду `hrconnect-website-xxx.vercel.app` — це ваш сайт.

### Крок 6. Додати ваш Vercel-URL у Supabase Allowed URLs (1 хв)

У Supabase: **Authentication → URL Configuration → Site URL**: поставте ваш Vercel-URL.
**Redirect URLs**: додайте `https://your-vercel.app/**` (зірочки важливі).

### Крок 7. (Опціонально) Custom domain

У Vercel → Settings → Domains: додайте `hrconnect.com.ua` (якщо купили). Зміна A/CNAME-записів у вашого реєстратора.

---

## Активація PRO-підписки (вручну, MVP)

Користувач реєструється → автоматично отримує `free` (2 тести/міс).
Коли треба активувати PRO/Enterprise:

1. У Supabase → **Table editor → subscriptions**
2. Знайти рядок користувача (по email через JOIN з `profiles`)
3. Редагувати:
   - `tier`: `pro` або `enterprise`
   - `tests_quota`: `50` (pro) або `99999` (enterprise)
   - `valid_until`: дата завершення підписки (наприклад `2026-12-31`)
   - `activated_by_admin`: `true`
   - `notes`: «Оплата на IBAN XX, чек №...»

---

## Workflow оновлень

Як було з дашбордом — те саме:
1. Я в чаті оновлюю файли в `website/`
2. Ви робите `git add . && git commit -m "Update" && git push`
3. Vercel автоматично деплоїть за ~30 сек

---

## Що ще потрібно дороблити (next sprint)

- Сторінка `/test/?t=<token>` — публічна форма тесту для кандидатів (без login)
- Серверна функція парсингу PDF (Vercel Edge Function або Supabase Function)
- AI-аналіз через OpenAI API (треба API key)
- Email-нотифікації коли кандидат завершив тест (через Supabase Auth emails або Resend)
- Stripe/WayForPay для авто-біллінгу

Це наступний етап після того, як основа запрацює.
