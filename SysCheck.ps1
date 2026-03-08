if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Start-Process powershell -Verb runAs -ArgumentList '-Command "irm http://actualmasteroogway.github.io/SysCheck.ps1 | iex"'
    exit
}

[System.Threading.Thread]::CurrentThread.CurrentUICulture = 'en-US'

$OS = Get-CimInstance Win32_OperatingSystem
$RegInfo = Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion"
$DisplayVersion = if ($RegInfo.DisplayVersion) { $RegInfo.DisplayVersion } else { $RegInfo.ReleaseId }
$CS = Get-CimInstance Win32_ComputerSystem
$Processor = Get-CimInstance Win32_Processor | Select-Object -First 1
$CoresTotal = $Processor.NumberOfCores
$CoresEnabled = if ($Processor.NumberOfEnabledCore) { $Processor.NumberOfEnabledCore } else { $Processor.NumberOfCores }
$BIOS = Get-CimInstance Win32_Bios | Select-Object Manufacturer, SMBIOSBIOSVersion

$Uptime = (Get-Date) - $OS.LastBootUpTime

$PowerReg = Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Power" -ErrorAction SilentlyContinue
$FastStartup = if ($null -ne $PowerReg -and $PowerReg.HiberbootEnabled -eq 1) { "Enabled" } else { "Disabled" }

$VirtFeatures = Get-WindowsOptionalFeature -Online | Where-Object { $_.FeatureName -match "hyper|VirtualMachinePlatform|Subsystem-Linux" } | Select-Object FeatureName, State
$VirtServices = Get-Service -Name "vmms", "vmcompute" -ErrorAction SilentlyContinue | Select-Object Name, Status

$VBS = Get-CimInstance Win32_DeviceGuard -Namespace root\Microsoft\Windows\DeviceGuard
$VBSStatus = switch($VBS.VirtualizationBasedSecurityStatus) {
    0 { "Not Enabled" }
    1 { "Enabled but not running" }
    2 { "Running" }
    default { "Unknown" }
}

$HVCIReg = Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\DeviceGuard\Scenarios\HypervisorEnforcedCodeIntegrity" -ErrorAction SilentlyContinue
$HVCI = if ($HVCIReg -and $HVCIReg.Enabled -eq 1) { "Enabled" } else { "Disabled" }

$BCD = bcdedit /enum "{current}" | Select-String "hypervisorlaunchtype"
$BCDLaunchType = if ($BCD) { ($BCD -split '\s+')[-1] } else { "Not explicitly set" }

$KernelDMA = if ($CS.KernelDmaProtection) { "Enabled" } else { "Disabled/Unsupported" }

$SBStatus = "Disabled/Unsupported"
try {
    if ((Get-CimInstance -ClassName Win32_SecureBoot -Namespace root\Microsoft\Windows\SecureBoot -ErrorAction SilentlyContinue).SecureBootStatus -eq $true -or (Confirm-SecureBootUEFI -ErrorAction SilentlyContinue)) {
        $SBStatus = "Enabled"
    }
} catch {}

$Output = @"
--- System Info ---
System Vendor:     $($CS.Manufacturer)
System Model:      $($CS.Model)
System Type:       $($CS.SystemType)
Processor:         $($Processor.Name.Trim())
    Cores:         $CoresEnabled enabled t/ $CoresTotal total
    Threads:       $($Processor.NumberOfLogicalProcessors)
Operating System:  $($OS.Caption) $($DisplayVersion) ($($OS.Version) | $($OS.BuildNumber)) $($OS.OSArchitecture)
System Uptime:     $($Uptime.Days) Days, $($Uptime.Hours) Hours, $($Uptime.Minutes) Minutes
Fast Startup:      $FastStartup

BIOS Vendor:       $($BIOS.Manufacturer)
BIOS Version:      $($BIOS.SMBIOSBIOSVersion)
BIOS Date:         $(if ($BIOS.ReleaseDate) { $BIOS.ReleaseDate.ToString("MM/dd/yyyy") } else { "Unknown" })

--- Virtualization & Security Status ---
Hypervisor Detected:                 $(if ($CS.HypervisorPresent) { "Yes" } else { "No" })
Bootloader Hypervisor Launch Type:   $BCDLaunchType
Virtualization-Based Security (VBS): $VBSStatus
Memory Integrity (Core Isolation):   $HVCI
Kernel DMA Protection (IOMMU):       $KernelDMA
Secure Boot:                         $SBStatus

--- Hardware ---
VM Monitor Mode Extensions:          $(if ($Processor.VMMonitorModeExtensions) { "Yes" } else { "No" })
Virtualization Enabled in Firmware:  $(if ($Processor.VirtualizationFirmwareEnabled) { "Yes" } else { "No" })
Second Level Address Translation:    $(if ($Processor.SecondLevelAddressTranslationExtensions) { "Yes" } else { "No" })
Data Execution Prevention Available: $(if ($OS.DataExecutionPrevention_Available) { "Yes" } else { "No" })

--- Windows Features ---
$($VirtFeatures | Out-String)
--- Virtualization Services ---
$($VirtServices | Out-String)
"@
clear
echo $Output #$Output | Out-File -FilePath "Info.txt" -Encoding utf8
pause
