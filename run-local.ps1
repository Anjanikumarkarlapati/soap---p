# Runs the whole backend locally without Docker (Windows / PowerShell).
#   1. Copy .env.example to .env and set DB_PASSWORD (and JWT_SECRET)
#   2. .\run-local.ps1            -> builds jars, starts Eureka, then services, then the gateway
#   3. .\run-local.ps1 -Stop      -> stops everything it started
# Logs go to .\logs\<service>.log
param([switch]$Stop, [switch]$SkipBuild)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$pidFile = Join-Path $root "logs\pids.txt"

if ($Stop) {
    if (Test-Path $pidFile) {
        Get-Content $pidFile | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
        Remove-Item $pidFile
    }
    Write-Host "Stopped."
    return
}

# Load .env into this process (child processes inherit it).
$envFile = Join-Path $root ".env"
if (-not (Test-Path $envFile)) { throw "Missing .env - copy .env.example to .env and set DB_PASSWORD." }
Get-Content $envFile | Where-Object { $_ -match '^\s*([A-Z_]+)\s*=\s*(.*)$' } | ForEach-Object {
    if ($Matches[2] -ne "") { [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], "Process") }
}
if (-not $env:DB_PASSWORD) { throw "DB_PASSWORD is empty in .env" }

if (-not $env:JAVA_HOME) {
    $jdk = Get-ChildItem "C:\Program Files\Java" -Directory -Filter "jdk-25*" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($jdk) { $env:JAVA_HOME = $jdk.FullName }
}
$java = if ($env:JAVA_HOME) { Join-Path $env:JAVA_HOME "bin\java.exe" } else { "java" }

if (-not $SkipBuild) {
    $mvn = (Get-Command mvn -ErrorAction SilentlyContinue).Source
    if (-not $mvn) { $mvn = Get-ChildItem "$env:USERPROFILE\.m2\wrapper\dists" -Recurse -Filter mvn.cmd | Select-Object -First 1 -ExpandProperty FullName }
    & $mvn -B -q -f (Join-Path $root "pom.xml") package -DskipTests
    if ($LASTEXITCODE -ne 0) { throw "Maven build failed" }
}

New-Item -ItemType Directory -Force (Join-Path $root "logs") | Out-Null
Remove-Item $pidFile -ErrorAction SilentlyContinue

function Start-Service([string]$name, [int]$port) {
    $jar = Get-ChildItem (Join-Path $root "$name\target") -Filter "$name-*.jar" | Where-Object { $_.Name -notlike "*plain*" } | Select-Object -First 1
    $log = Join-Path $root "logs\$name.log"
    $env:PORT = "$port"
    $p = Start-Process -FilePath $java -ArgumentList "-jar", "`"$($jar.FullName)`"" -RedirectStandardOutput $log -RedirectStandardError "$log.err" -PassThru -WindowStyle Hidden
    Add-Content $pidFile $p.Id
    Write-Host "Started $name (pid $($p.Id)) on :$port"
}

function Wait-Healthy([string]$name, [int]$port) {
    for ($i = 0; $i -lt 90; $i++) {
        try {
            $up = (Invoke-RestMethod "http://localhost:$port/actuator/health" -TimeoutSec 2).status -eq "UP"
            # Healthy isn't enough: the gateway can only route to services that registered with Eureka.
            $registered = $name -eq "eureka-server" -or (@((Invoke-RestMethod "http://localhost:8761/eureka/apps" -Headers @{ Accept = "application/json" } -TimeoutSec 2).applications.application.name) -contains $name.ToUpper())
            if ($up -and $registered) { Write-Host "$name is UP and registered"; return }
        } catch {}
        Start-Sleep -Seconds 2
    }
    throw "$name did not become healthy/registered - see logs\$name.log"
}

Start-Service "eureka-server" 8761; Wait-Healthy "eureka-server" 8761
Start-Service "auth-service" 8081
Start-Service "course-service" 8082
Start-Service "enrollment-service" 8083
Start-Service "payment-service" 8084
Wait-Healthy "auth-service" 8081; Wait-Healthy "course-service" 8082; Wait-Healthy "enrollment-service" 8083; Wait-Healthy "payment-service" 8084
Start-Service "api-gateway" 8080; Wait-Healthy "api-gateway" 8080

Write-Host ""
Write-Host "Gateway:  http://localhost:8080   (e.g. POST /api/auth/login)"
Write-Host "Eureka:   http://localhost:8761"
Write-Host "Swagger:  http://localhost:8082/swagger-ui.html (per service)"
Write-Host "Stop with: .\run-local.ps1 -Stop"
