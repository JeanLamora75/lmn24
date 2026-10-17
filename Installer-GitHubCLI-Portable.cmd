@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\Install-GitHubCLI-Portable.ps1"
set "RESULT=%ERRORLEVEL%"
echo.
if not "%RESULT%"=="0" (
  echo L'installation portable n'a pas abouti. Lis les indications ci-dessus.
) else (
  echo Installation portable terminee. Aucun droit administrateur n'a ete utilise.
)
echo.
pause
exit /b %RESULT%
