# Microfronts API — NestJS, Prisma и PostgreSQL

Начни с [пошаговой инструкции: Docker, пароли, схема, миграции и Railway](docs/DATABASE_GUIDE.md).

## Локальный запуск

Нужны Node.js 24 LTS и запущенный Docker Desktop (Linux containers). Из папки backend:

```powershell
npm ci
npm run db:setup
npm run db:up
npm run db:deploy
npm run db:seed
npm run start:dev
```

Для последующих запусков достаточно db:up и start:dev; после получения новых миграций выполнить db:deploy. Проверка: [localhost:3000/api/health](http://localhost:3000/api/health).

PostgreSQL хранит пользователей, хеши паролей и токенов, корзины, отметки переноса и ограничения попыток входа. Данные находятся в Docker volume. Остановка или пересоздание контейнера не удаляет данные и не меняет пароль. Локальная база и Railway — разные базы. SQLite больше не используется; перенос старых данных не выполнялся по согласованному решению.

## Код и схема

- [src/auth](src/auth) — регистрация, вход, сессии.
- [src/cart](src/cart) — корзины и транзакционный перенос гостевой корзины.
- [src/shop](src/shop) — HTTP API магазина.
- [src/database](src/database) — Prisma provider и подключение.
- [src/common/guards](src/common/guards) — CSRF-защита.
- Каталог хранится в таблице `products`; `CartService` читает товары и цены через Prisma.
- [prisma/schema.prisma](prisma/schema.prisma) — модели, [prisma/migrations](prisma/migrations) — SQL-история.

## Каталог товаров

`GET /api/products` читает каталог из PostgreSQL. Добавлены поля `description`, `rating` (0–5, `null` — оценок пока нет), `createdAt` и `updatedAt` (даты ISO 8601). Рейтинг пока хранится как значение; сбор пользовательских оценок не реализован. Дата создания заполняется автоматически, дата изменения обновляется Prisma при изменении товара. При прямом SQL-обновлении дату изменения нужно задавать явно. Цены корзины также берутся из БД; пока поддерживается USD.

Миграции создают структуру без демонстрационных записей: `20261010000100_add_products` — товары с ограничениями цены/рейтинга, `20261023000100_add_categories` — категории и связь товара с категорией. SQL категорий сгенерирован Prisma командой `migrate dev --name add_categories --create-only` и сохранён без ручных изменений. Применить: `npm run db:deploy`, затем `npm run db:seed`; клиент обновляется через `npm run db:generate` или перед запуском backend.

`npm run db:seed` вызывает [scripts/seed.mjs](scripts/seed.mjs) через настройку Prisma. Скрипт в одной транзакции сначала создаёт категории «Периферия», «Мониторы», «Прочее», затем товары keyboard/dock в peripherals и monitor в monitors. Повторный запуск добавляет только отсутствующие записи: существующие товары, цены, описания, категории и даты не перезаписываются. Пользователи, сессии и корзины не создаются и не изменяются. Скрипт использует установленный PostgreSQL-драйвер pg и параметризованные запросы; сборка приложения для seed не нужна. Миграции сами seed не запускают.

Категории хранятся в `categories` (`id`, `name`, уникальный `slug`). Каждый товар относится к одной категории через `categoryId`; удаление используемой категории запрещено внешним ключом. Значение по умолчанию — `other`: перед созданием товара без явной категории она должна существовать. Данные можно редактировать через `npm run db:studio`.

- `GET /api/categories` — категории, включая пустые.
- `GET /api/products` — все товары, массив с `categoryId` и `category: { id, name, slug }`.
- `GET /api/products?category=peripherals` — фильтрация по slug; пустая существующая категория возвращает `[]`, неизвестная — 404, некорректный/повторённый параметр — 400.
- `GET /api/products/:id` — полный товар с описанием, рейтингом, датами и категорией; неизвестный ID — 404. ID остаются строками (например, `keyboard`).

Эти GET-маршруты публичны; страницы внутри Shell по-прежнему требуют входа. Чтение каталога находится в `src/catalog`, корзина получает товары и цены через Prisma. На новой БД сначала применяются миграции, затем явно запускается seed; после обновления backend Shell и catalog выпускаются согласованно для общего React Router.

Для БД со старой версией изменённых миграций обычного `db:deploy` недостаточно: сначала нужен отдельно согласованный план сброса или переноса данных. Сброс допустим только для явно разрешённой локальной БД. Порядок описан в [руководстве БД](docs/DATABASE_GUIDE.md#6-как-менять-схему).

## API и размещение

Auth: GET /api/auth/me, POST /api/auth/register, /api/auth/login, /api/auth/logout. Сессия действует семь дней. Регистрация принимает name, email, password (12–128 символов). При входе/регистрации X-Cart-Key позволяет однократно перенести гостевую корзину.

Используй same-origin /api proxy на frontend: он должен передавать Cookie, Set-Cookie и Origin. CORS_ORIGINS содержит точные разрешённые origins. Мутации требуют X-Requested-With: microfronts. Cookie — HttpOnly, SameSite=Lax, Secure в production. COOKIE_SECURE=false предназначен только для локального HTTP Docker. X-Session-User проверяет ожидаемую личность, а не даёт доступ.

Ограничения входа: 10 попыток на email и 40 на IP за 15 минут. За reverse proxy настрой доверенную топологию до использования IP-лимита как персонального; автоматически доверять любому X-Forwarded-For нельзя. Обновление БД не меняет эту существующую политику cookies/proxy.

Backend размещается на Railway, отдельно от PostgreSQL-сервиса. [railway.json](railway.json) задаёт Dockerfile, pre-deploy миграции и healthcheck. Подключение передаётся через DATABASE_URL. Render-конфигурация backend удалена. Инструкция создания БД и настройки reference variable — в руководстве выше; облачная публикация в этой задаче не выполнялась.

## Проверки

Подробности конфигурации Jest и актуальных E2E-сценариев: [docs/TESTING.md](docs/TESTING.md).

```powershell
npm run db:test:up
npm test
npm run test:e2e
npm run build
```

Тесты работают с отдельной временной БД microfronts_test на порту 5434. Запускай наборы последовательно. Prisma Studio: npm run db:studio. Остановить локальную БД без потери данных: npm run db:stop.

[Исходный исследовательский отчёт](docs/DATABASE_DOCKER_PRISMA_REPORT.md) описывает состояние до внедрения; текущая инструкция — DATABASE_GUIDE.md.
