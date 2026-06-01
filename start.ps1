# Запуск AU Copy для разработки: бэкенд (FastAPI :8000) + Telegram-бот + фронтенд (Vite :5173)
# + киоск-браузер на весь экран.
# Открывает отдельные окна PowerShell с логами. Чтобы остановить — закрой окна.
#
# Запуск:  powershell -ExecutionPolicy Bypass -File .\start.ps1
# Без киоска:  powershell -ExecutionPolicy Bypass -File .\start.ps1 -NoKiosk

param([switch]$NoKiosk)

$root = $PSScriptRoot

Write-Host "Запускаю AU Copy..." -ForegroundColor Cyan

# --- Бэкенд (python из venv напрямую, активация не нужна) ---
$py = Join-Path $root "venv\Scripts\python.exe"
if (-not (Test-Path $py)) {
    Write-Host "Не найден venv: $py" -ForegroundColor Red
    Write-Host "Создай venv и поставь зависимости:" -ForegroundColor Yellow
    Write-Host "  python -m venv venv; venv\Scripts\pip install -r requirements.txt"
    exit 1
}
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root'; & '$py' -m backend.run"

# --- Telegram-бот (нужен token.txt; backend должен быть запущен) ---
$tokenFile = Join-Path $root "telega\token.txt"
if ((Test-Path $tokenFile) -and ((Get-Content $tokenFile -Raw).Trim().Length -gt 0)) {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root'; & '$py' -m telega.bot"
} else {
    Write-Host "Пропускаю бота: telega\token.txt пуст или отсутствует." -ForegroundColor Yellow
}

# --- Фронтенд ---
$frontend = Join-Path $root "frontend"
if (-not (Test-Path (Join-Path $frontend "node_modules"))) {
    Write-Host "node_modules не найдены — ставлю зависимости фронта (npm install)..." -ForegroundColor Yellow
    Push-Location $frontend; npm install; Pop-Location
}
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontend'; npm run dev"

# --- Киоск-браузер (ждём, пока фронт поднимется на :5173) ---
if (-not $NoKiosk) {
    Write-Host "Жду запуска фронта на :5173..." -ForegroundColor Cyan
    $ready = $false
    foreach ($i in 1..30) {
        # TCP-проверка порта: любой ответ = сервер поднят (Vite слушает на ::1,
        # а на корне отдаёт 404 — поэтому HTTP-проверка тут не годится).
        if (Test-NetConnection -ComputerName "localhost" -Port 5173 -WarningAction SilentlyContinue -InformationLevel Quiet) {
            $ready = $true
            break
        }
        Start-Sleep -Seconds 1
    }
    $kiosk = Join-Path $root "kiosk.bat"
    if ($ready -and (Test-Path $kiosk)) {
        Start-Process -FilePath $kiosk
        Write-Host "Киоск-браузер запущен. Выход: Alt+F4." -ForegroundColor Green
    } else {
        Write-Host "Не дождался фронта или нет kiosk.bat — киоск не запущен." -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Бэкенд -> http://localhost:8000  (Swagger: /docs)" -ForegroundColor Green
Write-Host "Бот    -> Telegram (long polling)" -ForegroundColor Green
Write-Host "Фронт  -> http://localhost:5173" -ForegroundColor Green
Write-Host "Логи в открывшихся окнах. Чтобы остановить — закрой их."