# Проверка сценариев RelaxDrive

Дата: 2026-02-05

## E2E: всего 56 тестов

Запуск: `cd backend && npm run test:e2e`

## Сборки

| Проект    | Статус |
|----------|--------|
| Backend  | ✅ `npm run build` — успешно |
| Web      | ✅ `npm run build` — успешно |
| Desktop  | ✅ `npm run build` (Vite + electron-builder) — успешно |

## E2E тесты (Backend)

Запуск: `cd backend && npm run test:e2e` — **56 тестов**.

### Публичные эндпоинты
| Тест | Результат |
|------|-----------|
| GET /health — status, timestamp, services | ✅ |
| POST /auth/forgot-password — 200, ok + message | ✅ |
| POST /auth/reset-password — 401 при неверном токене / коротком пароле | ✅ |

### Роль ADMIN
| Тест | Результат |
|------|-----------|
| GET /audit, GET /audit?limit=5 — 200, массив | ✅ |
| GET /white-label — 200, объект или null | ✅ |
| GET /cost-control — 200, usage data | ✅ |
| GET /users — 200, массив | ✅ |
| GET /users/sessions — 200, массив | ✅ |
| POST /auth/admin/generate-reset-token — 200, token + link | ✅ |
| POST .../generate-reset-token без auth — 401 | ✅ |

### Роль DISPATCHER
| Тест | Результат |
|------|-----------|
| GET /audit, GET /users, GET /users/sessions — 200 | ✅ |
| GET /orders, GET /passengers — 200, массив | ✅ |
| GET /analytics/stats — 200 | ✅ |
| GET /white-label — 403 | ✅ |
| GET /cost-control — 403 | ✅ |
| POST /auth/admin/generate-reset-token — 403 | ✅ |

### Роль DRIVER
| Тест | Результат |
|------|-----------|
| GET /users/me — 200, свой профиль (id, role, available) | ✅ |
| GET /orders — 200, массив (только свои) | ✅ |
| PATCH /users/me/location — 200, lat/lng | ✅ |
| PATCH /users/me/available — 200, available | ✅ |
| GET /reports?minLat=... — 200, массив | ✅ |
| GET /audit, GET /users, GET /users/sessions — 403 | ✅ |
| GET /white-label, GET /passengers, GET /analytics/stats — 403 | ✅ |
| POST /auth/admin/generate-reset-token — 403 | ✅ |

### Функционал: заказы, карты, пассажиры, отчёты

| Сценарий | Результат |
|----------|-----------|
| **Orders flow** — диспетчер создаёт заказ → видит в списке → назначает водителя → водитель видит заказ → arrived at pickup → IN_PROGRESS → COMPLETED → заказ не в активном списке | ✅ |
| **Order reject** — диспетчер создаёт заказ, назначает водителя → водитель отклоняет → заказ снова SCHEDULED | ✅ |
| **Passengers** — диспетчер создаёт пассажира (phone, name) → видит в списке | ✅ |
| **Reports** — водитель создаёт отчёт (lat, lng, type, description) → GET /reports в bounds возвращает массив | ✅ |
| **Order route (карты)** — создание заказа → GET /orders/:id/route возвращает pickupCoords, dropoffCoords, polyline, durationMinutes, distanceKm | ✅ |
| **Order delete** — диспетчер создаёт заказ → удаляет → заказа нет в списке | ✅ |
| **Admin: смена роли** — админ меняет роль водителя на DISPATCHER и обратно на DRIVER | ✅ |

## Ручная проверка (рекомендуется)

1. **Web — Audit**  
   Войти как ADMIN или DISPATCHER → пункт «Audit Logs» → фильтры и таблица загружаются.

2. **Web — Health**  
   Войти как ADMIN → «System Health» → отображаются статусы сервисов.

3. **Web — White Label**  
   Войти как ADMIN → «White Label» → ввод logo URL, цвета, домена, локалей → «Save».

4. **Web — Сброс пароля по ссылке**  
   - Роли → выбрать пользователя → «Reset link» → скопировать ссылку.  
   - Открыть ссылку в гостевом окне → ввести новый пароль дважды → «Set password».  
   - Войти под этим пользователем с новым паролем.

5. **Web — Уведомления**  
   Разрешить уведомления в браузере. Водитель: назначить заказ → уведомление «Order assigned». Диспетчер: создать заказ в другой вкладке → уведомление «New order».

6. **Desktop — Сессии**  
   Войти как ADMIN → Control → вкладка Sessions → подвкладка «Registered accounts» → таблица аккаунтов.

7. **Desktop — Карта с отчётами**  
   Live Wall (карта) → отображаются водители (синие) и отчёты (оранжевые) при наличии данных.

8. **Swagger**  
   Запустить backend → открыть `http://localhost:3000/api-docs`.

## Исправления в процессе проверки

- **Web:** удалена неиспользуемая переменная `config` в `WhiteLabel.tsx` (ошибка сборки TS6133).
