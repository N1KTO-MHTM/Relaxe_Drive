# RelaxDrive — обзор функционала

Полный перечень возможностей backend, web и desktop по модулям и ролям.

---

## Роли и доступ

| Роль        | Web: страницы |
|------------|----------------|
| **ADMIN**  | Dashboard, Calendar, Passengers, Drivers, Translation, Analytics, Roles, Session Monitor, Cost Control, White Label, About |
| **DISPATCHER** | Dashboard, Calendar, Passengers, Drivers, Translation, Session Monitor, About (без Analytics, Roles, Cost Control, White Label) |
| **DRIVER** | Dashboard (как «Мои поездки»), Translation, About |

---

## Backend API

### Публичные (без JWT)

- `GET /` — информация об API (name, version, docs).
- `GET /health` — состояние сервиса (database, websocket, redis/maps/ai — unknown).
- `POST /auth/register` — регистрация (nickname, password, role?, phone?).
- `POST /auth/login` — вход (nickname, password, device?, rememberDevice?).
- `POST /auth/forgot-password` — запрос сброса пароля (nickname).
- `POST /auth/refresh` — обновление access-токена (refreshToken).

### С JWT

- `POST /auth/logout` — выход (опционально sessionId).

### Users (`/users`) — JWT

- `GET /users/me` — текущий пользователь (id, nickname, role, locale).
- `PATCH /users/me` — обновление профиля (locale).
- `PATCH /users/me/location` — обновление координат водителя (lat, lng). Только DRIVER.
- `GET /users` — список пользователей. ADMIN, DISPATCHER.
- `PATCH /users/:id/role` — смена роли. ADMIN.
- `PATCH /users/:id/password` — сброс пароля. ADMIN.
- `PATCH /users/:id/block` — блокировка (blocked). ADMIN.
- `PATCH /users/:id/ban` — бан (until, reason). ADMIN.
- `PATCH /users/:id/unban` — снятие бана. ADMIN.
- `GET /users/sessions` — активные сессии. ADMIN, DISPATCHER.

### Orders (`/orders`) — JWT

- `GET /orders` — заказы: без from/to — активные и запланированные; с from/to — за период. Водитель видит только свои.
- `GET /orders/:id/driver-etas` — ETA водителей до подачи и до высадки. ADMIN, DISPATCHER.
- `GET /orders/:id/route` — маршрут (polyline, duration, distance, опционально от водителя до подачи). ADMIN, DISPATCHER, DRIVER.
- `POST /orders` — создание заказа (pickupAt, pickupAddress, dropoffAddress, tripType?, middleAddress?, pickupType?, dropoffType?, passengerId?, phone?, passengerName?, bufferMinutes?). ADMIN, DISPATCHER. При указании phone — findOrCreateByPhone, при завершении заказа — авто-добавление клиента (phone, name, pickup), если такой пары ещё нет.
- `PATCH /orders/:id/assign` — назначить водителя. ADMIN, DISPATCHER.
- `PATCH /orders/:id/reject` — водитель отказывается. DRIVER.
- `PATCH /orders/:id/arrived-at-pickup` — водитель прибыл на подачу. DRIVER.
- `PATCH /orders/:id/arrived-at-middle` — водитель прибыл на вторую точку (roundtrip). DRIVER.
- `PATCH /orders/:id/left-middle` — водитель уехал со второй точки. DRIVER.
- `PATCH /orders/:id/status` — статус IN_PROGRESS или COMPLETED. ADMIN, DISPATCHER, DRIVER (свои заказы).
- `DELETE /orders/:id` — удаление заказа. ADMIN, DISPATCHER.

### Passengers (`/passengers`) — JWT, ADMIN/DISPATCHER

- `GET /passengers` — список клиентов (админ видит phone, диспетчер — без phone).
- `POST /passengers` — добавление клиента (phone, name?, pickupAddr?, dropoffAddr?, pickupType?, dropoffType?).

Логика сервиса: linkDriverToPassenger (при регистрации водителя с phone) — не дублировать водителя по phone; existsByPhoneAndPickupAddr; findOrCreateByPhone (в т.ч. при завершении заказа).

### Geo (`/geo`) — JWT

- `GET /geo/reverse?lat=&lng=` — обратное геокодирование (Nominatim), возврат address.

Роутинг и геокодирование: OSRM + Nominatim (без ключей).

### Audit (`/audit`) — JWT, ADMIN/DISPATCHER

- `GET /audit` — логи (query: userId?, action?, resource?, from?, to?, limit?).

### Cost Control (`/cost-control`) — JWT, ADMIN

- `GET /cost-control` — снимок счётчиков (maps, translation, ai, tts). При ошибке — fallback нули.

### WebSocket (Socket.IO)

- События от сервера: `orders`, `drivers`, `alerts`, `eta`, `user.updated`.
- Подключение с auth: token в handshake.

### Модули без REST (только внутреннее использование)

