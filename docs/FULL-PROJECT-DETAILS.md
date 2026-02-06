# Relaxe Drive — полное описание проекта (всё что есть, подробно)

Документ для передачи в ChatGPT или другому ассистенту: полный перечень того, что реализовано в проекте — структура, API, UI, автоматизация, данные, файлы.

---

## 1. Общее описание проекта

**Relaxe Drive** (RelaxDrive) — платформа диспетчеризации поездок: веб-приложение и десктоп (Electron) для диспетчеров, водителей и администраторов. Региональный фокус: Rockland County, NY (карта по умолчанию — Spring Valley). Технологии: backend NestJS + Prisma (SQLite или PostgreSQL), frontend React + TypeScript + Vite, карта Leaflet (OpenStreetMap), WebSocket (Socket.IO), i18n (en, ru, es, ka).

---

## 2. Роли и доступ

| Роль        | Описание |
|------------|----------|
| **ADMIN**  | Полный доступ: Dashboard, Calendar, Passengers, Drivers, Translation, Analytics, Roles, Pendings, Session Monitor, Cost Control, White Label, Audit, Health, About. Может менять роли, пароли, блокировать/банить, удалять пользователей, генерировать reset-токены. |
| **DISPATCHER** | Dashboard, Calendar, Passengers, Drivers, Translation, Pendings, Session Monitor, Audit, About. Не может: Roles, Cost Control, White Label, Analytics (частично). Видит телефоны водителей и клиентов (в зависимости от реализации). |
| **DRIVER** | Dashboard (вид «Мои поездки» — только свои заказы), Translation, About. Не видит список других водителей как диспетчер; передаёт геолокацию; принимает/отклоняет назначения; отмечает прибытие на подачу/среднюю точку, старт и завершение поездки. |

Регистрация по умолчанию создаёт водителя (pending до одобрения админом). Вход по nickname + password. JWT (access + опционально refresh), сессии хранятся в БД.

---

## 3. Backend — структура модулей

Корень backend: `backend/`. Точка входа: `main.ts`. Глобально включён `JwtAuthGuard` (кроме маршрутов с `@Public()`).

Модули (папки в `backend/src/`):

- **app** — `AppModule`, `AppController` (GET `/` — описание API, GET `/health` делегирует в HealthModule).
- **auth** — регистрация, логин, forgot-password, reset-password, refresh, logout, admin/generate-reset-token.
- **users** — me, pending, list, approve/reject водителей, me/trip-history, me/stats, me/location, me/available, `:id/stats`, `:id/trip-history`, `:id/role`, `:id/password`, `:id/block`, `:id/ban`, `:id/unban`, delete, with-session-status, sessions, sessions/:sessionId (delete).
- **orders** — list (с from/to или активные), `:id/driver-etas`, `:id/route`, POST create, `:id/assign`, `:id/reject`, `:id/arrived-at-pickup`, `:id/arrived-at-middle`, `:id/left-middle`, `:id/stop-underway`, `:id/status`, delete.
- **passengers** — GET list, POST create, PATCH `:id`, DELETE `:id`. Роли: ADMIN, DISPATCHER.
- **drivers** — сервис (используется в orders/users), отдельного контроллера нет.
- **geo** — GET reverse?lat=&lng= (обратное геокодирование). JWT обязателен.
- **reports** — GET list (minLat, maxLat, minLng, maxLng, sinceMinutes), POST create (lat, lng, type, description). Типы: POLICE, TRAFFIC, WORK_ZONE, CAR_CRASH, OTHER. Роли: ADMIN, DISPATCHER, DRIVER.
- **alerts** — сервис: emitAlert(...). События уходят в WebSocket (alerts). Нет REST-контроллера.
- **websocket** — Socket.IO gateway: broadcastOrders, broadcastDrivers, broadcastAlerts, broadcastEta, emitUserUpdated(userId), broadcastReport.
- **audit** — GET audit (query: userId, action, resource, from, to, limit). ADMIN, DISPATCHER.
- **analytics** — GET stats (from, to) — heatmap/aggregates. Контроллер есть.
- **cost-control** — GET cost-control — счётчики maps, translation, ai, tts и лимиты. ADMIN.
- **cost-tracker** — глобальный учёт вызовов (maps/translation/ai/tts) для лимитов. Без контроллера.
- **white-label** — GET, PATCH (конфиг тенанта: logo, colors, domain, locales). Контроллер есть.
- **health** — GET health — проверка БД и др. Публичный или по JWT в зависимости от настройки.
- **prisma** — PrismaService, подключение к БД.
- **scheduler** — Cron: очистка старых сессий (ежедневно 3:00), очистка DriverTripSummary старше 7 дней (4:00), напоминания о подаче через 15 минут (каждые 5 мин), проверка превышения лимитов стоимости (каждый час).
- **ai** — AiService (используется для ETA и др.). Без контроллера.
- **translation** — TranslationService (LibreTranslate и т.п.). Без REST; веб Translation может быть заглушкой.

