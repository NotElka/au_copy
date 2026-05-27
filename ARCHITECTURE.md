# AU Copy — Архитектура системы

## Общая схема

```
Пользователь (телефон)
        │
        │  отправляет PDF/DOCX
        ▼
┌─────────────┐      HTTP POST /api/upload      ┌──────────────────┐
│ Telegram Bot│ ──────────────────────────────► │  FastAPI Backend  │
│  (aiogram)  │ ◄──────────────────────────────  │  :8000            │
└─────────────┘      { code: "A7K2NP", ... }    └──────┬───────────┘
                                                        │  хранит файл
        │  Код A7K2NP                                   │  в storage/
        ▼                                               │
Пользователь (киоск)                                    │
        │                                               │
        │  вводит код                                   │
        ▼                                               │
┌─────────────────┐  GET /api/file/{code}        ┌──────┴───────────┐
│    React Фронт   │ ──────────────────────────► │  FastAPI Backend  │
│  (Vite, порт    │ ◄────────────────────────── │  возвращает       │
│  5173 в dev)    │  { fileName, mimeType, ... } │  метаданные       │
│                 │                              │                   │
│                 │  GET /api/file/{code}/download │                  │
│   <iframe>      │ ──────────────────────────► │  отдаёт байты     │
│   PDF viewer    │ ◄────────────────────────── │  файла            │
└─────────────────┘                              └───────────────────┘
```

---

## 1. Telegram-бот (`telega/bot.py`)

**Технология:** Python, aiogram 3.x (асинхронный)

**Запуск:**
```bash
python -m telega.bot
```

**Что делает:**

1. Читает токен бота из `telega/token.txt`
2. Слушает входящие сообщения через Telegram Bot API (long polling)
3. При получении файла-документа:
   - Проверяет расширение: только `.pdf`, `.doc`, `.docx`
   - Проверяет размер: не больше 25 МБ
   - Скачивает файл из Telegram в память (BytesIO)
   - Отправляет файл на backend через HTTP `POST /api/upload` с заголовком `X-Upload-Token`
   - Получает от backend JSON с полем `code`
   - Отвечает пользователю: «🔑 Ваш код: `A7-K2NP`»

**Константы (в `telega/bot.py`):**
```
BACKEND_URL = "http://127.0.0.1:8000"
UPLOAD_TOKEN = "dev-secret-change-me"   # должен совпадать с backend/config.py
```

---

## 2. Backend (`backend/`)

**Технология:** Python, FastAPI + uvicorn, хранение в памяти (dict) + файлы на диске

**Запуск:**
```bash
python -m backend.run
# → слушает http://0.0.0.0:8000
```

### Файловая структура

```
backend/
├── __init__.py
├── config.py        # константы: TTL, лимиты, CORS, UPLOAD_TOKEN
├── main.py          # FastAPI app, эндпоинты
├── sessions.py      # SessionStore — хранилище сессий (in-memory + файлы)
├── pdf_pages.py     # подсчёт страниц PDF без зависимостей (regex по структуре)
├── word_to_pdf.py   # конвертация DOCX→PDF через docx2pdf (MS Word COM)
├── run.py           # точка входа для uvicorn
└── storage/         # папка с загруженными файлами (создаётся автоматически)
```

### Эндпоинты

#### `POST /api/upload`
- Принимает: `multipart/form-data` с полем `file` + заголовок `X-Upload-Token`
- Проверяет токен (защита от случайных загрузок)
- Если `.doc`/`.docx` → конвертирует в PDF через `word_to_pdf.py` (требует MS Word)
- Сохраняет файл в `backend/storage/{CODE}.pdf`
- Создаёт `Session` в памяти: код, путь к файлу, имя, mime, размер, число страниц, TTL (30 мин)
- Возвращает: `{ code, fileName, mimeType, size, pageCount, expiresAt }`

#### `GET /api/file/{code}`
- Возвращает метаданные сессии по коду (без тела файла)
- Если код не найден или истёк TTL → 404

#### `GET /api/file/{code}/download`
- Отдаёт сам файл с `Content-Disposition: inline`
- Inline важен для `<iframe>` — без него браузер скачивает, а не показывает

#### `GET /api/health`
- Просто `{ ok: true }` — для проверки что сервер живой

### Управление сессиями (`sessions.py`)

