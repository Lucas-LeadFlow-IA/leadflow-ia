@echo off
chcp 65001 >nul
title LeadFlow IA PRO
color 0A

echo.
echo  =============================================
echo   LeadFlow IA PRO - Lancement
echo  =============================================
echo.

powershell -Command "Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force" 2>nul

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERREUR] Node.js n'est pas installe!
    echo.
    echo Veuillez installer Node.js depuis:
    echo https://nodejs.org
    echo.
    pause
    exit /b 1
)

set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

if not exist "node_modules" (
    echo [INFO] Installation des dependances npm...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo [ERREUR] Echec de l'installation
        pause
        exit /b 1
    )
    echo.
)

echo [OK] Demarrage du serveur...
echo.
echo  ===================================================================
echo  Pour acceder depuis un autre appareil (mobile, tablette):
echo  Trouvez votre IP locale: ipconfig (Windows) ou ipconfig getifaddr en0 (Mac)
echo  Ensuite connectez-vous sur: http://VOTRE_IP:3000
echo  ===================================================================
echo.
echo  - Site local:        http://localhost:3000
echo  - Dashboard:         http://localhost:3000/dashboard
echo.
echo  Comptes demo:
echo  - demo@leadflow.io / demo123 (Gratuit)
echo  - pro@leadflow.io / pro123 (Pro)
echo  - agency@leadflow.io / demo123 (Agency)
echo.
echo  Appuyez sur Ctrl+C pour arreter
echo =============================================
echo.

npm run dev -- -H 0.0.0.0

pause