@echo off
echo Starting auto-backup...

REM Change to the script's directory (works from any location)
cd /d "%~dp0"

git add .
if %errorlevel% neq 0 (
    echo Failed to add files
    exit /b 1
)

for /f "tokens=*" %%a in ('git status --porcelain') do set changes=%%a
if not defined changes (
    echo No changes to commit
    exit /b 0
)

git commit -m "Auto-backup: %date% %time%"
if %errorlevel% neq 0 (
    echo Failed to commit
    exit /b 1
)

git push origin master
if %errorlevel% neq 0 (
    echo Failed to push
    exit /b 1
)

echo Auto-backup completed successfully