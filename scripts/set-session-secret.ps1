# Generates a random SESSION_SECRET on this machine and stores it in the Vercel
# project's Production environment. The value is never printed or saved to disk.
#
# Usage (PowerShell 5.1 or 7, needs the Vercel CLI logged in to the owning account):
#   powershell -ExecutionPolicy Bypass -File scripts\set-session-secret.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\set-session-secret.ps1 -IncludePreview
#
# After it succeeds, redeploy Production so the new variable takes effect.

param(
  [string]$Scope = 'vetko-9084s-projects',
  [string]$Project = 'pos',
  [switch]$IncludePreview
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) {
  Write-Host 'FAIL vercel CLI not found. Install it with: npm i -g vercel'
  exit 1
}

# A throwaway folder linked to the project, so this works from any directory.
$linkDir = Join-Path ([System.IO.Path]::GetTempPath()) ("pos-session-secret-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $linkDir | Out-Null

try {
  Push-Location $linkDir
  vercel link --yes --project $Project --scope $Scope | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "vercel link failed for $Scope/$Project" }

  $environments = @('production')
  if ($IncludePreview) { $environments += 'preview' }

  $existing = (vercel env ls --scope $Scope 2>$null) -join "`n"
  foreach ($environment in $environments) {
    if ($existing -match "(?m)^\s*SESSION_SECRET\s.*\b$environment\b") {
      Write-Host "WARN SESSION_SECRET already exists for $environment; left unchanged. Remove it in the dashboard first to rotate."
      continue
    }

    # 48 random bytes -> 64 base64 characters, well above the 32-character minimum.
    $bytes = New-Object byte[] 48
    $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $generator.GetBytes($bytes)
    $generator.Dispose()
    $secret = [Convert]::ToBase64String($bytes)

    $secret | vercel env add SESSION_SECRET $environment --scope $Scope | Out-Null
    $exitCode = $LASTEXITCODE
    $secret = $null
    [Array]::Clear($bytes, 0, $bytes.Length)
    if ($exitCode -ne 0) { throw "vercel env add failed for $environment" }
    Write-Host "PASS SESSION_SECRET added to $environment"
  }

  $after = (vercel env ls --scope $Scope 2>$null) -join "`n"
  if ($after -match '(?m)^\s*SESSION_SECRET\s') {
    Write-Host 'PASS vercel env ls shows SESSION_SECRET (value hidden). Redeploy Production to apply it.'
  } else {
    Write-Host 'FAIL SESSION_SECRET is not listed by vercel env ls'
    exit 1
  }
}
finally {
  Pop-Location
  Remove-Item -Recurse -Force $linkDir -ErrorAction SilentlyContinue
}