- `SessionStore` — синглтон `store`
- Хранит `dict[code → Session]`
- Код: 6 символов из алфавита `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (без похожих O/0/I/1)
- Фоновая корутина `cleanup_loop()` каждую минуту удаляет истёкшие сессии и их файлы
- TTL: 30 минут (настраивается в `config.py`)

---

## 3. Фронтенд (`frontend/`)

**Технология:** React 18, Vite, Tailwind CSS

**Запуск:**
```bash
cd frontend
npm run dev    # dev-сервер на http://localhost:5173
npm run build  # production-сборка в dist/
```

### Ключевые файлы

```
frontend/src/
├── App.jsx                     # корневой компонент, маршрутизация по экранам
├── main.jsx                    # точка входа React
├── index.css                   # глобальные стили + kiosk-настройки
├── components/
│   ├── ScaleToFit.jsx          # обёртка: масштабирует 1920×1080 под любой экран
│   ├── Header.jsx              # шапка: лого, шаги, кнопка ошибки
│   ├── StepIndicator.jsx       # прогресс 1→5 сверху
│   ├── PrintPreview.jsx        # предпросмотр листов печати (pdfjs-dist)
│   ├── ErrorReportModal.jsx    # модалка «Сообщить об ошибке»
│   └── screens/
│       ├── Screen1Upload.jsx   # ввод кода, QR-коды ботов
│       ├── Screen2Preview.jsx  # просмотр документа, выбор ориентации
│       ├── Screen3Settings.jsx # страницы, копии, раскладка, duplex
│       ├── Screen4Payment.jsx  # выбор способа оплаты, итог
│       ├── Screen5Kaspi.jsx    # оплата Kaspi QR
│       ├── Screen5Card.jsx     # оплата картой (contactless)
│       └── Screen6Success.jsx  # успех + прогресс печати
├── hooks/
│   └── usePrintPrice.js        # хук расчёта стоимости (цена × страницы × копии)
└── utils/
    ├── api.js                  # fetchSession(), formatBytes(), API_BASE
    └── parsePageRange.js       # парсинг «1, 3-7» → массив номеров страниц
```

### Поток экранов

```
Screen1Upload → Screen2Preview → Screen3Settings → Screen4Payment
                                                         │
                                              ┌──────────┴──────────┐
                                              ▼                     ▼
                                        Screen5Kaspi          Screen5Card
                                              └──────────┬──────────┘
                                                         ▼
                                                   Screen6Success
```

### Масштабирование (`ScaleToFit.jsx`)

Весь интерфейс рендерится в фиксированном контейнере **1920×1080 px**.
`ScaleToFit` вычисляет `scale = min(viewportW/1920, viewportH/1080)` и применяет
`transform: scale(scale)` — так кiosk выглядит одинаково на экранах любого размера.
Браузерные скроллбары отключены (`overflow: hidden` на `html, body`).

### Взаимодействие с backend

Все запросы идут через `utils/api.js`:

```
API_BASE = http://localhost:8000   (или VITE_API_BASE из .env)
```

| Действие | Запрос |
|---|---|
| Проверить код | `GET /api/file/{code}` |
| Загрузить PDF в iframe | `GET /api/file/{code}/download` |
| Получить число страниц | поле `pageCount` из ответа выше |

Фронт **никогда** не загружает файлы напрямую — только бот отправляет их через `/api/upload`.

### Расчёт цены (`usePrintPrice.js`)

```
PRICE_PER_SHEET = 24 ₸

выбранных_страниц = pages === 'all' ? pageCount : parsePageRange(pageRange)
листов = ceil(выбранных_страниц / pagesPerSide)
итого = листов × copies × 24
```

---

## 4. Взаимосвязь компонентов

### Данные сессии — от бота до экрана

```
telega/bot.py
  скачивает файл → POST /api/upload
                              │
              backend/main.py  │  конвертирует DOCX→PDF
                              │  считает pageCount
                              │  создаёт Session{code, filePath, ...}
                              │  отвечает {code, pageCount, ...}
                              ▼
                        бот → пользователь: «Ваш код: A7K2NP»

frontend/Screen1Upload.jsx
  пользователь вводит код → GET /api/file/A7K2NP
                              │
                    backend возвращает {fileName, mimeType, pageCount, ...}
                              │
                    App.jsx сохраняет session в useState
                              │
                    Screen2: iframe src = /api/file/A7K2NP/download
                    Screen3: PrintPreview загружает PDF через pdfjs
                    Screen4: usePrintPrice считает итог
