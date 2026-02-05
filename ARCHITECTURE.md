# RelaxDrive — System Architecture

**Каноническая спецификация продукта (роли, модули, дизайн, требования):** [docs/SPEC.md](docs/SPEC.md).

## 1. Executive Summary

RelaxDrive — профессиональная диспетчерская платформа уровня Control Center. Единый backend обслуживает **Web UI**, **Desktop Control Center** (Electron) и **Driver App** (mobile/PWA). Архитектура рассчитана на 24/7 работу, real-time, отказоустойчивость, масштабирование и премиальный UX.

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS (TLS / WSS)                                  │
├─────────────────┬─────────────────────────────┬──────────────────────────────────┤
│  Web Dispatcher │  Desktop Control Center     │  Driver App                      │
│  (React + Vite) │  (Electron + React)          │  (PWA / Mobile Web)              │
│  • Dashboard    │  • Control / Wall / Health   │  • Accept/Decline orders         │
│  • Map, Orders  │  • Logs & Audit              │  • GPS, Navigation               │
│  • Calendar     │  • Local cache, auto-reconnect│  • Auto-reconnect               │
└────────┬────────┴──────────────┬──────────────┴────────────────┬─────────────────┘
         │                       │                                │
         │    REST + WebSocket   │    REST + WebSocket            │
         │    JWT + Refresh      │    JWT + Refresh               │
         ▼                       ▼                                ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           API GATEWAY / LOAD BALANCER                             │
│                    (rate limit, TLS termination, health checks)                   │
└─────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              RELAXDRIVE BACKEND                                   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────────┐  │
│  │   Auth      │ │   Orders    │ │   Geo       │ │   AI/ETA    │ │  WebSocket │  │
│  │   JWT, RBAC │ │   Schedules │ │   Routes    │ │  Pred.Load  │ │  Gateway   │  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ └────────────┘  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────────┐  │
│  │ Translation │ │  Analytics  │ │  Audit      │ │  Cost       │ │  White     │  │
│  │ Voice→Text  │ │  Heatmap    │ │  Logs       │ │  Control    │ │  Label     │  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ └────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
         │                       │                                │
         ▼                       ▼                                ▼
