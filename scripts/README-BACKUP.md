# Automatic Backup System

This directory contains scripts for automatic database backups and table monitoring.

## Scripts

### 1. `auto-backup.ps1`
Creates a MySQL database backup with timestamp.

**Usage:**
```powershell
.\scripts\auto-backup.ps1 -MYSQL_HOST localhost -MYSQL_USER root -MYSQL_PASSWORD your_password -MYSQL_DATABASE Super_Market
```

**Options:**
- `-MYSQL_HOST`: MySQL server host (default: localhost)
- `-MYSQL_PORT`: MySQL server port (default: 3306)
- `-MYSQL_USER`: MySQL username (default: root)
- `-MYSQL_PASSWORD`: MySQL password
- `-MYSQL_DATABASE`: Database name (default: Super_Market)
- `-BACKUP_DIR`: Backup storage directory (default: .\backups)
- `-CLIENT_SERVER_PATH`: Path to push backup to client server
- `-PushToClient`: Enable pushing backup to client server

**Features:**
- Creates timestamped SQL dump files
- Compresses backups (if gzip available)
- Keeps last 10 backups (auto-cleanup)
- Can push to client server automatically

### 2. `monitor-tables.ps1`
Monitors database for new tables and triggers backup automatically.

**Usage:**
```powershell
.\scripts\monitor-tables.ps1 -MYSQL_HOST localhost -MYSQL_USER root -MYSQL_PASSWORD your_password
```

**Features:**
- Checks for new tables every 5 minutes (configurable)
- Automatically triggers backup when new tables detected
- Maintains state file to track table changes

### 3. `setup-backup-task.ps1`
Sets up Windows Task Scheduler for automatic backups.

**Usage (Run as Administrator):**
```powershell
.\scripts\setup-backup-task.ps1 -Schedule Daily -Time "02:00"
```

**Schedules:**
- `Daily`: Backup once per day at specified time
- `Hourly`: Backup every hour
- `OnTableChange`: Requires monitor-tables.ps1 running as service

## Setup Instructions

### Option 1: Scheduled Daily Backups

1. **Run setup script as Administrator:**
   ```powershell
   cd D:\Frontend\Super_Market
   .\scripts\setup-backup-task.ps1 -Schedule Daily -Time "02:00"
   ```

2. **Verify task:**
   - Open Task Scheduler (`taskschd.msc`)
   - Look for "SuperMarket_AutoBackup"
   - Test by right-clicking → Run

### Option 2: Monitor for New Tables

1. **Start monitoring service:**
   ```powershell
   .\scripts\monitor-tables.ps1
   ```

2. **Run as Windows Service (optional):**
   - Use NSSM (Non-Sucking Service Manager) to run as service
   - Download: https://nssm.cc/download

### Option 3: Manual Backup

```powershell
.\scripts\auto-backup.ps1 -MYSQL_PASSWORD your_password
```

## Backup Storage

- **Location:** `.\backups\` directory
- **Format:** `backup_Super_Market_YYYYMMDD_HHMMSS.sql.gz`
- **Retention:** Last 10 backups (auto-cleanup)

## Integration with Docker Build/Push

To automatically build and push Docker images after backup:

1. **Modify `auto-backup.ps1`** to add:
   ```powershell
   # After successful backup
   if ($LASTEXITCODE -eq 0) {
       Write-Host "🐳 Triggering Docker build..."
       docker-compose build
       docker-compose push
   }
   ```

2. **Or use Jenkins pipeline** (already configured in `Jenkinsfile`)

## Client Server Push

To automatically push backups to client server:

```powershell
.\scripts\auto-backup.ps1 `
    -MYSQL_PASSWORD your_password `
    -CLIENT_SERVER_PATH "\\192.168.1.50\backups" `
    -PushToClient
```

## Requirements

- MySQL client tools (mysqldump)
- PowerShell 5.1 or later
- Windows Task Scheduler (for scheduled backups)

## Troubleshooting

### mysqldump not found
Install MySQL client tools:
- Download: https://dev.mysql.com/downloads/mysql/
- Or use: `winget install Oracle.MySQL`

### Permission denied
- Run PowerShell as Administrator
- Check MySQL user has backup privileges

### Backup file too large
- Enable compression (gzip)
- Consider excluding large tables
- Use `--where` clause for incremental backups

