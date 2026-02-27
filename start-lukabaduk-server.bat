@echo off
title 루카바둑 서버
cd /d "%~dp0"
set GTP_ENGINE_PATH_PACHI=%~dp0engines\pachi.exe
set GTP_ENGINE_PATH=%~dp0engines\pachi.exe
rem 기력 향상: 스레드·트리 크기 (비워두면 기본값)
set GTP_ENGINE_ARGS_PACHI=threads=4 max_tree_size=200
rem GNU Go: set GTP_ENGINE_PATH_GNUGO=%~dp0engines\gnugo.exe
echo 루카바둑 서버를 시작합니다. 이 창을 닫으면 서버가 종료됩니다.
echo 접속: http://localhost:3000
echo AI Pachi: %GTP_ENGINE_PATH_PACHI%
echo.
call npm run dev
pause
