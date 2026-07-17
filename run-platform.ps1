# Start OmniGraph's API and React web platform in two terminals.
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Write-Host "Terminal 1: `$env:PYTHONPATH='$root\src'; uvicorn omnigraph.api:app --reload"
Write-Host "Terminal 2: Set-Location '$root\frontend'; npm install; npm run dev"