- **Translation** — TranslationService: translate (LibreTranslate), сохранение в TranslationRecord, учёт в cost-tracker. Нет контроллера — веб-страница Translation только заглушка.
- **Analytics** — AnalyticsService: getHeatmap(from, to) возвращает пустые zones/counts. Нет контроллера — веб Analytics только заглушка.
- **White Label** — WhiteLabelService: getConfig(tenantId). Нет контроллера — веб White Label только заглушка.
- **AI** — используется для ETA и др.; cost-tracker считает вызовы.
- **Alerts** — AlertsService: emitAlert (order.created, order.assigned, order.rejected, order.completed) через WebSocket.
- **Cost Tracker** — глобальные счётчики maps/translation/ai/tts для Cost Control.

---

## Web (React + Vite)

### Маршруты

- Публичные: `/login`, `/register`, `/forgot-password`.
- Под JWT: `/` → `/dashboard`, `/dashboard`, `/calendar`, `/passengers`, `/drivers`, `/translation`, `/analytics`, `/roles`, `/sessions`, `/cost-control`, `/white-label`, `/about`.

### Реализованные страницы (логика + API)

- **Login** — вход, сохранение токенов, locale, редирект по роли.
- **Register** — регистрация (роль DISPATCHER по умолчанию).
- **ForgotPassword** — запрос сброса пароля.
- **Dashboard** — заказы (активные/завершённые), карта (Leaflet, OSM), водители, создание заказа (ONE_WAY/ROUNDTRIP), назначение водителя, ETA, маршруты, для водителя: принять/отклонить, старт, прибытие на подачу/среднюю точку, завершение, передача геолокации, подсказки клиентов из Passengers.
- **Calendar** — день/неделя, заказы по датам из `/orders?from=&to=`, создание заказа на день, конфликты по bufferMinutes.
- **Passengers** — список клиентов, поиск, добавление (phone, name, pickup, тип места), экспорт CSV, переход «+ New order» с подстановкой в форму заказа. Без поля dropoff в форме.
- **Drivers** — список водителей, поиск, экспорт CSV, статусы (on map / offline / blocked / banned).
- **Roles** — список пользователей, смена роли, сброс пароля. Только ADMIN.
- **Session Monitor** — таблица сессий (user, device, IP, last active), авто-обновление 30 с.
- **Cost Control** — счётчики maps/translation/ai/tts, авто-обновление 60 с и при фокусе окна.
- **About** — описание приложения, по роли: детальное описание возможностей водителя и диспетчера.

### Заглушки (только текст, без вызова API)

- **Translation** — текст про голос→текст, авто-язык, историю. Нет вызова TranslationService.
- **Analytics** — текст «Heatmap, Filters». Нет вызова аналитики.
- **White Label** — текст про логотип, цвета, домены, языки. Нет вызова White Label API.

### Общее

- Локализация: en, ru, es, ka.
- Навбар и роуты фильтруются по роли (ROLE_PATHS).
- API client: baseURL из env, Bearer token, refresh при 401, редирект на /login при неавторизованном доступе.
- Toasts для уведомлений (order created, driver assigned, и т.д.).
- WebSocket: подписка на orders/drivers/alerts для обновления дашборда.

---

## Desktop (Electron + React)

### Режимы (маршруты)

- `/login`, `/forgot-password`.
- `/control` — панель управления (заказы, водители, сессии).
- `/wall` — «стена» (карта, ETA, алерты).
- `/health` — состояние системы.
- `/logs` — логи/аудит.
- `/admin` — админка (пользователи, роли, блок/бан, сброс пароля).
- `/clients` — клиенты.
- `/drivers` — водители.
- `/calendar` — календарь заказов.
- `/about` — о приложении.

Доступ по ролям: canAccessDesktopPath / getDefaultPathForRole.

### Реализация

- Те же API и WebSocket, что и веб.
- Свои локали (en, ru, es, ka) и режимы под десктоп (Control, Wall, Admin, Clients, Drivers, Calendar, Logs, Health, About).

---

## Краткая сводка по «полноте»

| Модуль           | Backend API      | Web UI           | Desktop     |
|------------------|------------------|------------------|-------------|
| Auth             | ✅               | ✅               | ✅          |
| Users / Roles    | ✅               | ✅ Roles         | ✅ Admin    |
| Orders           | ✅               | ✅ Dashboard     | ✅ Control  |
| Passengers       | ✅               | ✅               | ✅ Clients  |
| Drivers          | через Users      | ✅               | ✅          |
| Geo              | ✅ reverse       | в Dashboard      | в Control   |
| Audit            | ✅               | нет страницы     | ✅ Logs     |
| Sessions         | ✅               | ✅ Session Monitor | в Control |
| Cost Control     | ✅               | ✅               | только Admin (если есть) |
| Health           | ✅               | нет              | ✅ Health   |
| Translation      | сервис, нет API  | заглушка         | —           |
| Analytics        | пустой heatmap  | заглушка         | —           |
| White Label      | сервис, нет API  | заглушка         | —           |
| WebSocket/Alerts | ✅               | ✅               | ✅          |

Можно использовать этот файл как единый ориентир по всему функционалу и точкам доработки (Translation, Analytics, White Label, Audit на вебе и т.д.).
