@echo off
REM Двойной клик по этому файлу запускает весь киоск AU Copy:
REM backend + Telegram-бот + фронтенд + браузер на весь экран.
REM Окно закроется само — нужные сервисы откроются в своих окнах.

cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0start.ps1"
