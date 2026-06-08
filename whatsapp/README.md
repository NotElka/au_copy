# WhatsApp-бот AU Copy

Принимает файл из WhatsApp и выдаёт код для печати на терминале — как Telegram-бот,
только через **WhatsApp Cloud API** (официальный, от Meta).

```
Пользователь → WhatsApp → [вебхук] → cloudflared → whatsapp-сервис :8001
                                                          │
                                                          ▼  POST /api/upload
                                                     бэкенд AU Copy :8000  →  код
```

Бэкенд (`:8000`) наружу НЕ открывается — публичным делаем только whatsapp-сервис (`:8001`),
и только его адрес `/webhook` отдаём Meta. Файл на бэкенд уходит локально.

---

## Что понадобится один раз

- Аккаунт **Meta for Developers**: https://developers.facebook.com (вход через обычный Facebook).
- Телефон с WhatsApp, **отдельный от номера-бота** — на него будете слать тесты.
- **cloudflared** (бесплатный туннель). Установка на Windows:
  - через winget: `winget install --id Cloudflare.cloudflared`
  - или скачать `cloudflared.exe`: https://github.com/cloudflare/cloudflared/releases

---

## Шаг 1. Создать приложение в Meta

1. https://developers.facebook.com → **My Apps** → **Create App**.
2. Тип приложения: **Business** → Next.
3. Введите название (например `AU Copy`) → Create App.
4. На странице приложения найдите карточку **WhatsApp** → **Set up**.
   Meta автоматически заведёт тестовый номер отправителя и песочницу.

## Шаг 2. Взять токен и Phone number ID

1. Слева: **WhatsApp → API Setup** (или «Getting Started»).
2. Здесь видно:
   - **Temporary access token** — нажмите «копировать». ⚠️ Живёт **24 часа** (для теста ок; как сделать постоянный — внизу).
   - **Phone number ID** — длинное число под тестовым номером. Это НЕ сам номер!
3. В блоке **«Send and receive messages»** добавьте свой личный номер в **To** (Meta пришлёт код подтверждения в WhatsApp) — иначе бот не сможет писать вам в режиме теста.

## Шаг 3. Заполнить secrets.env

1. Скопируйте `whatsapp/secrets.example.env` → `whatsapp/secrets.env`.
2. Впишите:
   - `WHATSAPP_ACCESS_TOKEN=` — токен из шага 2
   - `WHATSAPP_PHONE_NUMBER_ID=` — Phone number ID из шага 2
   - `WHATSAPP_VERIFY_TOKEN=` — придумайте любую строку (например `aucopy-verify-777`), запомните — пригодится в шаге 5
   - `UPLOAD_TOKEN=` — должен совпадать с `UPLOAD_TOKEN` в `backend/config.py` (по умолчанию `dev-secret-change-me`)

## Шаг 4. Запустить бэкенд, бота и туннель

Открой **три** окна (бэкенд должен быть запущен — бот шлёт файлы ему):

```powershell
# 1) бэкенд AU Copy
& .\venv\Scripts\python.exe -m backend.run

# 2) whatsapp-сервис (:8001)
& .\venv\Scripts\python.exe -m whatsapp.run

# 3) туннель на порт бота
cloudflared tunnel --url http://localhost:8001
```

cloudflared напечатает строку вида:

```
https://random-words-1234.trycloudflare.com
```

Это ваш публичный адрес. Адрес вебхука = он же + `/webhook`, например
`https://random-words-1234.trycloudflare.com/webhook`.

> ⚠️ Бесплатный быстрый туннель даёт **новый адрес при каждом перезапуске** —
> тогда вебхук в Meta придётся прописать заново. Для постоянного адреса см. «Продакшен».

## Шаг 5. Прописать вебхук в Meta

1. Слева: **WhatsApp → Configuration**.
2. Блок **Webhook** → **Edit**:
   - **Callback URL**: `https://ВАШ-АДРЕС.trycloudflare.com/webhook`
   - **Verify token**: та же строка, что в `WHATSAPP_VERIFY_TOKEN`
   - **Verify and save**.
   Если зелёная галочка — наш `GET /webhook` ответил правильно (в окне бота будет `webhook verified ok`).
3. Там же **Manage** → подпишитесь на поле **messages** (Subscribe).

## Шаг 6. Тест

Напишите боту (на тестовый номер из API Setup) и **прикрепите PDF/фото**.
В ответ придёт `🔑 Ваш код: ABC123`. Введите его на терминале AU Copy — файл откроется для печати.

---

## Если не работает

- **Галочка вебхука не ставится** → проверьте, что `whatsapp.run` запущен, туннель жив, и `WHATSAPP_VERIFY_TOKEN` совпадает; URL заканчивается на `/webhook`.
- **Файл пришёл, кода нет** → смотрите окно `whatsapp.run`. `backend upload failed` = бэкенд не запущен или не совпал `UPLOAD_TOKEN`. `media download failed` = просрочен `WHATSAPP_ACCESS_TOKEN`.
- **Бот молчит** → в режиме теста писать можно только на номера, добавленные в **To** (шаг 2.3). И ответ возможен только в течение 24 ч после сообщения пользователя (для бота это всегда так).
- **401 от бэкенда** → `UPLOAD_TOKEN` в `secrets.env` ≠ `UPLOAD_TOKEN` в `backend/config.py`.

## Продакшен (потом)

- **Постоянный токен** вместо 24-часового: Meta → Business Settings → System Users → создать System User → выдать роль на приложение → Generate token с правами `whatsapp_business_messaging`, `whatsapp_business_management`. Вписать в `WHATSAPP_ACCESS_TOKEN`.
- **Стабильный адрес** вместо случайного:
  - cloudflared **named tunnel** (нужен домен в Cloudflare), или
  - ngrok со статическим доменом (1 бесплатный): `ngrok http 8001 --domain ваш.ngrok-free.app`.
- **Подпись вебхука**: заполните `WHATSAPP_APP_SECRET` (Meta → App settings → Basic → App secret) — сервис начнёт проверять `X-Hub-Signature-256`.
- **Свой номер**: чтобы бот работал с любого номера (не только тест), добавьте и верифицируйте свой номер телефона в WhatsApp → API Setup и пройдите Business Verification.
