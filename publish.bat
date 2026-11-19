@echo off
setlocal enabledelayedexpansion

echo ============================================================
echo   IsoCad - Test, Version Bump, Publish, Deploy ^& APPX
echo ============================================================

echo.
echo [1/5] Running TypeScript check ^& Vitest...
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

echo.
echo [2/5] Incrementing version (10 patch -^> 1 minor, 10 minor -^> 1 major)...
for /f "delims=" %%v in ('node -e "const pkg=require('./package.json'); let [maj,min,pat]=pkg.version.split('.').map(Number); pat++; if(pat>=10){pat=0;min++;} if(min>=10){min=0;maj++;} console.log(maj+'.'+min+'.'+pat);"') do set NEW_VERSION=%%v
if "!NEW_VERSION!"=="" (
    echo [ERROR] Failed to calculate next version!
    exit /b 1
)
call npm version !NEW_VERSION! --no-git-tag-version
if errorlevel 1 (
    echo [ERROR] npm version update failed!
    exit /b 1
)
echo   Updated version to: !NEW_VERSION!

echo.
echo [3/5] Building production bundle ^& publishing to npm...
call npm run build
if errorlevel 1 (
    echo [ERROR] Vite build failed!
    exit /b 1
)

call npm publish --access public
if errorlevel 1 (
    echo [WARN] npm publish skipped or already published for version !NEW_VERSION!.
)

echo.
echo [4/5] Uploading dist/ to truncgil_ubuntu...
set REMOTE_DIR=/home/truncgil/web/isocad.truncgil.com/public_html
tar -czf - -C dist . | ssh truncgil_ubuntu "mkdir -p %REMOTE_DIR% && tar -xzf - -C %REMOTE_DIR% && chown -R truncgil:truncgil %REMOTE_DIR%"
if errorlevel 1 (
    echo [ERROR] SSH tar upload failed!
    exit /b 1
)

echo.
echo [5/5] Building Microsoft Store APPX package (v!NEW_VERSION!)...
call npm run dist:appx
if errorlevel 1 (
    echo [ERROR] APPX build failed!
    exit /b 1
)

echo.
echo ============================================================
echo   IsoCad v!NEW_VERSION! Deploy ^& APPX Build Completed!
echo   Web  : https://isocad.truncgil.com
echo   APPX : release\!NEW_VERSION!\IsoCad !NEW_VERSION!.appx
echo ============================================================
endlocal
