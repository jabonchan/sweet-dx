@Echo Off

CD %~dp0
deno compile --include ./assets --allow-all mod.ts

Exit /b