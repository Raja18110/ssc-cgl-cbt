@echo off
title SSC CGL Full-Stack CBT Platform
cd /d "%~dp0"
echo =========================================================
echo   Starting SSC CGL Full-Stack CBT Examination Platform...
echo =========================================================
start http://localhost:8085
node backend/server.js
pause
