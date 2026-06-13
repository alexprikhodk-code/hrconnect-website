@echo off
title Deploy website to Vercel
setlocal

cd /d "%~dp0"

echo ============================================================
echo  Deploy HRconnect website
echo ============================================================

echo.
echo [1/3] git add
git add -A

echo.
echo [2/3] commit
for /f "tokens=*" %%a in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH-mm"') do set "TS=%%a"
git commit -m "Update %TS%"

echo.
echo [3/3] push (Vercel will auto-deploy in ~30 sec)
git push
if errorlevel 1 goto err

echo.
echo ============================================================
echo  Pushed OK
echo  Vercel will deploy automatically.
echo  Check progress: https://vercel.com/dashboard
echo ============================================================
pause
exit /b 0

:err
echo Push failed - check token/connection
pause
exit /b 1
