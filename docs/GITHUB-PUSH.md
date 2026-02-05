# Как выложить RelaxDrive на GitHub и подключить к Render

Сейчас проект только у тебя на компьютере. Чтобы Render мог его деплоить, нужен репозиторий на GitHub.

---

## 1. Создать репозиторий на GitHub

1. Зайди на [github.com](https://github.com) и войди в аккаунт.
2. Справа вверху **+** → **New repository**.
3. Заполни:
   - **Repository name**: например `relaxdrive` или `Relaxe-Drive`.
   - **Public**.
   - **НЕ** ставь галочки "Add a README" / "Add .gitignore" — репо должен быть пустой.
4. Нажми **Create repository**.

---

## 2. Инициализировать Git в проекте и первый раз запушить

Открой терминал (PowerShell или cmd) и выполни команды **из папки проекта** (та, где лежат `backend`, `web`, `render.yaml`).

**Замени `ТВОЙ_ЮЗЕР` и `relaxdrive` на свой логин GitHub и имя репозитория.**

```bash
cd "c:\Users\lukak\OneDrive\Desktop\Relaxe Drive"

git init
git add .
git commit -m "Initial: RelaxDrive backend, web, desktop, Render config"
git branch -M main
git remote add origin https://github.com/ТВОЙ_ЮЗЕР/relaxdrive.git
git push -u origin main
```

При `git push` GitHub может попросить логин и пароль.  
Пароль от аккаунта больше не подойдёт — нужен **Personal Access Token**:

- GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)** → **Generate new token**.
- Выдай права **repo**.
- Скопируй токен и при запросе пароля при `git push` вставь его вместо пароля.

---

## 3. Подключить репозиторий к Render

1. [dashboard.render.com](https://dashboard.render.com) → **New** → **Web Service** (или **Blueprint**, если хочешь по `render.yaml`).
2. **Connect account** → выбери GitHub и разреши доступ.
3. В списке репозиториев выбери **relaxdrive** (или как назвал).
4. Дальше по инструкции [DEPLOY-RENDER.md](DEPLOY-RENDER.md): Root Directory `backend`, переменные, деплой, seed.

После этого код будет на GitHub, а Render будет собирать и запускать его с твоего репо.
