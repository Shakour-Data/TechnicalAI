# PowerShell script to setup Windows Task Scheduler for data updates
# Run as Administrator: Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

param(
    [string]$Action = "install",  # install, uninstall, or status
    [int]$IntervalMinutes = 115
)

$TaskName = "TechnicalAI Data Update"
$ScriptPath = "E:\Shakour\MyProjects\TechnicalAI"
$BatchFile = "$ScriptPath\run-data-update.bat"

function Install-Task {
    Write-Host "Installing task '$TaskName' to run every $IntervalMinutes minutes..." -ForegroundColor Green
    
    # Stop existing task if running
    try {
        Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
        Write-Host "Stopped existing task" -ForegroundColor Yellow
    } catch {}
    
    # Unregister existing task if exists
    try {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
        Write-Host "Unregistered previous task" -ForegroundColor Yellow
    } catch {}
    
    # Create new task
    $action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$BatchFile`""
    
    # Calculate interval in seconds for Windows scheduler
    # Windows supports minutes, so we use $IntervalMinutes
    $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date "00:01:00") -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes) -RepetitionDuration (New-TimeSpan -Days 3650)
    
    # Run with highest privileges
    $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    
    # Settings
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -DontStopOnIdleEnd -ExecutionTimeLimit (New-TimeSpan -Hours 2)
    
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "TechnicalAI Data Update Scheduler - Runs every $IntervalMinutes minutes"
    
    Write-Host "Task '$TaskName' installed successfully!" -ForegroundColor Green
    Write-Host "  - Runs every $IntervalMinutes minutes"
    Write-Host "  - Executes: $BatchFile"
    Write-Host "  - Logs: $ScriptPath\db\data-update.log"
}

function Uninstall-Task {
    Write-Host "Uninstalling task '$TaskName'..." -ForegroundColor Yellow
    
    try {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Host "Task '$TaskName' uninstalled successfully!" -ForegroundColor Green
    } catch {
        Write-Host "Task '$TaskName' not found or already removed" -ForegroundColor Yellow
    }
}

function Show-Status {
    Write-Host "Checking task status..." -ForegroundColor Cyan
    
    try {
        $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
        $taskInfo = Get-ScheduledTaskInfo -TaskName $TaskName
        
        Write-Host "`nTask '$TaskName' Status:" -ForegroundColor Green
        Write-Host "  State: $($task.State)"
        Write-Host "  Last Run Time: $($taskInfo.LastRunTime)"
        Write-Host "  Next Run Time: $($taskInfo.NextRunTime)"
        Write-Host "  Last Task Result: $($taskInfo.LastTaskResult)"
        Write-Host "  Run Time Count: $($taskInfo.RunTimeCount)"
    } catch {
        Write-Host "Task '$TaskName' not found." -ForegroundColor Red
        Write-Host "`nTo install the task, run:" -ForegroundColor Yellow
        Write-Host "  .\setup-data-update-scheduler.ps1 -Action install"
    }
}

# Main
switch ($Action.ToLower()) {
    "install" { Install-Task }
    "uninstall" { Uninstall-Task }
    "status" { Show-Status }
    default {
        Write-Host "Usage: .\setup-data-update-scheduler.ps1 [-Action <install|uninstall|status>] [-IntervalMinutes <minutes>]" -ForegroundColor Yellow
        Write-Host "`nActions:" -ForegroundColor Cyan
        Write-Host "  install  - Install the scheduled task (default)"
        Write-Host "  uninstall - Remove the scheduled task"
        Write-Host "  status   - Check task status"
        Write-Host "`nDefault interval is $IntervalMinutes minutes"
    }
}