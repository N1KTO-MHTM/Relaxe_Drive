$root = Split-Path $PSScriptRoot -Parent; $path = Join-Path $root ".cursorignore"
$lines = Get-Content $path
# Line index 13 is the 14th line (0-based)
if ($lines.Count -gt 13) { $lines[13] = "# Less indexing = less memory (fewer OOM)" }
$lines | Set-Content $path
