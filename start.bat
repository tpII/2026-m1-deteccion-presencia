@echo off
rem Instala los requisitos faltantes y levanta MQTT, backend y frontend en Windows. Ejecuta start.ps1 sin cambiar la politica de scripts del sistema.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" %*
