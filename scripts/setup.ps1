# Herramientas y dependencias del arranque Windows. No inicia servicios.
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

function Prepare-Dependencies($projectRoot) {
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

    $venvPython = Join-Path $projectRoot 'backend\.venv\Scripts\python.exe'
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
        & $python -m venv backend\.venv | Out-Host
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
        & $venvPython -m pip install --disable-pip-version-check -r backend\requirements.txt | Out-Host
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
        try { & npm.cmd ci --no-audit --no-fund | Out-Host; $npmResult = $LASTEXITCODE } finally { Pop-Location }
        if ($npmResult -ne 0) { Stop-WithError 'Fallo npm ci. Revisa Internet y repeti .\start.bat.' }
        Set-Content $packagesMarker $frontendSignature
    }
    return $venvPython
}
