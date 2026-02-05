# RelaxDrive — Control Center Platform

Диспетчерская платформа: единый backend, Web Dashboard, Desktop Control Center. Управление заказами, водителями, пассажирами в реальном времени.

---

## Что скачать, добавить и обновить

### Установка (скачать зависимости)

Из корня проекта:

```bash
npm run install:all
```

Или по частям: `npm install` в корне, затем `npm install` в `backend`, `web`, `desktop`.

**Нужно установить:** Node.js 18+ (с [nodejs.org](https://nodejs.org)).

---

### Добавить (опционально)

| Что | Зачем |
|-----|--------|
| **PostgreSQL** | Для продакшена вместо SQLite: задать `DATABASE_URL` в `backend/.env`. |
| **Переменные в backend** | `JWT_SECRET`, `CORS_ORIGINS`, при лимитах — `COST_LIMIT_MAPS`, `COST_LIMIT_TRANSLATION`, `COST_LIMIT_AI`, `COST_LIMIT_TTS`. |
| **Переменные в web/desktop** | `VITE_API_URL`, `VITE_WS_URL` — если API не на localhost. |
| **Свой OSRM** | Переменная `OSRM_URL` в backend — свои маршруты/альтернативы вместо публичного сервера. |

---

### Обновить (после изменений в коде)

1. **База данных (новая таблица отчётов водителей)**  
   В `backend`:
   - **SQLite:** `npx prisma db push`
   - **PostgreSQL:** `npx prisma migrate deploy` (миграции уже в `backend/prisma/migrations/`)

2. **Сгенерировать Prisma-клиент**  
   ```bash
   cd backend && npx prisma generate
   ```

3. **Сборки**  
   - Backend: `cd backend && npm run build`  
   - Web: `cd web && npm run build`  
   - Desktop exe: `cd desktop && npm run build:win` → `dist-electron/RelaxDrive-Desktop.exe`

4. **Обновить зависимости до последних версий**  
   В каждой папке (`backend`, `web`, `desktop`):
   ```bash
   npm update
   ```
   Проверить устаревшие: `npm outdated`.

5. **Деплой (Render)**  
   После пуша в GitHub сервисы пересоберутся. Для PostgreSQL выполните миграции в Shell: `npx prisma migrate deploy`.

---

## Структура проекта

| Папка | Описание |
|-------|----------|
| **backend/** | NestJS API (REST + WebSocket), JWT, роли, заказы, гео, пассажиры, аудит |
| **web/** | React + Vite: Dashboard, календарь, клиенты, перевод, аналитика, роли, сессии |
| **desktop/** | Electron: Control, Live Wall, System Health, Logs & Audit, Клиенты, Админ |
| **docs/** | Доп. материалы (скриншоты и т.п.) |

---

## Быстрый старт

### Backend (локально)

```bash
cd backend
cp .env.example .env
npm install
npx prisma db push
npm run prisma:seed
npm run start:dev
```

По умолчанию используется SQLite. Для продакшена задайте `DATABASE_URL` на PostgreSQL.

**Вход:** после seed создаётся пользователь **Admin** / **Luka1Soso**. Свой логин/пароль:  
`ADMIN_NICKNAME=... ADMIN_PASSWORD=... npm run prisma:seed`

### Web

```bash
cd web
cp .env.example .env
npm install
npm run dev
```

Открыть http://localhost:5173. API по умолчанию: `/api` → backend.

### Desktop

```bash
cd desktop
npm install
npm run dev
```

В папке `desktop` создайте `.env` для прод API:

```env
VITE_API_URL=https://relaxdrive-api.onrender.com
VITE_WS_URL=https://relaxdrive-api.onrender.com
```

Без `.env` приложение обращается к `http://localhost:3000`.

**Сборка exe (Windows):** `npm run build:win` → `desktop/dist-electron/RelaxDrive-Desktop.exe`

---

## Роли и доступ

| Роль | Web | Desktop |
|------|-----|---------|
| **Admin** | Всё: Dashboard, календарь, клиенты, перевод, аналитика, роли, сессии, контроль затрат, white label, About | Всё: Control, Live Wall, System Health, Logs & Audit, Клиенты, Админ, About |
| **Dispatcher** | Dashboard, календарь, клиенты, перевод, аналитика, сессии, About | Соответствующие режимы по правам |
| **Driver** | Dashboard (мои заказы, карта, геолокация), перевод, About | Dashboard-режим, About |

Смена ролей: только Admin в разделе «Роли». После смены роли на другом устройстве обновится по WebSocket или при следующем входе.

---

## Деплой на Render

1. **Репозиторий на GitHub**  
   Создайте репозиторий (без README/.gitignore). Из папки проекта:
   ```bash
   git init
   git add .
   git commit -m "Initial: RelaxDrive"
   git branch -M main
   git remote add origin https://github.com/ВАШ_ЛОГИН/relaxdrive.git
   git push -u origin main
   ```
   При запросе пароля используйте [Personal Access Token](https://github.com/settings/tokens) (права **repo**).

2. **Render**  
   - [dashboard.render.com](https://dashboard.render.com) → **New** → **Blueprint** (или вручную PostgreSQL + Web Service).  
   - Подключите репозиторий. В корне есть **render.yaml**: БД + сервис **relaxdrive-api** (Root Directory: `backend`).  
   - Переменные: `DATABASE_URL` (Internal URL из PostgreSQL), `JWT_SECRET` (длинная случайная строка), `CORS_ORIGINS` (URL фронта или `*` для теста).

3. **Создать админа**  
   После успешного деплоя API: в карточке сервиса → **Shell** → выполнить:
   ```bash
   npm run prisma:seed
   ```
   Либо с компьютера: в `backend` задать `DATABASE_URL` на External URL из Render → `cp prisma/schema.postgres.prisma prisma/schema.prisma` → `npx prisma migrate deploy` → `npm run prisma:seed`.

4. **Фронт (Static Site)**  
   **New** → **Static Site** → тот же репо. Root: `web`, Build: `npm install && npm run build`, Publish: `dist`. В API в `CORS_ORIGINS` добавьте URL этого сайта.

**Обновление после изменений:** запушьте в репо → Render пересоберёт сервисы. Либо **Manual Deploy** в карточке сервиса. После деплоя веб-сайта обновите страницу с **Ctrl+Shift+R**.

---

## Сборка и обновление (web + desktop)

- **Web:** `cd web` → `npm run build` → артефакты в `web/dist`.  
- **Backend:** `cd backend` → `npm run build`.  
- **Desktop:** `cd desktop` → `npm run build:win` → exe в `desktop/dist-electron/RelaxDrive-Desktop.exe`.

Раздайте exe пользователям или загрузите в GitHub Releases.

---

## Не входит в админку / типичные проблемы

- **Не входится Admin:** проверьте, что seed выполнен на прод-БД (Shell на Render: `npm run prisma:seed`). Вводите **Admin** / **Luka1Soso** без лишних пробелов.  
- **Сайт не обновляется:** жёсткое обновление **Ctrl+Shift+R**; проверьте Logs деплоя relaxdrive-web.  
- **Ошибка деплоя API:** смотрите Logs в Render; частые причины: не задан `DATABASE_URL`, нужен Node 18+ (в настройках сервиса укажите Node 20).

---

## Технологии

- **Backend:** NestJS, Prisma (SQLite/PostgreSQL), JWT, Socket.IO  
- **Web:** React 18, Vite, React Router, Zustand, i18next, Leaflet  
- **Desktop:** Electron, тот же React-стек  
- **Стиль:** тёмная тема, панели, карточки (см. `web/src/styles/variables.css`)

Вся актуальная информация и инструкции собраны в этом README. Дополнительные материалы — в папке `docs/` (при необходимости).
