# Контрольный чеклист по требованиям

Проверка по пунктам: что есть, чего не хватает.

---

## ✅ Есть

| Требование | Статус |
|------------|--------|
| **Реальные таблицы** | Prisma: User, Session, Order, Passenger, AuditLog, TranslationRecord, WhiteLabelConfig. Не «we store data», а реальные модели и миграции. |
| **Role system** | Роли ADMIN / DISPATCHER / DRIVER в БД и в коде. |
| **Auth (JWT + refresh)** | JWT access/refresh, логин/логаут, сессии. |
| **Permission matrix в коде** | Не один `if (role === 'admin')`, а декоратор `@Roles('ADMIN')` / `@Roles('ADMIN', 'DISPATCHER')` на каждом эндпоинте + `RolesGuard`. Матрица прав задаётся объявлением ролей на маршрутах. |
| **AI ETA без mock/random** | Нет `Math.random()`. Baseline — детерминированный ETA из GeoService (OpenRouteService). Опционально подключаемый слой через `AI_ETA_URL`. |
| **Conflict detection в календаре** | `OrdersService.findConflicts(pickupAt, bufferMinutes, excludeOrderId)` — проверка пересечений по времени. |
| **Translation text→text** | `TranslationService.translate()` — первый шаг именно текст→API→текст (LibreTranslate), запись в БД. |
| **Desktop не только loadURL** | В проде `loadFile(dist/index.html)` — своя сборка. В dev — loadURL на локальный Vite. Есть отдельный state (Zustand + persist), страница System Health. |
| **Audit таблица и сервис** | `AuditLog` в БД, `AuditService.log()`. Сейчас логируются: вход, выход, запрос сброса пароля. |
| **WebSocket gateway** | События `orders`, `drivers`, `alerts`, `eta` объявлены в `RelaxDriveWsGateway`. |
| **i18n** | EN / RU / KA в вебе и в desktop (locales). |
| **Graceful degradation (частично)** | Geo и Translation при недоступности API возвращают заглушки, приложение не падает. |

---

## ⚠️ Частично или нужно доработать

| Требование | Сейчас | Что сделать |
|------------|--------|-------------|
| **Audit: логировать всё важное** | Логируются: auth, **user.role_change**, **order.create**, **order.assign**. | Добавить audit при ручном override ETA (когда будет эндпоинт). |
| **WebSocket: реальные события** | При **создании** и **назначении водителя** вызывается `broadcastOrders`. Dashboard подписан на `orders` и обновляет список. | По желанию: broadcast при смене ролей. |
| **Desktop: local cache** | В main процесса есть `get-cached-data` / `set-cached-data`, но они возвращают `null` и ничего не сохраняют. | Реализовать сохранение (например, в файл через electron-store или в preload → localStorage), чтобы при потере бэкенда можно было показывать последние данные. |
| **Cost tracking по API** | `CostControlService.getCosts()` возвращает нули. | Считать вызовы Maps/Translation/AI (например, в сервисах инкрементить счётчики или писать в таблицу) и отдавать в getCosts. |
| **Назначение водителя на заказ** | В Order есть `driverId`, но нет эндпоинта PATCH/POST assign и нет смены статуса на ASSIGNED. | Добавить в OrdersService/Controller: assign(orderId, driverId) + audit + WebSocket broadcast. |

---

## ❌ Пока нет (как в чеклисте)

| Требование | Комментарий |
|------------|-------------|
| **FallbackMapService** | Отдельного класса нет. Логика «при падении API — заглушка» встроена в сам GeoService. При желании можно вынести в отдельный слой. |
| **OfflineQueue** | Очереди запросов при офлайне с последующей отправкой нет. |
| **LocalCacheStore** | В desktop заявлены IPC-хендлеры кэша, но без реального хранилища. |
| **RetryPolicy + CircuitBreaker** | Повторов и размыкателя цепи при падении внешних API нет. Можно добавить в Geo/Translation/Ai сервисы (например, библиотека или свой wrapper). |
| **Карта в UI** | Интеграция Google Maps (или другой) в веб/desktop для отображения маршрутов и ETA в интерфейсе не сделана (бэкенд OpenRouteService уже есть). |

---

## Итог по пунктам чеклиста

- Реальные таблицы, WebSocket: при создании и назначении заказа вызывается broadcastOrders; веб-Dashboard подписан на `orders`.
- Desktop: отдельный state, system health, **локальный кэш** (файл в userData через IPC get/set-cached-data).
- Audit: вход/выход, смена роли, создание заказа, **назначение водителя** (order.assign).
- Translation: text→text первым шагом. Conflict detection есть.
- **Cost tracking**: CostTrackerService, инкремент при вызовах maps/translation/ai, getCosts() возвращает счётчики.
- **Назначение водителя**: PATCH `/orders/:id/assign`, UI на Dashboard (выбор водителя для заказов в SCHEDULED).
- Permission matrix (декораторы ролей), без mock AI.

Дальнейшие шаги (по желанию): RetryPolicy/CircuitBreaker для внешних API, персистентный cost tracking, audit при ручном override ETA.

---

**Расширенный roadmap** (AI copilot, Time Windows, геозоны, Incident Center, Chaos-режим, Live Wall Pro, аналитика «почему», Replay, Drag & Drop и др.) — см. [ROADMAP.md](./ROADMAP.md).
