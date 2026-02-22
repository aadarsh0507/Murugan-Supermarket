# Setup Windows Task Scheduler for Automatic Backups
# Run this script as Administrator to set up scheduled backups

param(
    [string]$BackupScript = ".\scripts\auto-backup.ps1",
    [string]$Schedule = "Daily",  # Daily, Hourly, OnTableChange
    [string]$Time = "02:00"  # For Daily schedule
)

$scriptPath = Resolve-Path $BackupScript
$taskName = "SuperMarket_AutoBackup"

Write-Host "📅 Setting up Windows Task Scheduler for automatic backups..."

# Remove existing task if it exists
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Host "🗑️  Removed existing task"
}

# Create action
$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-ExecutionPolicy Bypass -File `"$scriptPath`""

# Create trigger based on schedule
switch ($Schedule) {
    "Daily" {
        $trigger = New-ScheduledTaskTrigger -Daily -At $Time
        Write-Host "   Schedule: Daily at $Time"
    }
    "Hourly" {
        $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration (New-TimeSpan -Days 365)
        Write-Host "   Schedule: Every hour"
    }
    "OnTableChange" {
        # This would require the monitor script to be running as a service
        Write-Host "⚠️  OnTableChange requires running monitor-tables.ps1 as a service"
        Write-Host "   Use 'monitor-tables.ps1' script instead"
        exit
    }
}

# Create settings
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable

# Register task
Register-ScheduledTask -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description "Automatic backup for Super Market database" `
    -User "SYSTEM" `
    -RunLevel Highest

Write-Host "✅ Task scheduled successfully!"
Write-Host "   Task Name: $taskName"
Write-Host "   View in Task Scheduler: taskschd.msc"

