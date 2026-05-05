# Deploy Complete Podcast Chunks Edge Function
# Run this script from the repository root

Write-Host "🎙️  Deploying Complete Podcast Chunks Edge Function" -ForegroundColor Cyan
Write-Host ""

# Check if Supabase CLI is installed
Write-Host "Checking Supabase CLI..." -ForegroundColor Yellow
if (!(Get-Command supabase -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Supabase CLI not found!" -ForegroundColor Red
    Write-Host "Install it with: npm install -g supabase" -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ Supabase CLI found" -ForegroundColor Green
Write-Host ""

# Deploy the function
Write-Host "Deploying complete-podcast-chunks function..." -ForegroundColor Yellow
supabase functions deploy complete-podcast-chunks --no-verify-jwt

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Deployment successful! The complete-podcast-chunks function is live." -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "❌ Deployment failed." -ForegroundColor Red
    exit 1
}
