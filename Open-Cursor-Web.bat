@echo off
REM Open Cursor with only the WEB folder = less memory, fewer crashes (OOM)
cd /d "%~dp0"
where cursor >nul 2>&1
if %errorlevel% neq 0 (
  echo Cursor not in PATH. Create a shortcut instead:
  echo   Target: path to Cursor.exe
  echo   Start in: %~dp0web
  echo Then open that shortcut to work with only the web folder.
  pause
  exit /b 1
)
start "" cursor "%~dp0web"
