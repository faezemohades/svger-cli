param(
  [Parameter(Mandatory = $true)][string]$Exe,
  [string]$ReportPath = (Join-Path $env:TEMP ("svger-recovery-qualification-" + [guid]::NewGuid().ToString('N') + '.json'))
)

$ErrorActionPreference = 'Stop'
$script:results = [System.Collections.Generic.List[object]]::new()
$root = Join-Path $env:TEMP ("svger-recovery-qualify-" + [guid]::NewGuid().ToString('N'))
$holder = $null
$fatalError = $null

function Add-Result([string]$Gate, [string]$Status, [string]$Evidence) {
  $script:results.Add([pscustomobject]@{
    gate = $Gate
    status = $Status
    evidence = $Evidence
  })
  Write-Host "$Status $Gate`: $Evidence"
}

function Assert-Rejected([string]$Path, [string]$Kind, [string]$ExpectedCode, [string]$Gate) {
  $output = & $Exe $Kind $Path 2>&1
  $status = $LASTEXITCODE
  $text = $output -join "`n"
  if ($status -eq 0 -or $text -notmatch [regex]::Escape($ExpectedCode)) {
    throw "Expected $ExpectedCode for $Kind '$Path'; exit=$status output=$text"
  }
  Add-Result $Gate 'PASS' "rejected with $ExpectedCode (exit $status)"
}

