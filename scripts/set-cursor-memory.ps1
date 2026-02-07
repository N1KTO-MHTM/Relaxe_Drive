# Set NODE_OPTIONS so Cursor can use more memory (fewer OOM crashes).
# Run once: right-click -> "Run with PowerShell" or in PowerShell: .\scripts\set-cursor-memory.ps1

$value = "--max-old-space-size=14336"  # 14 GB (14 * 1024 MB)
[Environment]::SetEnvironmentVariable("NODE_OPTIONS", $value, "User")
Write-Host "NODE_OPTIONS set to $value for current user."
Write-Host "Close Cursor completely and open it again for the change to take effect." -ForegroundColor Yellow
