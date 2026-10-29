@echo off
rem Inicio rapido en Windows. Ejecuta start.ps1 sin cambiar la politica de scripts del sistema.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" %*
