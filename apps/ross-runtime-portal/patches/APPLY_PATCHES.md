# Apply the Runtime Integration

This directory contains the complete delta from Ross Runtime Portal 3.0.0 to the self-healing 3.1.0 runtime.

## Automated validation

```powershell
python patches\validate_patch_bundle.py
```

## Reassemble the split runtime-store patch

```powershell
Get-Content patches\runtime-store.patch.part.* |
  Set-Content patches\runtime-store.patch
```

## Apply to a Ross Runtime Portal 3.0.0 working tree

```powershell
git apply patches\runtime-store.patch
git apply patches\app-main.patch
git apply patches\app-css.patch
git apply patches\shell.patch
```

Copy these added files into their matching paths:

- `app/runtime/`
- `app/templates/runtime.html`
- `app/static/js/runtime.js`
- `deploy/systemd/`
- `scripts/run_supervised.ps1`
- `scripts/update_windows.ps1`

Then install `requirements.txt`, run diagnostics and tests, and start the application.

The separately delivered full 3.1.0 ZIP already contains these changes applied and does not require patching.
