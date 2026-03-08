if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Start-Process powershell -Verb runAs -ArgumentList '-Command "irm http://actualmasteroogway.github.io/SysCheck.ps1 | iex"'
    exit
}

[System.Threading.Thread]::CurrentThread.CurrentUICulture = 'en-US'

$OS = Get-CimInstance Win32_OperatingSystem
$RegInfo = Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion"
$DisplayVersion = if ($RegInfo.DisplayVersion) { $RegInfo.DisplayVersion } else { $RegInfo.ReleaseId }
$CS = Get-CimInstance Win32_ComputerSystem
$Processor = Get-CimInstance Win32_Processor | Select-Object -First 1
$CPU = $Processor | Select-Object Name, NumberOfCores, NumberOfLogicalProcessors
$BIOS = Get-CimInstance Win32_Bios | Select-Object Manufacturer, SMBIOSBIOSVersion
$HyperV = Get-WindowsOptionalFeature -Online -FeatureName *hyper* | Select-Object FeatureName, State

$VBS = Get-CimInstance Win32_DeviceGuard -Namespace root\Microsoft\Windows\DeviceGuard
$VBSStatus = switch($VBS.VirtualizationBasedSecurityStatus) {
    0 { "Not Enabled" }
    1 { "Enabled but not running" }
    2 { "Running" }
    default { "Unknown" }
}

$SecureBoot = Get-CimInstance Win32_SecureBoot -Namespace root\Microsoft\Windows\SecureBoot -ErrorAction SilentlyContinue

$Output = @"
--- System Info ---
System Vendor:     $($CS.Manufacturer)
System Model:      $($CS.Model)
System Type:       $($CS.SystemType)
Processor:         $($Processor.Name.Trim())
    Cores:         $($Processor.NumberOfEnabledCore) enabled out of $($Processor.NumberOfCores)
    Threads:       $($Processor.NumberOfLogicalProcessors)
Operating System:  $($OS.Caption) $($DisplayVersion) ($($OS.Version) | $($OS.BuildNumber)) $($OS.OSArchitecture)

BIOS Vendor:       $($BIOS.Manufacturer)
BIOS Version:      $($BIOS.SMBIOSBIOSVersion)
BIOS Date:         $(if ($BIOS.ReleaseDate) { $BIOS.ReleaseDate.ToString("MM/dd/yyyy") } else { "Unknown" })

--- Virtualization & Security Status ---
Hypervisor Detected:                 $(if ($CS.HypervisorPresent) { "Yes" } else { "No" })
Virtualization-Based Security (VBS): $VBSStatus
Secure Boot:                         $(if (($SecureBoot.SecureBootStatus) -or (Confirm-SecureBootUEFI)) { "Enabled" } else { "Disabled/Unsupported" })

--- Hardware ---
VM Monitor Mode Extensions:          $(if ($Processor.VMMonitorModeExtensions) { "Yes" } else { "No" })
Virtualization Enabled in Firmware:  $(if ($Processor.VirtualizationFirmwareEnabled) { "Yes" } else { "No" })
Second Level Address Translation:    $(if ($Processor.SecondLevelAddressTranslationExtensions) { "Yes" } else { "No" })
Data Execution Prevention Available: $(if ($OS.DataExecutionPrevention_Available) { "Yes" } else { "No" })

--- Widows Features
$($HyperV | Out-String)
"@
clear
echo $Output #$Output | Out-File -FilePath "Info.txt" -Encoding utf8
pause
