# Arranque con un comando en Windows: .\start.bat
param([ValidateSet('mqtt')][string]$Mode = 'mqtt')
$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot
$BackendPort = 8000
$FrontendPort = 5173
$started = @()

function Write-Step($text) { Write-Host "`n==> $text" -ForegroundColor Cyan }
function Stop-WithError($text) { throw $text }

function Refresh-ToolPath {
    $paths = @($env:Path,
        [Environment]::GetEnvironmentVariable('Path', 'Machine'),
        [Environment]::GetEnvironmentVariable('Path', 'User'),
        "$env:LOCALAPPDATA\Programs\Python\Python312",
        "$env:LOCALAPPDATA\Programs\Python\Python312\Scripts",
        "$env:ProgramFiles\nodejs", "$env:ProgramFiles\mosquitto")
    $env:Path = ($paths | Where-Object { $_ }) -join ';'
}

function Install-WithWinget($packageId) {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        Stop-WithError 'Falta WinGet (App Installer de Microsoft). Instalalo desde https://aka.ms/getwinget y repeti .\start.bat.'
    }
    Write-Step "Instalando $packageId; Windows puede pedir permisos"
    & winget install --exact --id $packageId --source winget --accept-source-agreements --accept-package-agreements | Out-Host
    if ($LASTEXITCODE -ne 0) { Stop-WithError "No se pudo instalar $packageId. Revisa Internet y permisos; repeti .\start.bat." }
    Refresh-ToolPath
}

function Find-Python {
    foreach ($candidate in @('python', 'py', "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe")) {
        if (-not (Get-Command $candidate -ErrorAction SilentlyContinue)) { continue }
        try {
            $executable = & $candidate -c 'import sys; print(sys.executable) if sys.version_info >= (3,12) else sys.exit(1)' 2>$null
            if ($LASTEXITCODE -eq 0 -and $executable) { return $executable.Trim() }
        } catch { }
    }
    return $null
}

function Test-Node {
    if (-not (Get-Command node -ErrorAction SilentlyContinue) -or -not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { return $false }
    & node -e "const [major, minor] = process.versions.node.split('.').map(Number); process.exit(major > 20 || (major === 20 && minor >= 19) ? 0 : 1)"
    return $LASTEXITCODE -eq 0
}

function Find-Mosquitto {
    $command = Get-Command mosquitto -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    foreach ($folder in @($env:ProgramFiles, ${env:ProgramFiles(x86)})) {
        if (-not $folder) { continue }
        $executable = Join-Path $folder 'mosquitto\mosquitto.exe'
        if (Test-Path $executable) { return $executable }
    }
    return $null
}

function Test-Port($address, $port) {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $attempt = $client.BeginConnect($address, $port, $null, $null)
        return $attempt.AsyncWaitHandle.WaitOne(500) -and $client.Connected
    } catch { return $false } finally { $client.Close() }
}

function Stop-Started {
    foreach ($process in $script:started) {
        if ($process -and -not $process.HasExited) {
            # Incluye los hijos de Uvicorn; no detiene procesos ajenos.
            try { & taskkill /PID $process.Id /T /F | Out-Null } catch { }
        }
    }
}

