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
