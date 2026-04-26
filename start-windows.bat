@echo off
setlocal

cd /d "%~dp0"
echo Starting Sky Camera App on Windows...
start "" powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds 2; Start-Process 'http://127.0.0.1:3000'"
node server.js
