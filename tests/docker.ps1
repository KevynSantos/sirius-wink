$ErrorActionPreference = 'Stop'
$previousUrl = $env:TEST_URL
$testContainer = "sirius-wink-tests-$PID"
$created = $false
Push-Location (Split-Path $PSScriptRoot -Parent)
try {
    docker compose build
    if ($LASTEXITCODE -ne 0) { throw 'Falha no build Docker.' }
    docker run --rm -d --name $testContainer -p '127.0.0.1:18081:80' --tmpfs '/var/www/data:uid=33,gid=33,mode=0700' sirius-wink-app
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao iniciar a instância de teste.' }
    $created = $true
    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        try {
            $health = Invoke-RestMethod 'http://127.0.0.1:18081/api/health' -TimeoutSec 2
            if ($health.status -eq 'ok') { $ready = $true; break }
        } catch { Start-Sleep -Seconds 1 }
    }
    if (-not $ready) { throw 'A API de teste não ficou disponível.' }
    $env:TEST_URL = 'http://127.0.0.1:18081'
    node tests/api.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Falha nos testes da API.' }
} finally {
    if ($created) { docker rm -f $testContainer 2>$null | Out-Null }
    $env:TEST_URL = $previousUrl
    Pop-Location
}
