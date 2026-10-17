@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\Deploy-LMN24.ps1"
set "RESULT=%ERRORLEVEL%"
echo.
if not "%RESULT%"=="0" (
  echo Le deploiement n'est pas confirme. Consulte les messages ci-dessus.
) else (
  echo Operation terminee.
)
echo.
pause
exit /b %RESULT%