---

## 4. Backend API — полный список эндпоинтов

### 4.1 Публичные (без JWT)

- `POST /auth/register` — body: nickname, password, phone?, email?, carPlateNumber?, carType?, carCapacity?, carModelAndYear?
- `POST /auth/login` — body: nickname, password, device?, rememberDevice?
- `POST /auth/forgot-password` — body: nickname
- `POST /auth/reset-password` — body: token, newPassword
- `POST /auth/refresh` — body: refreshToken
- `GET /` — информация об API (app.controller)
- `GET /health` — состояние сервиса (если настроен как публичный)

### 4.2 С JWT

- `POST /auth/logout` — body: sessionId?
- `POST /auth/admin/generate-reset-token` — body: userId. Только ADMIN.

### 4.3 Users (`/users`)

- `GET /users/me` — текущий пользователь (id, nickname, role, locale, для DRIVER: available, driverId, carType, carPlateNumber, carCapacity, carModelAndYear).
- `PATCH /users/me` — body: locale?
- `GET /users/pending` — список водителей на одобрении. ADMIN, DISPATCHER.
- `GET /users` — список всех пользователей. ADMIN, DISPATCHER.
- `PATCH /users/:id/approve` — одобрить водителя. ADMIN, DISPATCHER.
- `PATCH /users/:id/reject` — отклонить водителя. ADMIN, DISPATCHER.
- `GET /users/me/trip-history` — история поездок текущего водителя (последние 7 дней). DRIVER.
- `GET /users/me/stats` — totalEarningsCents, totalMiles текущего водителя. DRIVER.
- `GET /users/:id/stats` — то же для водителя по id. ADMIN, DISPATCHER. Проверка: пользователь с id должен быть DRIVER.
- `GET /users/:id/trip-history` — история поездок водителя по id. ADMIN, DISPATCHER.
- `PATCH /users/me/location` — body: lat, lng. DRIVER.
- `PATCH /users/me/available` — body: available (boolean). DRIVER.
- `PATCH /users/:id/role` — body: role. ADMIN.
- `PATCH /users/:id/password` — body: password. ADMIN.
- `PATCH /users/:id/block` — body: blocked. ADMIN.
- `PATCH /users/:id/ban` — body: until?, reason?. ADMIN.
- `PATCH /users/:id/unban` — снять бан. ADMIN.
- `DELETE /users/:id` — удалить пользователя. ADMIN. Нельзя удалить себя и последнего админа.
- `GET /users/with-session-status` — пользователи с флагом активности сессии. ADMIN.
- `GET /users/sessions` — активные сессии. ADMIN, DISPATCHER.
- `DELETE /users/sessions/:sessionId` — завершить сессию. ADMIN.

### 4.4 Orders (`/orders`)