```

### Переменные окружения / настройки

| Файл | Переменная | По умолчанию | Описание |
|---|---|---|---|
| `backend/config.py` | `UPLOAD_TOKEN` | `dev-secret-change-me` | Токен для `/api/upload` |
| `backend/config.py` | `SESSION_TTL_SECONDS` | `1800` (30 мин) | Время жизни кода |
| `backend/config.py` | `CORS_ORIGINS` | `localhost:5173, 4173` | Разрешённые источники |
| `telega/token.txt` | — | токен бота | Читается при старте |
| `frontend/.env` | `VITE_API_BASE` | `http://localhost:8000` | URL backend для фронта |

---

## 5. Запуск всей системы

```bash
# Терминал 1 — Backend
cd "au.copy"
.\venv\Scripts\python.exe -m backend.run
# → http://localhost:8000

# Терминал 2 — Telegram бот (backend должен быть запущен)
cd "au.copy"
.\venv\Scripts\python.exe -m telega.bot

# Терминал 3 — Фронтенд (dev)
cd "au.copy\frontend"
npm run dev
# → http://localhost:5173
```

> **Важно:** бот и backend должны использовать одинаковый `UPLOAD_TOKEN`.
> Конвертация Word→PDF требует установленного **Microsoft Word** на машине с backend.

---

## 6. Зависимости

### Python (`requirements.txt`)
- `fastapi` — REST API
- `uvicorn` — ASGI-сервер
- `aiogram` — Telegram Bot API
- `aiohttp` — HTTP-клиент в боте (запрос к backend)
- `aiofiles` — асинхронная работа с файлами
- `pydantic` — валидация данных
- `docx2pdf` + `pywin32` — конвертация Word→PDF (Windows/MS Word)

### JavaScript (`package.json`)
- `react` + `react-dom` — UI
- `vite` — сборщик
- `tailwindcss` — утилитарные стили
- `pdfjs-dist` — рендер PDF-страниц в Canvas (для PrintPreview на Screen3)

---

## 7. Печать (Screen6 → принтер)

### Что гарантируется

- **Превью на Screen3 = реальный вывод на принтер**. Один и тот же алгоритм
  (frontend `layoutFor()` + backend `_nup_layout()`) определяет, как страницы
  лягут на лист. Раскладка, ориентация — всё совпадает один-в-один.
- **Ориентация — это размер листа, а не поворот контента**: выбор книжная/
  альбомная меняет аспект бумаги (210×297 vs 297×210), но содержимое страниц
  НЕ поворачивается. Если ориентации source и target не совпадают, появляются
  поля по бокам — как в стандартных Adobe Reader / Word без auto-rotate.
- **Изображения (JPG/PNG/etc.)** конвертируются в одностраничный A4 PDF в
  выбранной ориентации перед печатью — картинка центрируется и масштабируется
  с сохранением пропорций.

### Общий поток

```
Screen2 (ориентация)─┐
Screen3 (раскладка)──┼──► App.jsx (printSettings + orientation)
                     │
                     ▼
              Screen6Success
                     │
                     │  POST /api/print/{code}
                     │  { pages, pageRange, copies,
                     │    pagesPerSide, duplex, orientation }
                     ▼
              backend/main.py
                     │  PrintRequest (pydantic)
                     ▼
              backend/print_job.py
                     │
                     │  ┌─ если файл-картинка → Pillow конвертирует в A4 PDF
                     │  │   в выбранной ориентации (центрирует, масштабирует)
                     │  ▼
                     │  ┌─ pypdf: page-range → rotation → N-up
                     │  │   • 1-up: поворачиваем страницу на 90° если ориентации
                     │  │     source и target отличаются
                     │  │   • 2/4/8-up: собираем N исходных страниц на A4
                     │  │     листе target-ориентации (cols×rows = layout)
                     │  │   → temp_<stamp>.pdf, где каждая страница ровно равна
                     │  │     одному физическому листу
                     │  ▼
                     │  ┌─ Виртуальный принтер? (Microsoft Print to PDF / XPS / пусто)
                     │  │     ДА → копируем PDF в ~/Downloads/au_copy_print/
                     │  │     НЕТ → Ghostscript mswinpr2 → Windows spooler
                     │  ▼
                     │  возвращаем { sheets, mode, output }
                     ▼
              Screen6 показывает «Лист X из N»
              файл удаляется (DELETE /api/file/{code})
```

### Какие инструменты используются

