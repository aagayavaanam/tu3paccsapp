@echo off
echo ===================================================
echo   PACS Portal - GitHub Automatic Update Script
echo ===================================================
echo.
echo 1. Scanning local changes...
git add .

echo.
echo 2. Committing changes...
git commit -m "Update Crop Loan interest rounding calculations"

echo.
echo 3. Uploading updates to GitHub...
git push

echo.
echo ===================================================
echo  SUCCESS: Your updates are now live on the web!
echo ===================================================
echo.
pause
