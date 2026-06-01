@echo off
REM Открывает киоск-браузер на весь экран на фронте AU Copy.
REM Сначала пробует Chrome, если не найден — Microsoft Edge.
REM Выход из киоска: Alt+F4  (или Ctrl+Alt+Del).

set "URL=http://localhost:5173"
set "FLAGS=--kiosk --no-first-run --disable-pinch --overscroll-history-navigation=0 --disable-session-crashed-bubble --disable-infobars --incognito --noerrdialogs"

set "CHROME1=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
set "CHROME2=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
set "EDGE1=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
set "EDGE2=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"

if exist "%CHROME1%" (
    start "" "%CHROME1%" %FLAGS% "%URL%"
    goto :eof
)
if exist "%CHROME2%" (
    start "" "%CHROME2%" %FLAGS% "%URL%"
    goto :eof
)
if exist "%EDGE1%" (
    start "" "%EDGE1%" %FLAGS% "%URL%"
    goto :eof
)
if exist "%EDGE2%" (
    start "" "%EDGE2%" %FLAGS% "%URL%"
    goto :eof
)

echo Не найден ни Chrome, ни Edge. Установите браузер или поправьте пути в kiosk.bat.
pause
