# Generates a random SESSION_SECRET on this machine and stores it in the Vercel
# project's Production environment. The value is never printed or saved to disk.
#
# Usage (PowerShell 5.1 or 7, needs the Vercel CLI logged in to the owning account):
#   powershell -ExecutionPolicy Bypass -File scripts\set-session-secret.ps1
#
# Preview deployments are not covered; add the variable for Preview in the dashboard if needed.
# After it succeeds, redeploy Production so the new variable takes effect.

param(
  [string]$Scope = 'vetko-9084s-projects',
  [string]$Project = 'pos'
)

# The Vercel CLI writes progress to stderr; success is judged by $LASTEXITCODE only.
$ErrorActionPreference = 'Continue'

if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) {
  Write-Host 'FAIL vercel CLI not found. Install it with: npm i -g vercel'
  exit 1
}

function Set-SessionSecret {
  # A throwaway folder linked to the project, so this works from any directory.
  $linkDir = Join-Path ([System.IO.Path]::GetTempPath()) ("pos-session-secret-" + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $linkDir | Out-Null

  try {
    Push-Location $linkDir
    vercel link --yes --project $Project --scope $Scope *> $null
    if ($LASTEXITCODE -ne 0) {
      Write-Host "FAIL vercel link failed for $Scope/$Project"
      return 1
    }

    $existing = (vercel env ls production --scope $Scope 2> $null) -join "`n"
    if ($LASTEXITCODE -ne 0) {
      Write-Host 'FAIL vercel env ls failed'
      return 1
    }
    if ($existing -match '(?m)^\s*SESSION_SECRET\s') {
      Write-Host 'WARN SESSION_SECRET already exists for production; left unchanged. Remove it in the dashboard first to rotate.'
      return 0
    }

    # 48 random bytes -> 64 base64 characters, well above the 32-character minimum.
    $bytes = New-Object byte[] 48
    $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $generator.GetBytes($bytes)
    $generator.Dispose()
    $secret = [Convert]::ToBase64String($bytes)
    [Array]::Clear($bytes, 0, $bytes.Length)

    $secret | vercel env add SESSION_SECRET production --scope $Scope *> $null
    $addExitCode = $LASTEXITCODE
    $secret = $null
    if ($addExitCode -ne 0) {
      Write-Host 'FAIL vercel env add failed for production'
      return 1
    }

    $after = (vercel env ls production --scope $Scope 2> $null) -join "`n"
    if ($after -match '(?m)^\s*SESSION_SECRET\s') {
      Write-Host 'PASS SESSION_SECRET is set for production (value hidden). Redeploy Production to apply it.'
      return 0
    } else {
      Write-Host 'FAIL SESSION_SECRET is not listed by vercel env ls production'
      return 1
    }
  }
  finally {
    Pop-Location
    Remove-Item -Recurse -Force $linkDir -ErrorAction SilentlyContinue
  }
}

exit (Set-SessionSecret)