| Слой | Что | Где |
|---|---|---|
| Конвертация изображений | **Pillow** (PIL fork) | `Pillow>=12` в venv |
| Препроцессинг (page-range + rotation + N-up) | **pypdf** | `pypdf==6.x` в `requirements.txt` |
| Отправка на принтер | **Ghostscript** (`gswin64c.exe`) | внешний бинарь, ставится отдельно |
| Конвертация DOCX → PDF | **docx2pdf + Word COM** | устанавливается с Microsoft Office |
| pdf-превью на фронте | **pdfjs-dist** | npm |

Файл логики печати: **`backend/print_job.py`**.

**Зачем именно так:**
- Ghostscript отлично умеет отправлять PDF в Windows-спулер через `mswinpr2`,
  поддерживает `-dNumCopies`, `-dDuplex`, `-sPageList`. Но **N-up через CLI
  не умеет**, и поворот страниц через CLI тоже неудобен.
- pypdf через `PageObject.create_blank_page()` и `merge_transformed_page()`
  даёт точный контроль над тем, как страница ляжет на лист.
- Pillow конвертирует растровые форматы в PDF в одну операцию.
- Все три инструмента работают офлайн, без сетевых зависимостей.

### Конфигурация

В `backend/config.py`:

```python
GS_PATH      = os.environ.get("AU_GS_PATH",
                              r"C:\Program Files\gs\gs10.07.1\bin\gswin64c.exe")
PRINTER_NAME = os.environ.get("AU_PRINTER", "Microsoft Print to PDF")
```

| Переменная env | Что переопределяет | По умолчанию (хардкод в config.py) |
|---|---|---|
| `AU_GS_PATH` | путь до `gswin64c.exe` | `C:\Program Files\gs\gs10.07.1\bin\gswin64c.exe` |
| `AU_PRINTER` | имя принтера Windows | `Microsoft Print to PDF` (тест-режим) |

**Чтобы поменять принтер навсегда** — отредактируй `config.py` напрямую.
Чтобы поменять временно — задай env var перед стартом backend.

### Установка Ghostscript

1. Скачать с **https://ghostscript.com/releases/gsdnld.html** → AGPL release →
   Windows 64-bit installer (`gs10xx_w64.exe`).
2. Установить с настройками по умолчанию. Создаст:
   ```
   C:\Program Files\gs\gs10.07.1\bin\gswin64c.exe   ← консольная версия (для нас)
   C:\Program Files\gs\gs10.07.1\bin\gswin64.exe    ← GUI, не нужна
   ```
3. Проверить установку:
   ```powershell
   & "C:\Program Files\gs\gs10.07.1\bin\gswin64c.exe" -v
   ```
4. Если версия другая — поправь путь в `config.py` (`GS_PATH`).

### Как выбрать/поменять принтер

**Узнать имена доступных принтеров** (PowerShell):
```powershell
Get-Printer | Select-Object Name, PrinterStatus, DriverName | Format-Table -AutoSize
```

Получится что-то вроде:
```
Name                          PrinterStatus    DriverName
----                          -------------    ----------
HP LaserJet Pro M404dn        Normal           HP Universal Printing PCL 6
Canon iR-ADV C5550            Normal           Canon Generic Plus UFR II
Microsoft Print to PDF        Normal           Microsoft Print To PDF
```

**Поменять принтер** — три способа:

1. **Прямо в `config.py`** (рекомендуемо в продакшене):
   ```python
   PRINTER_NAME = os.environ.get("AU_PRINTER", "HP LaserJet Pro M404dn")
   ```

2. **Через переменную окружения** (для разработки):
   ```powershell
   $env:AU_PRINTER = "HP LaserJet Pro M404dn"
   .\venv\Scripts\python.exe -m backend.run
   ```

3. **Постоянная переменная пользователя**:
   ```powershell
   [System.Environment]::SetEnvironmentVariable("AU_PRINTER", "HP LaserJet Pro M404dn", "User")
   ```

Имя берётся **точно как в `Get-Printer`** — с пробелами, регистром, тире.

### Тест-режим (без реального принтера)

Microsoft Print to PDF из фонового процесса висит на Save-диалоге. Поэтому
`print_job.py:_is_dialog_printer()` детектит «виртуальные» принтеры
(`""`, `Microsoft Print to PDF`, `Microsoft XPS Document Writer`) и **вместо
вызова Ghostscript просто копирует готовый PDF в `~/Downloads/au_copy_print/`**.

Имя файла: `print_<YYYYMMDD_HHMMSS>.pdf`. Если копий > 1, страницы дублируются
внутри одного файла (для проверки итогового объёма).

В Screen6 при этом показывается синяя плашка с путём до файла, чтобы было
понятно куда смотреть.

