# Опросник — ФБУ «Пермский ЦСМ»

Веб-приложение для проведения опросов сотрудников с автоматической статистикой, сводными таблицами и экспортом в Excel.

## Стек

Vite + React + TypeScript + Tailwind CSS + shadcn/ui  
Хранилище: Supabase (PostgreSQL + Auth)  
Деплой: GitHub Pages через GitHub Actions

## Быстрый старт

```bash
npm install
cp .env.example .env.local   # заполнить ключи Supabase
npm run dev
```

## Переменные окружения

| Переменная | Описание |
|---|---|
| `VITE_SUPABASE_URL` | URL проекта Supabase |
| `VITE_SUPABASE_ANON_KEY` | Анонимный ключ Supabase |
| `VITE_BACKEND` | `supabase` или `mock` (по умолчанию авто) |

## Формат вопросов (.md)

Вопросы описываются в Markdown-файлах. Пример в `surveys/2026-10-udovletvorennost.md`.

Типы вопросов: `single`, `multi`, `agree`, `number`, `text`.  
Атрибуты: `required`, `comment=optional|required`, `min`, `max`, `slider`, `scale=5|7`, `rows`, `maxlength`, `shuffle`.

## Публикация нового опроса

1. Подготовить `.md` файл с вопросами
2. Модератор открывает страницу «Публикация» → вставляет markdown → проверяет предпросмотр → публикует
3. Опрос сразу доступен участникам без пересборки сайта

## Роли

- **Участник** — регистрация по email, заполнение профиля (ФИО, подразделение, должность), прохождение опросов
- **Модератор** — публикация опросов, просмотр статистики, сводных таблиц, экспорт в Excel

Назначение модератора (SQL Editor в Supabase):

```sql
UPDATE auth.users SET raw_app_meta_data = '{"role":"moderator"}' WHERE email = 'user@example.com';
```

## Деплой на GitHub Pages

1. В настройках репозитория: Settings → Pages → Source: **GitHub Actions**
2. В Settings → Secrets and variables → Actions добавить:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. При пуше в `main` сайт автоматически собирается и публикуется

## Структура проекта

```
surveys/                  # seed-опросы в .md
src/
  styles/tokens.css       # токены оформления (единственная точка смены скина)
  lib/
    survey/               # парсер md, zod-схемы, типы, валидация
    backend/              # интерфейс Backend + mock.ts + supabase.ts
    stats/                # aggregate() и pivot() — чистые функции
    excel/                # экспорт .xlsx через exceljs
  features/
    auth/                 # логин, регистрация, контекст авторизации
    participant/          # кабинет участника, прохождение опросов
    moderator/            # статистика, сводная таблица, ответы
    publish/              # публикация опросов из markdown
  ui/                     # компоненты интерфейса
supabase/schema.sql       # схема БД + RLS-политики
.github/workflows/        # CI/CD
```

</content>