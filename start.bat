@echo off
title Cinematic App Launcher
color 0B
echo.
echo  ========================================
echo    CINEMATIC - Streaming App
echo  ========================================
echo.
echo  [1/2] Web sunucusu baslatiliyor...
start "Cinematic Web" /min cmd /c "node web-server.js > web-server.out.log 2> web-server.err.log"
timeout /t 2 /nobreak >nul

echo  [2/2] Reklamsiz stream sunucusu baslatiliyor...
start "Cinematic Stream" /min cmd /c "node stream-server.js > stream-server.out.log 2> stream-server.err.log"
timeout /t 3 /nobreak >nul

echo.
echo  Her iki sunucu calistirildi!
echo  Site: http://127.0.0.1:8080
echo  Stream Server: http://localhost:3001/health
echo.
echo  Tarayici aciliyor...
start http://127.0.0.1:8080

echo.
echo  Bu pencereyi kapatirsaniz sunucular kapanir.
echo  Cikis icin Ctrl+C basin.
echo.
pause
