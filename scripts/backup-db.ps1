# RelaxDrive DB backup (SQLite or PostgreSQL)
# Usage: .\scripts\backup-db.ps1 [output-dir]
# For PostgreSQL set DATABASE_URL in env (or backend\.env). Backup is pg_dump.
# For SQLite backup is a file copy of backend/prisma/dev.db (or path from DATABASE_URL).

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $root 'package.json'))) {
  $root = $PSScriptRoot
  while ($root -and -not (Test-Path (Join-Path $root 'package.json'))) { $root = Split-Path -Parent $root }
}
if (-not $root) { Write-Error 'Repo root not found'; exit 1 }

$outDir = if ($args.Count -gt 0) { $args[0] } else { Join-Path $root 'backups' }
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$envPath = Join-Path $root 'backend\.env'
if (Test-Path $envPath) {
  Get-Content $envPath | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
      [System.Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim().Trim('"'), 'Process')
    }
  }
}
$dbUrl = $env:DATABASE_URL

if ($dbUrl -and $dbUrl -match '^postgres') {
  $outFile = Join-Path $outDir "relaxdrive-pg-$stamp.sql"
  Write-Host "PostgreSQL backup -> $outFile"
  & pg_dump $dbUrl -f $outFile 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Error 'pg_dump failed. Ensure PostgreSQL client (pg_dump) is installed and DATABASE_URL is set.'
    exit 1
  }
  Write-Host "Done: $outFile"
} else {
  $sqlitePath = if ($dbUrl -and $dbUrl -match 'file:(.+)') { $matches[1].Trim() } else { Join-Path $root 'backend\prisma\dev.db' }
  if (-not (Test-Path $sqlitePath)) {
    Write-Error "SQLite file not found: $sqlitePath"
    exit 1
  }
  $outFile = Join-Path $outDir "relaxdrive-sqlite-$stamp.db"
  Write-Host "SQLite copy -> $outFile"
  Copy-Item -Path $sqlitePath -Destination $outFile -Force
  Write-Host "Done: $outFile"
}
