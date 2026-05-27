# Промпт для Claude Code — AU Copy Print Kiosk Frontend

> Скопируй всё содержимое этого файла и вставь в Claude Code

---

```
You are building a self-service print kiosk frontend application using React + Vite + TailwindCSS.

Company name: AU Copy
Logo: located in the /logo folder of the project. Use <img src="/logo/logo.png" /> with a fallback
gray placeholder if the file doesn't exist yet.

## TECH STACK
- React 18 + Vite
- TailwindCSS for styling
- pdf.js (pdfjs-dist) for PDF rendering
- useState-based screen navigation (no React Router needed)
- No backend required — mock all data

## DESIGN SYSTEM
Tailwind config — extend with these colors:
- primary: #2563EB
- primary-light: #EFF6FF
- dark-blue: #1E3A5F
- muted: #94A3B8
- border-color: #E2E8F0
- kaspi-red: #E83232
- kaspi-light: #FFF0F0

Typography: Inter font — add to index.html:
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">

Style rules:
- Flat design — zero shadows, zero gradients
- border-radius: 16px cards, 12px buttons, 8px inputs
- All interactive elements minimum 56px height (touchscreen)
- All text in Russian
- No external UI libraries (no MUI, no Chakra) — pure Tailwind only

---

## GLOBAL LAYOUT (every screen)

Base resolution: 1920x1080. Use `min-h-screen w-full` layout.
Responsive: min-width 1280px, scale up automatically on larger screens using
`max-w-[1920px] mx-auto` so it looks good on any widescreen.

### TOP HEADER BAR (fixed, height 80px, z-index 50)
White background, border-bottom 1px #E2E8F0.

LEFT SIDE — Company branding:
- Logo: <img src="/logo/logo.png" alt="AU Copy" className="h-12 w-12 object-contain rounded-xl" />
  Fallback if logo missing: gray rounded square 48x48px with "AC" initials in #2563EB
- Company name: "AU Copy" — 24px, font-weight 500, color #1E3A5F, margin-left 12px

RIGHT SIDE — Step progress indicator (prominent, readable from distance):
5 steps connected by a horizontal line:
  1. Загрузка файла
  2. Просмотр
  3. Настройки печати
  4. Оплата
  5. Готово

Each step:
- Circle: 44px diameter
- Active: bg #2563EB, white number inside, label below in #2563EB, font-weight 500
- Completed: bg #22C55E, white checkmark SVG inside, label in #22C55E
- Upcoming: white bg, border 1.5px #E2E8F0, number in #94A3B8, label in #94A3B8
- Label: 13px below each circle
- Connector line between circles: 1.5px, #E2E8F0 (completed segment turns #22C55E)
- Total step indicator width: ~600px, spaced evenly

---

## SCREEN 1 — File Upload (currentScreen === 1)

Layout: two columns, left 38% / right 62%, full height minus header (calc(100vh - 80px)).

### LEFT COLUMN — Advertisement panel
Full height, background #F8FAFF, border-right 1px #E2E8F0.
Centered content (flex, items-center, justify-center, flex-col):
- Dashed border rectangle: 70% width, 60% height, border 2px dashed #CBD5E1, border-radius 16px
- Inside: large image icon SVG (48px, #CBD5E1)
- Text: "Тут могла быть ваша реклама" — 22px, #94A3B8, text-center
- Below: "Свяжитесь с нами: aucopy@email.com" — 14px, #CBD5E1
This column is easy to replace with <img> or <video> later — add a comment // REPLACE WITH AD CONTENT

### RIGHT COLUMN — Main content
Padding 48px, overflow-y auto.
Flex column, justify-center, full height.

**Greeting:**
- "Добро пожаловать в AU Copy!" — 34px, font-weight 500, #1E3A5F
- "Распечатайте документ за несколько шагов" — 17px, #94A3B8, margin-top 8px

**Two method cards side by side** (margin-top 36px, gap 20px):

Card 1 — Telegram:
- White bg, border 1.5px #E2E8F0, border-radius 16px, padding 28px
- Hover: border-color #2563EB, bg #EFF6FF, transition 150ms
- Telegram SVG logo (blue #229ED9, 40x40px)
- Title: "Telegram бот" — 18px, #1E3A5F, font-weight 500, margin-top 12px
- Subtitle: "Отправьте файл в наш бот" — 14px, #94A3B8
- QR placeholder: 110x110px, bg #F1F5F9, border-radius 10px, centered, text "QR" in #94A3B8
- Username: "@AUCopyBot" — 13px, #2563EB, margin-top 8px

Card 2 — WhatsApp:
- Same base style
- Hover: border-color #25D366, bg #F0FDF4
- WhatsApp SVG logo (green #25D366, 40x40px)
- Title: "WhatsApp бот" — 18px, #1E3A5F, font-weight 500
- Subtitle: "Отправьте файл в WhatsApp" — 14px, #94A3B8
- QR placeholder: same style
- Number: "+7 (700) 000-0000" — 13px, #25D366

**Code input section** (margin-top 36px):
- Label: "Введите код из Telegram или WhatsApp бота" — 16px, #1E3A5F, font-weight 500
- Sublabel: "Код появится в чате после отправки файла боту" — 13px, #94A3B8, margin-top 4px
- Input field: height 64px, font-size 28px, letter-spacing 0.18em, text-center,
  border 1.5px #E2E8F0, border-radius 12px, placeholder "A7-K2NP", uppercase transform
  Focus: border #2563EB, bg #EFF6FF, outline none
- Hint: "Код действует 30 минут" — 12px, #94A3B8, margin-top 8px, text-center
- Primary button (margin-top 20px): "Открыть документ →"
  Full width, height 60px, bg #2563EB, white text 18px, border-radius 12px
  Hover: bg #1D4ED8, scale(1.01), transition 150ms
  // MOCK: clicking this advances to Screen 2

### ERROR REPORT BUTTON (fixed, bottom-right)
Position: fixed, bottom 24px, right 24px, z-index 40.
Style: white bg, border 1.5px #E2E8F0, border-radius 12px, padding 12px 20px,
flex items-center gap 10px, cursor pointer.
Hover: border #F59E0B, bg #FFFBEB.
- Warning triangle SVG icon: 20px, color #F59E0B
- Text: "Сообщить об ошибке" — 14px, #64748B

On click: show ErrorReportModal (see component below).
This button is visible on ALL screens, always fixed position.

**ErrorReportModal component:**
Semi-transparent backdrop (bg black/40), centered overlay.
White modal card: border-radius 20px, padding 36px, width 480px.
- Title: "Сообщить об ошибке" — 22px, #1E3A5F, font-weight 500
- Error type dropdown (height 48px, border #E2E8F0, border-radius 10px):
  Options: "Не читается код", "Принтер не работает", "Экран завис", "Другое"
- Textarea (height 120px, border #E2E8F0, border-radius 10px, padding 12px,
  placeholder: "Опишите подробнее что пошло не так...", resize-none, margin-top 16px)
- Buttons row (margin-top 24px, gap 12px):
  "Отмена" — secondary (border #E2E8F0, white bg, #64748B text, height 48px, half width)
  "Отправить" — primary (#2563EB bg, white text, height 48px, half width)
  // MOCK: both close the modal, "Отправить" logs to console

---

## SCREEN 2 — Document Preview (currentScreen === 2)

Layout: two columns, left 63% / right 37%.

### LEFT COLUMN — PDF Viewer
Background #1E293B (dark, like real viewer). Full height.

Top toolbar (bg #0F172A, height 52px, px 20px, flex items-center justify-between):
- Left: filename "document.pdf" — 14px, white, opacity 80%
- Center: page navigation
  "←" button | "Страница 3 из 12" white 15px | "→" button
  Buttons: 36x36px, hover bg white/10, border-radius 8px, white arrow SVG
- Right: zoom controls
  "−" button | "75%" white 14px | "+" button | separator | fit-page icon button

Viewer area (flex-1, flex items-center justify-center, padding 32px):
- // MOCK: White A4 rectangle representing the document page
- Portrait mock: 420x594px (scaled to fit). White bg, border-radius 4px, 
  inside: gray horizontal lines (text simulation), margin 32px
- Landscape mock: 594x420px (when landscape orientation selected)
- Below the page: page thumbnail strip (horizontal scroll, height 80px, bg #0F172A,
  padding 8px 16px, gap 8px)
  5 small thumbnails visible: 52x72px white rectangles, border-radius 4px,
  active one has blue border 2px #2563EB

### RIGHT COLUMN — Controls
White bg, padding 32px, border-left 1px #E2E8F0, overflow-y auto.

**File info card** (bg #EFF6FF, border-radius 12px, padding 16px):
Rows (label left in #94A3B8 13px, value right in #1E3A5F 14px font-weight 500):
- "Файл" → "document.pdf"
- "Страниц" → "12"
- "Формат" → "A4"
- "Размер файла" → "2.4 МБ"

**Orientation section** (margin-top 28px):
Label: "Ориентация страниц" — 16px, #1E3A5F, font-weight 500

Two selectable cards side by side (gap 12px):
Card "Книжная":
- Portrait page SVG icon: tall rectangle (24x34px) with horizontal lines, color #2563EB
- Label: "Книжная" — 15px
- Sub: "210 × 297 мм" — 12px, #94A3B8
Card "Альбомная":
- Landscape page SVG icon: wide rectangle (34x24px) with horizontal lines
- Label: "Альбомная" — 15px
- Sub: "297 × 210 мм" — 12px, #94A3B8

Card base: border 1.5px #E2E8F0, border-radius 12px, padding 16px, cursor pointer,
text-center, flex flex-col items-center, gap 8px
Selected: border 2px #2563EB, bg #EFF6FF

**Orientation preview thumbnail** (margin-top 20px):
Small card (border 1px #E2E8F0, border-radius 10px, padding 16px, text-center):
- Label: "Предпросмотр ориентации" — 12px, #94A3B8
- Thumbnail: switches between 80x113px (portrait) and 113x80px (landscape),
  white bg, border 1px #E2E8F0, centered, with gray lines inside

**Bottom buttons** (margin-top auto, padding-top 24px, flex gap 12px):
- "← Назад" — secondary, half width, height 52px, border #E2E8F0, #64748B text
- "Настройки →" — primary, half width, height 52px, bg #2563EB, white text

---

## SCREEN 3 — Print Settings (currentScreen === 3)

Layout: two columns, left 43% / right 57%.

### LEFT COLUMN — Live preview + price
White bg, padding 28px, border-right 1px #E2E8F0, flex flex-col.

Title: "Предпросмотр" — 18px, #1E3A5F, font-weight 500

**Page layout preview** (flex-1, flex items-center justify-center):
White sheet representation (border 1px #E2E8F0, border-radius 8px, bg white):
- 1-on-1: single gray rectangle centered (80% of sheet)
- 2-on-1: two small rectangles side by side
- 4-on-1: 2x2 grid of rectangles
- 8-on-1: 2x4 grid of rectangles
Each inner rectangle: bg #F1F5F9, border-radius 2px
Below: "Так будет выглядеть лист" — 12px, #94A3B8, text-center

**Price card** (margin-top auto, bg #EFF6FF, border-radius 14px, padding 20px):
- Label: "Итоговая стоимость" — 13px, #94A3B8
- Price: large animated number — 44px, font-weight 500, #2563EB
  (use CSS transition on value change: brief scale pulse animation)
- Breakdown: "8 стр × 2 копии × 20 ₸ = 320 ₸" — 13px, #94A3B8, margin-top 6px
  Updates live as any setting changes.

### RIGHT COLUMN — Settings
Padding 32px, overflow-y auto, flex flex-col gap 28px.

**Setting 1: Выбор страниц**
Label: "Какие страницы печатать?" — 16px, #1E3A5F, font-weight 500

Three option pills (full-width each, height 52px, border 1.5px #E2E8F0, border-radius 10px,
cursor pointer, flex items-center padding-left 16px, gap 12px):
- Radio circle (20px) + label text 15px #1E3A5F
Selected: border #2563EB, bg #EFF6FF, radio filled blue

Options:
- "Все страницы" (default selected)
- "Диапазон"
- "Выбрать вручную"

If "Диапазон": show two number inputs side by side (margin-top 12px):
  "С" label + input (width 80px, height 48px) | "По" label + input
  
If "Выбрать вручную": show (margin-top 12px):
  Text input full-width, height 48px, placeholder "1, 3, 4-7, 10"
  Help box below (bg #EFF6FF, border-left 3px #2563EB, border-radius 8px, padding 14px,
  border-radius-left 0):
  Title: "Как указывать страницы:" — 13px, #1E3A5F, font-weight 500
  Lines (13px, #64748B):
  "• 1, 3, 5 — конкретные страницы"
  "• 4-7 — диапазон от 4 до 7"  
  "• 1, 3, 4-7 — комбинация"

**Setting 2: Количество копий**
Label: "Количество копий" — 16px, #1E3A5F, font-weight 500

Counter row (flex items-center gap 16px):
- "−" button: 52x52px, border 1.5px #E2E8F0, border-radius 10px, font-size 24px, #64748B
  Disabled style when value = 1
- Number display: min-width 48px, text-center, font-size 26px, font-weight 500, #1E3A5F
- "+" button: same style as minus

**Setting 3: Страниц на одной стороне**
Label: "Страниц на одной стороне листа" — 16px, #1E3A5F, font-weight 500

2x2 grid of option cards (gap 10px):
Each card (border 1.5px #E2E8F0, border-radius 12px, padding 14px, cursor pointer,
flex flex-col items-center, gap 8px):
- SVG layout icon (36px) showing page arrangement
- Number label: "1", "2", "4", "8" — 16px, font-weight 500, #1E3A5F
- Sub: "стр/лист" — 11px, #94A3B8
Selected: border 2px #2563EB, bg #EFF6FF

**Setting 4: Цвет печати**
Label: "Тип печати" — 16px, #1E3A5F, font-weight 500

Two cards side by side:
Card "Чёрно-белая":
- B&W circle icon SVG (half black half white, 32px)
- "Чёрно-белая" — 15px, #1E3A5F
- "20 ₸/стр" — 13px, #64748B

Card "Цветная":
- Color circle icon SVG (gradient segments, 32px)
- "Цветная" — 15px, #1E3A5F
- "60 ₸/стр" — 13px, #64748B
- Badge: "×3 дороже" — 11px, bg #FEF3C7, text #92400E, padding 2px 8px, border-radius 20px

Same card style as pages-per-side.

**Setting 5: Двусторонняя печать**
Row (flex items-center justify-between, border 1.5px #E2E8F0, border-radius 12px,
padding 16px 20px):
- Left: icon + text column
  "Двусторонняя печать" — 15px, #1E3A5F, font-weight 500
  "Экономия бумаги" — 13px, #94A3B8
- Right: toggle switch (52x28px, bg #E2E8F0 off / #2563EB on, circle slides)
  + badge when on: "-50% бумаги" in green

**Setting 6: Качество печати**
Label: "Качество печати" — 16px, #1E3A5F, font-weight 500
Three pills side by side: "Эконом" | "Стандарт" | "Высокое"
Pill: height 44px, border 1.5px #E2E8F0, border-radius 8px, flex-1, text-center
Selected: border #2563EB, bg #EFF6FF, text #2563EB

**Bottom buttons** (sticky bottom, bg white, padding-top 20px, border-top 1px #E2E8F0):
- "← Назад" secondary half-width, height 56px
- "К оплате →" primary half-width, height 56px

---

## SCREEN 4 — Payment Selection (currentScreen === 4)

Layout: two columns, left 55% / right 45%.

### LEFT COLUMN — Payment methods
Padding 48px.
Title: "Выберите способ оплаты" — 28px, #1E3A5F, font-weight 500
Subtitle: "AU Copy принимает оплату следующими способами" — 16px, #94A3B8, margin-top 8px

**Kaspi QR card** (margin-top 36px):
Border 1.5px #E2E8F0, border-radius 20px, padding 36px, cursor pointer, relative.
Hover: border 2px #E83232, bg #FFF0F0, transition 150ms.
Selected: border 2px #E83232, bg #FFF0F0.

Radio circle (20px, top-right corner, absolute top-16px right-16px):
- Unselected: white bg, border 1.5px #E2E8F0
- Selected: #E83232 bg, white dot center

Content:
- "Kaspi" text in #E83232, 32px, font-weight 600 (as logo substitute, or use SVG "K" in red circle)
- "Kaspi QR" — 22px, #1E3A5F, font-weight 500, margin-top 16px
- "Самый быстрый способ оплаты" — 15px, #94A3B8
- Badge: "Рекомендуем" — bg #DCFCE7, text #166534, 12px, padding 4px 12px, border-radius 20px, margin-top 8px

**Bank card payment card** (margin-top 16px):
Same base style.
Hover: border 2px #2563EB, bg #EFF6FF.
Selected: border 2px #2563EB, bg #EFF6FF.
Radio: selected = #2563EB.

Content:
- Credit card SVG icon (48x34px, blue #2563EB, with chip and contactless symbol)
- "Банковская карта" — 22px, #1E3A5F, font-weight 500, margin-top 16px
- "Visa, Mastercard, бесконтактная оплата" — 15px, #94A3B8
- Sub: "Apple Pay и Google Pay поддерживаются" — 13px, #94A3B8

**Confirm button** (margin-top 32px, full-width, height 60px, disabled until method selected):
"Подтвердить и оплатить →" — bg #2563EB, white 18px
Disabled: bg #E2E8F0, #94A3B8 text, cursor not-allowed

### RIGHT COLUMN — Order summary
Bg #F8FAFF, padding 36px, border-left 1px #E2E8F0.
Title: "Ваш заказ" — 20px, #1E3A5F, font-weight 500

**Receipt card** (white bg, border 1px #E2E8F0, border-radius 16px, padding 24px):
Rows (padding 10px 0, border-bottom 0.5px #F1F5F9, flex justify-between):
Label: 14px, #94A3B8 | Value: 14px, #1E3A5F, font-weight 500

Rows:
- "Файл" → "document.pdf"
- "Страницы" → "Все (12 стр)"
- "Копии" → "2"
- "Тип" → "Чёрно-белая"
- "Страниц на листе" → "1"
- "Двусторонняя" → "Нет"
- "Качество" → "Стандарт"

Divider (border-top 1.5px #E2E8F0, margin 16px 0).

Total row (flex justify-between):
- "Итого к оплате" — 17px, #1E3A5F, font-weight 500
- "320 ₸" — 28px, #2563EB, font-weight 500

---

## SCREEN 5A — Kaspi QR Payment (currentScreen === 5, paymentMethod === 'kaspi')

Layout: two columns, left 50% / right 50%.

### LEFT COLUMN — Instructions
Padding 48px.

Header (flex items-center gap 12px):
- "Kaspi" in #E83232, 28px, font-weight 600
- Title: "Оплата через Kaspi QR" — 26px, #1E3A5F, font-weight 500

Step list (margin-top 32px, flex flex-col gap 20px):
Each step (flex items-start gap 16px):
- Number circle: 36px, bg #E83232, white, font-weight 500, 16px, flex-shrink-0
- Text: 16px, #1E3A5F, line-height 1.5

Steps:
1. "Откройте приложение Kaspi.kz на вашем телефоне"
2. "Нажмите кнопку «Платёжный QR» в главном меню"
3. "Наведите камеру на QR-код справа"
4. "Проверьте сумму и получателя — AU Copy"
5. "Нажмите «Оплатить» и дождитесь подтверждения"

Info box (margin-top 28px, bg #FFF0F0, border-left 3px #E83232, border-radius 0 8px 8px 0,
padding 16px, border-radius-left 0):
"QR-код действителен 5 минут. Если время истекло — нажмите кнопку «Обновить QR»"
13px, #991B1B

**Countdown timer** (margin-top 20px):
Pill: bg #E83232, white text, padding 10px 24px, border-radius 24px, font-size 18px,
font-weight 500, display inline-flex, gap 8px:
- Clock SVG icon (20px, white)
- "Осталось 4:32" (countdown from 5:00, use setInterval)

### RIGHT COLUMN — QR Code
Flex flex-col items-center justify-center, full height, padding 40px.

**Kaspi-branded QR card** (border 2px #E83232, border-radius 24px, padding 36px,
bg white, flex flex-col items-center gap 20px):
- "Kaspi" — 28px, #E83232, font-weight 700
- Divider
- QR placeholder: 220x220px, bg #F8FAFF, border 1px #E2E8F0, border-radius 12px,
  centered, flex items-center justify-center:
  QR grid SVG mock (simple grid pattern suggesting a QR code in #1E3A5F)
  // MOCK: replace with real QR image from backend
- Amount: "320 ₸" — 30px, #E83232, font-weight 500
- "Получатель: AU Copy" — 14px, #94A3B8

**Refresh button** (margin-top 8px):
Border 1.5px #E83232, text #E83232, bg white, height 44px, border-radius 10px, width 220px
"↻ Обновить QR"

---

## SCREEN 5B — Card Payment (currentScreen === 5, paymentMethod === 'card')

Layout: two columns, left 50% / right 50%.

### LEFT COLUMN — Instructions
Same structure, blue theme.

Title: "Оплата банковской картой" — 26px, #2563EB, font-weight 500

Steps (number circles: bg #2563EB):
1. "Приложите карту или телефон к терминалу"
2. "Удерживайте 2-3 секунды до звукового сигнала"
3. "Дождитесь сообщения «Оплата принята» на экране"
4. "Заберите карту — чек будет распечатан вместе с документом"

Info box (blue theme, bg #EFF6FF, border-left #2563EB):
"Поддерживаются карты Visa, Mastercard, и бесконтактная оплата через Apple Pay и Google Pay"
13px, #1E3A5F

### RIGHT COLUMN — Terminal visual
Flex flex-col items-center justify-center, full height.

**Terminal card** (border 1.5px #E2E8F0, border-radius 24px, padding 44px, bg white,
flex flex-col items-center, gap 24px):

Credit card SVG illustration (130x85px):
- Rounded rectangle, bg gradient-like flat color #2563EB
- Chip rectangle (gold/yellow, 24x18px, top-left area)
- Contactless waves SVG symbol (right side, white)

Pulsing animation (CSS keyframes):
@keyframes pulse-ring {
  0% { box-shadow: 0 0 0 0 rgba(37,99,235,0.4); }
  70% { box-shadow: 0 0 0 20px rgba(37,99,235,0); }
  100% { box-shadow: 0 0 0 0 rgba(37,99,235,0); }
}
Apply to a 80px blue circle behind the card icon, animation: pulse-ring 2s infinite.

Amount: "320 ₸" — 32px, #2563EB, font-weight 500

Status indicator (flex items-center gap 8px):
- Animated dots (3 dots fading in sequence)
- "Ожидание карты" — 16px, #64748B

---

## SCREEN 6 — Success & Printing (currentScreen === 6)

Full screen, centered content, white bg.

### Phase 1: Printing (printProgress < 100)

Mount animation: checkmark circle scales from 0 to 1 with spring (CSS: transform scale,
transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)).

Checkmark circle: 100px, bg #22C55E, white checkmark SVG inside (stroke-width 3,
60px, animated stroke-dashoffset on mount).

"Оплата прошла успешно!" — 32px, #1E3A5F, font-weight 500, margin-top 24px, text-center
"Документ отправлен на печать" — 18px, #94A3B8, text-center

**Progress card** (margin-top 32px, white bg, border 1px #E2E8F0, border-radius 20px,
padding 36px, width 520px, flex flex-col gap 16px):

Row (flex justify-between):
- "Печатается..." — 16px, #64748B
- "Страница 3 из 8" — 16px, #2563EB, font-weight 500 (updates with progress)

Progress bar: full-width, height 14px, bg #E2E8F0, border-radius 7px:
  Fill: bg #2563EB, border-radius 7px, width: ${printProgress}%, transition width 0.5s ease

"Осталось примерно 45 секунд" — 14px, #94A3B8, text-center
(// MOCK: use setInterval to increment printProgress from 0 to 100 over 8 seconds)

Below card: "Заберите ваши документы у принтера после завершения" — 15px, #94A3B8, text-center

### Phase 2: Complete (printProgress >= 100, auto-transition)

Replace Phase 1 content with:

Larger checkmark: 120px circle, confetti-like: add 3-4 small colored dots that fly outward
(CSS animation, optional)

"Готово! Ваши документы готовы" — 36px, #1E3A5F, font-weight 500, text-center
"Спасибо, что воспользовались AU Copy!" — 18px, #94A3B8, text-center

**Summary card** (margin-top 24px, bg #EFF6FF, border-radius 16px, padding 28px, width 440px):
Quick receipt — same rows as Screen 4 receipt, compact style

**Countdown back to home** (margin-top 32px, flex flex-col items-center gap 12px):
Circular progress ring (SVG, 64px, #2563EB stroke, animates from full to empty over 10s):
Inside: countdown number "10" decreasing.
"Возврат на главный экран через 10 секунд" — 15px, #94A3B8

"Начать заново" button (primary, height 52px, width 240px):
onClick: reset all state, currentScreen = 1, restart

// MOCK: auto-redirect to screen 1 after 10 seconds using setTimeout

---

## STATE MANAGEMENT (App.jsx)

```javascript
// All state in App.jsx, passed as props
const [currentScreen, setCurrentScreen] = useState(1);
const [sessionCode, setSessionCode] = useState('');
const [uploadedFile, setUploadedFile] = useState({
  name: 'document.pdf', // MOCK
  pageCount: 12,         // MOCK
  size: '2.4 МБ'        // MOCK
});
const [orientation, setOrientation] = useState('portrait');
const [printSettings, setPrintSettings] = useState({
  pages: 'all',          // 'all' | 'range' | 'custom'
  pageRange: '',
  copies: 1,
  pagesPerSide: 1,
  colorType: 'bw',       // 'bw' | 'color'
  duplex: false,
  quality: 'standard'    // 'economy' | 'standard' | 'high'
});
const [paymentMethod, setPaymentMethod] = useState(null); // 'kaspi' | 'card'
const [printProgress, setPrintProgress] = useState(0);
const [showErrorModal, setShowErrorModal] = useState(false);

