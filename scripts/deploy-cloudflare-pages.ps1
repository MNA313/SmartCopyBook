# Upload the built site to Cloudflare Pages from your PC (no Git integration).
# Prerequisites: Node.js, Cloudflare account (free).
#
# First time only — log in (opens the browser):
#   npx wrangler login
#
# Run from project root:
#   .\scripts\deploy-cloudflare-pages.ps1
# Or with your project name (must match an existing Pages project OR a new name to create):
#   .\scripts\deploy-cloudflare-pages.ps1 -ProjectName "smart0001"

param(
  [string] $ProjectName = "smartcopybook-live"
)

$ErrorActionPreference = "Stop"
if (-not $PSScriptRoot) {
  Write-Host "Run this script as: .\scripts\deploy-cloudflare-pages.ps1" -ForegroundColor Red
  exit 1
}
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host ">> Project root: $root" -ForegroundColor DarkGray
Write-Host ">> Building (npm run build)..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ">> Ensuring Pages project exists: $ProjectName" -ForegroundColor Cyan
Write-Host "   (If it already exists, the next line may show an error — that is OK.)" -ForegroundColor DarkGray
$ErrorActionPreference = "Continue"
npx wrangler pages project create $ProjectName --production-branch=main 2>&1 | ForEach-Object { Write-Host $_ }
$ErrorActionPreference = "Stop"
if ($LASTEXITCODE -ne 0) {
  Write-Host "   (Project create skipped or failed — will still try deploy if project exists.)" -ForegroundColor Yellow
}

Write-Host ">> Uploading dist/ to Cloudflare Pages..." -ForegroundColor Cyan
Write-Host "   Not logged in? Run: npx wrangler login" -ForegroundColor Yellow
npx wrangler pages deploy dist --project-name=$ProjectName
$deployExit = $LASTEXITCODE
if ($deployExit -ne 0) {
  Write-Host ""
  Write-Host "If you saw 'Project not found', pick a name you already use in Cloudflare:" -ForegroundColor Yellow
  Write-Host "  .\scripts\deploy-cloudflare-pages.ps1 -ProjectName `"smart0001`"" -ForegroundColor White
  Write-Host "Or list projects: npx wrangler pages project list" -ForegroundColor White
}
exit $deployExit
