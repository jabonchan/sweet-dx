@Echo Off
SetLocal

CD /D "%~dp0"

where deno >nul 2>nul
If ErrorLevel 1 (
    Echo [SweetDX] Deno was not found on your PATH. Install it from https://deno.com
    Pause
    Exit /b 1
)

deno compile --include ./assets --allow-all mod.ts
If ErrorLevel 1 (
    Echo [SweetDX] deno compile failed.
    Pause
    Exit /b 1
)

Echo [SweetDX] Done.
Exit /b 0
