@echo off
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo Virtual environment missing. Run scripts\setup_windows.ps1 first.
  pause
  exit /b 1
)
.venv\Scripts\python.exe -m idlelib launch_idle.py
