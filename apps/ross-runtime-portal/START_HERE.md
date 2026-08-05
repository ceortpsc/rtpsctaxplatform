# Start Here — Ross Runtime Portal

## Windows PowerShell

```powershell
Set-Location "$HOME\Downloads"
Expand-Archive -LiteralPath ".\ross_runtime_portal_full_build.zip" -DestinationPath ".\RossRuntimePortal" -Force
Set-Location ".\RossRuntimePortal\ross_runtime_portal_full_build"
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\scripts\setup_windows.ps1
.\scripts\start_windows.ps1
```

Open `http://127.0.0.1:8000`. Local access code: `ross-demo`.

## Python IDLE

After setup:

```powershell
.\scripts\open_in_idle.ps1
```

Press **F5** inside IDLE. This launcher uses `.venv`, preventing dependency mismatches between the system IDLE and the project environment.

## Verify

```powershell
python diagnose.py
python -m pytest -q
```

See `README.md` and `docs/` for rollout, module, science, SEO, API, security, troubleshooting, observability, and architecture documentation.