- `GET /orders` — без query: активные и запланированные (для водителя — только свои). С query `from`, `to` (ISO даты): заказы за период.
- `GET /orders/:id/driver-etas` — ETA водителей до подачи и до высадки; возвращает drivers (массив с id, nickname, phone, lat, lng, etaMinutesToPickup, etaMinutesPickupToDropoff, etaMinutesTotal), pickupCoords, dropoffCoords. ADMIN, DISPATCHER.
- `GET /orders/:id/route` — query: fromLat?, fromLng?, alternatives?. Возвращает pickupCoords, dropoffCoords, polyline (encoded), durationMinutes, distanceKm, steps?; при fromLat/fromLng — driverToPickupPolyline, driverToPickupMinutes, driverToPickupSteps; при alternatives — alternativeRoutes. ADMIN, DISPATCHER, DRIVER (только свой заказ).
- `POST /orders` — body: pickupAt (ISO), pickupAddress, dropoffAddress, tripType?, routeType?, middleAddress?, waypoints? (массив { address }), pickupType?, dropoffType?, passengerId?, phone?, passengerName?, preferredCarType?, bufferMinutes?. При наличии phone — findOrCreateByPhone. После создания — broadcast orders, alert order.created. ADMIN, DISPATCHER.
- `PATCH /orders/:id/assign` — body: driverId. Audit, broadcast orders, alert order.assigned. ADMIN, DISPATCHER.
- `PATCH /orders/:id/reject` — водитель отказывается. Audit, broadcast, alert order.rejected. DRIVER.
- `PATCH /orders/:id/arrived-at-pickup` — водитель прибыл на подачу. DRIVER.
- `PATCH /orders/:id/arrived-at-middle` — водитель прибыл на вторую точку (roundtrip). DRIVER.
- `PATCH /orders/:id/left-middle` — водитель уехал со второй точки. DRIVER.
- `PATCH /orders/:id/stop-underway` — водитель остановил поездку в пути. Audit, broadcast, alert order.stopped_underway. DRIVER.
- `PATCH /orders/:id/status` — body: status ('IN_PROGRESS' | 'COMPLETED'), distanceKm?, earningsCents?. При COMPLETED создаётся запись DriverTripSummary, обновляется DriverStats (totalEarningsCents, totalMiles), очистка старых trip summary (>7 дней). Audit, broadcast, при COMPLETED — alert order.completed. ADMIN, DISPATCHER, DRIVER (свои заказы).
- `DELETE /orders/:id` — удаление заказа. Audit, broadcast. ADMIN, DISPATCHER.

### 4.5 Passengers (`/passengers`)

- `GET /passengers` — список клиентов. ADMIN видит phone, DISPATCHER может не видеть (зависит от реализации).
- `POST /passengers` — body: phone, name?, pickupAddr?, dropoffAddr?, pickupType?, dropoffType?.
- `PATCH /passengers/:id` — обновление полей.
- `DELETE /passengers/:id` — удаление.

### 4.6 Geo (`/geo`)

- `GET /geo/reverse?lat=&lng=` — обратное геокодирование (Nominatim). Возврат { address } или null.

### 4.7 Reports (`/reports`)

- `GET /reports?minLat=&maxLat=&minLng=&maxLng=&sinceMinutes=` — список отчётов в bounding box за последние sinceMinutes (по умолчанию 120).
- `POST /reports` — body: lat, lng, type (POLICE|TRAFFIC|WORK_ZONE|CAR_CRASH|OTHER), description?. После создания — broadcastReport.

### 4.8 Audit (`/audit`)

- `GET /audit` — query: userId?, action?, resource?, from?, to?, limit?. ADMIN, DISPATCHER.

### 4.9 Analytics (`/analytics`)

- `GET /analytics/stats` — query: from, to. Возвращает ordersCreated, ordersCompleted, byStatus (SCHEDULED, ASSIGNED, IN_PROGRESS), heatmap. ADMIN (или по настройке ролей).

### 4.10 Cost Control (`/cost-control`)

- `GET /cost-control` — счётчики использования (maps, translation, ai, tts) и лимиты. ADMIN.

### 4.11 White Label (`/white-label`)

- `GET /white-label` — конфиг текущего тенанта (logoUrl, primaryColor, domain, locales).
- `PATCH /white-label` — обновление конфига. ADMIN.

### 4.12 Health (`/health`)

- `GET /health` — статус БД и опционально других сервисов.

---

## 5. WebSocket (Socket.IO)

Подключение: auth через token в handshake. События, которые сервер отправляет клиентам:

- `orders` — полный список активных/запланированных заказов (после любого изменения заказов).
- `drivers` — список водителей с координатами (при обновлении локаций/списка).
- `alerts` — объект с типом и данными: order.created, order.assigned, order.rejected, order.completed, order.stopped_underway, reminder_pickup_soon, cost_limit_exceeded и т.д.
- `eta` — обновления ETA (если используются).
- `user.updated` — { userId } — при смене роли/блокировке и т.д., чтобы клиент перезапросил текущего пользователя.
- `report` — новый отчёт на карте (police, traffic, work zone, crash).

Клиент (web) подписывается на `orders`, `drivers`, `alerts` в Dashboard и обновляет state.

---

