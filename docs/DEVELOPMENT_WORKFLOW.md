# Разработка backend

Порядок согласования, работа с веткой, ограничения БД и публикация определены в [AGENTS.md](../AGENTS.md). Навигация для агента — в [backend-workflow](../.agents/skills/backend-workflow/SKILL.md), архитектурные критерии — в [nestjs-development](../.agents/skills/nestjs-development/SKILL.md).

## Проверка результата

| Изменение | Проверки и документация |
| --- | --- |
| Код | npm run typecheck, npm run build, относящиеся сервисные и HTTP-тесты; [TESTING.md](TESTING.md) |
| HTTP-контракт | Статусы, JSON, headers и доступ; обновить [API.md](API.md) |
| Схема или настройка БД | Генерация и проверка миграции по [DATABASE_GUIDE.md](DATABASE_GUIDE.md), тестовый контур |
| Только Markdown | Содержание, локальные ссылки, UTF-8, git diff --check |

Команды сверять с [package.json](../package.json) и [CI](../.github/workflows/ci.yml). Настройки runtime-валидации общие для приложения и E2E: src/configure-validation.ts.

## Передача и PR

Просмотреть diff, перечислить фактические проверки и ограничения. При согласованной публикации использовать [шаблон PR](../.github/pull_request_template.md): проблема и итоговое поведение, существенные изменения, проверки, документация и миграции при наличии. Невыполненную проверку не отмечать успешной; сообщить доступный статус CI. Merge — отдельное действие.
