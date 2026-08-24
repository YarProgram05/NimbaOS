[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[0-9a-fA-F]{40}$')]
  [string]$CommitSha,

  [string]$RepositoryPath = 'C:\NimbaOS\nimba',
  [string]$BackupPath = 'C:\NimbaOS\backups'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Write-Step {
  param([string]$Message)
  Write-Host "`n==> $Message"
}

function Invoke-Native {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [Parameter(Mandatory = $true)][string[]]$CommandArgs
  )

  & $FilePath @CommandArgs
  if ($LASTEXITCODE -ne 0) {
    throw "$FilePath exited with code $LASTEXITCODE"
  }
}

function Invoke-NativeCapture {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [Parameter(Mandatory = $true)][string[]]$CommandArgs
  )

  $output = @(& $FilePath @CommandArgs)
  if ($LASTEXITCODE -ne 0) {
    throw "$FilePath exited with code $LASTEXITCODE"
  }

  return [string]::Join("`n", $output).Trim()
}

$mutex = New-Object System.Threading.Mutex($false, 'NimbaOSProductionDeploy')
$mutexAcquired = $false
$locationPushed = $false
$previousCommit = $null
$previousAppImageId = $null
$rollbackImageTag = $null
$checkoutChanged = $false
$migrationStarted = $false

