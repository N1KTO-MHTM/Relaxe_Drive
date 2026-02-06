# Мобильные макеты RelaxDrive

Сгенерированы макеты экранов мобильного приложения (как может выглядеть веб-дашборд на телефоне или будущее нативное приложение).

## Список экранов

| Файл | Описание |
|------|----------|
| **relaxdrive-mobile-dashboard-list.png** | Список заказов: табы Active/Completed, фильтры, карточки с риском и Suggested driver, кнопки Assign/Swap/Delay/Mark manual, тумблеры Auto-Assign, View Plan, Problem zones, Focus. |
| **relaxdrive-mobile-focus-mode.png** | Режим фокуса: большая карта + нижняя панель с одним заказом, Suggested driver, кнопки действий, «Exit focus». |
| **relaxdrive-mobile-map-overlay.png** | Карта: маркеры по риску (зелёный/жёлтый/красный), водители, будущие пикапы, тепловая карта проблем, блок планирования. |
| **relaxdrive-mobile-plan-panel.png** | Панель планирования: окно, счётчики заказов/водителей, Driver shortage, список Risky orders. |
| **relaxdrive-mobile-order-card.png** | Развёрнутая карточка заказа: статус, риск, пассажир, адреса, Suggested driver, Swap/Delay/Mark manual, ссылки на карту. |
| **relaxdrive-mobile-driver-view.png** | Вид водителя: мой заказ, Accept/Start ride, навигация до пикапа, Google Maps / Waze. |

## Где лежат изображения

Изображения созданы инструментом генерации и сохраняются в папке **assets** окружения Cursor, например:

- `C:\Users\lukak\.cursor\projects\c-Users-lukak-OneDrive-Desktop-Relaxe-Drive\assets\`

Скопируйте нужные PNG в `docs/mobile-mockups/` или в репозиторий по своему усмотрению.

## Использование

Можно использовать как референс для:

- адаптивной вёрстки веб-дашборда под мобильные;
- дизайна будущего мобильного приложения (React Native / Flutter и т.д.);
- презентации продукта и согласования UI с заказчиком.