try {
    foreach ($port in @($BackendPort, $FrontendPort)) {
        if (Test-Port '127.0.0.1' $port) { Stop-WithError "El puerto $port esta ocupado. Cerra la instancia anterior antes de ejecutar otra." }
    }
    Refresh-ToolPath
    $python = Find-Python
    if (-not $python) {
        Install-WithWinget 'Python.Python.3.12'
        $python = Find-Python
        if (-not $python) { Stop-WithError 'Python 3.12+ no esta disponible despues de instalar. Revisa la instalacion y repeti .\start.bat.' }
    }
    if (-not (Test-Node)) {
        Install-WithWinget 'OpenJS.NodeJS.LTS'
        if (-not (Test-Node)) { Stop-WithError 'Node 20.19+ y npm no estan disponibles despues de instalar.' }
    }
    if (-not (Test-Path '.env')) { Copy-Item '.env.example' '.env'; Write-Step 'Configuracion local .env creada' }
    $env:DATA_SOURCE = 'mqtt'

    $venvPython = Join-Path $PSScriptRoot 'backend\.venv\Scripts\python.exe'
    $venvReady = $false
    if (Test-Path $venvPython) {
        try {
            & $venvPython -c 'import sys; sys.exit(sys.version_info < (3,12))'
            $venvReady = $LASTEXITCODE -eq 0
        } catch { }
    }
    if (-not $venvReady) {
        if (Test-Path 'backend\.venv') {
            $backup = '.venv.backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + $PID
            Rename-Item 'backend\.venv' $backup
            Write-Step "Entorno anterior conservado en backend\$backup"
        }
        Write-Step 'Creando el entorno Python'
        & $python -m venv backend\.venv
        if ($LASTEXITCODE -ne 0) { Stop-WithError 'No se pudo crear el entorno Python.' }
    }
    $requirementsMarker = 'backend\.venv\requirements.sha256'
    $requirementsSha = (Get-FileHash 'backend\requirements.txt' -Algorithm SHA256).Hash.ToLower()
    $backendImports = $false
    try {
        & $venvPython -c 'import fastapi, uvicorn, pydantic_settings, aiosqlite, numpy, paho.mqtt.client' 2>$null
        $backendImports = $LASTEXITCODE -eq 0
    } catch { }
    if (-not (Test-Path $requirementsMarker) -or (Get-Content $requirementsMarker) -ne $requirementsSha -or -not $backendImports) {
        Write-Step 'Instalando dependencias del backend'
        & $venvPython -m pip install --disable-pip-version-check -r backend\requirements.txt
        if ($LASTEXITCODE -ne 0) { Stop-WithError 'Fallo pip. Revisa Internet y repeti .\start.bat.' }
        Set-Content $requirementsMarker $requirementsSha
    }

    $packagesMarker = 'frontend\node_modules\package-lock.sha256'
    $packagesSha = (Get-FileHash 'frontend\package-lock.json' -Algorithm SHA256).Hash.ToLower()
    $nodeSignature = & node -p "process.platform + '/' + process.arch + '/' + process.versions.node.split('.')[0]"
    $frontendSignature = "$packagesSha/$nodeSignature"
    if (-not (Test-Path $packagesMarker) -or (Get-Content $packagesMarker) -ne $frontendSignature -or
        -not (Test-Path 'frontend\node_modules\vite\bin\vite.js') -or -not (Test-Path 'frontend\node_modules\typescript\bin\tsc')) {
        Write-Step 'Instalando dependencias del frontend'
        Push-Location frontend
        try { & npm.cmd ci --no-audit --no-fund; $npmResult = $LASTEXITCODE } finally { Pop-Location }
        if ($npmResult -ne 0) { Stop-WithError 'Fallo npm ci. Revisa Internet y repeti .\start.bat.' }
        Set-Content $packagesMarker $frontendSignature
    }

    # Leer la configuracion real despues de instalar el backend.
    Push-Location backend
    try {
        $brokerJson = & $venvPython -c "from app.config import settings; import json; print(json.dumps({'address':settings.MQTT_HOST,'port':settings.MQTT_PORT}))"
        $configResult = $LASTEXITCODE
    } finally { Pop-Location }
    if ($configResult -ne 0) { Stop-WithError 'No se pudo leer .env. Revisa tambien backend\.env si existe.' }
    $brokerSettings = $brokerJson | ConvertFrom-Json
    $brokerAddress = $brokerSettings.address
    $brokerPort = [int]$brokerSettings.port
    if (Test-Port $brokerAddress $brokerPort) {
        Write-Step "Reutilizando broker en ${brokerAddress}:$brokerPort; no se detendra al salir"
        Write-Host 'Si el ESP32 no conecta, revisa que ese broker acepte la red local y el firewall.'
    } else {
        if ($brokerAddress -notin @('localhost', '127.0.0.1')) { Stop-WithError "El broker remoto ${brokerAddress}:$brokerPort no responde. Inicialo o usa MQTT_HOST=localhost." }
        $mosquitto = Find-Mosquitto
        if (-not $mosquitto) {
            Install-WithWinget 'EclipseFoundation.Mosquitto'
            $mosquitto = Find-Mosquitto
            if (-not $mosquitto) { Stop-WithError 'No se encontro Mosquitto despues de instalarlo.' }
        }
        # El instalador puede haber iniciado un servicio en el puerto configurado.
        if (Test-Port $brokerAddress $brokerPort) {
            Write-Step 'Reutilizando el broker iniciado durante la instalacion'
        } else {
            $brokerConfig = Join-Path $PSScriptRoot 'mosquitto\mosquitto.conf'
            if ($brokerPort -ne 1883) {
                New-Item -ItemType Directory -Force '.runtime' | Out-Null
                $brokerConfig = Join-Path $PSScriptRoot ".runtime\mosquitto-$brokerPort.conf"
                Set-Content $brokerConfig "listener $brokerPort 0.0.0.0`nallow_anonymous true`npersistence false`nlog_dest stdout"
            }
            Write-Step "Iniciando Mosquitto en $brokerPort; permite acceso en redes privadas si Windows lo solicita"
            $broker = Start-Process $mosquitto -ArgumentList '-c', "`"$brokerConfig`"" -NoNewWindow -PassThru
            $started += $broker
            $brokerReady = $false
            for ($i = 0; $i -lt 15; $i++) {
                if (Test-Port $brokerAddress $brokerPort) { $brokerReady = $true; break }
                if ($broker.HasExited) { break }
                Start-Sleep -Seconds 1
            }
            if (-not $brokerReady) { Stop-WithError 'Mosquitto no pudo iniciar.' }
        }
    }

    Write-Step 'Iniciando backend'
    $backend = Start-Process $venvPython -WorkingDirectory (Join-Path $PSScriptRoot 'backend') -NoNewWindow -PassThru `
        -ArgumentList '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', "$BackendPort", '--reload'
    $started += $backend
    $mqttConnected = $false
    for ($i = 0; $i -lt 40; $i++) {
        if ($backend.HasExited) { Stop-WithError 'El backend se detuvo. Revisa los mensajes de arriba.' }
        try {
            $health = Invoke-RestMethod "http://127.0.0.1:$BackendPort/api/v1/health" -TimeoutSec 2
            if ($health.mqtt_connected) { $mqttConnected = $true; break }
        } catch { }
        Start-Sleep -Milliseconds 500
    }
    if (-not $mqttConnected) { Stop-WithError 'El backend no se conecto a MQTT.' }

    Write-Step 'Iniciando frontend'
    $frontend = Start-Process (Get-Command node).Source -WorkingDirectory (Join-Path $PSScriptRoot 'frontend') -NoNewWindow -PassThru `
        -ArgumentList 'node_modules\vite\bin\vite.js', '--host', '127.0.0.1', '--port', "$FrontendPort", '--strictPort'
    $started += $frontend
    $frontendReady = $false
    for ($i = 0; $i -lt 40; $i++) {
        if ($frontend.HasExited) { Stop-WithError 'El frontend se detuvo. Revisa los mensajes de arriba.' }
        try {
            $response = Invoke-WebRequest "http://127.0.0.1:$FrontendPort" -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -eq 200) { $frontendReady = $true; break }
        } catch { }
        Start-Sleep -Milliseconds 500
    }
    if (-not $frontendReady) { Stop-WithError 'La web no respondio a tiempo.' }
    $addresses = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
        Select-Object -ExpandProperty IPAddress
    Write-Host "`nWeb: http://localhost:5173 | API: http://localhost:8000/docs" -ForegroundColor Green
    Write-Host "Broker: ${brokerAddress}:$brokerPort"
    Write-Host "IP de esta PC para MQTT_HOST del ESP32: $($addresses -join ', ')"
    Write-Host 'Ctrl+C detiene los procesos iniciados por este script. Las placas se programan por separado.'
    if ($env:PRESENCE_OPEN_BROWSER -ne '0') {
        try { Start-Process 'http://localhost:5173' } catch { Write-Host 'Abri http://localhost:5173 en tu navegador.' }
    }
    while ($true) {
        foreach ($process in $started) {
            if ($process.HasExited) { Stop-WithError "Un proceso se detuvo (codigo $($process.ExitCode))." }
        }
        Start-Sleep -Seconds 1
    }
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    Stop-Started
}