Переключение между тест-режимом и реальным принтером происходит автоматически
по `PRINTER_NAME` — менять код не нужно.

### Что передаётся из настроек пользователя

Screen3 + Screen2 формируют объект, который идёт в `POST /api/print/{code}` body:

```json
{
  "pages": "all",            // 'all' | 'range'
  "pageRange": "1-5,7,9-12", // непустое только при range
  "copies": 2,
  "pagesPerSide": 1,         // 1 | 2 | 4
  "duplex": false,
  "orientation": "portrait"
}
```

Маппинг настроек на стадии:

| Настройка | Где обрабатывается | Как |
|---|---|---|
| `pages` + `pageRange` | pypdf preprocess | `_parse_page_range()` → отбираем нужные страницы |
| `orientation` | pypdf preprocess | размер выходного листа = `_sheet_size(orientation)` (A4 595×842 / 842×595) |
| `pagesPerSide=1` + ориентация ≠ source | pypdf preprocess | `_rotated_copy()` поворачивает страницу на 90° |
| `pagesPerSide=2/4/8` | pypdf preprocess | `_nup_layout()` даёт cols×rows, `_place_on_sheet()` ставит по слотам |
| `copies` | Ghostscript | `-dNumCopies=N` (в тест-режиме — дублирование страниц) |
| `duplex` | Ghostscript | `-dDuplex=true -dTumble=false` (переплёт по длинному краю) |
| **картинка** | Pillow preprocess | `_image_to_pdf()` → одностраничный A4 PDF в выбранной ориентации |

**Раскладка N-up** (одинаковая в `print_job._nup_layout()` и `PrintPreview.layoutFor()`):

| N | Книжный лист | Альбомный лист |
|---|---|---|
| 1 | 1×1 | 1×1 |
| 2 | 1×2 (стопкой) | 2×1 (рядом) |
| 4 | 2×2 | 2×2 |
| 8 | 2×4 (стопкой) | 4×2 (рядом) |

Это и есть гарантия "что вижу в превью на Screen3 — то и распечатается".

### Итоговая команда Ghostscript (реальный принтер)

```
gswin64c.exe -dBATCH -dNOPAUSE -dSAFER
             -sDEVICE=mswinpr2
             -sOutputFile=%printer%HP LaserJet Pro M404dn
             -dNumCopies=2
             -dDuplex=true -dTumble=false
             C:\Temp\aucopy_A7K2NP_212034.pdf
```

В логах backend ищи `print cmd: [...]` — полный набор аргументов с принтером
и временным PDF после препроцессинга.

### Что поддерживается / не поддерживается

✅ Поддерживается:
- PDF (любой ориентации страниц)
- Изображения: JPG, JPEG, PNG, BMP, GIF, TIFF, TIF, WebP — конвертируются в A4 PDF
- Поворот страниц под выбранную ориентацию листа
- N-up: 1, 2, 4, 8 на лист
- Произвольные диапазоны страниц ("1-3, 5, 7-9")
- Несколько копий
- Дуплекс (через драйвер принтера)

❌ Пока нет:
- Выбор лотка / paper bin
- Выбор цвет/ч-б (управляется драйвером принтера)
- Размер бумаги отличный от A4
- N-up для картинок (всегда 1 картинка = 1 лист, иначе бессмыслица)

### Жизненный цикл файла и печати

```
1. Бот → POST /api/upload         → файл на диск (storage/A7K2NP.pdf), TTL 30 мин
2. Юзер вводит код на фронте      → GET /api/file/{code}    (метаданные)
3. iframe / pdfjs                 → GET /api/file/{code}/download  (отображение)
4. После оплаты Screen6           → POST /api/print/{code}         (печать)
   ├── pypdf: range + N-up → temp PDF в %TEMP%
   ├── Ghostscript / file mode
   ├── temp PDF удаляется в finally
   └── вернётся { ok, sheets, mode, output }
5. Screen6 после успеха           → DELETE /api/file/{code}        (удаление)
   └── фоновый cleanup_loop тоже удалит файл через 30 мин если что
```

`POST /api/print/{code}` ждёт завершения процесса Ghostscript (макс 30 с —
жёсткий таймаут). На фронте дополнительно 45-сек failsafe чтобы не висеть
на спиннере, если backend не ответил.

### Диагностика

