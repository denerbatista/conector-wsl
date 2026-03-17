param(
  [Parameter(Mandatory = $true)]
  [string]$DistroName,

  [Parameter(Mandatory = $true)]
  [string]$LinuxProjectPath,

  [string]$DefaultCwd,
  [string]$AllowedRoots,
  [string]$ServerName = "wsl-workspace-direct",
  [int]$TimeoutMs = 120000
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-ClaudeConfigPath {
  $candidates = @(
    (Join-Path $env:LOCALAPPDATA "Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\claude_desktop_config.json"),
    (Join-Path $env:APPDATA "Claude\claude_desktop_config.json")
  )

  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) {
      return $candidate
    }
  }

  $directory = Split-Path $candidates[0] -Parent
  New-Item -ItemType Directory -Force -Path $directory | Out-Null
  return $candidates[0]
}

function Get-WslHomeFromPath {
  param([string]$PathValue)

  if ($PathValue -match '^(/home/[^/]+)') {
    return $Matches[1]
  }

  return $null
}

function Escape-BashSingleQuoted {
  param([string]$Value)

  return $Value.Replace("'", "'\"'\"'")
}

function Ensure-Property {
  param(
    [object]$Object,
    [string]$Name,
    [object]$Value
  )

  if ($null -eq $Object.PSObject.Properties[$Name]) {
    $Object | Add-Member -NotePropertyName $Name -NotePropertyValue $Value
  }
}

$wslHome = Get-WslHomeFromPath -PathValue $LinuxProjectPath

if (-not $DefaultCwd) {
  if ($wslHome) {
    $DefaultCwd = $wslHome
  } else {
    $DefaultCwd = $LinuxProjectPath
  }
}

if (-not $AllowedRoots) {
  if ($wslHome) {
    $AllowedRoots = "$wslHome:/mnt/c/Users/$env:USERNAME"
  } else {
    $AllowedRoots = $DefaultCwd
  }
}

$serverPath = "$LinuxProjectPath/server/index.js"
$escapedServerPath = Escape-BashSingleQuoted -Value $serverPath

& wsl.exe -d $DistroName -- bash -lc "test -f '$escapedServerPath'"
if ($LASTEXITCODE -ne 0) {
  throw "Nao encontrei $serverPath dentro da distro $DistroName."
}

$configPath = Get-ClaudeConfigPath

if (Test-Path $configPath) {
  $rawConfig = Get-Content -Raw $configPath
  if ([string]::IsNullOrWhiteSpace($rawConfig)) {
    $config = [pscustomobject]@{}
  } else {
    $config = $rawConfig | ConvertFrom-Json
  }
} else {
  $config = [pscustomobject]@{}
}

Ensure-Property -Object $config -Name "mcpServers" -Value ([pscustomobject]@{})

$serverConfig = [pscustomobject]@{
  command = "C:\Windows\System32\wsl.exe"
  args = @(
    "-d",
    $DistroName,
    "--",
    "node",
    $serverPath
  )
  env = [pscustomobject]@{
    WSL_CONNECTOR_DEFAULT_CWD = $DefaultCwd
    WSL_CONNECTOR_ALLOWED_ROOTS = $AllowedRoots
    WSL_CONNECTOR_DISTRO = $DistroName
    WSL_CONNECTOR_TIMEOUT_MS = $TimeoutMs.ToString()
  }
}

$config.mcpServers | Add-Member -NotePropertyName $ServerName -NotePropertyValue $serverConfig -Force

$backupPath = "$configPath.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
if (Test-Path $configPath) {
  Copy-Item $configPath $backupPath -Force
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText(
  $configPath,
  ($config | ConvertTo-Json -Depth 20),
  $utf8NoBom
)

Write-Host "Config atualizado com sucesso."
Write-Host "Arquivo:" $configPath
Write-Host "Backup:" $backupPath
Write-Host "Servidor MCP:" $ServerName
Write-Host "Distro:" $DistroName
Write-Host "Projeto WSL:" $LinuxProjectPath
Write-Host "Default CWD:" $DefaultCwd
Write-Host "Allowed Roots:" $AllowedRoots
Write-Host ""
Write-Host "Feche e abra o Claude para carregar o conector."
