@echo off
title HRconnect local server
cd /d "%~dp0"
echo Starting local server...
start "" http://localhost:8000
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1"
pause
