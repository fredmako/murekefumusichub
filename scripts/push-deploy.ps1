param(
  [string[]]$FrontendRemotes = @("frontend"),
  [string]$FrontendBranch = "main",
  [string]$BackendDir = "server",
  [string[]]$BackendRemotes = @("backend"),
  [string]$BackendBranch = "main",
  [switch]$SkipDirtyCheck,
  [switch]$DryRun
)

$ErrorActionPreference = "Continue"

function Fail([string]$message) {
  Write-Host ""
  Write-Host "[push-deploy] $message" -ForegroundColor Red
  exit 1
}

function RunGit([string]$repoPath, [string[]]$gitArgs) {
  & git -c core.safecrlf=false -C $repoPath @gitArgs
  if ($LASTEXITCODE -ne 0) {
    Fail "git -C $repoPath $($gitArgs -join ' ') failed."
  }
}

function GetGitOutput([string]$repoPath, [string[]]$gitArgs) {
  $output = & git -c core.safecrlf=false -C $repoPath @gitArgs 2>$null
  if ($LASTEXITCODE -ne 0) {
    return $null
  }
  return $output
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$backendPath = Join-Path $repoRoot $BackendDir

$FrontendRemotes = @(
  $FrontendRemotes |
    ForEach-Object { $_ -split "," } |
    ForEach-Object { $_.Trim() } |
    Where-Object { $_ -ne "" }
)

$BackendRemotes = @(
  $BackendRemotes |
    ForEach-Object { $_ -split "," } |
    ForEach-Object { $_.Trim() } |
    Where-Object { $_ -ne "" }
)

if ($FrontendRemotes.Count -eq 0) {
  Fail "No frontend remotes were provided."
}

if ($BackendRemotes.Count -eq 0) {
  Fail "No backend remotes were provided."
}

if (-not (Test-Path $backendPath)) {
  Fail "Backend directory '$BackendDir' was not found at $backendPath."
}

if (-not (Test-Path (Join-Path $backendPath ".git"))) {
  Fail "Backend directory '$BackendDir' is not a git repository."
}

$resolvedFrontendRemotes = @()
foreach ($frontendRemote in $FrontendRemotes) {
  $frontendRemoteUrl = GetGitOutput $repoRoot @("remote", "get-url", $frontendRemote)
  if (-not $frontendRemoteUrl) {
    Fail "Frontend remote '$frontendRemote' is not configured in root repo."
  }
  $resolvedFrontendRemotes += [PSCustomObject]@{
    Name = $frontendRemote
    Url  = $frontendRemoteUrl
  }
}

$resolvedBackendRemotes = @()
foreach ($backendRemote in $BackendRemotes) {
  $backendRemoteUrl = GetGitOutput $backendPath @("remote", "get-url", $backendRemote)
  if (-not $backendRemoteUrl) {
    Fail "Backend remote '$backendRemote' is not configured in $BackendDir repo."
  }
  $resolvedBackendRemotes += [PSCustomObject]@{
    Name = $backendRemote
    Url  = $backendRemoteUrl
  }
}

$frontendConflicts = GetGitOutput $repoRoot @("diff", "--name-only", "--diff-filter=U")
if ($frontendConflicts -and $frontendConflicts.Count -gt 0) {
  Fail "Frontend repo has unresolved merge conflicts."
}

$backendConflicts = GetGitOutput $backendPath @("diff", "--name-only", "--diff-filter=U")
if ($backendConflicts -and $backendConflicts.Count -gt 0) {
  Fail "Backend repo has unresolved merge conflicts."
}

if (-not $SkipDirtyCheck) {
  $frontendDirty = GetGitOutput $repoRoot @("status", "--porcelain")
  if ($frontendDirty) {
    Fail "Frontend repo has uncommitted changes. Commit/stash first or use -SkipDirtyCheck."
  }

  $backendDirty = GetGitOutput $backendPath @("status", "--porcelain")
  if ($backendDirty) {
    Fail "Backend repo has uncommitted changes. Commit/stash first or use -SkipDirtyCheck."
  }
}

$frontendRef = "HEAD:$FrontendBranch"
$backendRef = "HEAD:$BackendBranch"

Write-Host "[push-deploy] Frontend target branch: $FrontendBranch"
Write-Host "[push-deploy] Backend target branch:  $BackendBranch"
foreach ($target in $resolvedFrontendRemotes) {
  Write-Host "[push-deploy] Frontend remote: $($target.Name) -> $($target.Url)"
}
foreach ($target in $resolvedBackendRemotes) {
  Write-Host "[push-deploy] Backend remote:  $($target.Name) -> $($target.Url)"
}

if ($DryRun) {
  Write-Host "[push-deploy] DRY RUN mode enabled. No push was executed." -ForegroundColor Yellow
  foreach ($target in $resolvedFrontendRemotes) {
    Write-Host "[push-deploy] Would run: git -C $repoRoot push $($target.Name) $frontendRef"
  }
  foreach ($target in $resolvedBackendRemotes) {
    Write-Host "[push-deploy] Would run: git -C $backendPath push $($target.Name) $backendRef"
  }
  exit 0
}

foreach ($target in $resolvedFrontendRemotes) {
  Write-Host "[push-deploy] Pushing frontend -> $($target.Name)..."
  RunGit $repoRoot @("push", $target.Name, $frontendRef)
}

foreach ($target in $resolvedBackendRemotes) {
  Write-Host "[push-deploy] Pushing backend -> $($target.Name)..."
  RunGit $backendPath @("push", $target.Name, $backendRef)
}

Write-Host "[push-deploy] Completed successfully." -ForegroundColor Green