| Симптом | Что проверить |
|---|---|
| `Ghostscript не найден` | путь в `AU_GS_PATH` / `GS_PATH` в `config.py`. Проверить `Test-Path` |
| `Принтер … не ответил за 30 с` | принтер требует диалог (типа Microsoft Print to PDF) или офлайн |
| `Ghostscript завершился с кодом N` | имя в `PRINTER_NAME` точно совпадает с `Get-Printer` |
| Прогресс зависает в Screen6 | `console.log` в DevTools, ошибка из `printDocument` |
| Файл сохранился в Downloads вместо принтера | `PRINTER_NAME` попал в список виртуальных в `_is_dialog_printer()` |
| Документ обрезается по краям | проверить размер исходных страниц vs A4-настройку драйвера |

---

## 8. Локализация (i18n)

Поддерживается 3 языка: **Русский (ru) · Қазақша (kk) · English (en)**.

### Архитектура

```
frontend/src/i18n/
├── dictionary.js      ← плоский объект { ru: {...}, kk: {...}, en: {...} }
└── LanguageProvider.jsx  ← React Context с хуком useT()
```

**Использование в компонентах:**
```jsx
import { useT } from '../i18n/LanguageProvider';

function MyScreen() {
  const { t, lang, setLang } = useT();
  return <h1>{t('screen1.heroTitle')}</h1>;
}
```

Подстановки: `t('screen6.remainingTime', { n: 5 })` подставляет `{{n}}` в строке.

### Переключатель
Компонент `LanguageSwitcher` в шапке (`Header.jsx`). Выбор сохраняется в
`localStorage` (`aucopy.lang`). Default — `ru`.

### Что переведено
- Header, StepIndicator (значки этапов)
- Screen1 (главный)
- Screen2 (превью)
- Screen3 (настройки)
- Screen4 (оплата)
- Screen6 (готово)
- ErrorReportModal (форма жалобы)
- PaperIndicator
- AdminPanel

Screen5 (Kaspi/Card) частично — там в основном статичный платёжный UI.

### Как добавить новые строки
1. Добавить ключ в `dictionary.js` во ВСЕ три языка
2. В компоненте импортировать `useT` и использовать `t('путь.ключ')`
3. Не забывать про fallback — если ключа в выбранном языке нет, `getValue`
   возьмёт из `ru` (DEFAULT_LANG)

---

## 9. Жалобы пользователей + админ-панель

### Поток жалобы

```
Юзер на любом экране → кнопка «Сообщить об ошибке» в Header
  ↓
ErrorReportModal: выбор типа + описание + Send
  ↓
POST /api/error-report  (публичный, без авторизации, но с rate-limit)
  body: { category, description, lang, screen }
  ↓
kiosk_state.add_report()
  ├── check_spam(ip) — лимиты по IP
  ├── _validate_report(category, description) — длина / повторы / "Другое"
  └── сохраняет в kiosk_state.json → reports[]
  ↓
ответ { ok: true, id } → юзер видит подтверждение
  ↓
Админ на /#/admin видит badge с числом нерешённых жалоб
```

### Защита от спама

В `kiosk_state.py`:

| Параметр | Значение | Что делает |
|---|---|---|
| `SPAM_WINDOW_SECONDS` | 60 | окно подсчёта |
| `SPAM_MAX_PER_WINDOW` | 3 | макс. отчётов с одного IP в окне |
| `SPAM_MIN_TEXT_LEN` | 4 | минимум символов для категории «Другое» |
| `SPAM_COOLDOWN_AFTER_BLOCK` | 300 | блок IP на 5 минут после перебора |

Дополнительные проверки в `_validate_report`:
- описание ≤ 1000 символов
- категория ≤ 100 символов
- для категории «Другое» требуется описание ≥ 4 символов
- если описание состоит из ≤ 2 уникальных символов и длиннее 5 → спам

In-memory счётчики (`_spam_log`, `_spam_blocked_until`) сбрасываются при
рестарте бэка — это ок, лимит даёт мягкую защиту, не жёсткую.

### Админские эндпойнты

| Метод | URL | Что делает |
|---|---|---|
| `GET /api/admin/reports` | список всех отчётов |
| `POST /api/admin/reports/{id}/resolve` | пометить решённым |

Все требуют `X-Admin-Token` (захардкожен `admin-secret-change-me` в `main.py`
— **обязательно поменять** перед публичным запуском).

### UI в админке
- Карточка «Жалобы пользователей» с бейджем числа нерешённых
- Каждая жалоба: категория, язык, экран, описание, IP, время, кнопка ✓
- Решённые жалобы становятся серыми с галкой, но остаются в списке

