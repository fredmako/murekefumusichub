param(
  [string]$FrontendRemote = "frontend",
  [string]$FrontendBranch = "main",
  [string]$BackendDir = "server",
  [string]$BackendRemote = "backend",
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

if (-not (Test-Path $backendPath)) {
  Fail "Backend directory '$BackendDir' was not found at $backendPath."
}

if (-not (Test-Path (Join-Path $backendPath ".git"))) {
  Fail "Backend directory '$BackendDir' is not a git repository."
}

$frontendRemoteUrl = GetGitOutput $repoRoot @("remote", "get-url", $FrontendRemote)
if (-not $frontendRemoteUrl) {
  Fail "Frontend remote '$FrontendRemote' is not configured in root repo."
}

$backendRemoteUrl = GetGitOutput $backendPath @("remote", "get-url", $BackendRemote)
if (-not $backendRemoteUrl) {
  Fail "Backend remote '$BackendRemote' is not configured in $BackendDir repo."
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

Write-Host "[push-deploy] Frontend remote: $FrontendRemote -> $frontendRemoteUrl"
Write-Host "[push-deploy] Backend remote:  $BackendRemote -> $backendRemoteUrl"

if ($DryRun) {
  Write-Host "[push-deploy] DRY RUN mode enabled. No push was executed." -ForegroundColor Yellow
  Write-Host "[push-deploy] Would run: git -C $repoRoot push $FrontendRemote $frontendRef"
  Write-Host "[push-deploy] Would run: git -C $backendPath push $BackendRemote $backendRef"
  exit 0
}

Write-Host "[push-deploy] Pushing frontend..."
RunGit $repoRoot @("push", $FrontendRemote, $frontendRef)

Write-Host "[push-deploy] Pushing backend..."
RunGit $backendPath @("push", $BackendRemote, $backendRef)

Write-Host "[push-deploy] Completed successfully." -ForegroundColor Green
