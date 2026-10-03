@echo off
title Batch Process All SSC CGL Shift PDFs
cd /d "%~dp0\scripts"
echo ===================================================
echo   Processing all SSC CGL PYQ PDFs into CBT Mock Tests...
echo ===================================================
python batch_all_shifts.py
echo ===================================================
echo   Processing complete! All shifts are now ready.
echo ===================================================
pause
