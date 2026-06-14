# Форма «Задай питання» — налаштування (2 хв)

Ця функція приймає форму з сайту та надсилає її як email на вашу адресу.

## Передумови

Вже мають бути налаштовані:
- Resend акаунт із API-ключем (див. SETUP.md у `notify-test-complete`)
- Той самий `RESEND_API_KEY` буде використано тут

## Крок 1. Деплой функції (1 хв)

### Через Supabase Dashboard
1. Відкрийте https://supabase.com/dashboard/project/tfxodvhqlilqlfviosxx/functions
2. **Create a new function** → ім'я: `send-question`
3. Скопіюйте вміст `index.ts` з цієї папки → вставте в редактор
4. **Deploy function**

### Або через CLI
```bash
supabase functions deploy send-question --project-ref tfxodvhqlilqlfviosxx
```

## Крок 2. Додати секрет ADMIN_EMAIL (30 сек)

Зайдіть у Edge Functions → `send-question` → **Secrets** → **Add new secret**:

| Name | Value |
|---|---|
| `ADMIN_EMAIL` | ваша email-адреса, куди приходитимуть питання (наприклад `alex@hrconnect.com.ua`) |

> Секрети `RESEND_API_KEY` і `FROM_EMAIL` зазвичай уже додані для `notify-test-complete` — Edge Functions використовують спільне сховище секретів, тому повторно нічого додавати не треба.

## Крок 3. Перевірка JWT

У Supabase Dashboard → Edge Functions → `send-question` → **Settings**:

**«Verify JWT with legacy secret» — ЗАЛИШТЕ УВІМКНЕНИМ** ✅

Логіка та сама що й для `notify-test-complete`: фронт викликає функцію з anon-ключем, який задовольняє перевірку.

## Тестовий запит

1. Відкрийте https://hrconnect-website.vercel.app/
2. У шапці натисніть **💬 Задай питання**
3. Заповніть форму
4. Натисніть **Надіслати**
5. Через 5-10 секунд перевірте вашу пошту (адреса з `ADMIN_EMAIL`)

Має прийти лист з помаранчевою шапкою «Нове питання з сайту», даними кандидата (імʼя, посада, телефон, email) та текстом питання. Кнопка «Відповісти» одразу відкриє ваш поштовий клієнт із заповненою адресою кандидата у To: і темою «Re: ваше питання до AI-HRconnect».