try {
  if (-not (Test-Path -LiteralPath $Exe -PathType Leaf)) { throw "Executable not found: $Exe" }
  $Exe = (Resolve-Path -LiteralPath $Exe).Path

  & $Exe create-dir $root
  if ($LASTEXITCODE -ne 0) { throw 'Protected test-root creation failed.' }
  $rootAcl = Get-Acl -LiteralPath $root
  if (-not $rootAcl.AreAccessRulesProtected) { throw 'Test root DACL unexpectedly inherits ACEs.' }

  $safe = Join-Path $root 'safe.bin'
  & $Exe create-file $safe
  if ($LASTEXITCODE -ne 0) { throw 'Protected file creation failed.' }
  & $Exe inspect-file $safe
  if ($LASTEXITCODE -ne 0) { throw 'Protected file inspection failed.' }
  $safeAcl = Get-Acl -LiteralPath $safe
  if (-not $safeAcl.AreAccessRulesProtected) { throw 'Protected file DACL is not protected.' }
  $safeRules = $safeAcl.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier])
  $systemSid = 'S-1-5-18'
  $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
  $userSid = $identity.User.Value
  $actualOwnerSid = $safeAcl.GetOwner([System.Security.Principal.SecurityIdentifier]).Value
  if ($actualOwnerSid -ne $userSid) {
    throw "Unexpected protected metadata owner SID: $actualOwnerSid"
  }
  foreach ($sid in @($systemSid, $userSid)) {
    if (-not ($safeRules | Where-Object { $_.IdentityReference.Value -eq $sid -and $_.AccessControlType -eq [System.Security.AccessControl.AccessControlType]::Allow })) {
      throw "Protected metadata is missing the expected allow ACE for $sid."
    }
  }
  Add-Result 'protected metadata owner and DACL' 'PASS' 'protected DACL; current user and SYSTEM allow ACEs verified'

  $everyone = [System.Security.Principal.SecurityIdentifier]::new('S-1-1-0')
  $write = [System.Security.AccessControl.FileSystemRights]::Write
  $allow = [System.Security.AccessControl.AccessControlType]::Allow

  $explicit = Join-Path $root 'explicit.bin'
  & $Exe create-file $explicit
  if ($LASTEXITCODE -ne 0) { throw 'Explicit-ACE fixture creation failed.' }
  $acl = Get-Acl -LiteralPath $explicit
  $rule = [System.Security.AccessControl.FileSystemAccessRule]::new($everyone, $write, $allow)
  [void]$acl.AddAccessRule($rule)
  Set-Acl -LiteralPath $explicit -AclObject $acl
  $explicitRules = (Get-Acl -LiteralPath $explicit).GetAccessRules($true, $false, [System.Security.Principal.SecurityIdentifier])
  if (-not ($explicitRules | Where-Object { $_.IdentityReference.Value -eq $everyone.Value -and $_.AccessControlType -eq $allow -and ($_.FileSystemRights -band $write) -ne 0 })) {
    throw 'Explicit Everyone write ACE was not present in the fixture before inspection.'
  }
  Assert-Rejected $explicit 'inspect-file' 'untrusted_write_ace' 'explicit untrusted write ACE'

  $inheritedParent = Join-Path $root 'inherited'
  New-Item -ItemType Directory -Path $inheritedParent | Out-Null
  $parentAcl = Get-Acl -LiteralPath $inheritedParent
  $inheritance = [System.Security.AccessControl.InheritanceFlags]::ContainerInherit -bor `
    [System.Security.AccessControl.InheritanceFlags]::ObjectInherit
  $inheritedRule = [System.Security.AccessControl.FileSystemAccessRule]::new(
    $everyone, $write, $inheritance,
    [System.Security.AccessControl.PropagationFlags]::None, $allow)
  [void]$parentAcl.AddAccessRule($inheritedRule)
  Set-Acl -LiteralPath $inheritedParent -AclObject $parentAcl
  $inheritedFile = Join-Path $inheritedParent 'child.bin'
  [System.IO.File]::WriteAllText($inheritedFile, 'temporary fixture')
  # Hosted Windows runners can create PowerShell/.NET files with the
  # Administrators group as owner when the process is elevated. Make this
  # fixture's owner explicit so the inherited-ACE assertion reaches the ACE
  # check rather than failing the independent owner authorization gate.
  $inheritedFileAcl = Get-Acl -LiteralPath $inheritedFile
  $inheritedFileAcl.SetOwner($identity.User)
  Set-Acl -LiteralPath $inheritedFile -AclObject $inheritedFileAcl
  $inheritedOwner = (Get-Acl -LiteralPath $inheritedFile).GetOwner(
    [System.Security.Principal.SecurityIdentifier]).Value
  if ($inheritedOwner -ne $userSid) {
    throw "Inherited-ACE fixture owner mismatch: expected $userSid, observed $inheritedOwner."
  }
  $inheritedRules = (Get-Acl -LiteralPath $inheritedFile).GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier])
  if (-not ($inheritedRules | Where-Object { $_.IdentityReference.Value -eq $everyone.Value -and $_.AccessControlType -eq $allow -and $_.IsInherited -and ($_.FileSystemRights -band $write) -ne 0 })) {
    throw 'Inherited Everyone write ACE was not present in the fixture before inspection.'
  }
  Assert-Rejected $inheritedFile 'inspect-file' 'untrusted_inherited_write_ace' 'inherited untrusted write ACE'

  $foreignOwner = Join-Path $root 'foreign-owner.bin'
  & $Exe create-file $foreignOwner
  if ($LASTEXITCODE -ne 0) { throw 'Foreign-owner fixture creation failed.' }
  $ownerGate = 'PASS'
  $ownerEvidence = 'SYSTEM owner SID fixture constructed and rejected'
  $ownerFixtureReady = $true
  try {
    $foreignAcl = Get-Acl -LiteralPath $foreignOwner
    $foreignAcl.SetOwner([System.Security.Principal.SecurityIdentifier]::new($systemSid))
    Set-Acl -LiteralPath $foreignOwner -AclObject $foreignAcl
    $actualOwner = (Get-Acl -LiteralPath $foreignOwner).Owner
    if ($actualOwner -is [System.Security.Principal.SecurityIdentifier]) {
      $actualOwnerSid = $actualOwner.Value
    } else {
      $actualOwnerSid = ([System.Security.Principal.NTAccount]$actualOwner).Translate([System.Security.Principal.SecurityIdentifier]).Value
    }
    if ($actualOwnerSid -ne $systemSid) { throw "The runner did not apply the requested owner SID (observed $actualOwnerSid)." }
  } catch {
    $ownerFixtureReady = $false
    $ownerGate = 'INCONCLUSIVE'
    $ownerEvidence = "Could not assign and independently verify SYSTEM owner SID: $($_.Exception.Message)"
  }
  if ($ownerFixtureReady) {
    $output = & $Exe inspect-file $foreignOwner 2>&1
    $status = $LASTEXITCODE
    $text = $output -join "`n"
    if ($status -eq 0 -or $text -notmatch 'owner_mismatch') {
      throw "Owner-mismatch fixture was not rejected: exit=$status output=$text"
    }
  }
  Add-Result 'foreign owner rejection' $ownerGate $ownerEvidence

  $target = Join-Path $root 'target-dir'
  & $Exe create-dir $target
  if ($LASTEXITCODE -ne 0) { throw 'Reparse target fixture creation failed.' }
  $junction = Join-Path $root 'junction'
  New-Item -ItemType Junction -Path $junction -Target $target | Out-Null
  Assert-Rejected $junction 'inspect-dir' 'reparse_point_rejected' 'reparse-point rejection'

  $lockPath = Join-Path $root 'exclusive.lock'
  $readyPath = Join-Path $root 'lock-holder-output.txt'
  Remove-Item -LiteralPath $readyPath -Force -ErrorAction SilentlyContinue
  $holder = Start-Process -FilePath $Exe -ArgumentList @('hold-lock', ('"{0}"' -f $lockPath), '10000') `
    -PassThru -NoNewWindow -RedirectStandardOutput $readyPath
  $deadline = [DateTime]::UtcNow.AddSeconds(10)
  while ([DateTime]::UtcNow -lt $deadline) {
    $holder.Refresh()
    if ($holder.HasExited) { throw "Lock holder exited before reporting acquisition (exit $($holder.ExitCode))." }
    if ((Test-Path -LiteralPath $readyPath) -and (Get-Content -LiteralPath $readyPath -Raw) -match 'lock_acquired') { break }
    Start-Sleep -Milliseconds 100
  }
  if (-not (Test-Path -LiteralPath $readyPath) -or (Get-Content -LiteralPath $readyPath -Raw) -notmatch 'lock_acquired') {
    throw 'Lock holder did not acquire its lock before the timeout.'
  }
  $lockOutput = & $Exe try-lock $lockPath 2>&1
  $lockStatus = $LASTEXITCODE
  $holder.Refresh()
  if ($holder.HasExited) { throw 'Lock holder exited before competing-process check.' }
  if ($lockStatus -eq 0 -or ($lockOutput -join "`n") -notmatch 'lock_busy') {
    throw "Competing process was not rejected: exit=$lockStatus output=$lockOutput"
  }
  $holder.WaitForExit()
  if ($holder.ExitCode -ne 0) { throw "Lock holder exited with $($holder.ExitCode)." }
  $holder = $null
  Add-Result 'cross-process exclusive lock' 'PASS' 'second process rejected with lock_busy while first held lock'

  Add-Result 'Node 22/24 integration' 'UNTESTED' 'no Node-API or Node integration exists in this isolated experiment'
} catch {
  $fatalError = $_.Exception.Message
  Add-Result 'qualification execution' 'FAIL' $fatalError
} finally {
  if ($holder -and -not $holder.HasExited) {
    Stop-Process -Id $holder.Id -Force -ErrorAction SilentlyContinue
    $holder.WaitForExit()
  }
  Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue
  if (Test-Path -LiteralPath $root) {
    Add-Result 'disposable fixture cleanup' 'FAIL' 'fixture directory remains after cleanup attempt'
  } else {
    Add-Result 'disposable fixture cleanup' 'PASS' 'temporary qualification directory removed'
  }
  $reportDirectory = Split-Path -Parent $ReportPath
  if ($reportDirectory) { New-Item -ItemType Directory -Path $reportDirectory -Force | Out-Null }
  [pscustomobject]@{
    schemaVersion = 1
    generatedAtUtc = [DateTime]::UtcNow.ToString('o')
    nodeIntegration = 'UNTESTED: no Node integration exists'
    results = @($script:results)
  } | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $ReportPath -Encoding UTF8
  Write-Host "Qualification report: $ReportPath"
}

$statuses = @($script:results | ForEach-Object { $_.status })

if ($fatalError -or $statuses -contains 'FAIL') {
  exit 1
}

if ($statuses -contains 'INCONCLUSIVE') {
  exit 2
}

exit 0
