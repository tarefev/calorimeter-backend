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