## 6. База данных (Prisma)

Файл схемы: `backend/prisma/schema.prisma`. Поддерживаются SQLite (по умолчанию) и PostgreSQL (production).

Основные модели:

- **User** — id, nickname (unique), email?, phone?, passwordHash, role, tenantId?, locale, lat?, lng?, available, blocked, bannedUntil?, banReason?, carPlateNumber?, carType?, carCapacity?, carModelAndYear?, driverId? (unique), approvedAt?, createdAt, updatedAt. Связи: sessions, auditLogs, ordersCreated.
- **Session** — id, userId, device?, ip?, lastActiveAt, createdAt.
- **Order** — id, status (DRAFT|SCHEDULED|ASSIGNED|IN_PROGRESS|COMPLETED|CANCELLED), tripType, routeType?, pickupAt, pickupAddress, middleAddress?, waypoints? (JSON: массив { address }), dropoffAddress, pickupType?, dropoffType?, passengerId?, preferredCarType?, driverId?, createdById, bufferMinutes, etaMinutes?, aiEtaMinutes?, startedAt?, arrivedAtPickupAt?, leftPickupAt?, waitChargeAtPickupCents?, arrivedAtMiddleAt?, leftMiddleAt?, waitChargeAtMiddleCents?, completedAt?, createdAt, updatedAt.
- **Passenger** — id, phone, name?, pickupAddr?, dropoffAddr?, pickupType?, dropoffType?, userId?, tenantId?, createdAt, updatedAt.
- **AuditLog** — id, userId?, action, resource, payload? (JSON string), ip?, createdAt.
- **TranslationRecord** — id, sourceLang, targetLang, sourceText, targetText, userId?, createdAt.
- **DriverReport** — id, lat, lng, type, description?, userId, createdAt.
- **WhiteLabelConfig** — id, tenantId (unique), logoUrl?, primaryColor?, domain?, locales, createdAt, updatedAt.
- **DriverTripSummary** — id, driverId, orderId, pickupAddress, dropoffAddress, startedAt, completedAt, distanceKm, earningsCents, createdAt. Очищается через 7 дней (cron).
- **DriverStats** — driverId (PK), totalEarningsCents, totalMiles, updatedAt. Накапливается при завершении заказов.

Миграции в `backend/prisma/migrations/`. Для PostgreSQL есть отдельный schema.postgres.prisma при необходимости.

---

## 7. Web (React) — структура и страницы

Корень фронта: `web/`. Сборка: Vite. Маршрутизация: react-router-dom. Состояние: zustand (auth, toast). Языки: react-i18next, локали в `web/src/i18n/locales/` (en.json, ru.json, es.json, ka.json).

### 7.1 Маршруты (App.tsx)

- Публичные (AuthLayout): `/login`, `/register`, `/forgot-password`.
- Под JWT (DashboardLayout): `/` → redirect `/dashboard`, `/dashboard`, `/calendar`, `/passengers`, `/drivers`, `/translation`, `/analytics`, `/roles`, `/pendings`, `/sessions`, `/cost-control`, `/white-label`, `/audit`, `/health`, `/about`.
- Остальное → redirect `/`.

PrivateRoute проверяет наличие accessToken; при отсутствии — redirect на `/login`.

### 7.2 Страницы (папка pages)

