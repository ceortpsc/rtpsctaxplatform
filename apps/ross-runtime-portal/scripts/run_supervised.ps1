param([int]$Port = 8000, [int]$MaximumBackoffSeconds = 60)
$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)
$LogDir = Join-Path (Get-Location) "logs"
New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
$Backoff = 2
while ($true) {
  $Started = Get-Date
  "$(Get-Date -Format o) starting Ross Runtime Portal" | Tee-Object -FilePath (Join-Path $LogDir "supervisor.log") -Append
  & .\.venv\Scripts\python.exe run.py
  $ExitCode = $LASTEXITCODE
  $RunSeconds = ((Get-Date) - $Started).TotalSeconds
  "$(Get-Date -Format o) process exited code=$ExitCode runtime_seconds=$RunSeconds" | Tee-Object -FilePath (Join-Path $LogDir "supervisor.log") -Append
  if ($RunSeconds -gt 120) { $Backoff = 2 } else { $Backoff = [Math]::Min($MaximumBackoffSeconds, $Backoff * 2) }
  Start-Sleep -Seconds $Backoff
}