// Price calculation
const PRICES = { bw: 20, color: 60 };
function calculatePrice(settings, filePageCount) {
  const selectedPages = settings.pages === 'all' ? filePageCount : 
    parsePageRange(settings.pageRange, filePageCount);
  const sheets = Math.ceil(selectedPages / settings.pagesPerSide);
  const pricePerSheet = PRICES[settings.colorType];
  return sheets * settings.copies * pricePerSheet;
}
// MOCK total price shown everywhere
```

---

## UTILITY: parsePageRange.js

```javascript
// Parse "1, 3, 4-7, 10" → count of selected pages
export function parsePageRange(input, totalPages) {
  if (!input.trim()) return 0;
  const parts = input.split(',').map(s => s.trim());
  const pages = new Set();
  for (const part of parts) {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(Number);
      for (let i = start; i <= Math.min(end, totalPages); i++) pages.add(i);
    } else {
      const n = Number(part);
      if (n >= 1 && n <= totalPages) pages.add(n);
    }
  }
  return pages.size;
}
```

---

## ANIMATIONS (global CSS or Tailwind)

Screen transitions (wrap each screen in):
```css
.screen-enter {
  animation: screenIn 300ms ease forwards;
}
@keyframes screenIn {
  from { opacity: 0; transform: translateX(20px); }
  to   { opacity: 1; transform: translateX(0); }
}
```

Price pulse when value changes:
```css
@keyframes pricePulse {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.08); }
  100% { transform: scale(1); }
}
.price-pulse { animation: pricePulse 300ms ease; }
```

---

## FILE STRUCTURE

```
au-copy-kiosk/
├── public/
│   └── logo/
│       └── logo.png          ← company logo goes here
├── src/
│   ├── components/
│   │   ├── Header.jsx
│   │   ├── StepIndicator.jsx
│   │   ├── ErrorReportButton.jsx
│   │   ├── ErrorReportModal.jsx
│   │   └── screens/
│   │       ├── Screen1Upload.jsx
│   │       ├── Screen2Preview.jsx
│   │       ├── Screen3Settings.jsx
│   │       ├── Screen4Payment.jsx
│   │       ├── Screen5Kaspi.jsx
│   │       ├── Screen5Card.jsx
│   │       └── Screen6Success.jsx
│   ├── hooks/
│   │   └── usePrintPrice.js
│   ├── utils/
│   │   └── parsePageRange.js
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── tailwind.config.js
├── vite.config.js
└── package.json
```

---

## FINAL NOTES

- Company name "AU Copy" appears in: Header, Screen 1 greeting, Screen 4 Kaspi receipt, Screen 6 thank-you
- Logo loaded from: /logo/logo.png — if missing show "AC" initials fallback
- All MOCK data clearly marked with // MOCK comment
- Console.log every user action: "[Screen1] Code entered: A7K2NP", "[Screen3] Copies changed: 2" etc.
- Add data-testid attributes on all interactive elements
- Use React.memo on screens to avoid unnecessary re-renders
- Error boundary wrapping each screen component
```
