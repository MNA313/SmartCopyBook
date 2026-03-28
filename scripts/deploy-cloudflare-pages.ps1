# Upload the built site to Cloudflare Pages from your PC (no Git integration, no "deploy command" in the dashboard).
# Prerequisites: Node.js installed, Cloudflare account (free).
#
# First time only — log in (opens the browser):
#   npx wrangler login
#
# Then run (from project root in PowerShell):
#   .\scripts\deploy-cloudflare-pages.ps1
# Or with your own project name (letters, numbers, hyphens):
#   .\scripts\deploy-cloudflare-pages.ps1 -ProjectName "my-notes-app"
#
# If Wrangler says the project does not exist, it can create it — follow the prompts.

param(
  [string] $ProjectName = "smartcopybook-live"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

Write-Host ">> Building (npm run build)..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ">> Uploading dist/ to Cloudflare Pages (project: $ProjectName)..." -ForegroundColor Cyan
Write-Host "   If this fails with 'not logged in', run: npx wrangler login" -ForegroundColor Yellow
npx wrangler pages deploy dist --project-name=$ProjectName
exit $LASTEXITCODE