try {
  $mutexAcquired = $mutex.WaitOne(0)
  if (-not $mutexAcquired) {
    throw 'Another NimbaOS production deployment is already running.'
  }

  if (-not (Test-Path -LiteralPath $RepositoryPath -PathType Container)) {
    throw "Repository path does not exist: $RepositoryPath"
  }

  $envFile = Join-Path $RepositoryPath '.env.production'
  $composeFile = Join-Path $RepositoryPath 'docker-compose.prod.yml'
  if (-not (Test-Path -LiteralPath $envFile -PathType Leaf)) {
    throw "Production environment file is missing: $envFile"
  }
  if (-not (Test-Path -LiteralPath $composeFile -PathType Leaf)) {
    throw "Production Compose file is missing: $composeFile"
  }

  $dockerConfigPath = 'C:\ProgramData\NimbaOS\docker-cli'
  New-Item -ItemType Directory -Path $dockerConfigPath -Force | Out-Null
  $dockerConfigFile = Join-Path $dockerConfigPath 'config.json'
  if (-not (Test-Path -LiteralPath $dockerConfigFile -PathType Leaf)) {
    Set-Content -LiteralPath $dockerConfigFile -Value '{}' -Encoding Ascii
  }
  $env:DOCKER_CONFIG = $dockerConfigPath

  Push-Location $RepositoryPath
  $locationPushed = $true

  Write-Step 'Checking repository and Docker Desktop'
  Invoke-Native 'git' @('rev-parse', '--is-inside-work-tree')
  $trackedChanges = Invoke-NativeCapture 'git' @('status', '--porcelain', '--untracked-files=no')
  if ($trackedChanges) {
    throw 'Production checkout has tracked local changes. Deployment stopped without modifying them.'
  }

  Invoke-Native 'docker' @('version')
  $previousCommit = Invoke-NativeCapture 'git' @('rev-parse', 'HEAD')

  $baseComposeArgs = @(
    'compose',
    '--env-file', $envFile,
    '-f', $composeFile
  )

  $previousAppContainer = Invoke-NativeCapture 'docker' ($baseComposeArgs + @('ps', '-q', 'app'))
  if ($previousAppContainer) {
    $previousAppImageId = Invoke-NativeCapture 'docker' @(
      'inspect',
      '--format', '{{.Image}}',
      $previousAppContainer
    )
    $rollbackImageTag = "rollback-$((Get-Date).ToUniversalTime().ToString('yyyyMMddHHmmss'))"
    Invoke-Native 'docker' @('image', 'tag', $previousAppImageId, "nimba-app:$rollbackImageTag")
  }

  Write-Step 'Fetching and validating the requested main commit'
  Invoke-Native 'git' @('fetch', '--prune', 'origin', 'main')
  Invoke-Native 'git' @('cat-file', '-e', "$CommitSha`^{commit}")
  & git merge-base --is-ancestor $CommitSha origin/main
  if ($LASTEXITCODE -ne 0) {
    throw 'Requested commit is not contained in origin/main.'
  }

  Invoke-Native 'git' @('checkout', '--detach', $CommitSha)
  $checkoutChanged = $true

  $shortCommit = $CommitSha.Substring(0, 12).ToLowerInvariant()
  $env:NIMBA_IMAGE_TAG = $shortCommit
  $baseComposeArgs = @(
    'compose',
    '--env-file', $envFile,
    '-f', $composeFile
  )

  Write-Step "Validating Compose configuration for $shortCommit"
  Invoke-Native 'docker' ($baseComposeArgs + @('config', '--quiet'))

  Write-Step 'Building the versioned application image while the old app remains online'
  Invoke-Native 'docker' ($baseComposeArgs + @('build', 'app'))

  Write-Step 'Creating and validating a PostgreSQL backup'
  New-Item -ItemType Directory -Path $BackupPath -Force | Out-Null
  $postgresContainer = Invoke-NativeCapture 'docker' ($baseComposeArgs + @('ps', '-q', 'postgres'))
  if (-not $postgresContainer) {
    throw 'PostgreSQL container is not running.'
  }

  $timestamp = (Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmmss')
  $containerBackup = "/tmp/nimba-predeploy-$timestamp.dump"
  $backupFile = Join-Path $BackupPath "nimba-production-$timestamp-$shortCommit.dump"
  Invoke-Native 'docker' @(
    'exec', $postgresContainer,
    'sh', '-lc',
    'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f ' + $containerBackup
  )
  Invoke-Native 'docker' @('exec', $postgresContainer, 'pg_restore', '-l', $containerBackup)
  Invoke-Native 'docker' @('cp', "${postgresContainer}:$containerBackup", $backupFile)
  Invoke-Native 'docker' @('exec', $postgresContainer, 'rm', '-f', $containerBackup)

  $backupInfo = Get-Item -LiteralPath $backupFile
  if ($backupInfo.Length -lt 1024) {
    throw "Backup validation failed: $backupFile"
  }
  $backupHash = (Get-FileHash -LiteralPath $backupFile -Algorithm SHA256).Hash
  Write-Host "Backup ready: $backupFile ($($backupInfo.Length) bytes, SHA256 $backupHash)"

  Write-Step 'Applying committed Prisma migrations'
  $migrationStarted = $true
  Invoke-Native 'docker' ($baseComposeArgs + @(
    '--profile', 'migrate',
    'run', '--rm', 'migrate'
  ))

  Write-Step 'Updating the application and both workers'
  Invoke-Native 'docker' ($baseComposeArgs + @(
    'up', '-d', '--no-build', '--remove-orphans',
    'app', 'worker', 'automation-worker'
  ))

  Write-Step 'Re-applying database-backed schedules'
  Invoke-Native 'docker' ($baseComposeArgs + @(
    '--profile', 'scheduler',
    'run', '--rm', 'scheduler'
  ))
  Invoke-Native 'docker' ($baseComposeArgs + @(
    '--profile', 'scheduler',
    'run', '--rm', 'automation-scheduler'
  ))

  Write-Step 'Waiting for the application health endpoint'
  $healthy = $false
  for ($attempt = 1; $attempt -le 36; $attempt++) {
    try {
      $response = Invoke-WebRequest `
        -Uri 'http://127.0.0.1:3000/api/health' `
        -UseBasicParsing `
        -TimeoutSec 5
      $payload = $response.Content | ConvertFrom-Json
      if ($response.StatusCode -eq 200 -and $payload.ok -eq $true) {
        $healthy = $true
        break
      }
    }
    catch {
      Write-Host "Health attempt $attempt/36 is not ready yet."
    }
    Start-Sleep -Seconds 5
  }
  if (-not $healthy) {
    throw 'Application did not become healthy within three minutes.'
  }

  foreach ($service in @('app', 'worker', 'automation-worker', 'postgres', 'redis')) {
    $containerId = Invoke-NativeCapture 'docker' ($baseComposeArgs + @('ps', '-q', $service))
    if (-not $containerId) {
      throw "Service has no container: $service"
    }
    $isRunning = Invoke-NativeCapture 'docker' @(
      'inspect',
      '--format', '{{.State.Running}}',
      $containerId
    )
    if ($isRunning -ne 'true') {
      throw "Service is not running: $service"
    }
  }

  $statePath = 'C:\ProgramData\NimbaOS\deployments'
  New-Item -ItemType Directory -Path $statePath -Force | Out-Null
  [ordered]@{
    commit = $CommitSha.ToLowerInvariant()
    deployedAtUtc = (Get-Date).ToUniversalTime().ToString('o')
    backupPath = $backupFile
    backupSha256 = $backupHash
  } | ConvertTo-Json | Set-Content `
    -LiteralPath (Join-Path $statePath 'last-successful.json') `
    -Encoding UTF8

  Write-Step "Deployment completed successfully: $CommitSha"
}
catch {
  $deploymentError = $_
  Write-Host "Deployment failed: $($deploymentError.Exception.Message)" -ForegroundColor Red

  if ($checkoutChanged -and $previousCommit) {
    Write-Host "Attempting application rollback to $previousCommit."
    try {
      Invoke-Native 'git' @('checkout', '--detach', $previousCommit)

      if ($previousAppImageId -and $rollbackImageTag) {
        $env:NIMBA_IMAGE_TAG = $rollbackImageTag
      }

      $rollbackEnvFile = Join-Path $RepositoryPath '.env.production'
      $rollbackComposeFile = Join-Path $RepositoryPath 'docker-compose.prod.yml'
      $rollbackComposeArgs = @(
        'compose',
        '--env-file', $rollbackEnvFile,
        '-f', $rollbackComposeFile
      )
      Invoke-Native 'docker' ($rollbackComposeArgs + @(
        'up', '-d', '--no-build',
        'app', 'worker', 'automation-worker'
      ))
      Write-Host 'Previous application image was restarted.'
    }
    catch {
      Write-Host "Automatic application rollback also failed: $($_.Exception.Message)" -ForegroundColor Red
    }
  }

  if ($migrationStarted) {
    Write-Warning 'A migration was attempted. The database was not automatically restored; use the validated backup for controlled recovery if needed.'
  }
  throw $deploymentError
}
finally {
  if ($locationPushed) {
    Pop-Location
  }
  if ($mutexAcquired) {
    $mutex.ReleaseMutex()
  }
  $mutex.Dispose()
}
