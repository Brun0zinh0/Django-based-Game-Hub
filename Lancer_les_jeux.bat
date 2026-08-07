@echo off
setlocal
title Mini-jeux Django

rem Toujours travailler depuis le dossier qui contient ce fichier.
cd /d "%~dp0"

if not exist "manage.py" (
    echo ERREUR : manage.py est introuvable dans :
    echo %CD%
    echo.
    echo Place ce fichier .bat dans le meme dossier que manage.py.
    pause
    exit /b 1
)

rem Utiliser l'environnement virtuel s'il est complet, sinon Python global.
if exist ".venv\Scripts\python.exe" (
    set "PYTHON_EXE=%CD%\.venv\Scripts\python.exe"
) else (
    set "PYTHON_EXE=python"
    where python >nul 2>&1
    if errorlevel 1 (
        echo ERREUR : Python est introuvable.
        echo Installe Python puis relance ce fichier.
        pause
        exit /b 1
    )
)

rem Installer les dependances uniquement si Django n'est pas disponible.
"%PYTHON_EXE%" -c "import django" >nul 2>&1
if errorlevel 1 (
    echo Installation des dependances...
    "%PYTHON_EXE%" -m pip install -r requirements.txt
    if errorlevel 1 (
        echo.
        echo ERREUR : l'installation des dependances a echoue.
        pause
        exit /b 1
    )
)

rem Liberer le port avant de demarrer.
rem Sans cela, un serveur deja lance garde le port 8000 : le nouveau n'arrive
rem pas a demarrer et le navigateur continue d'afficher l'ancienne version du
rem jeu (surtout si l'ancien serveur tourne avec --noreload, auquel cas il ne
rem rechargera jamais les fichiers modifies).
set "PORT=8000"
echo Verification du port %PORT%...
powershell -NoProfile -Command "$ids = @(Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique); if (-not $ids) { Write-Host '  Port libre.' }; foreach ($id in $ids) { $p = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $id) -ErrorAction SilentlyContinue; if ($p -and $p.Name -like 'python*') { Write-Host ('  Arret de l''ancien serveur (PID ' + $id + ').'); Stop-Process -Id $id -Force -ErrorAction SilentlyContinue } elseif ($p) { Write-Host ('  ATTENTION : le port %PORT% est utilise par ' + $p.Name + ' (PID ' + $id + '). Programme non arrete.') } }"

rem Laisser Windows liberer completement le port.
powershell -NoProfile -Command "Start-Sleep -Milliseconds 800" >nul 2>&1

echo.
echo Demarrage de l'interface sur http://127.0.0.1:8000/
echo Pour arreter le programme, appuie sur Ctrl+C.
echo.

rem Ouvrir le navigateur apres avoir laisse au serveur le temps de demarrer.
if /I not "%DJANGO_LAUNCHER_NO_BROWSER%"=="1" (
    start "" /b powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://127.0.0.1:8000/'"
)

"%PYTHON_EXE%" manage.py runserver

if errorlevel 1 (
    echo.
    echo Le serveur s'est arrete avec une erreur.
    pause
)

endlocal
