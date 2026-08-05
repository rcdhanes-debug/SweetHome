@echo off
rem HomeHQ - double-click launcher
rem Starts MongoDB + API server + client in one window and opens your browser.
title HomeHQ
cd /d "%~dp0"

echo.
echo   ============================================
echo     HomeHQ - Shared Home Manager
echo     Node version check...
echo   ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   [ERROR] Node.js is not installed or not on PATH.
  echo           Download it from https://nodejs.org and re-run this file.
  echo.
  pause
  exit /b 1
)

node server\scripts\run.js %*
echo.
echo   HomeHQ has stopped. Close this window.
echo.
pause
