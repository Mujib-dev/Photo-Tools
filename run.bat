@echo off
setlocal EnableDelayedExpansion
title Photo Tools

rem Always run from the project root, no matter where this script is invoked.
pushd "%~dp0"

set "MODE=%~1"
if "%MODE%"=="" set "MODE=dev"
if /i not "%MODE%"=="dev" if /i not "%MODE%"=="start" if /i not "%MODE%"=="build" (
    echo [ERROR] Unknown mode "%MODE%".
    echo         Usage: run.bat [dev^|start^|build]
    popd
    exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js was not found on PATH. Install Node.js 20 or newer.
    popd
    exit /b 1
)

if not exist ".env" if exist ".env.example" (
    copy /y ".env.example" ".env" >nul
    echo [setup] Created .env from .env.example
    echo         Set the PHOTO_*_EXE paths to the engines in bin\ before using them.
)

if not exist "frontend\.env.local" if exist "frontend\.env.example" (
    copy /y "frontend\.env.example" "frontend\.env.local" >nul
    echo [setup] Created frontend\.env.local from .env.example
)

if not exist "node_modules" (
    echo [setup] Installing dependencies, this may take a minute...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        popd
        exit /b 1
    )
)

if /i "%MODE%"=="start" if not exist "backend\dist\index.js" (
    echo [ERROR] backend\dist\index.js is missing. Run "run.bat build" first.
    popd
    exit /b 1
)

echo.
echo   Mode      %MODE%
echo   Frontend  http://localhost:3000
echo   Backend   http://localhost:4000
echo   Stop      Ctrl+C
echo.

if /i "%MODE%"=="dev" (
    call npm run dev
) else if /i "%MODE%"=="start" (
    call npm run start
) else (
    call npm run build
)

set "EXITCODE=%errorlevel%"
echo.
if not "%EXITCODE%"=="0" echo [ERROR] Exited with code %EXITCODE%.
popd
endlocal & exit /b %EXITCODE%
