@echo off
setlocal enabledelayedexpansion

echo ============================================================
echo   IsoCad - Build, Test, NPM Publish ^& Server Deploy
echo ============================================================

echo.
echo [1/4] Running TypeScript check, Vitest ^& Vite Production Build...
call npx tsc --noEmit
if errorlevel 1 (
    echo [ERROR] TypeScript check failed!
    exit /b 1
)

call npm test
if errorlevel 1 (
    echo [ERROR] Unit tests failed!
    exit /b 1
)

call npm run build
if errorlevel 1 (
    echo [ERROR] Vite build failed!
    exit /b 1
)

echo.
echo [2/4] Publishing package to npm (isocad-webgl-pdf)...
call npm publish --access public
if errorlevel 1 (
    echo [WARN] npm publish skipped or already published for current version.
)

echo.
echo [3/4] Preparing remote directory and uploading dist/ to truncgil_ubuntu...
set REMOTE_DIR=/home/truncgil/web/isocad.truncgil.com/public_html
tar -czf - -C dist . | ssh truncgil_ubuntu "mkdir -p %REMOTE_DIR% && tar -xzf - -C %REMOTE_DIR% && chown -R truncgil:truncgil %REMOTE_DIR%"
if errorlevel 1 (
    echo [ERROR] SSH tar upload failed!
    exit /b 1
)

echo.
echo ============================================================
echo   IsoCad Deploy Completed Successfully!
echo   Target: https://isocad.truncgil.com
echo ============================================================
endlocal
