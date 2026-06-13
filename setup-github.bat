@echo off
title Push website to GitHub
setlocal

set "USERNAME=alexprikhodk-code"
set "REPO=hrconnect-website"
set "REMOTE=https://github.com/%USERNAME%/%REPO%.git"

cd /d "%~dp0"

echo ============================================================
echo  Push HRconnect website to GitHub
echo  Target: %REMOTE%
echo ============================================================
echo.
echo Make sure you already created an EMPTY PUBLIC repo on GitHub:
echo https://github.com/new   name: %REPO%
echo.
pause

echo.
echo [1/6] git config
git config --global user.email "alexprikhodk@gmail.com"
git config --global user.name "%USERNAME%"

echo.
echo [2/6] git init
git init

echo.
echo [3/6] branch -M main
git branch -M main

echo.
echo [4/6] remote add origin
git remote remove origin >nul 2>&1
git remote add origin "%REMOTE%"

echo.
echo [5/6] add and commit
git add -A
git commit -m "Initial HRconnect website"

echo.
echo [6/6] push
echo.
echo Username: %USERNAME%
echo Password: Personal Access Token (same as for dashboard)
echo.
git push -u origin main
if errorlevel 1 goto err

echo.
echo ============================================================
echo  PUSHED OK!
echo  Next: deploy to Vercel
echo  Open: https://vercel.com/new
echo ============================================================
pause
exit /b 0

:err
echo.
echo PUSH FAILED. Check:
echo - Repo created on GitHub?
echo - Token still valid?
pause
exit /b 1
