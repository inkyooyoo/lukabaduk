@echo off
title 루카바둑 서버
cd /d "%~dp0"
echo 루카바둑 서버를 시작합니다. 이 창을 닫으면 서버가 종료됩니다.
echo 접속: http://localhost:3000
echo.
call npm run dev
pause
