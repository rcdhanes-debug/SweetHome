@echo off
title Sweet Home
cd /d "%~dp0"
echo.
echo   Starting Sweet Home (MongoDB + API + Client)...
echo   Keep this window open. Close it to stop.
echo.
node server\scripts\run.js
echo.
echo   Sweet Home has stopped.
pause
