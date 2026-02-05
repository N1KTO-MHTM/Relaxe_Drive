# RelaxDrive на Render — настройка с нуля

Ниже — пошагово: одна база PostgreSQL и один Web Service для API. Репозиторий должен быть запушен на GitHub/GitLab и подключён к Render.

---

## Вариант А: Blueprint (всё одной кнопкой)

1. Открой [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint**.
2. Подключи репозиторий с RelaxDrive (если ещё не подключён — **Connect account** и выбери репо).
3. Render подхватит файл **`render.yaml`** из корня репозитория.
4. В **render.yaml** уже заданы:
   - база **relaxdrive-db** (PostgreSQL);
   - сервис **relaxdrive-api** (Node.js, папка `backend`).
5. Перед созданием проверь/заполни:
   - **CORS_ORIGINS** в `render.yaml`: замени на свой URL фронта (или оставь `*` для теста).
   - **JWT_SECRET** — в Blueprint можно сгенерировать автоматически.
6. Нажми **Apply** — создастся БД и сервис, запустится первый деплой.
7. После успешного деплоя один раз выполни **seed** (шаг 4 ниже).

---

## Вариант Б: Вручную (PostgreSQL + Web Service)

### Шаг 1. Создать базу PostgreSQL

1. [Render Dashboard](https://dashboard.render.com) → **New** → **PostgreSQL**.
2. Поля:
   - **Name**: `relaxdrive-db`
   - **Database**: `relaxdrive`
   - **Region**: например **Frankfurt (EU Central)**.
   - **Plan**: Free (если нужен бесплатный план).
3. **Create Database**.
4. Когда БД создана → открой её → в **Connections** скопируй **Internal Database URL** (для сервиса на Render) и при желании **External Database URL** (для seed с компьютера).

---

### Шаг 2. Создать Web Service (backend)

1. В Dashboard → **New** → **Web Service**.
2. **Connect repository**: выбери репозиторий с RelaxDrive (если нет — подключи GitHub/GitLab и репо).
3. Настройки:
   - **Name**: `relaxdrive-api` (или любое).
   - **Region**: тот же, что у БД (например Frankfurt).
   - **Root Directory**: **`backend`** (обязательно).
   - **Runtime**: **Node**.
   - **Build Command** (скопируй целиком):
     ```bash
     cp prisma/schema.postgres.prisma prisma/schema.prisma && npm install && npx prisma generate && npx prisma migrate deploy && npm run build
     ```
   - **Start Command**:
     ```bash
     npm run start:prod
     ```
   - **Instance Type**: Free (или платный при необходимости).

4. **Environment** (кнопка **Add Environment Variable**):

   | Key             | Value |
   |-----------------|--------|
   | `DATABASE_URL`  | Вставь **Internal Database URL** из шага 1 (из карточки PostgreSQL → Connections). |
   | `JWT_SECRET`    | Любая длинная случайная строка (например 32+ символов). Можно сгенерировать: https://generate-secret.vercel.app/32 |
   | `CORS_ORIGINS`  | URL твоего фронта через запятую, без пробелов. Пока нет фронта — можно `*` (только для теста). |

5. **Create Web Service** — запустится первый деплой.

---

### Шаг 3. Дождаться деплоя

- В карточке сервиса открой вкладку **Logs**.
- Дождись сообщения вроде **Build successful** и **Your service is live at https://...**.
- Если в логах ошибка — пришли текст ошибки, подскажу, что поменять.

---

### Шаг 4. Создать админа (один раз)

После успешного деплоя нужно один раз выполнить seed (создаётся пользователь **Admin** / **Luka1Soso**).

**Способ 1 — через Render Shell (если доступен)**

1. В карточке **relaxdrive-api** → **Shell** (в правом верхнем углу или в меню).
2. В открывшейся консоли выполни:
   ```bash
   npm run prisma:seed
   ```
3. Должно появиться: `Admin user ready: nickname = Admin`.

**Способ 2 — с твоего компьютера**

1. В Render открой свою PostgreSQL → **Connections** → скопируй **External Database URL**.
2. Локально в папке проекта создай временный `.env.backend` в папке **backend** (или открой `backend/.env`) и вставь одну строку:
   ```env
   DATABASE_URL="вставь_сюда_External_Database_URL"
   ```
3. В терминале:
   ```bash
   cd backend
   cp prisma/schema.postgres.prisma prisma/schema.prisma
   npx prisma migrate deploy
   npm run prisma:seed
   ```
4. После успешного выполнения можно удалить временный `.env` или вернуть в нём локальный `DATABASE_URL` (SQLite).

Готово. Логин на API: **Admin** / **Luka1Soso**.

---

### Шаг 5. Проверка API

- URL сервиса будет вида: `https://relaxdrive-api.onrender.com` (или как в карточке сервиса).
- Проверка здоровья: открой в браузере `https://ТВОЙ-URL/health` — должен вернуться JSON со статусом.
- Логин: `POST https://ТВОЙ-URL/auth/login` с телом `{"nickname":"Admin","password":"Luka1Soso"}` (через Postman, curl или фронт).

---

## Фронт (Web) на Render (по желанию)

1. **New** → **Static Site**.
2. Подключи тот же репозиторий.
3. **Build settings**:
   - **Root Directory**: `web`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
4. **Create Static Site**.
5. В backend в переменной **CORS_ORIGINS** добавь URL этого статического сайта (например `https://relaxdrive-web.onrender.com`) и сделай **Manual Deploy**, чтобы применились переменные.

---

## Краткий чек-лист

- [ ] Репозиторий на GitHub/GitLab и подключён к Render  
- [ ] Создана PostgreSQL, скопирован Internal Database URL  
- [ ] Создан Web Service с Root Directory `backend`, Build/Start командами и переменными  
- [ ] Деплой прошёл без ошибок (проверил Logs)  
- [ ] Выполнен seed (админ Admin / Luka1Soso)  
- [ ] Открыл `/health` и проверил логин  

Если что-то не получается — пришли скрин или текст из **Logs** деплоя или ошибки в браузере.
