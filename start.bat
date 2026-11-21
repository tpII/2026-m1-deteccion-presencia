@echo off
rem Arranque de Windows. PowerShell ejecuta el script interno.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-windows.ps1" %*
