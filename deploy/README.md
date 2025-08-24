Шаблоны инфраструктуры. Секреты не храним.
1) Скопировать deploy/.env.example -> .env и заполнить.
2) В deploy/nginx/conf.d/api.template.conf заменить <your-api-domain>.
3) Залить на сервер и применить: docker compose up -d
