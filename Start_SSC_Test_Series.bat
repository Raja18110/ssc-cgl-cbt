@echo off
title SSC CGL Full-Stack CBT Mock Test Series
cd /d "%~dp0"
echo =========================================================
echo   Starting SSC CGL Full-Stack CBT Examination Platform...
echo =========================================================
where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    start http://localhost:8085
    node backend/server.js
) else (
    python server.py
)
pause
