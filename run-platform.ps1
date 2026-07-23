# ======================================================================
# OmniGraph Platform Orchestration Script
# Author: Garvit Joshi
# Specialization: Data Science & Agentic AI
# ======================================================================

Clear-Host
Write-Host "◇ OmniGraph: Initiating Autonomous SaaS Stack..." -ForegroundColor Green

# 1. Environment and Dependency Validation Engine
Write-Host "`n[1/4] Validating Core Infrastructure Dependencies..." -ForegroundColor Cyan

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Error "CRITICAL: Python runtime compiler not found on system PATH. Execution terminated."
    Exit
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error "CRITICAL: Node Package Manager (npm) execution layer not found. Execution terminated."
    Exit
}

# Install missing Python libraries quietly if requirements are unfulfilled
Write-Host "Verifying Python package architecture matches requirements..." -ForegroundColor Gray
pip install -q -r requirements.txt

# 2. Gemini Authentication Secure Entry
Write-Host "`n[2/4] Configuring Gemini Pipeline Authentication..." -ForegroundColor Cyan
if (-not $env:GEMINI_API_KEY) {
    $SecretKey = Read-Host -Prompt "Enter your GEMINI_API_KEY (hidden)" -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecretKey)
    $UnencryptedKey = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
    $env:GEMINI_API_KEY = $UnencryptedKey
    Write-Host "✔ Gemini API Key injected securely into active session memory." -ForegroundColor Green
} else {
    Write-Host "✔ Existing GEMINI_API_KEY detected in shell context." -ForegroundColor Green
}

# 3. Asynchronous Booting Layer: FastAPI Engine
Write-Host "`n[3/4] Spinning up FastAPI Ingestion Engine on port 8000..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$env:GEMINI_API_KEY='$env:GEMINI_API_KEY'; cd backend; `$Host.UI.RawUI.WindowTitle='OmniGraph Backend API'; python main.py"

# 4. Asynchronous Booting Layer: Vite Frontend Client Canvas
Write-Host "`n[4/4] Booting Vite Frontend User Journey Client Canvas on port 5173..." -ForegroundColor Cyan
if (-not (Test-Path "frontend\node_modules")) {
    Write-Host "Local node_modules missing. Synchronizing package dependencies via npm install..." -ForegroundColor Yellow
    Set-Location frontend
    npm install --quiet
    Set-Location ..
}

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; `$Host.UI.RawUI.WindowTitle='OmniGraph Frontend UI'; npm run dev"

# 5. Workspace Readiness Indicator
Write-Host "`n======================================================================" -ForegroundColor Green
Write-Host "◇ STACK LIVE AND OPERATIONAL" -ForegroundColor Green
Write-Host "  • Backend Logic Cluster: http://localhost:8000" -ForegroundColor Gray
Write-Host "  • Interactive Frontend Workspace: http://localhost:5173" -ForegroundColor Gray
Write-Host "======================================================================" -ForegroundColor Green
Write-Host "Leave this master terminal open to observe orchestrator pipeline signals.`n" -ForegroundColor Gray