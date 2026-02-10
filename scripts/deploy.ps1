# RelaxDrive deploy: pull, build web (and optionally commit + push)
# Usage: .\scripts\deploy.ps1 [--check] [--push]
#   --check  Run npm run check (locales + build web + build backend) before build:web
#   --push   After build, commit web/dist and push to current branch (if dist is tracked)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $root 'package.json'))) {
  $root = $PSScriptRoot
  while ($root -and -not (Test-Path (Join-Path $root 'package.json'))) { $root = Split-Path -Parent $root }
}
if (-not $root) { Write-Error 'Repo root not found'; exit 1 }

Set-Location $root
Write-Host 'Pull latest...'
git pull
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$doCheck = $args -contains '--check'
if ($doCheck) {
  Write-Host 'Run check (locales + build web + backend)...'
  npm run check
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host 'Build web...'
npm run build:web
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$doPush = $args -contains '--push'
if ($doPush) {
  $status = git status --porcelain
  if ($status) {
    git add web/dist 2>$null
    git add .
    git commit -m "Build web"
    git push
  } else {
    Write-Host 'No changes to commit.'
  }
} else {
  Write-Host 'Done. To commit and push build, run: .\scripts\deploy.ps1 --push'
}
