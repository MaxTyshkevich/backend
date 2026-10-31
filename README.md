# Microfronts API

NestJS, Prisma и PostgreSQL. Требуются Node.js из [.nvmrc](.nvmrc) и Docker Desktop с Linux containers.

## Локальный запуск

Из корня backend:

```powershell
npm ci
npm run db:setup
npm run db:up
npm run db:deploy
npm run db:seed
npm run start:dev
```

Повторный запуск: `db:up` и `start:dev`; после получения миграций — `db:deploy`. Seed добавляет только отсутствующие категории и товары, сохраняя существующие записи. Проверка: [localhost:3000/api/health](http://localhost:3000/api/health). Остановить БД без потери данных: `npm run db:stop`.

## Структура

- [src/auth](src/auth) — регистрация, вход, cookie-сессии и Guards доступа.
- [src/cart](src/cart) — HTTP API корзины, транзакции и перенос гостевой корзины.
- [src/catalog](src/catalog) — контроллеры товаров и категорий, внутренний CatalogService.
- [src/database](src/database) — общий Prisma provider и блокировки транзакций.
- [src/health.controller.ts](src/health.controller.ts) — проверка подключения к БД.
- [prisma](prisma) — схема и история миграций; [scripts](scripts) — настройка, seed и тестовый runner.

## Документация

- [HTTP-контракт](docs/API.md) — каталог, авторизация, корзина, заголовки и статусы.
- [База данных и размещение](docs/DATABASE_GUIDE.md) — Docker, пароли, миграции, backup и Railway.
- [Проверки](docs/TESTING.md) — изолированная тестовая БД, сценарии и CI.
- [Разработка](docs/DEVELOPMENT_WORKFLOW.md) и [AGENTS.md](AGENTS.md) — порядок работы и обязательные правила.
- [Архив исследования БД](docs/archive/DATABASE_DOCKER_PRISMA_REPORT.md) — состояние до перехода на PostgreSQL, не инструкция эксплуатации.

## Проверки

```powershell
npm run db:test:up
npm test
npm run typecheck
npm run build
npm run test:e2e
```

Наборы тестов запускаются последовательно на локальной `microfronts_test`. Backend размещается отдельно от PostgreSQL; [railway.json](railway.json) задаёт Docker-сборку, pre-deploy миграции и healthcheck.
