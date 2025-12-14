# VAPID Keys Setup Script for Windows PowerShell
# This script helps you set up VAPID keys for push notifications

Write-Host "🔔 VAPID Keys Setup for Push Notifications" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env.local exists
$envFile = ".env.local"
$envExists = Test-Path $envFile

if (-not $envExists) {
    Write-Host "⚠️  .env.local not found. Creating from .env.example..." -ForegroundColor Yellow
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" $envFile
        Write-Host "✅ Created .env.local" -ForegroundColor Green
    } else {
        Write-Host "❌ .env.example not found. Creating new .env.local..." -ForegroundColor Red
        New-Item -Path $envFile -ItemType File | Out-Null
    }
}

Write-Host ""
Write-Host "Step 1: Generate VAPID Keys" -ForegroundColor Yellow
Write-Host "----------------------------" -ForegroundColor Yellow
Write-Host ""
Write-Host "Generating VAPID keys using web-push..." -ForegroundColor White

try {
    $vapidOutput = npx web-push generate-vapid-keys 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host $vapidOutput -ForegroundColor Green
        
        # Extract keys from output
        $publicKey = ($vapidOutput | Select-String "Public Key:" -Context 0,1).Context.PostContext[0].Trim()
        $privateKey = ($vapidOutput | Select-String "Private Key:" -Context 0,1).Context.PostContext[0].Trim()
        
        Write-Host ""
        Write-Host "✅ Keys generated successfully!" -ForegroundColor Green
        Write-Host ""
        
        # Update .env.local
        Write-Host "Step 2: Updating .env.local" -ForegroundColor Yellow
        Write-Host "---------------------------" -ForegroundColor Yellow
        
        $email = Read-Host "Enter your contact email (e.g., support@studdyhub.com)"
        if ([string]::IsNullOrWhiteSpace($email)) {
            $email = "support@studdyhub.com"
        }
        
        $envContent = Get-Content $envFile -Raw
        
        # Update or add VAPID keys
        if ($envContent -match "VITE_VAPID_PUBLIC_KEY=") {
            $envContent = $envContent -replace "VITE_VAPID_PUBLIC_KEY=.*", "VITE_VAPID_PUBLIC_KEY=$publicKey"
        } else {
            $envContent += "`nVITE_VAPID_PUBLIC_KEY=$publicKey"
        }
        
        if ($envContent -match "VAPID_PRIVATE_KEY=") {
            $envContent = $envContent -replace "VAPID_PRIVATE_KEY=.*", "VAPID_PRIVATE_KEY=$privateKey"
        } else {
            $envContent += "`nVAPID_PRIVATE_KEY=$privateKey"
        }
        
        if ($envContent -match "VAPID_SUBJECT=") {
            $envContent = $envContent -replace "VAPID_SUBJECT=.*", "VAPID_SUBJECT=mailto:$email"
        } else {
            $envContent += "`nVAPID_SUBJECT=mailto:$email"
        }
        
        Set-Content $envFile $envContent
        Write-Host "✅ .env.local updated with VAPID keys" -ForegroundColor Green
        
        Write-Host ""
        Write-Host "Step 3: Configure Supabase Secrets" -ForegroundColor Yellow
        Write-Host "-----------------------------------" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Run these commands to add secrets to Supabase:" -ForegroundColor White
        Write-Host ""
        Write-Host "supabase secrets set VAPID_PUBLIC_KEY=`"$publicKey`"" -ForegroundColor Cyan
        Write-Host "supabase secrets set VAPID_PRIVATE_KEY=`"$privateKey`"" -ForegroundColor Cyan
        Write-Host "supabase secrets set VAPID_SUBJECT=`"mailto:$email`"" -ForegroundColor Cyan
        Write-Host ""
        
        $setupSupabase = Read-Host "Do you want to set up Supabase secrets now? (y/n)"
        if ($setupSupabase -eq "y" -or $setupSupabase -eq "Y") {
            Write-Host "Setting up Supabase secrets..." -ForegroundColor White
            
            supabase secrets set "VAPID_PUBLIC_KEY=$publicKey"
            supabase secrets set "VAPID_PRIVATE_KEY=$privateKey"
            supabase secrets set "VAPID_SUBJECT=mailto:$email"
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✅ Supabase secrets configured!" -ForegroundColor Green
            } else {
                Write-Host "❌ Failed to set Supabase secrets. Run the commands manually." -ForegroundColor Red
            }
        }
        
        Write-Host ""
        Write-Host "Step 4: Configure Vercel Environment Variables" -ForegroundColor Yellow
        Write-Host "-----------------------------------------------" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Add these environment variables in Vercel Dashboard:" -ForegroundColor White
        Write-Host "https://vercel.com/dashboard → Your Project → Settings → Environment Variables" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Name: VITE_VAPID_PUBLIC_KEY" -ForegroundColor White
        Write-Host "Value: $publicKey" -ForegroundColor Green
        Write-Host "Environments: Production, Preview, Development" -ForegroundColor Gray
        Write-Host ""
        Write-Host "Name: VAPID_PRIVATE_KEY" -ForegroundColor White
        Write-Host "Value: $privateKey" -ForegroundColor Green
        Write-Host "Environments: Production" -ForegroundColor Gray
        Write-Host ""
        Write-Host "Name: VAPID_SUBJECT" -ForegroundColor White
        Write-Host "Value: mailto:$email" -ForegroundColor Green
        Write-Host "Environments: Production" -ForegroundColor Gray
        Write-Host ""
        
        Write-Host "🎉 VAPID Setup Complete!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Yellow
        Write-Host "1. Add the environment variables to Vercel (see above)" -ForegroundColor White
        Write-Host "2. Redeploy your Vercel app" -ForegroundColor White
        Write-Host "3. Test push notifications locally: npm run dev" -ForegroundColor White
        Write-Host ""
        Write-Host "For detailed guide, see: VAPID_SETUP_GUIDE.md" -ForegroundColor Cyan
        
    } else {
        throw "Failed to generate VAPID keys"
    }
    
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Alternative: Generate keys manually at https://vapidkeys.com/" -ForegroundColor Yellow
    Write-Host "Then run this script again or update .env.local manually" -ForegroundColor Yellow
}

Write-Host ""
Read-Host "Press Enter to exit"
