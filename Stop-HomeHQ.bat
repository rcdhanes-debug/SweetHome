@echo off
rem HomeHQ - stop helper
rem Stops MongoDB + API server + client launched by Start-HomeHQ.bat.
title HomeHQ - Stop
cd /d "%~dp0"

node server\scripts\stop.js
if errorlevel 1 (
  echo.
  echo   [ERROR] Could not stop processes. Run this file as Administrator if needed.
)

echo.
pause
