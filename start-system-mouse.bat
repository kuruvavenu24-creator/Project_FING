@echo off
setlocal

cd /d "%~dp0"

if not exist ".python-packages\mediapipe" (
  echo Installing gesture mouse dependencies...
  python -m pip install --target .python-packages -r requirements-system-mouse.txt
)

echo Starting system-wide gesture mouse...
echo Press Ctrl+Alt+Q to stop.
set "PYTHONPATH=%CD%\.python-packages;%PYTHONPATH%"
python windows_system_mouse.py
