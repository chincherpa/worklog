@echo off
cd /d D:\Projects\worklog

echo Bumping version...
powershell -ExecutionPolicy Bypass -File "D:\Projects\worklog\bump-version.ps1"
if errorlevel 1 (
    echo VERSION BUMP FAILED
    pause
    exit /b 1
)

echo Building...
pnpm tauri build
if errorlevel 1 (
    echo BUILD FAILED
    pause
    exit /b 1
)

powershell -ExecutionPolicy Bypass -Command "$src = 'D:\Projects\worklog\src-tauri\target\release\worklog.exe'; $zip = 'X:\Bertrandt\worklog.zip'; if (-not (Test-Path $src)) { Write-Error \"EXE not found: $src\"; exit 1 }; Compress-Archive -Path $src -DestinationPath $zip -Force; Write-Host \"Done: $zip\""
if errorlevel 1 (
    echo PACKAGE FAILED
    pause
    exit /b 1
)

pause
