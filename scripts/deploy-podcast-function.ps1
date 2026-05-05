# Deploy Podcast Transcription Edge Function
# Run this script from the repository root

Write-Host "🎙️  Deploying Podcast Transcription Edge Function" -ForegroundColor Cyan
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

# Check if logged in
Write-Host "Checking Supabase login status..." -ForegroundColor Yellow
$loginCheck = supabase projects list 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Not logged in to Supabase!" -ForegroundColor Red
    Write-Host "Login with: supabase login" -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ Logged in to Supabase" -ForegroundColor Green
Write-Host ""

# Ask for Gemini API key
Write-Host "Setting up environment variables..." -ForegroundColor Yellow
$geminiKey = Read-Host "Enter your Gemini API Key (or press Enter to skip if already set)"

if ($geminiKey) {
    Write-Host "Setting GEMINI_API_KEY secret..." -ForegroundColor Yellow
    supabase secrets set GEMINI_API_KEY=$geminiKey
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ GEMINI_API_KEY set successfully" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to set GEMINI_API_KEY" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "⚠️  Skipping GEMINI_API_KEY setup (assuming already configured)" -ForegroundColor Yellow
}
Write-Host ""

# Deploy the function
Write-Host "Deploying podcast-transcribe function..." -ForegroundColor Yellow
supabase functions deploy podcast-transcribe

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Deployment successful!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Test your live podcast feature in the app" -ForegroundColor White
    Write-Host "2. Check function logs: supabase functions logs podcast-transcribe" -ForegroundColor White
    Write-Host "3. Monitor transcriptions in the browser console" -ForegroundColor White
    Write-Host ""
    Write-Host "Your podcast transcription is ready!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "Deployment failed!" -ForegroundColor Red
    Write-Host "Check the error messages above for details." -ForegroundColor Yellow
    exit 1
}
