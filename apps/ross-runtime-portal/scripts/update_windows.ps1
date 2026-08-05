$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)
if (-not (Test-Path ".venv")) { throw "Run scripts/setup_windows.ps1 first." }
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install --upgrade -r requirements.txt
.\.venv\Scripts\python.exe diagnose.py
.\.venv\Scripts\python.exe -m pytest -q
Write-Host "Upgrade validation completed. Restart the supervised runtime after reviewing the test output." -ForegroundColor Green
