# Table Monitor Script
# Monitors for new tables and triggers backup automatically
# Run this as a scheduled task or service

param(
    [string]$MYSQL_HOST = "localhost",
    [int]$MYSQL_PORT = 3306,
    [string]$MYSQL_USER = "root",
    [string]$MYSQL_PASSWORD = "market_2025",
    [string]$MYSQL_DATABASE = "Super_Market",
    [int]$CHECK_INTERVAL = 300,  # Check every 5 minutes
    [string]$STATE_FILE = ".\scripts\.table-state.json"
)

# Load previous table state
$previousTables = @()
if (Test-Path $STATE_FILE) {
    $previousTables = (Get-Content $STATE_FILE | ConvertFrom-Json).tables
}

Write-Host "🔍 Monitoring database for new tables..."
Write-Host "   Database: $MYSQL_DATABASE"
Write-Host "   Check interval: $CHECK_INTERVAL seconds"

while ($true) {
    try {
        # Get current table list
        $env:MYSQL_PWD = $MYSQL_PASSWORD
        $query = "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = '$MYSQL_DATABASE' AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME"
        
        $currentTables = @()
        $result = & mysql -h $MYSQL_HOST -P $MYSQL_PORT -u $MYSQL_USER -D $MYSQL_DATABASE -e $query -N 2>$null
        
        if ($LASTEXITCODE -eq 0) {
            $currentTables = $result | Where-Object { $_ -and $_.Trim() } | ForEach-Object { $_.Trim() }
            
            # Compare with previous state
            $newTables = $currentTables | Where-Object { $previousTables -notcontains $_ }
            
            if ($newTables.Count -gt 0) {
                Write-Host "🆕 New tables detected: $($newTables -join ', ')"
                
                # Trigger backup
                $backupScript = Join-Path $PSScriptRoot "auto-backup.ps1"
                if (Test-Path $backupScript) {
                    Write-Host "🔄 Triggering automatic backup..."
                    & powershell -File $backupScript `
                        -MYSQL_HOST $MYSQL_HOST `
                        -MYSQL_PORT $MYSQL_PORT `
                        -MYSQL_USER $MYSQL_USER `
                        -MYSQL_PASSWORD $MYSQL_PASSWORD `
                        -MYSQL_DATABASE $MYSQL_DATABASE
                }
                
                # Update state file
                $previousTables = $currentTables
                @{ tables = $currentTables } | ConvertTo-Json | Set-Content $STATE_FILE
            }
        }
    } catch {
        Write-Host "❌ Error monitoring tables: $_"
    }
    
    Start-Sleep -Seconds $CHECK_INTERVAL
}