- **login** — Login.tsx, Login.css. Ввод nickname, password, опция remember device. Вызов POST /auth/login, сохранение токенов и user в store, redirect по роли.
- **register** — Register.tsx. Поля: nickname, password, phone, email?, carType?, carPlateNumber?, carCapacity?, carModelAndYear?. POST /auth/register. После регистрации водитель в статусе pending.
- **forgot-password** — ForgotPassword.tsx. Запрос сброса (nickname) или установка нового пароля по token из URL (token, newPassword). POST /auth/forgot-password, POST /auth/reset-password.
- **dashboard** — Dashboard.tsx, Dashboard.css. Главная страница: для диспетчера — список заказов (активные/завершённые), форма создания заказа, карта с маршрутами и водителями, правая панель «Drivers» и «Alerts»; для водителя — «Мои поездки», карта своей локации и маршрута, кнопка Share location, статус онлайн/офлайн. Подробности ниже в разделе «Dashboard».
- **calendar** — Calendar.tsx, Calendar.css. Вид день/неделя, выбор даты. Загрузка заказов GET /orders?from=&to=. Выпадающий список водителей: «All drivers» или конкретный водитель — фильтрация заказов по driverId. Карточки по дням: заказы с переведённым статусом (Scheduled, Assigned, In progress, Completed, Cancelled, Draft), имя водителя при просмотре «All». Кнопка «Create order for this day» — переход на /dashboard с state createOrderDate (подстановка даты в форму заказа).
- **passengers** — Passengers.tsx, Passengers.css. Таблица клиентов (phone, name, pickup, dropoff, типы мест). Поиск, добавление, редактирование, удаление. Экспорт CSV. Кнопка «+ New order» с передачей выбранного клиента в форму заказа (state passengerPrefill).
- **drivers** — Drivers.tsx, Drivers.css. Таблица водителей (nickname, phone, email, userId, driverId, carType, carPlateNumber, status). Вкладки по типу авто, поиск по имени/email/телефону/ID. При выборе водителя — панель с вкладками: Driver information, **Trip history** (новый UI: у каждой поездки карточка с мини-картой маршрута сверху, адреса pickup → dropoff, время · мили, средняя скорость, «Risky events», View route, заработок; компонент TripCardMap, геокодирование GET /geo/geocode), Earnings. Данные: GET /users/:id/stats, GET /users/:id/trip-history. После деплоя веб-приложения перезагрузите страницу с очисткой кэша (Ctrl+Shift+R), чтобы увидеть новый вид Trip history.
- **translation** — Translation.tsx. Заглушка или интерфейс голос→текст и история (без вызова backend TranslationService в текущей реализации).
- **analytics** — Analytics.tsx. Графики/heatmap по заказам (GET /analytics/stats), фильтры по датам.
- **roles** — Roles.tsx. Список пользователей, смена роли (PATCH /users/:id/role), сброс пароля (PATCH /users/:id/password). Только ADMIN.
- **pendings** — Pendings.tsx, Pendings.css. Список водителей на одобрении (GET /users/pending). Кнопки Approve (PATCH /users/:id/approve), Reject (PATCH /users/:id/reject). ADMIN, DISPATCHER.
- **session-monitor** — SessionMonitor.tsx. Таблица активных сессий (GET /users/sessions), устройство, IP, last active. Завершение сессии DELETE /users/sessions/:sessionId. Обновление раз в ~30 с. ADMIN, DISPATCHER.
- **cost-control** — CostControl.tsx, CostControl.css. Счётчики maps, translation, ai, tts и лимиты (GET /cost-control). Обновление при фокусе и по таймеру. ADMIN.
- **white-label** — WhiteLabel.tsx. Настройки логотипа, цвета, домен, локали. GET/PATCH /white-label. ADMIN.
- **audit** — Audit.tsx. Фильтры (userId, action, resource, from, to, limit), таблица логов GET /audit. ADMIN, DISPATCHER.
- **health** — Health.tsx. Отображение GET /health. ADMIN.
- **about** — About.tsx, About.css. Текст о приложении, описание возможностей по ролям (водитель, диспетчер, админ).

### 7.3 Dashboard (подробно)

Файл: `web/src/pages/dashboard/Dashboard.tsx`. Большой компонент: заказы, форма заказа, карта, водители, алерты.

