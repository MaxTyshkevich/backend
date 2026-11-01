---
name: backend-workflow
description: Вести задачи по репозиторию MaxTyshkevich/backend (Microfronts NestJS API) от диагностики до проверок и согласованной публикации. Применять только в checkout этого backend.
---

# Навигация по backend

Обязательный процесс, согласование, Git и ограничения БД — в [AGENTS.md](../../../AGENTS.md). Для архитектурных решений используй [nestjs-development](../nestjs-development/SKILL.md).

## Где искать

- Запуск: src/main.ts, src/app.module.ts; общая валидация — src/configure-validation.ts. E2E не исполняет main.ts и подключает валидацию явно.
- Авторизация: src/auth/; CSRF — src/common/guards/csrf.guard.ts. Cookie содержит токен, БД — его хеш. Проверка сессии читает актуальную роль пользователя.
- Каталог: src/catalog/products.controller.ts, categories.controller.ts, catalog.service.ts. Корзина читает товары и цены непосредственно через Prisma.
- Корзина: src/cart/. Метод mergeGuest покрыт сервисными тестами, но вход и регистрация его не вызывают. Не принимай наличие метода за реализованный HTTP-сценарий.
- Доступность: src/app.controller.ts — / и /health; src/health.controller.ts — /api/health с проверкой БД.
- Конкурентные операции: src/database/prisma.service.ts, withLocks и вызывающие сервисы. Проверь ключи, порядок блокировок и границы транзакций.
- Данные: prisma/schema.prisma и SQL-миграции вместе; отдельные ограничения могут быть только в SQL. src/generated/prisma не редактируется.

## Справочники по задаче

- [API](../../../docs/API.md) — маршруты, ответы, cookies, доступ и текущие ограничения.
- [База данных](../../../docs/DATABASE_GUIDE.md) — настройка, генерация миграций, seed и Railway.
- [Проверки](../../../docs/TESTING.md) — изолированная БД и последовательный запуск тестов. npm run lint исправляет файлы: для диагностики без правок его не запускать.
- [Разработка](../../../docs/DEVELOPMENT_WORKFLOW.md) — проверки и состав результата; команды сверять с package.json и .github/workflows/ci.yml.

При переносе обработчиков сверяй полный HTTP-контракт, Guards и DI. При изменениях товара учитывай nullable-рейтинг, идентификаторы и цены в минимальных единицах; @updatedAt не обновляет дату при прямом SQL.
