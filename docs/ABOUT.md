# About Relaxe Drive — For Dispatchers & Admins

## What is Relaxe Drive?

**Relaxe Drive** is a dispatch control platform (control center) for managing drivers, orders, and passengers. One backend serves a **Web Dashboard**, a **Desktop Control Center** (Electron), and (in the future) a **Driver App**. It is built for 24/7 operation, real-time updates, and clear roles for dispatchers and admins.

---

## For Dispatchers

**Web Dashboard** (https://relaxdrive-web.onrender.com) and **Desktop Control Center** (run locally) let dispatchers:

- **Orders** — Create, edit, and track orders. Lifecycle: draft → scheduled → assigned → in progress → completed (or cancelled).
- **Calendar** — View and manage schedules; avoid overlaps and conflicts.
- **Passengers** — Manage passenger data and history.
- **Real-time** — See live updates (WebSocket) for orders, driver positions, and alerts.
- **Translation** — Use in-app translation / voice-to-text for multilingual support (when configured).
- **Analytics** — View dashboards and heatmaps (when data is available).
- **Session monitor** — See active sessions (who is logged in, from where).

Dispatchers log in with their own account, work in the dashboard or desktop app, and use the same API (e.g. on Render) for all actions.

---

## For Admins

**Admins** have full access and extra controls:

- **Roles** — Manage roles and permissions (Admin, Dispatcher, Driver).
- **Users** — Create and manage dispatchers and drivers (when user management UI is extended).
- **Audit** — View audit logs (who did what, when).
- **Cost control** — Monitor and control costs (when configured).
- **White label** — Configure branding and tenant settings (when configured).
- **Session monitor** — See and revoke active sessions for security.
- **Health** — Check API and database health (e.g. `/health` endpoint).

First admin is created by seed: **Admin** / **Luka1Soso** (change password after first login in production).

---

## Main concepts

| Concept | Description |
|--------|-------------|
| **Order** | A trip request: pickup time/address, dropoff address, passenger, optional driver. |
| **Driver** | Assigned to orders; can accept/decline (Driver App); sends GPS, gets ETA. |
| **Dispatcher** | Creates and manages orders, assigns drivers, watches calendar and alerts. |
| **Admin** | Manages users, roles, audit, cost control, white label, and system health. |

---

## Who sees what — Dispatchers vs Drivers

| What | Dispatcher | Driver |
|------|------------|--------|
| **Dashboard** (orders, map) | ✓ Sees all orders, can create/edit, assign drivers | — Uses Driver App only (future) |
| **Calendar** (schedule, conflicts) | ✓ Full access | — |
| **Passengers** (DB, history) | ✓ Full access | — |
| **Translation** (voice/text) | ✓ | ✓ (driver can use translator) |
| **Analytics** (reports, heatmap) | ✓ (in scope) | — |
| **Session monitor** (who is online) | ✓ Sees sessions (device, IP) | — |
| **Roles / Users** (manage permissions) | — | — (Admin only) |
| **Cost control** (spend, limits) | — | — (Admin only) |
| **White label** (branding) | — | — (Admin only) |
| **Audit logs** (who did what) | — | — (Admin only) |
| **System health** (API, DB status) | — | — (Admin only) |
| **Accept/Decline order** | — | ✓ In Driver App (future) |
| **GPS** (send position), **own orders** | — | ✓ In Driver App (future) |

**Summary:**  
- **Dispatcher** — works in Web or Desktop: orders, calendar, passengers, translation, analytics, session list. Cannot manage users/roles, cost, white label, audit, or health.  
- **Driver** — in the web app sees **Dashboard** and **Translation** (driver can use the translator). In the future Driver App (PWA/mobile): accept/decline assigned orders, send GPS, see ETA. Driver does not see calendar, passengers, analytics, roles, sessions, cost control, or white label.  

*The web app now shows each role only the menu items they can access; opening a URL for a forbidden section redirects to Dashboard.*

---

## What the system does today

- **Auth** — Login, register, refresh token, logout.
- **Orders** — Create, list, update (REST); structure ready for status flow and assignment.
- **Users & sessions** — List sessions; RBAC (Admin / Dispatcher / Driver).
- **Audit** — Log and read audit events.
- **Health** — API and database health check.
- **WebSocket** — Real-time channel for orders, drivers, alerts, ETA (backend ready; frontend can subscribe).
- **Web** — Dashboard with login, dashboard home, calendar, passengers, translation, analytics, roles, session monitor, cost control, white label.
- **Desktop** — Control Center (Electron) with Control, Live Wall, System Health, Logs & Audit, login.
- **i18n** — EN, RU, KA in web and desktop.

---

## Deployed URLs (example)

- **Web:** https://relaxdrive-web.onrender.com  
- **API:** https://relaxdrive-api.onrender.com  
- **API health:** https://relaxdrive-api.onrender.com/health  

Log in with **Admin** / **Luka1Soso** (or a dispatcher account you create).

---

# О программе Relaxe Drive — для диспетчеров и админов

## Что такое Relaxe Drive?

**Relaxe Drive** — платформа диспетчеризации (контроль-центр) для управления водителями, заказами и пассажирами. Один backend обслуживает **веб-дашборд**, **десктопный контроль-центр** (Electron) и (в перспективе) **приложение водителя**. Система рассчитана на работу 24/7, обновления в реальном времени и чёткие роли диспетчеров и админов.

---

## Для диспетчеров

**Веб-дашборд** и **десктопный контроль-центр** позволяют диспетчерам:

- **Заказы** — создавать, редактировать и отслеживать заказы (черновик → в расписании → назначен → в работе → выполнен / отменён).
- **Календарь** — просматривать и управлять расписанием, избегать пересечений.
- **Пассажиры** — вести учёт пассажиров и историю.
- **Real-time** — получать живые обновления (WebSocket) по заказам, позициям водителей и алертам.
- **Перевод** — использовать перевод/распознавание речи для мультиязычности (при настройке).
- **Аналитика** — просматривать отчёты и тепловые карты (при наличии данных).
- **Сессии** — видеть активные сессии (кто и откуда залогинен).

Диспетчер входит под своим аккаунтом и работает через дашборд или десктоп, оба подключаются к одному API (например на Render).

---

## Для админов

**Админы** имеют полный доступ и дополнительные возможности:

- **Роли** — управление ролями и правами (Admin, Dispatcher, Driver).
- **Пользователи** — создание и управление диспетчерами и водителями (при расширении UI).
- **Аудит** — просмотр логов (кто что и когда сделал).
- **Контроль затрат** — мониторинг и ограничение затрат (при настройке).
- **White label** — настройка брендинга и мультитенантности (при настройке).
- **Сессии** — просмотр и отзыв активных сессий для безопасности.
- **Здоровье системы** — проверка API и БД (например эндпоинт `/health`).

Первый админ создаётся через seed: **Admin** / **Luka1Soso** (в продакшене пароль лучше сменить после первого входа).

---

## Основные понятия

| Понятие | Описание |
|--------|-----------|
| **Заказ** | Поездка: время/адрес подачи, адрес назначения, пассажир, опционально водитель. |
| **Водитель** | Назначается на заказы; принимает/отклоняет (в приложении водителя); передаёт GPS, получает ETA. |
| **Диспетчер** | Создаёт и ведёт заказы, назначает водителей, следит за календарём и алертами. |
| **Админ** | Управляет пользователями, ролями, аудитом, контролем затрат, white label и здоровьем системы. |

---

## Кто что видит — диспетчеры и водители

| Что | Диспетчер | Водитель |
|-----|-----------|----------|
| **Дашборд** (заказы, карта) | ✓ Видит все заказы, создаёт/редактирует, назначает водителей | — Только приложение водителя (в перспективе) |
| **Календарь** (расписание, конфликты) | ✓ Полный доступ | — |
| **Пассажиры** (БД, история) | ✓ Полный доступ | — |
| **Перевод** (голос/текст) | ✓ | ✓ (водитель может пользоваться переводчиком) |
| **Аналитика** (отчёты, тепловая карта) | ✓ (в своей области) | — |
| **Монитор сессий** (кто онлайн) | ✓ Видит сессии (устройство, IP) | — |
| **Роли / Пользователи** | — | — (только админ) |
| **Контроль затрат** | — | — (только админ) |
| **White label** (брендинг) | — | — (только админ) |
| **Аудит** (кто что сделал) | — | — (только админ) |
| **Здоровье системы** (API, БД) | — | — (только админ) |
| **Принять/Отклонить заказ** | — | ✓ В приложении водителя (в перспективе) |
| **GPS** (передача позиции), **свои заказы** | — | ✓ В приложении водителя (в перспективе) |

**Кратко:**  
- **Диспетчер** — работает в вебе или десктопе: заказы, календарь, пассажиры, перевод, аналитика, список сессий. Не управляет пользователями/ролями, затратами, white label, аудитом и здоровьем системы.  
- **Водитель** — в веб-приложении видит **Дашборд** и **Перевод** (водитель может пользоваться переводчиком). В перспективе приложение водителя (PWA/мобильное): принять/отклонить заказы, передавать GPS, видеть ETA. Водитель не видит календарь, пассажиров, аналитику, роли, сессии, контроль затрат и white label.  

*В вебе каждой роли показываются только те пункты меню, к которым у неё есть доступ; переход по ссылке на запрещённый раздел перенаправляет на Дашборд.*

---

## Что система умеет сейчас

- **Авторизация** — вход, регистрация, обновление токена, выход.
- **Заказы** — создание, список, обновление (REST); структура готова к статусам и назначению.
- **Пользователи и сессии** — список сессий; RBAC (Admin / Dispatcher / Driver).
- **Аудит** — запись и просмотр событий аудита.
- **Health** — проверка работоспособности API и БД.
- **WebSocket** — канал в реальном времени для заказов, водителей, алертов, ETA (backend готов; фронт может подписаться).
- **Веб** — дашборд: вход, главная, календарь, пассажиры, перевод, аналитика, роли, монитор сессий, контроль затрат, white label.
- **Десктоп** — контроль-центр (Electron): Control, Live Wall, System Health, Logs & Audit, вход.
- **i18n** — EN, RU, KA в вебе и десктопе.

---

## Ссылки (пример)

- **Веб:** https://relaxdrive-web.onrender.com  
- **API:** https://relaxdrive-api.onrender.com  
- **Health API:** https://relaxdrive-api.onrender.com/health  

Вход: **Admin** / **Luka1Soso** (или созданный вами аккаунт диспетчера).
