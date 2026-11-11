@echo off
setlocal
cd /d "%~dp0.."
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22.12+ or 24, then run this file again.
  pause
  exit /b 1
)
set "DCSMCRAFT_HTML=%CD%\DCSMCRAFT-Standalone.html"
if not exist "%DCSMCRAFT_HTML%" set "DCSMCRAFT_HTML=%CD%\dist\DCSMCRAFT-Standalone.html"
if not exist "%DCSMCRAFT_HTML%" if exist "%CD%\..\DCSMCRAFT.exe" (
  start /wait "" "%CD%\..\DCSMCRAFT.exe" --extract-only
  if errorlevel 1 exit /b 1
  set "DCSMCRAFT_HTML=%LOCALAPPDATA%\DCSMCRAFT\Game\index.html"
)
node server\relay.mjs
pause
