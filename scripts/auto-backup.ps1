# Auto Backup Script for Super Market Database
# This script monitors for new tables and creates backups automatically
# Can be scheduled via Windows Task Scheduler

param(
    [string]$MYSQL_HOST = "localhost",
    [int]$MYSQL_PORT = 3306,
    [string]$MYSQL_USER = "root",
    [string]$MYSQL_PASSWORD = "market_2025",
    [string]$MYSQL_DATABASE = "Super_Market",
    [string]$BACKUP_DIR = ".\backups",
    [string]$CLIENT_SERVER_PATH = "",
    [switch]$PushToClient = $false
)

# Create backup directory if it doesn't exist
if (-not (Test-Path $BACKUP_DIR)) {
    New-Item -ItemType Directory -Path $BACKUP_DIR -Force | Out-Null
    Write-Host "✅ Created backup directory: $BACKUP_DIR"
}

# Generate backup filename with timestamp
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = Join-Path $BACKUP_DIR "backup_${MYSQL_DATABASE}_${timestamp}.sql"
$backupFileZip = "${backupFile}.gz"

Write-Host "🔄 Starting database backup..."
Write-Host "   Database: $MYSQL_DATABASE"
Write-Host "   Host: ${MYSQL_HOST}:${MYSQL_PORT}"

# Check if mysqldump is available
$mysqldumpPath = Get-Command mysqldump -ErrorAction SilentlyContinue
if (-not $mysqldumpPath) {
    Write-Host "❌ mysqldump not found. Please install MySQL client tools."
    Write-Host "   Download from: https://dev.mysql.com/downloads/mysql/"
    exit 1
}

try {
    # Create MySQL dump
    $env:MYSQL_PWD = $MYSQL_PASSWORD
    & mysqldump -h $MYSQL_HOST -P $MYSQL_PORT -u $MYSQL_USER `
        --single-transaction `
        --routines `
        --triggers `
        --events `
        --add-drop-table `
        --complete-insert `
        $MYSQL_DATABASE | Out-File -FilePath $backupFile -Encoding UTF8
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Backup created: $backupFile"
        
        # Compress backup using gzip (if available) or 7zip
        $gzipPath = Get-Command gzip -ErrorAction SilentlyContinue
        if ($gzipPath) {
            & gzip -f $backupFile
            $finalBackupFile = $backupFileZip
            Write-Host "✅ Backup compressed: $finalBackupFile"
        } else {
            $finalBackupFile = $backupFile
            Write-Host "⚠️  gzip not found. Backup not compressed."
        }
        
        # Get backup file size
        $fileSize = (Get-Item $finalBackupFile).Length / 1MB
        Write-Host "   Size: $([math]::Round($fileSize, 2)) MB"
        
        # Keep only last 10 backups (optional cleanup)
        $backups = Get-ChildItem -Path $BACKUP_DIR -Filter "backup_${MYSQL_DATABASE}_*.sql*" | 
                   Sort-Object LastWriteTime -Descending
        if ($backups.Count -gt 10) {
            $backups | Select-Object -Skip 10 | Remove-Item -Force
            Write-Host "🧹 Cleaned up old backups (kept last 10)"
        }
        
        # Push to client server if enabled
        if ($PushToClient -and $CLIENT_SERVER_PATH) {
            Write-Host "📤 Pushing backup to client server..."
            if (Test-Path $CLIENT_SERVER_PATH) {
                Copy-Item -Path $finalBackupFile -Destination $CLIENT_SERVER_PATH -Force
                Write-Host "✅ Backup pushed to: $CLIENT_SERVER_PATH"
            } else {
                Write-Host "⚠️  Client server path not accessible: $CLIENT_SERVER_PATH"
            }
        }
        
        Write-Host "✅ Backup completed successfully!"
        exit 0
    } else {
        Write-Host "❌ Backup failed with exit code: $LASTEXITCODE"
        exit 1
    }
} catch {
    Write-Host "❌ Error creating backup: $_"
    exit 1
} finally {
    Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue
}