┌─────────────────┐    ┌─────────────────┐              ┌─────────────────┐
│   PostgreSQL    │    │     Redis        │              │  External APIs   │
│   Users, Orders │    │  Sessions, Pub/Sub│             │  Maps, AI, TTS   │
│   Audit, i18n   │    │  Real-time cache │              │  (graceful degr.)│
└─────────────────┘    └─────────────────┘              └─────────────────┘
```

---

## 3. Data Flow

### 3.1 Authentication & Session

- **Login**: POST `/auth/login` → JWT access (short TTL) + refresh token (stored httpOnly / secure).
- **Refresh**: POST `/auth/refresh` → new access token; refresh rotation for security.
- **Logout**: POST `/auth/logout` → invalidate refresh, optional blacklist access in Redis.
- **Session monitor**: Admin/Dispatcher видит активные сессии (device, IP, last activity). Возможность revoke по session_id.

### 3.2 Orders & Dispatcher

- **Order lifecycle**: `draft → scheduled → assigned → in_progress → completed` (или `cancelled`).
- **Create/Update order**: REST. При изменении времени/маршрута — conflict detection (buffer time, calendar).
- **Driver assignment**: Dispatcher назначает водителя → событие в WebSocket → Driver App получает предложение (accept/decline).
- **Real-time**: WebSocket каналы: `orders`, `drivers`, `alerts`, `eta`. Desktop и Web подписаны на те же каналы; при reconnect — snapshot + delta.

### 3.3 Geo & ETA

- **GPS**: Driver отправляет координаты (batch/buffered при плохой сети). Backend хранит последнюю позицию в Redis, реплирует в WebSocket.
- **ETA**: классический расчёт (distance/speed или Maps API) + **AI ETA** (ML model по историческим данным). Fallback: если AI недоступен — только classic ETA (graceful degradation).
- **Smart rerouting**: при отклонении от маршрута или задержке — пересчёт маршрута, предложение альтернативы; решение за диспетчером.

### 3.4 Alerts & Auto Follow-ups

- Условия: остановка движения, рост ETA, отклонение от маршрута, потеря связи (no GPS/heartbeat).
- Backend генерирует **alert** → WebSocket `alerts` → отображение в Dashboard и Desktop (красный/жёлтый по типу).
- Auto follow-up: таймеры/правила (например, «если ETA вырос на 15% — уведомить»). Логика в отдельном сервисе (queue/cron).

### 3.5 Translation Center

- Pipeline: **Voice → STT → Text → (optional) translate → Text → (optional) TTS**.
- Язык определяется автоматически (auto language detection). Все тексты сохраняются и логируются (audit).
- Cost control: учёт запросов к STT/TTS/translate по картам, лимиты по ролям/tenant.

### 3.6 Analytics & Cost Control

- Аналитика: агрегаты по заказам, зонам, времени (heatmap), фильтры по датам/ролям. Данные из БД + кэш.
- Cost control: админ видит расходы по картам, переводам, AI, TTS; лимиты и алерты при превышении.

### 3.7 Audit & Logs

- Каждое значимое действие (create order, assign driver, change role, login, export) → **audit log** (user_id, action, resource, payload, timestamp, IP).
- Desktop «Logs & Audit»: фильтрация, таймлайн, экспорт (CSV/JSON).

---

## 4. Backend Structure (NestJS)

```
backend/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── common/                    # Guards, decorators, filters, interceptors
│   │   ├── decorators/
│   │   ├── filters/
│   │   ├── guards/                 # JWT, RBAC, Permissions
│   │   ├── interceptors/
│   │   └── pipes/
│   ├── config/                    # ConfigModule, env validation
│   ├── auth/                       # Login, refresh, session, RBAC
│   │   ├── auth.module.ts
│   │   ├── strategies/
│   │   ├── dto/
│   │   └── session/
│   ├── users/                      # CRUD, roles, permission matrix
│   ├── orders/                     # Orders, schedules, conflict detection
│   ├── drivers/                    # Driver status, assignment, tech metrics (hidden)
│   ├── geo/                        # Routes, ETA, GPS buffer, rerouting
│   ├── ai/                         # AI ETA, predicted load, smart rerouting
│   ├── alerts/                     # Auto follow-ups, alert rules
│   ├── translation/                # STT, translate, TTS, history, cost
│   ├── analytics/                  # Reports, heatmap, filters
│   ├── audit/                      # Audit log write/read, export
│   ├── cost-control/               # Cost tracking, limits
│   ├── white-label/                # Logos, colors, domains, i18n tenant
│   ├── websocket/                  # Gateway, channels (orders, drivers, alerts, eta)
│   └── health/                     # System health (API, WS, Redis, DB, external)
├── prisma/                         # or typeorm/ — migrations, schema
├── test/
├── package.json
├── tsconfig.json
└── .env.example
```

**Ключевые технологии**: NestJS, Prisma (PostgreSQL), Redis (ioredis), Passport JWT, Socket.IO или native WebSocket, Bull (queues для алертов и фоновых задач).

---

## 5. Web Frontend Structure (React + Vite)

```
web/
├── public/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── i18n/                       # en, ru, ka — JSON + useTranslation
│   │   ├── locales/
│   │   │   ├── en.json
│   │   │   ├── ru.json
│   │   │   └── ka.json
│   │   └── index.ts
│   ├── api/                        # REST client, base URL, interceptors (JWT, refresh)
│   ├── ws/                         # WebSocket client, auto-reconnect, channels
│   ├── store/                      # Zustand/Redux — auth, orders, drivers, UI
│   ├── routes/                     # Protected routes by role
│   ├── layouts/
│   │   ├── AuthLayout.tsx
│   │   └── DashboardLayout.tsx
│   ├── pages/
│   │   ├── login/
│   │   ├── register/
│   │   ├── dashboard/              # Map center, orders list, driver statuses, ETA
│   │   ├── calendar/              # Day/Week, pre-orders 6 days, conflicts
│   │   ├── passengers/            # DB, phone, addresses, history
│   │   ├── translation/           # Translation Center UI
│   │   ├── analytics/             # Charts, heatmap, filters
│   │   ├── roles/                 # Roles & permissions (admin)
│   │   ├── session-monitor/       # Who's online, device, IP
│   │   ├── cost-control/          # Costs by category (admin)
│   │   └── white-label/           # Logos, colors, domains (admin)
│   ├── components/
│   │   ├── ui/                    # Design system: Button, Panel, Map, etc.
│   │   ├── map/                   # Live map, markers, ETA labels
│   │   ├── orders/                # Order card, list, status
│   │   ├── calendar/              # Day/week views, conflict badges
│   │   └── shared/
│   └── styles/
│       ├── variables.css          # RelaxDrive colors, spacing
│       ├── design-system.css
│       └── themes/
├── index.html
├── vite.config.ts
├── package.json
└── .env.example
```

**Design system (RelaxDrive Style)**: чёрный фон, белый текст, красный (critical), жёлтый (warning), зелёный (OK); glass-панели, карта в центре, hotkeys, drag & drop.

---

## 6. Desktop Control Center (Electron)

```
desktop/
├── electron/
│   ├── main.ts                    # Main process, windows, menu
│   ├── preload.ts                 # Context bridge (safe API to renderer)
│   └── windows/                  # Control, Wall, Health, Logs
├── src/                           # Shared with web where possible (React)
│   ├── main.tsx
│   ├── App.tsx
│   ├── modes/
│   │   ├── ControlMode/           # Full control (same as web dashboard + more)
│   │   ├── LiveWallMode/          # Read-only big screen: map, ETA, alerts
│   │   ├── SystemHealthMode/      # API, WS, Redis, maps, AI, queues, latency
│   │   └── LogsAuditMode/         # Timeline, filters, export
│   ├── services/
│   │   ├── local-cache.ts         # IndexedDB/SQLite for offline resilience
│   │   ├── reconnect.ts          # Auto-reconnect with backoff
│   │   └── degradation.ts        # Graceful degradation flags
│   ├── components/
│   │   ├── health/                # Status cards, latency, indicators
│   │   └── logs/                 # Log viewer, export
│   └── store/
├── package.json                   # electron, electron-builder
└── .env.example
```

**Особенности**: локальный кэш для работы при плохом интернете; единый WebSocket с повторным подключением; при сбое API/WS — визуальные статусы и ограниченный функционал (graceful degradation).

---

## 7. UI Layouts (Main Screens)

### 7.1 Login / Registration

- Центрированная форма (glass panel). Поля: email, password; регистрация — доп. поля по роли.
- Переключатель языка (EN / RU / KA). White-label: логотип и цвет акцента сверху.

### 7.2 Dispatcher Dashboard (Web & Desktop Control Mode)

- **Центр**: полноэкранная карта (live), маркеры водителей и заказов, ETA и AI ETA на маршрутах.
- **Левая панель**: список активных и запланированных заказов (фильтр по статусу), drag & drop для назначения.
- **Правая панель**: статусы водителей (online/busy/offline), алерты и подсказки (красный/жёлтый).
- **Верх**: поиск, быстрые действия, уведомления, профиль, переключение языка.
- **Низ (опционально)**: мини-таймлайн или очередь алертов.

### 7.3 Calendar

- Вид день / неделя. Предзаказы до 6 дней. Блоки заказов с буфером; конфликты подсвечены (жёлтый/красный).
- Клик по слоту — создание/редактирование заказа; conflict detection при сохранении.

### 7.4 Translation Center

- Область ввода (голос/текст). Автоопределение языка. Pipeline: voice→text→text→(opt) voice.
- История переводов (сохранённый текст, дата, участники). Cost control виден админу отдельно.

### 7.5 System Health (Desktop)

- Карточки: API, WebSocket, Redis, PostgreSQL, Maps API, Translation API, AI ETA, Queues.
- Цвет: зелёный / жёлтый / красный. Latency и last check time. При сбое — рекомендация (graceful degradation).

### 7.6 Logs & Audit (Desktop)

- Таблица/таймлайн: время, пользователь, действие, ресурс, payload (свёрнуто), IP.
- Фильтры по дате, пользователю, действию, ресурсу. Экспорт CSV/JSON.

---

## 8. Permission Matrix (Conceptual)

| Resource / Action     | Admin | Dispatcher | Driver |
|-----------------------|-------|------------|--------|
| Users, roles, permissions | ✓     | —          | —      |
| Orders CRUD, assign   | ✓     | ✓          | —      |
| Accept/Decline order  | —     | —          | ✓      |
| Calendar, conflicts   | ✓     | ✓          | —      |
| Passengers DB         | ✓     | ✓          | —      |
| Translation           | ✓     | ✓          | —      |
| Analytics             | ✓     | ✓ (scope)  | —      |
| Session monitor       | ✓     | ✓ (scope)  | —      |
| Cost control          | ✓     | —          | —      |
| White label           | ✓     | —          | —      |
| System health         | ✓     | —          | —      |
| Audit logs, export    | ✓     | —          | —      |
| GPS (own), orders (assigned) | — | —    | ✓      |

Рейтинги водителей не отображаются; скрытые технические метрики используются только для AI (назначение, rerouting).

---

## 9. Security & Resilience

- **TLS** для REST и WebSocket в проде.
- **JWT** access (короткий TTL) + refresh в httpOnly cookie или secure storage.
- **RBAC** на каждый endpoint; audit log для критичных действий.
- **Rate limiting** на login и публичные API.
- **WebSocket**: auto-reconnect с exponential backoff; при восстановлении — повторная подписка на каналы.
- **GPS**: буферизация на клиенте водителя при обрывах; отправка пачек при восстановлении.
- **Graceful degradation**: при недоступности карт — показать адреса текстом; при недоступности AI ETA — только classic ETA; при недоступности переводов — предупреждение и ручной ввод.

---

## 10. Deployment & Scaling

- Backend: stateless API; горизонтальное масштабирование за load balancer.
- WebSocket: sticky sessions или Redis adapter для broadcast между инстансами.
- PostgreSQL: реплики для чтения аналитики при росте нагрузки.
- Redis: сессии + pub/sub для real-time; при необходимости — кластер.
- Desktop: распространяется как standalone installer (electron-builder); обновления через собственный или общий update server.

---

*Документ описывает целевую архитектуру RelaxDrive. Детализация по модулям и API — в коде и OpenAPI/Swagger.*