# RelaxDrive — Спецификация проекта

Каноническое описание продукта и требований. Связь с реализацией: [ARCHITECTURE.md](../ARCHITECTURE.md), [ROADMAP.md](./ROADMAP.md), [CHECKLIST-REQUIREMENTS.md](./CHECKLIST-REQUIREMENTS.md).

---

## 1. ОБЩЕЕ ОПИСАНИЕ ПРОЕКТА

**RelaxDrive** — это:

- **Веб-платформа** для диспетчеров и администраторов
- **Desktop-приложение (Control Center)** для полного управления системой
- **Real-time** управление водителями, заказами и маршрутами
- **Многоязычная система** с автоматическим переводом
- **AI-модули** для предсказаний и ETA
- **Мощная аналитика** и логирование

Система должна **работать 24/7**, быть **устойчивой к сбоям** и выглядеть **премиально**.

---

## 2. АРХИТЕКТУРА СИСТЕМЫ (ОБЯЗАТЕЛЬНО)

Использовать **единый backend**, к которому подключаются:

- **Web UI**
- **Desktop Control Center**
- **Driver App** (или PWA)

### Backend

- **API** (REST)
- **WebSocket** (real-time)
- **Auth + Roles**
- **AI services**
- **Translation services**
- **Analytics**
- **Logging**
- **Cost tracking**

---

## 3. РОЛИ И ДОСТУПЫ

### Админ

- полный доступ
- управление ролями
- **permission matrix**
- system health
- cost control
- white label настройки

### Диспетчер

- создание и управление заказами
- карта в реальном времени
- назначение водителей
- переводы
- календарь
- аналитика (ограниченная)

### Водитель

- принять / отклонить заказ
- отправка геолокации
- навигация
- авто-reconnect

---

## 4. WEB-ПЛАТФОРМА (МНОГОФУНКЦИОНАЛЬНАЯ)

Создать **красивый, сложный, профессиональный UI**, не простой.

### Обязательные модули

- **Login / Registration** (i18n)
- **Dispatcher Dashboard**
  - Live Map
  - Orders list
  - AI alerts
  - ETA + AI ETA
- **Calendar**
  - день / неделя
  - предзаказы до 6 дней
  - conflict detection
  - buffer time
- **Passengers database**
  - телефон
  - pickup / drop-off
  - история
- **Translation Center**
  - Voice → Text
  - **Text → Text (ОБЯЗАТЕЛЬНО)**
  - Text → Voice
  - Auto language detection
- **Analytics**
  - heatmap
  - время
  - загрузка
- **Roles & Permissions**
- **Session Monitor** (кто онлайн)
- **Cost Control**
- **White Label**

---

## 5. DESKTOP CONTROL CENTER (КРИТИЧЕСКИ ВАЖНО)

Создать **Desktop Control Center** (Electron).

### Режимы

- **Control Mode** — полный контроль
- **Live Wall Mode** — большой экран (read-only)
- **System Health Dashboard**
- **Logs & Audit**

### Функции

- видеть **ВСЁ**, что происходит в системе
- управлять ролями и сессиями
- блокировать пользователей
- логировать все действия
- **local cache** (работа при плохом интернете)
- **auto-reconnect**
- **graceful degradation**

---

## 6. ИНТЕЛЛЕКТ И АВТОМАТИЗАЦИЯ

- **Predicted Load** — прогноз пиков по времени и районам
- **AI ETA Prediction** — реальное время подачи; **fallback на обычный ETA**
- **Auto Follow-ups** — алерты при:
  - задержках
  - остановках
  - росте ETA
  - потере связи
- **Smart Rerouting**
  - предложение альтернативных маршрутов
  - предложение смены водителя
  - диспетчер подтверждает

**❌ НЕ использовать рейтинги водителей**

---

## 7. ЯЗЫКИ И ПЕРЕВОДЫ

### Языки интерфейса

- **English**
- **Русский**
- **Грузинский**

### Переводы общения

- автоопределение языка
- **voice → text**
- **text → text (всегда!)**
- **text → voice**
- история переводов

---

## 8. НАДЁЖНОСТЬ И УСТОЙЧИВОСТЬ

Обязательно реализовать:

- **WebSocket auto-reconnect**
- **GPS buffering**
- **local cache** (desktop)
- **graceful degradation**
  - карты fallback
  - AI fallback
  - переводы fallback

---

## 9. ДИЗАЙН — RELAXDRIVE STYLE

### Цвета (строго)

- **чёрный** — основной фон
- **белый** — текст
- **красный** — критично
- **жёлтый** — внимание
- **зелёный** — OK

### Стиль

- тёмный **premium UI**
- **glass-панели**
- **карта в центре**
- **цвет = смысл**
- минимум кликов
- **hotkeys**
- **drag & drop**
- плавные анимации

UI должен выглядеть как **Control Center**, а не обычный сайт.

---

## 10. ТЕХНИЧЕСКИЕ ТРЕБОВАНИЯ

- **Real-time** (WebSocket)
- **JWT + refresh**
- **Permission matrix**
- **Audit logs**
- **Performance-first**
- **Scalability**
- **White-label ready**

---

## Связь с текущей реализацией

| Раздел спецификации | Где в проекте |
|---------------------|----------------|
| 1–2. Общее описание, архитектура | [ARCHITECTURE.md](../ARCHITECTURE.md) |
| 3. Роли | Backend: `@Roles()`, `RolesGuard`; Web/Desktop: меню по ролям |
| 4. Web-платформа | `web/`: Dashboard, Calendar, Passengers, Translation, Analytics, Roles, Sessions, Cost Control, White Label |
| 5. Desktop Control Center | `desktop/`: Control / Live Wall / System Health / Logs & Audit, local cache, i18n |
| 6. Интеллект | `backend/`: AiService, GeoService, OpenRouteService, AI_ETA_URL; алерты — WebSocket, доработки в [ROADMAP.md](./ROADMAP.md) |
| 7. Языки | i18n EN/RU/KA в web и desktop; TranslationService (LibreTranslate), text→text |
| 8. Надёжность | WebSocket reconnect (web), local cache (desktop), Retry + CircuitBreaker (Geo, Translation) |
| 9. Дизайн | `variables.css`, `design-system.css` — чёрный фон, glass, семантика цветов |
| 10. Технические требования | JWT + refresh, audit, permission matrix — см. [CHECKLIST-REQUIREMENTS.md](./CHECKLIST-REQUIREMENTS.md) |

Полный список оставшихся и приоритетных задач — [ЧТО-ОСТАЛОСЬ.md](./ЧТО-ОСТАЛОСЬ.md). Расширенный список идей — [ROADMAP.md](./ROADMAP.md).
