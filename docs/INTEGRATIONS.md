# Интеграции: карты, AI ETA, перевод

Бэкенд подключает внешние API для маршрутов/ETA и перевода. Если ключи не заданы, сервисы возвращают заглушки и не падают.

---

## Карты и ETA (OpenRouteService)

- **Сервис:** [OpenRouteService](https://openrouteservice.org/) (маршруты на авто).
- **Переменная:** `OPENROUTE_API_KEY`.
- **Где взять ключ:** [ORS Plans](https://openrouteservice.org/plans/) — есть бесплатный тариф.
- **Что делает:** `GeoService.getRoute()` и `GeoService.getEta()` — дистанция, время, полилиния. Без ключа возвращается `0` / пустая строка.

В **Render** в Environment для `relaxdrive-api` добавь:
```env
OPENROUTE_API_KEY=твой_ключ
```

---

## AI ETA (опционально)

- **Сервис:** любой свой или внешний API.
- **Переменная:** `AI_ETA_URL` — URL POST-эндпоинта.
- **Тело запроса:** `{ "orderId": "...", "from": { "lat": 0, "lng": 0 }, "to": { "lat": 0, "lng": 0 } }`.
- **Ожидаемый ответ:** `{ "minutes": 15 }`.
- **Поведение:** если `AI_ETA_URL` не задан или запрос неуспешен, используется классический ETA из OpenRouteService (карты).

---

## Перевод (LibreTranslate)

- **Сервис:** [LibreTranslate](https://libretranslate.com/) или свой инстанс.
- **Переменные:**
  - `LIBRETRANSLATE_URL` — по умолчанию `https://libretranslate.com`;
  - `LIBRETRANSLATE_API_KEY` — для libretranslate.com обычно нужен, для своего сервера — опционально.
- **Что делает:** `TranslationService.translate()` отправляет текст в API, сохраняет запись в БД. Если API недоступен или ключа нет, возвращается исходный текст.

В **Render**:
```env
LIBRETRANSLATE_URL=https://libretranslate.com
LIBRETRANSLATE_API_KEY=твой_ключ
```

---

## Кратко

| Интеграция   | Env-переменные              | Без ключа              |
|-------------|------------------------------|-------------------------|
| Карты / ETA | `OPENROUTE_API_KEY`          | ETA = 0, пустой маршрут |
| AI ETA      | `AI_ETA_URL`                 | Используется ETA с карт |
| Перевод     | `LIBRETRANSLATE_URL`, `LIBRETRANSLATE_API_KEY` | Возврат исходного текста |

Подробнее: `backend/.env.example`.
