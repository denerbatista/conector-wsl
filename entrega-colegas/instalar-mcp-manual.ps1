param(
  [Parameter(Mandatory = $true)][string]$DistroName,
  [Parameter(Mandatory = $true)][string]$LinuxProjectPath,
  [string]$DefaultCwd,
  [string]$AllowedRoots,
  [string]$ServerName = "wsl-workspace-direct",
  [int]$TimeoutMs = 120000
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-ConfigPath {
  $a = Join-Path $env:LOCALAPPDATA "Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\claude_desktop_config.json"
  $b = Join-Path $env:APPDATA "Claude\claude_desktop_config.json"
  if (Test-Path $a) { return $a }
  if (Test-Path $b) { return $b }
  New-Item -ItemType Directory -Force -Path (Split-Path $a -Parent) | Out-Null
  return $a
}

function Wsl-Bash([string]$d, [string]$cmd) {
  $out = & wsl.exe -d $d -- bash -lc $cmd 2>&1
  return [pscustomobject]@{ Code = $LASTEXITCODE; Out = ($out -join "`n").Trim() }
}

# Defaults inteligentes
if (-not $DefaultCwd -and $LinuxProjectPath -match '^(/home/[^/]+)') { $DefaultCwd = $Matches[1] }
if (-not $DefaultCwd) { $DefaultCwd = $LinuxProjectPath }
if (-not $AllowedRoots) { $AllowedRoots = "$DefaultCwd:/mnt/c/Users/$env:USERNAME" }

$serverPath = "$LinuxProjectPath/server/index.js"

# 1. Garante server/index.js
$check = Wsl-Bash $DistroName "test -f '$serverPath' && echo OK"
if ($check.Out -ne "OK") { throw "Nao encontrei $serverPath em '$DistroName'. Clone/copie o projeto pro WSL." }

# 2. Garante Node >= 20 (roda setup-wsl.sh se faltar)
$node = Wsl-Bash $DistroName "node -v 2>/dev/null || echo NONE"
$major = if ($node.Out -match '^v?(\d+)') { [int]$Matches[1] } else { 0 }

if ($major -lt 20) {
  Write-Host "[setup] Node ausente/desatualizado. Rodando setup-wsl.sh..."
  & wsl.exe -d $DistroName -- bash -lc "bash '$LinuxProjectPath/entrega-colegas/setup-wsl.sh'"
  if ($LASTEXITCODE -ne 0) { throw "setup-wsl.sh falhou. Rode manualmente dentro do WSL." }
  $node = Wsl-Bash $DistroName "node -v"
  Write-Host "[ok] Node agora: $($node.Out)"
} else {
  Write-Host "[ok] Node $($node.Out) detectado."
}

# 3. Garante node_modules
$dep = Wsl-Bash $DistroName "test -d '$LinuxProjectPath/node_modules' && echo OK || echo MISSING"
if ($dep.Out -eq "MISSING") {
  Write-Host "[setup] Instalando dependencias..."
  & wsl.exe -d $DistroName -- bash -lc "cd '$LinuxProjectPath' && npm install --no-audit --no-fund"
  if ($LASTEXITCODE -ne 0) { throw "npm install falhou." }
}

# 4. Atualiza claude_desktop_config.json
$configPath = Get-ConfigPath
$config = if (Test-Path $configPath) {
  $raw = Get-Content -Raw $configPath
  if ([string]::IsNullOrWhiteSpace($raw)) { [pscustomobject]@{} } else { $raw | ConvertFrom-Json }
} else { [pscustomobject]@{} }

if ($null -eq $config.PSObject.Properties["mcpServers"]) {
  $config | Add-Member -NotePropertyName "mcpServers" -NotePropertyValue ([pscustomobject]@{})
}

$serverConfig = [pscustomobject]@{
  command = "C:\Windows\System32\wsl.exe"
  args    = @("-d", $DistroName, "--", "bash", "-lc", "node '$serverPath'")
  env     = [pscustomobject]@{
    WSL_CONNECTOR_DEFAULT_CWD   = $DefaultCwd
    WSL_CONNECTOR_ALLOWED_ROOTS = $AllowedRoots
    WSL_CONNECTOR_DISTRO        = $DistroName
    WSL_CONNECTOR_TIMEOUT_MS    = $TimeoutMs.ToString()
  }
}

$config.mcpServers | Add-Member -NotePropertyName $ServerName -NotePropertyValue $serverConfig -Force

if (Test-Path $configPath) {
  Copy-Item $configPath "$configPath.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss').json" -Force
}

[System.IO.File]::WriteAllText(
  $configPath,
  ($config | ConvertTo-Json -Depth 20),
  (New-Object System.Text.UTF8Encoding($false))
)

Write-Host ""
Write-Host "OK. Conector registrado em $configPath" -ForegroundColor Green
Write-Host "Distro: $DistroName | Projeto: $LinuxProjectPath"
Write-Host "Reinicie o Claude Desktop."
