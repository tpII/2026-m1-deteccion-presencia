# Inicio rapido en Windows: equivalente de start.sh.
# Instala lo que falte (dependencias de Python y Node, y Mosquitto con winget) y levanta
# el broker MQTT, el backend y la pagina web. Ctrl+C detiene todo lo que inicio este script.
#
# Uso: doble clic en start.bat, o desde la carpeta del proyecto:  .\start.bat

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

$BackendPort = 8000
$FrontendPort = 5173
$BrokerPort = 1883
$started = @()

function Write-Step($text) { Write-Host "`n==> $text" -ForegroundColor Cyan }
function Write-Warn($text) { Write-Host "ATENCION: $text" -ForegroundColor Yellow }
function Stop-WithError($text) { Write-Host "ERROR: $text" -ForegroundColor Red; exit 1 }

function Test-Port($port) {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $attempt = $client.BeginConnect('127.0.0.1', $port, $null, $null)
        return $attempt.AsyncWaitHandle.WaitOne(300) -and $client.Connected
    } catch {
        return $false
    } finally {
        $client.Close()
    }
}

function Get-FileSha($path) { (Get-FileHash -Path $path -Algorithm SHA256).Hash }

function Find-Python {
    # Devuelve el comando de un Python 3.11 o superior (python o el lanzador py).
    foreach ($candidate in @('python', 'py')) {
        if (-not (Get-Command $candidate -ErrorAction SilentlyContinue)) { continue }
        try {
            $version = & $candidate -c "import sys; print('%d.%d' % sys.version_info[:2])" 2>$null
        } catch {
            continue
        }
        if ($version -and [version]$version -ge [version]'3.11') { return $candidate }
    }
    return $null
}

function Find-Mosquitto {
    $command = Get-Command mosquitto -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    foreach ($folder in @($env:ProgramFiles, ${env:ProgramFiles(x86)})) {
        if (-not $folder) { continue }
        $path = Join-Path $folder 'mosquitto\mosquitto.exe'
        if (Test-Path $path) { return $path }
    }
    return $null
}

function Stop-Started {
    foreach ($process in $script:started) {
        if ($process -and -not $process.HasExited) {
            # /T detiene tambien los procesos hijos (uvicorn --reload crea uno)
            try { & taskkill /PID $process.Id /T /F | Out-Null } catch { }
        }
    }
}

# --- 1. Programas necesarios -------------------------------------------------------------------

Write-Step 'Verificando programas necesarios'
$python = Find-Python
if (-not $python) { Stop-WithError 'Falta Python 3.11 o superior: https://www.python.org/downloads/ (tildar "Add python.exe to PATH").' }
if (-not (Get-Command node -ErrorAction SilentlyContinue) -or -not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    Stop-WithError 'Falta Node.js (incluye npm): https://nodejs.org (version LTS). Despues cerra y volve a abrir la terminal.'
}

$mosquitto = Find-Mosquitto
if (-not $mosquitto -and -not (Test-Port $BrokerPort)) {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        Stop-WithError 'Falta Mosquitto. Instalalo desde https://mosquitto.org/download y volve a ejecutar este script.'
    }
    Write-Step 'Instalando Mosquitto con winget (Windows puede pedir permiso de administrador)'
    & winget install --exact --id EclipseFoundation.Mosquitto --accept-source-agreements --accept-package-agreements
    $mosquitto = Find-Mosquitto
    if (-not $mosquitto) { Stop-WithError 'No se pudo instalar Mosquitto. Instalalo desde https://mosquitto.org/download.' }
}

# --- 2. Configuracion y dependencias -----------------------------------------------------------

if (-not (Test-Path '.env')) {
    Write-Step 'Creando .env a partir de .env.example'
    Copy-Item '.env.example' '.env'
}

$venvPython = 'backend\.venv\Scripts\python.exe'
if (-not (Test-Path $venvPython)) {
    Write-Step 'Creando el entorno virtual de Python (backend\.venv)'
    & $python -m venv backend\.venv
    if ($LASTEXITCODE -ne 0) { Stop-WithError 'No se pudo crear el entorno virtual.' }
}
$requirementsMarker = 'backend\.venv\requirements.sha256'
$requirementsSha = Get-FileSha 'backend\requirements.txt'
if (-not (Test-Path $requirementsMarker) -or (Get-Content $requirementsMarker) -ne $requirementsSha) {
    Write-Step 'Instalando dependencias del backend (solo la primera vez o si cambian)'
    & $venvPython -m pip install --disable-pip-version-check -r backend\requirements.txt
    if ($LASTEXITCODE -ne 0) { Stop-WithError 'Fallo la instalacion de dependencias del backend.' }
    Set-Content -Path $requirementsMarker -Value $requirementsSha
}