- **Состояние**: orders, completedOrders, loading, showForm, pickupAt, tripTypeForm, routeTypeForm, preferredCarTypeForm, pickupAddress, middleAddress, waypointAddresses, dropoffAddress, pickupType, dropoffType, orderPhone, orderPassengerName, drivers, assigningId, statusUpdatingId, stopUnderwayId, deletingId, rejectingId, selectedOrderId, routeData, driverEtas, driverLocation, pickMode, pickPoint, reverseGeocodeLoading, passengersSuggestions, orderTab (active/completed), orderStatusFilter, orderSortBy, mapCenterTrigger, alerts, reports, selectedRouteIndex, postTripSummary, driverStats (для водителя), sharingLocation, now и др.
- **Загрузка данных**: при монтировании и при возврате на вкладку (document.visibilitychange) — refreshAll: GET /orders, GET /users (фильтр DRIVER), GET /reports (bounds карты), для выбранного заказа GET /orders/:id/route и GET /orders/:id/driver-etas; для водителя — GET /users/me/stats, completed orders. WebSocket: подписка на orders, drivers, alerts; при новых заказах/назначениях — обновление списка и уведомления.
- **Форма заказа**: клиент (выпадающий список из Passengers), тип поездки (One-way / Roundtrip), тип маршрута (Local / Long), тип авто (Any / Sedan / Minivan / SUV), время подачи (datetime-local). При открытии формы по кнопке «+ New order» время подачи автоматически «сейчас + 30 минут» (функция defaultPickupAt). При переходе из Calendar с createOrderDate — подставляется дата и 09:00. Адреса: pickup, dropoff; для roundtrip — second location и дополнительные остановки (waypoints). Кнопки «Pick on map», «Use my location». Типы мест (pickup/dropoff): Home, Synagogue, School, Hospital, Store, Office, Other. Отправка POST /orders с waypoints (массив { address }).
- **Список заказов**: вкладки Active / Completed. Сортировка: по запланированному времени, по прибытию на подачу, по времени посадки, по высадке. Фильтр по статусу (SCHEDULED, ASSIGNED, IN_PROGRESS, COMPLETED). Для каждого заказа: статус, время, адреса, пассажир, тип авто, маршрут (все остановки из waypoints или middleAddress), кнопки Google Maps / Waze для всего маршрута и по каждой остановке. Назначение водителя: выпадающий список с ETA; при выборе PATCH /orders/:id/assign. Для водителя: кнопки Accept, Reject, Start, Arrived at pickup, Arrived at second stop, Left stop, Complete. Таймер ожидания на подаче (первые 5 мин бесплатно, далее платно). Отчёты на карте (POLICE, TRAFFIC и т.д.) — водитель может добавить POST /reports.
- **Карта**: компонент OrdersMap. Центр по умолчанию Spring Valley, NY. Отображаются: маршрут заказа (polyline), маркеры подачи/высадки, водители (цвет по статусу: зелёный — available, красный — busy, серый — offline), текущая локация водителя, выбранная точка при «Pick on map». Граница Rockland County отрисована красной линией (полигон без заливки). Кнопка Re-center подгоняет bounds по маршруту и точкам.
- **Панель Drivers (правая колонка)**: заголовок «Drivers», подзаголовок «Driver statuses and Alerts». Карточки водителей: аватар (placeholder), имя, статус (Location on / Busy / Offline / Unavailable), телефон, авто (тип · номер), Driver ID. Список с прокруткой (max-height). Ниже блок Alerts: заголовок «Alerts», список событий (order.created, order.assigned, order.rejected, order.completed, reminder_pickup_soon, cost_limit_exceeded и т.д.) или «No alerts».
- **Водительский вид**: блок «My profile» (ник, телефон, тип авто, номер, Driver ID), кнопка Go offline / Start online (PATCH /users/me/available), блок «My status», статистика (completed count, today rides, total earned, total miles). Передача геолокации: при включённом «Share location» — setInterval 5 с (если есть заказ) или 10 с (без заказа), PATCH /users/me/location. Диспетчер опрашивает список водителей каждые 3 с для актуальных координат на карте.

### 7.4 Компоненты (web/src/components)

- **OrdersMap.tsx** — Leaflet-карта. Слой OSM, маркеры заказов (pickup/dropoff), полилинии маршрута (основной и альтернативные), маркеры водителей (кластеризация), маркер текущего пользователя, маркер выбранной точки (pick), маркеры отчётов (reports). Константа ROCKLAND_COUNTY_BOUNDARY — полигон красной линией. Функция decodePolyline для OSRM-encoded polyline. Кнопка Re-center. Стили: orders-map-container, orders-map-recenter, orders-map-overlay.
- **NavBar.tsx** — навигация по страницам в зависимости от роли, переключатель языка, кнопка New order, отображение пользователя и роли.
- **Pagination.tsx** — пагинация списков (page, totalItems, onPageChange).
- **ErrorBoundary.tsx** — перехват ошибок рендера.
- **Toast.tsx** — уведомления (успех/ошибка).
- **leafletWithCluster.ts** — экспорт L с подключённым MarkerClusterGroup.

### 7.5 Стили и темы

- `web/src/styles/design-system.css` — переменные (--rd-*), кнопки, инпуты, бейджи, панели.
- `web/src/styles/variables.css` — цвета, отступы.
- В каждой странице при необходимости свой CSS (Dashboard.css, Drivers.css, Calendar.css и т.д.).

