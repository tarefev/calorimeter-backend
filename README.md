# Calorimeter Backend

## Deploy & Rollback

Автодеплой настроен через GitHub Actions: при push в `main` собирается образ и на сервере выполняется `docker compose up -d backend` (GHCR образ).

### Ручной откат (rollback) на предыдущий digest

```bash
cd ~/calorimeter
# 1) Посмотреть доступные digests локально
docker image ls --digests ghcr.io/tarefev/calorimeter-backend | sed -n '1,10p'

# 2) Подставить предыдущий SHA
PREV_SHA=sha256:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
docker pull ghcr.io/tarefev/calorimeter-backend@${PREV_SHA}
docker tag ghcr.io/tarefev/calorimeter-backend@${PREV_SHA} ghcr.io/tarefev/calorimeter-backend:latest

# 3) Перекатить backend на «старый latest»
docker compose up -d backend
docker compose ps | sed -n '1,50p'

# 4) Проверить
curl -s https://api.daysnap.ru/health || true
```

Вернуться вперёд на актуальный релиз:

```bash
cd ~/calorimeter
docker compose pull backend && docker compose up -d backend
```

## Link flow (привязка Telegram аккаунта)

Этот раздел описывает, как пользователь привязывает свой Telegram аккаунт к существующему аккаунту на сайте.

1. На фронтенде (авторизованный веб-пользователь) вызвать:

```bash
curl -X POST -c cookie.txt https://api.example.com/auth/link-token \
  -H "Content-Type: application/json" \
  -b cookie.txt
```

Ответ:

```json
{ "token": "ABC123", "expiresAt": "2025-08-24T12:34:56.000Z" }
```

Пользователь отправляет этот `token` боту (через команду или поле ввода).

2. Бот (сервер бота) подтверждает токен у бекенда:

```bash
curl -X POST https://api.example.com/auth/link/confirm \
  -H "Content-Type: application/json" \
  -H "X-Bot-Token: $BOT_TOKEN" \
  -d '{ "token": "ABC123", "telegramUserId": "123456789" }'
```

Ответ: информация о привязанном пользователе или ошибка (token expired / token not found / telegram account already linked).

Безопасность и ограничения:

- Токен одноразовый, TTL по умолчанию 10 минут.
- Запрещать повторное использование токена (помечаем `usedAt`).
- В endpoint ботов — валидация `X-Bot-Token` (совпадение с `BOT_TOKEN` в окружении).

Добавляйте примеры в Swagger/README по необходимости.

### Auth provider: local + Telegram

Endpoints and examples:

- `POST /auth/register` (body: `{ email, password }`) → creates user + authAccount(provider="local") and sets session cookie. Returns `201` with `{ id, email }`.
- `POST /auth/login` (body: `{ email, password }`) → validates local credentials, creates session cookie. Returns `200` with `{ id, email }`.
- `POST /auth/logout` → revokes current session and clears cookie. Returns `204`.
- `GET /auth/me` → returns current user (web session or bot headers `X-Bot-Token` + `X-Telegram-User-Id`).
- `PATCH /auth/password` (body: `{ oldPassword, newPassword }`) → rotate password, revoke all sessions, create new session and set cookie. Returns `200`.
- `POST /auth/link-token` → create one-time token for linking Telegram (authenticated web user).
- `POST /auth/link/confirm` → bot confirms token and attaches Telegram account (requires `X-Bot-Token`).

Swagger is available at `/api` when the backend is running (dev mode).

## Records API (CRUD day_record_v1)

Основные эндпоинты:

- `GET /records/:date` — получить JSON одного дня (с `totals`/`theoretical`, ETag)
- `POST /records` — создать/заменить запись дня (идемпотентно по `user+date`)
- `PUT /records/:date` — заменить целиком запись указанной даты
- `PATCH /records/:date` — частичные изменения коллекций (upsert/delete)

Под-ресурсы (частые операции):

- Вода: `POST /records/:date/water`, `PATCH /water/:id`, `DELETE /water/:id`
- Еда: `POST /records/:date/food`, `PATCH /food/:id`, `DELETE /food/:id`
- Активность: `POST /records/:date/activity`, `PATCH /activity/:id`, `DELETE /activity/:id`
- Упражнения: `POST /records/:date/exercise`, `PATCH /exercise/:id`, `DELETE /exercise/:id`

Примеры:

```bash
# GET: получить день
curl -s -b cookie.txt https://api.daysnap.ru/records/2025-09-01 | jq

# POST: создать/заменить день
curl -s -X POST -H "Content-Type: application/json" -b cookie.txt \
  https://api.daysnap.ru/records \
  -d '{
    "date": "2025-09-01",
    "metric": { "caloriesIn": 1200 },
    "water": [ { "amountMl": 250 } ],
    "food": [ { "name": "Apple", "calories": 52 } ],
    "activity": [],
    "exercise": [],
    "sleep": null
  }'

# PUT: заменить целиком
curl -s -X PUT -H "Content-Type: application/json" -b cookie.txt \
  https://api.daysnap.ru/records/2025-09-01 \
  -d '{ "water": [ { "amountMl": 400 } ], "metric": { "caloriesIn": 900 } }'

# PATCH: частично обновить воду (удалить и добавить)
curl -s -X PATCH -H "Content-Type: application/json" -b cookie.txt \
  https://api.daysnap.ru/records/2025-09-01 \
  -d '{ "water": { "delete": ["<waterId>"], "upsert": [ { "amountMl": 500 } ] } }'

# Под-ресурсы вода
curl -s -X POST -H "Content-Type: application/json" -b cookie.txt \
  https://api.daysnap.ru/records/2025-09-01/water \
  -d '{ "amountMl": 300 }'

curl -s -X PATCH -H "Content-Type: application/json" -b cookie.txt \
  https://api.daysnap.ru/water/<waterId> \
  -d '{ "amountMl": 450 }'

curl -s -X DELETE -b cookie.txt https://api.daysnap.ru/water/<waterId>
```

Доступ: web — cookie‑сессия; бот — заголовки `X-Bot-Token` + `X-Telegram-User-Id`.
