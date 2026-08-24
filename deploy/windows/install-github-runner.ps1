[CmdletBinding()]
param(
  [string]$RepositoryUrl = 'https://github.com/YarProgram05/NimbaOS',
  [string]$RunnerRoot = 'C:\NimbaOS\actions-runner',
  [string]$RunnerName = 'nimbaos-mini-pc',
  [string]$RunnerLabels = 'nimbaos-production'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$registrationToken = $env:GITHUB_RUNNER_REGISTRATION_TOKEN
if (-not $registrationToken) {
  throw 'GITHUB_RUNNER_REGISTRATION_TOKEN is not set.'
}

New-Item -ItemType Directory -Path $RunnerRoot -Force | Out-Null
$configuredMarker = Join-Path $RunnerRoot '.runner'

if (-not (Test-Path -LiteralPath $configuredMarker -PathType Leaf)) {
  $release = Invoke-RestMethod `
    -Uri 'https://api.github.com/repos/actions/runner/releases/latest' `
    -Headers @{ 'User-Agent' = 'NimbaOS-runner-installer' }
  $asset = $release.assets |
    Where-Object { $_.name -match '^actions-runner-win-x64-.*\.zip$' } |
    Select-Object -First 1
  if (-not $asset) {
    throw 'Could not find the latest Windows x64 GitHub Actions runner package.'
  }

  $zipPath = Join-Path $env:TEMP $asset.name
  Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $zipPath -UseBasicParsing
  Expand-Archive -LiteralPath $zipPath -DestinationPath $RunnerRoot -Force
  Remove-Item -LiteralPath $zipPath -Force

  Push-Location $RunnerRoot
  try {
    & .\config.cmd `
      --unattended `
      --replace `
      --url $RepositoryUrl `
      --token $registrationToken `
      --name $RunnerName `
      --labels $RunnerLabels `
      --work '_work'
    if ($LASTEXITCODE -ne 0) {
      throw "GitHub runner configuration failed with code $LASTEXITCODE."
    }
  }
  finally {
    Pop-Location
  }
}

$launcherPath = Join-Path $RunnerRoot 'run-nimbaos-runner.ps1'
@"
Set-Location -LiteralPath '$RunnerRoot'
& '.\run.cmd'
exit `$LASTEXITCODE
"@ | Set-Content -LiteralPath $launcherPath -Encoding UTF8

$taskName = 'NimbaOS GitHub Deploy Runner'
$userId = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$action = New-ScheduledTaskAction `
  -Execute 'powershell.exe' `
  -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$launcherPath`"" `
  -WorkingDirectory $RunnerRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $userId
$principal = New-ScheduledTaskPrincipal `
  -UserId $userId `
  -LogonType Interactive `
  -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -RestartCount 999 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit ([TimeSpan]::Zero)

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Principal $principal `
  -Settings $settings `
  -Description 'Runs the dedicated NimbaOS production GitHub Actions runner.' `
  -Force | Out-Null

Start-ScheduledTask -TaskName $taskName
Write-Host "GitHub runner task is configured: $taskName"