$packagesMarker = 'frontend\node_modules\package-lock.sha256'
$packagesSha = Get-FileSha 'frontend\package-lock.json'
if (-not (Test-Path $packagesMarker) -or (Get-Content $packagesMarker) -ne $packagesSha) {
    Write-Step 'Instalando dependencias del frontend (solo la primera vez o si cambian)'
    Push-Location frontend
    & npm.cmd install --no-audit --no-fund
    $npmResult = $LASTEXITCODE
    Pop-Location
    if ($npmResult -ne 0) { Stop-WithError 'Fallo npm install.' }
    Set-Content -Path $packagesMarker -Value $packagesSha
}

# --- 3. Puertos ----------------------------------------------------------------------------------

foreach ($port in @($BackendPort, $FrontendPort)) {
    if (Test-Port $port) { Stop-WithError "El puerto $port esta ocupado. Cerra la instancia anterior (o la terminal que la inicio)." }
}

try {
    # --- 4. Broker MQTT --------------------------------------------------------------------------
    $service = Get-Service -Name mosquitto -ErrorAction SilentlyContinue
    if ($service -and $service.Status -eq 'Running') {
        Write-Warn 'El servicio de Windows "Mosquitto Broker" esta activo y solo acepta conexiones de esta PC: el ESP32 no podra conectarse.'
        try {
            Stop-Service -Name mosquitto
            Write-Host 'Se detuvo el servicio; se usara la configuracion del proyecto.'
        } catch {
            Write-Warn 'No se pudo detener (hace falta administrador). Abri PowerShell como administrador y ejecuta:  net stop mosquitto  y  sc.exe config mosquitto start= demand'
        }
    }

    if (Test-Port $BrokerPort) {
        Write-Step "Reutilizando el broker que ya escucha en el puerto $BrokerPort"
    } else {
        Write-Step 'Iniciando Mosquitto (si Windows pregunta por el firewall, permiti el acceso en redes privadas)'
        $broker = Start-Process -FilePath $mosquitto -ArgumentList '-c', 'mosquitto\mosquitto.conf' -NoNewWindow -PassThru
        $started += $broker
        $ready = $false
        for ($i = 0; $i -lt 15; $i++) {
            if (Test-Port $BrokerPort) { $ready = $true; break }
            Start-Sleep -Seconds 1
        }
        if (-not $ready) { Stop-WithError 'Mosquitto no pudo iniciar.' }
    }

    # --- 5. Backend --------------------------------------------------------------------------------
    Write-Step "Iniciando el backend en http://localhost:$BackendPort"
    $backend = Start-Process -FilePath (Resolve-Path $venvPython).Path -WorkingDirectory backend -NoNewWindow -PassThru `
        -ArgumentList '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', "$BackendPort", '--reload'
    $started += $backend
    $mqttConnected = $false
    for ($i = 0; $i -lt 40; $i++) {
        if ($backend.HasExited) { Stop-WithError 'El backend se detuvo al iniciar. Revisa los mensajes de arriba.' }
        try {
            $health = Invoke-RestMethod -Uri "http://127.0.0.1:$BackendPort/api/v1/health" -TimeoutSec 2
            if ($health.mqtt_connected) { $mqttConnected = $true; break }
        } catch { }
        Start-Sleep -Milliseconds 500
    }
    if (-not $mqttConnected) { Stop-WithError 'El backend no se pudo conectar al broker MQTT.' }

    # --- 6. Frontend -------------------------------------------------------------------------------
    Write-Step "Iniciando la pagina web en http://localhost:$FrontendPort"
    $frontend = Start-Process -FilePath (Get-Command node).Source -WorkingDirectory frontend -NoNewWindow -PassThru `
        -ArgumentList 'node_modules\vite\bin\vite.js', '--host', '127.0.0.1', '--port', "$FrontendPort", '--strictPort'
    $started += $frontend

    # --- 7. Resumen --------------------------------------------------------------------------------
    $addresses = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
        Select-Object -ExpandProperty IPAddress
    Write-Host ''
    Write-Host '==================================================================' -ForegroundColor Green
    Write-Host " Pagina web:   http://localhost:$FrontendPort"
    Write-Host " API (docs):   http://localhost:$BackendPort/docs"
    Write-Host " Broker MQTT:  puerto $BrokerPort"
    Write-Host " IP de esta PC para MQTT_HOST en el config.h del ESP32: $($addresses -join ', ')"
    Write-Host ' Ctrl+C detiene todo lo que inicio este script.'
    Write-Host '==================================================================' -ForegroundColor Green
    Start-Sleep -Seconds 2
    Start-Process "http://localhost:$FrontendPort"

    while ($true) {
        foreach ($process in $started) {
            if ($process.HasExited) { Stop-WithError "Un proceso se detuvo (codigo $($process.ExitCode)). Revisa los mensajes de arriba." }
        }
        Start-Sleep -Seconds 1
    }
} finally {
    Write-Host "`nDeteniendo los procesos iniciados por este script..."
    Stop-Started
}
