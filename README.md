# Microfronts API — NestJS, Prisma и PostgreSQL

Начни с [пошаговой инструкции: Docker, пароли, схема, миграции и Railway](docs/DATABASE_GUIDE.md).

## Локальный запуск

Нужны Node.js 24 LTS и запущенный Docker Desktop (Linux containers). Из папки backend:

```powershell
npm ci
npm run db:setup
npm run db:up
npm run db:deploy
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

Миграция `20261010000100_add_products` добавляет три прежних демонстрационных товара с сохранением ID и цен, описания и ограничения цены/рейтинга. Применить: `npm run db:deploy`, затем `npm run db:generate` и перезапустить backend. Миграция выполняется один раз и не перезаписывает последующие изменения товаров. Редактировать данные можно через `npm run db:studio`.

Категории хранятся в `categories` (`id`, `name`, уникальный `slug`). Каждый товар относится к одной категории через `categoryId`; удаление используемой категории запрещено внешним ключом. Миграция `20261023000100_add_categories` создаёт «Периферия», «Мониторы» и «Прочее»: keyboard/dock попадают в peripherals, monitor — в monitors, остальные существующие товары и новые товары без явно заданной категории — в other. ID, цены, описания и корзины сохраняются.

- `GET /api/categories` — категории, включая пустые.
- `GET /api/products` — все товары, прежний массив с дополнительными `categoryId` и `category: { id, name, slug }`.
- `GET /api/products?category=peripherals` — фильтрация по slug; пустая существующая категория возвращает `[]`, неизвестная — 404, некорректный/повторённый параметр — 400.
- `GET /api/products/:id` — полный товар с описанием, рейтингом, датами и категорией; неизвестный ID — 404. ID остаются строками (например, `keyboard`).

Эти GET-маршруты публичны, как прежний список; доступ к страницам внутри Shell по-прежнему требует входа. Чтение каталога находится в `src/catalog`, корзина использует товары и цены напрямую через Prisma. Перед выпуском нового catalog применить миграцию, сгенерировать клиент и обновить backend; затем обновить Shell и catalog вместе для общего React Router.

Категории хранятся в `categories` (`id`, `name`, уникальный `slug`). Каждый товар относится к одной категории через `categoryId`; удаление используемой категории запрещено внешним ключом. Миграция `20261023000100_add_categories` создаёт «Периферия», «Мониторы» и «Прочее»: keyboard/dock попадают в peripherals, monitor — в monitors, остальные существующие товары и новые товары без явно заданной категории — в other. ID, цены, описания и корзины сохраняются.

- `GET /api/categories` — категории, включая пустые.
- `GET /api/products` — все товары, прежний массив с дополнительными `categoryId` и `category: { id, name, slug }`.
- `GET /api/products?category=peripherals` — фильтрация по slug; пустая существующая категория возвращает `[]`, неизвестная — 404, некорректный/повторённый параметр — 400.
- `GET /api/products/:id` — полный товар с описанием, рейтингом, датами и категорией; неизвестный ID — 404. ID остаются строками (например, `keyboard`).

Эти GET-маршруты публичны, как прежний список; доступ к страницам внутри Shell по-прежнему требует входа. Чтение каталога находится в `src/catalog`, корзина использует товары и цены напрямую через Prisma. Перед выпуском нового catalog применить миграцию, сгенерировать клиент и обновить backend; затем обновить Shell и catalog вместе для общего React Router.

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
