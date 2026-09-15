# AcademiaX — Start all backend services
param([switch]$Stop)

$JAVA = 'C:\Program Files\Java\jdk-25\bin\java.exe'
$BASE = $PSScriptRoot
$LOGS = Join-Path $BASE 'logs'

# Load .env into this process (child processes inherit it)
$envFile = Join-Path $BASE '.env'
if (Test-Path $envFile) {
    Get-Content $envFile | Where-Object { $_ -match '^\s*([A-Z_]+)\s*=\s*(.*)$' } | ForEach-Object {
        if ($Matches[2] -ne "") { [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], "Process") }
    }
}

if (-not $env:DB_URL) { $env:DB_URL = 'jdbc:postgresql://localhost:5432/postgres' }
if (-not $env:DB_USERNAME) { $env:DB_USERNAME = 'postgres' }
if (-not $env:DB_PASSWORD) { throw 'DB_PASSWORD is not set. Please set DB_PASSWORD in .env or your environment.' }
if (-not $env:JWT_SECRET) { $env:JWT_SECRET = 'dev-only-change-me-academiax-jwt-secret-0123456789' }
if (-not $env:EUREKA_SERVER_URL) { $env:EUREKA_SERVER_URL = 'http://localhost:8761/eureka' }
if (-not $env:SEED_DEMO_DATA) { $env:SEED_DEMO_DATA = 'true' }
if (-not $env:JAVA_HOME) { $env:JAVA_HOME = 'C:\Program Files\Java\jdk-25' }

if ($Stop) {
    Write-Host 'Stopping services...' -ForegroundColor Yellow
    Get-ChildItem -Path $LOGS -Filter '*.pid' -ErrorAction SilentlyContinue | ForEach-Object {
        $p = (Get-Content $_.FullName).Trim()
        if ($p -match '^\d+$') { Stop-Process -Id ([int]$p) -Force -ErrorAction SilentlyContinue; Write-Host "Stopped PID $p" }
    }
    Remove-Item (Join-Path $LOGS '*.pid') -ErrorAction SilentlyContinue
    return
}

if (-not (Test-Path $LOGS)) { New-Item -ItemType Directory -Path $LOGS | Out-Null }

function Run-Service($name, $jar, $port, $extras) {
    $log  = Join-Path $LOGS ($name + '.log')
    $err  = Join-Path $LOGS ($name + '-err.log')
    $a    = @('-jar', $jar, "--server.port=$port",
              "--spring.datasource.url=$env:DB_URL",
              "--spring.datasource.username=$env:DB_USERNAME",
              "--spring.datasource.password=$env:DB_PASSWORD",
              "--academiax.jwt.secret=$env:JWT_SECRET",
              "--eureka.client.service-url.defaultZone=$env:EUREKA_SERVER_URL")
    if ($extras) { $a += $extras }
    $proc = Start-Process -FilePath $JAVA -ArgumentList $a -RedirectStandardOutput $log -RedirectStandardError $err -NoNewWindow -PassThru
    $proc.Id | Out-File (Join-Path $LOGS ($name + '.pid'))
    Write-Host ('  Started ' + $name + ' PID=' + $proc.Id + ' port=' + $port)
}

Write-Host 'Starting AcademiaX...' -ForegroundColor Cyan

$eurekaJar = Join-Path $BASE 'eureka-server\target\eureka-server-1.0.0.jar'
$eLog = Join-Path $LOGS 'eureka-server.log'
$eErr = Join-Path $LOGS 'eureka-server-err.log'
$ep = Start-Process -FilePath $JAVA -ArgumentList @('-jar', $eurekaJar) -RedirectStandardOutput $eLog -RedirectStandardError $eErr -NoNewWindow -PassThru
$ep.Id | Out-File (Join-Path $LOGS 'eureka-server.pid')
Write-Host ('  Eureka started PID=' + $ep.Id + ' — waiting 12s')
Start-Sleep 12

Run-Service 'auth-service'       (Join-Path $BASE 'auth-service\target\auth-service-1.0.0.jar')             8081 @('--academiax.seed-demo-data=true')
Run-Service 'course-service'     (Join-Path $BASE 'course-service\target\course-service-1.0.0.jar')         8082 $null
Run-Service 'enrollment-service' (Join-Path $BASE 'enrollment-service\target\enrollment-service-1.0.0.jar') 8083 $null
Run-Service 'payment-service'    (Join-Path $BASE 'payment-service\target\payment-service-1.0.0.jar')       8084 $null

$gwJar = Join-Path $BASE 'api-gateway\target\api-gateway-1.0.0.jar'
$gwLog = Join-Path $LOGS 'api-gateway.log'
$gwErr = Join-Path $LOGS 'api-gateway-err.log'
$gp = Start-Process -FilePath $JAVA -ArgumentList @('-jar', $gwJar, "--eureka.client.service-url.defaultZone=$env:EUREKA_SERVER_URL") -RedirectStandardOutput $gwLog -RedirectStandardError $gwErr -NoNewWindow -PassThru
$gp.Id | Out-File (Join-Path $LOGS 'api-gateway.pid')
Write-Host ('  API Gateway started PID=' + $gp.Id + ' port=8080')

Write-Host 'All services started!' -ForegroundColor Green
Write-Host 'Eureka: http://localhost:8761'
Write-Host 'Gateway: http://localhost:8080'
Write-Host 'Demo: student@academiax.edu / instructor@academiax.edu / admin@academiax.edu (pw: password123)'
Write-Host 'Stop: .\start-services.ps1 -Stop'
