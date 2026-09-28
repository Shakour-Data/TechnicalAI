@echo off
REM Data Update Scheduler - Windows Batch File
REM Runs the data update scheduler as a background process

set PROJECT_DIR=%~dp0
cd /d "%PROJECT_DIR%"

echo Starting Data Update Scheduler...
echo Logs will be written to: %PROJECT_DIR%\db\data-update.log
echo Press Ctrl+C to stop

REM Run the daemon mode
npm run data:daemon

REM Keep the window open if run directly
if "%~1"=="keepopen" (
    pause
)