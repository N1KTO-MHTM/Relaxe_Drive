To give Cursor more memory (reduce OOM):

1. Run set-cursor-memory.ps1 once:
   - In File Explorer go to project folder -> scripts
   - Right-click set-cursor-memory.ps1 -> Run with PowerShell
   OR in PowerShell: cd to project root, then: .\scripts\set-cursor-memory.ps1

2. If you get "script execution disabled", run in PowerShell (Admin optional):
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

3. Close Cursor completely and open it again.

This sets NODE_OPTIONS=--max-old-space-size=14336 (14 GB) for your user. Note: Electron/V8 may cap heap lower (e.g. ~4–8 GB); if so, the effective limit will be less.
