# RelaxDrive — Control Center Platform

Профессиональная диспетчерская платформа уровня Control Center: единый backend, Web UI, Desktop Control Center и приложение водителя (PWA/mobile).

## Структура репозитория

- **`backend/`** — NestJS API (REST + WebSocket), JWT, RBAC, заказы, гео, AI ETA, алерты, переводы, аналитика, аудит, cost control, white label.
- **`web/`** — React + Vite: Dispatcher Dashboard, календарь, пассажиры, Translation Center, аналитика, роли, сессии, cost control, white label. i18n: EN, RU, KA.
- **`desktop/`** — Electron Control Center: Control Mode, Live Wall, System Health, Logs & Audit. Local cache, auto-reconnect, graceful degradation.
- **`docs/`** — спецификация проекта ([SPEC.md](docs/SPEC.md)), UI layouts, design system, деплой, roadmap.
- **`ARCHITECTURE.md`** — архитектура системы, data flow, permission matrix.

## Быстрый старт

### Backend

Локально можно использовать **SQLite** (без установки PostgreSQL):

```bash
cd backend
cp .env.example .env
npm install
npx prisma db push
npm run prisma:seed
npm run start:dev
```

(Миграции в репозитории — для PostgreSQL на [Render](https://render.com).)

**Хостинг на Render с нуля:** [docs/DEPLOY-RENDER.md](docs/DEPLOY-RENDER.md) — пошагово: PostgreSQL, Web Service, переменные, деплой и создание админа.

API: `http://localhost:3000`. Health: `GET /health`.  
Для продакшена в `.env` можно указать `DATABASE_URL` на PostgreSQL.

### Вход под админом (админка)

Вход выполняется по **никнейму** и паролю (не по email).

1. **Создать админа один раз** (из папки `backend`):
   ```bash
   npm run prisma:seed
   ```
   По умолчанию создаётся пользователь:
   - **Никнейм:** `Admin`
   - **Пароль:** `Luka1Soso`  
   Свой логин/пароль: `ADMIN_NICKNAME=... ADMIN_PASSWORD=... npm run prisma:seed`.

2. **Залогиниться:**
   - **Web:** открыть `http://localhost:5173` → «Sign in» → ввести никнейм `Admin` и пароль `Luka1Soso`.
   - **Desktop:** запустить приложение → экран входа → те же никнейм и пароль.

После входа админ видит все разделы: Dashboard, Calendar, Passengers, Translation, Analytics, Roles, Session Monitor, Cost Control, White Label (в Web); в Desktop — Control Mode, Live Wall, System Health, Logs & Audit.

**Альтернатива без seed:** создать админа через API:
   ```bash
   curl -X POST http://localhost:3000/auth/register -H "Content-Type: application/json" -d "{\"nickname\":\"Admin\",\"password\":\"Luka1Soso\",\"role\":\"ADMIN\"}"
   ```
   Затем войти на сайте или в Desktop с этими данными.

### Web

```bash
cd web
cp .env.example .env
npm install
npm run dev
```

Открыть `http://localhost:5173`. Прокси к API: `/api` → backend.

### Desktop

```bash
cd desktop
npm install
# Запустить backend и web (или только backend для API)
npm run dev
```

Предполагается, что Vite для desktop собран или запущен на порту 5174; при необходимости поправить `electron/main.js` (loadURL порт).

## Технологии

- **Backend**: NestJS, Prisma (PostgreSQL), JWT, Socket.IO, Redis (опционально).
- **Web**: React 18, Vite, React Router, Zustand, i18next, Socket.IO client.
- **Desktop**: Electron, тот же React-стек.
- **Дизайн**: RelaxDrive Style — тёмный UI, чёрный/белый/красный/жёлтый/зелёный, glass-панели. См. `docs/UI-LAYOUTS.md` и `web/src/styles/variables.css`.

## Роли

- **Admin**: полный доступ, роли, permission matrix, system health, cost control, white label.
- **Dispatcher**: карта, заказы, назначения, календарь, переводы, аналитика в рамках прав.
- **Driver**: принять/отклонить заказ, геолокация, навигация, auto-reconnect (реализуется в driver app).

Рейтинги водителей не используются; скрытые технические метрики — только для AI-логики.

## Документация

- **ARCHITECTURE.md** — высокоуровневая архитектура, компоненты, потоки данных.
- **docs/ABOUT.md** — что делает программа для диспетчеров и админов (EN + RU).
- **docs/ЧТО-ОСТАЛОСЬ.md** — что уже сделано и что осталось доделать.
- **docs/DESKTOP.md** — как запустить Desktop Control Center и чем он управляет.
- **docs/UI-LAYOUTS.md** — макеты экранов и дизайн-система RelaxDrive.
