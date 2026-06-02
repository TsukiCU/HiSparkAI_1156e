@echo off
setlocal enabledelayedexpansion

:: ─────────────────────────────────────────────────────────────────────────────
:: build.bat  –  One-click VSIX builder for hispark-projectwizard-shadow
:: Usage:  build.bat          (install deps + build + package)
::         build.bat noinstall (skip npm install, useful for incremental builds)
:: ─────────────────────────────────────────────────────────────────────────────

cd /d "%~dp0"

echo [1/4] Checking Node.js and npm...
where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found. Install from https://nodejs.org and retry.
    exit /b 1
)
where npm >nul 2>&1
if errorlevel 1 (
    echo ERROR: npm not found. Reinstall Node.js and retry.
    exit /b 1
)

:: ── Install dependencies ──────────────────────────────────────────────────────
if /i "%1"=="noinstall" (
    echo [2/4] Skipping npm install (noinstall flag set).
) else (
    echo [2/4] Installing dependencies (npm install)...
    call npm install
    if errorlevel 1 (
        echo ERROR: npm install failed.
        exit /b 1
    )
)

:: ── Webpack build ─────────────────────────────────────────────────────────────
echo [3/4] Building (frontend dark + light + backend)...
call npm run build
if errorlevel 1 (
    echo ERROR: Build failed.
    exit /b 1
)

:: ── Package VSIX ──────────────────────────────────────────────────────────────
echo [4/4] Packaging VSIX...

:: Prefer local vsce; fall back to globally installed one.
set VSCE=npx @vscode/vsce
where vsce >nul 2>&1
if not errorlevel 1 (
    set VSCE=vsce
)

%VSCE% package --no-yarn
if errorlevel 1 (
    echo ERROR: vsce package failed. Make sure @vscode/vsce is available:
    echo   npm install -g @vscode/vsce
    exit /b 1
)

:: ── Report output ─────────────────────────────────────────────────────────────
echo.
echo ===================================================
echo  Build successful!
echo  VSIX file:
for %%f in (*.vsix) do echo    %%~dpnxf
echo ===================================================
echo.
echo  To install in VSCode:
echo    code --install-extension ^<file^>.vsix
echo  or drag the .vsix into the VSCode Extensions panel.
echo ===================================================

endlocal