### 7.6 API-клиент и сокет

- `web/src/api/client.ts` — функция request: BASE = VITE_API_URL || '/api', заголовок Authorization: Bearer token из localStorage (relaxdrive-access-token). Обработка 401, парсинг JSON. Экспорт api (get, post, patch, delete).
- `web/src/ws/useSocket.ts` — хук useSocket: подключение io(WS_URL) с auth.token, состояние connected, socket. Используется в Dashboard для подписки на orders, drivers, alerts.

### 7.7 Типы (web/src/types/index.ts)

Order, Driver, PassengerRow, DriverEta, OrderStatus. Order включает waypoints?: { address }[].

### 7.8 Утилиты

- `web/src/utils/exportCsv.ts` — экспорт таблиц в CSV (downloadCsv).

### 7.9 Локализация

Ключи в en/ru/es/ka: app, common, auth, nav, dashboard (все подписи форм, статусов, алертов, календаря, водителей, trip history, earnings и т.д.), calendar, drivers, passengers, translation, analytics, roles, pendings, sessions, costControl, whiteLabel, audit, health, toast, status, pagination.

---

## 8. Desktop (Electron)

Корень: `desktop/`. Электрон загружает веб-сборку или отдельный Vite-билд. Режимы (modes): AboutMode, AdminMode, AnalyticsMode, CalendarMode, ClientsMode, ControlMode (диспетчерский пульт с вкладками заказы/водители/отчёты), CostControlMode, DriversMode, LiveWallMode (карта на весь экран), LogsAuditMode, PendingsMode, SystemHealthMode, TranslationMode, WhiteLabelMode. Компонент карты: WallMap.tsx. Обновление карты и списка водителей по таймеру (5 с и 3 с). Конфиг ролей и маршрутизация по ролям в layouts. Стили: design-system.css, variables.css, cost-control-mode.css.

---

## 9. Автоматизация и фоновые процессы

- **Обновление данных на дашборде**: при открытии страницы и при возврате на вкладку (visibility) вызывается refreshAll (заказы, водители, отчёты, маршрут для выбранного заказа, завершённые заказы при вкладке Completed).
- **Геолокация водителя**: интервал 5 с (с заказом) или 10 с (без заказа), PATCH /users/me/location. maximumAge 15 с для getCurrentPosition.
- **Диспетчерская карта**: опрос списка водителей каждые 3 с для актуальных координат (или через WebSocket drivers, если бэкенд шлёт).
- **Сервер**: cron очистки сессий (90 дней), очистка DriverTripSummary (7 дней), напоминания о подаче (каждые 5 мин, за 15 мин до pickupAt), проверка лимитов стоимости (каждый час) и alert cost_limit_exceeded.
- **Время в форме заказа**: при нажатии «+ New order» автоматически подставляется время «сейчас + 30 минут» (функция defaultPickupAt в Dashboard.tsx).

---

## 10. Сборка и деплой

- Корень репозитория: `package.json` — скрипты build:web-and-desktop, deploy:frontends. `.cursor/rules/build-web-and-desktop.mdc` — правило сборки.
- CI (GitHub Actions): в `.github/workflows/ci.yml` — сборка backend, web, desktop (Windows artifact при необходимости).
- Backend деплой (Render и т.п.): `render.yaml`, команда старта с миграциями; при необходимости resolve rolled-back миграции (например 20260219000000_add_order_completed_at) в startCommand.
- Переменные: VITE_API_URL, VITE_WS_URL на фронте; DATABASE_URL, JWT секреты и т.д. на бэкенде.

---

## 11. Документация в репозитории

- `docs/FUNCTIONALITY-OVERVIEW.md` — обзор функционала по модулям и ролям.
- `docs/ANALYSIS-AND-IMPROVEMENTS.md`, `docs/AUTOMATION-AND-IMPROVEMENTS.md`, `docs/GUI-AND-FEATURES-ROADMAP.md` — анализ и планы улучшений.
- `README.md` — общее описание и шаги запуска.
- `VERIFICATION.md` — шаги проверки (например P3009 resolve).

---

Этот документ содержит всё перечисленное выше: все эндпоинты, все страницы, все основные компоненты, модели БД, WebSocket-события, автоматизацию и структуру файлов. Его можно целиком отправить в ChatGPT или другому ассистенту для контекста.
