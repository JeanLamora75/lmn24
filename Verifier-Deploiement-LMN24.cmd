@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\Deploy-LMN24.ps1" -CheckOnly
set "RESULT=%ERRORLEVEL%"
echo.
echo Verification terminee, aucun deploiement n'a ete demande.
echo.
pause
exit /b %RESULT%
