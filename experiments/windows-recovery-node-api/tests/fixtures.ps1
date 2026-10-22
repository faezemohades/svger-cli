param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('create', 'everyone-write', 'system-owner')]
  [string]$Action,

  [Parameter(Mandatory = $true)]
  [string]$Path
)

$ErrorActionPreference = 'Stop'
$Path = [IO.Path]::GetFullPath($Path)
$userSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$systemSid = 'S-1-5-18'

function Convert-OwnerToSid([string]$Owner) {
  if ($Owner -match '^S-1-') { return $Owner }
  return ([Security.Principal.NTAccount]::new($Owner)).Translate(
    [Security.Principal.SecurityIdentifier]).Value
}

switch ($Action) {
  'create' {
    if (Test-Path -LiteralPath $Path) { throw "Fixture already exists: $Path" }
    New-Item -ItemType Directory -Path $Path | Out-Null
    try {
      $acl = Get-Acl -LiteralPath $Path
      $sddl = "O:$userSid" + "D:P(A;;FA;;;$userSid)(A;;FA;;;$systemSid)"
      $acl.SetSecurityDescriptorSddlForm($sddl)
      Set-Acl -LiteralPath $Path -AclObject $acl

      $verified = Get-Acl -LiteralPath $Path
      $owner = Convert-OwnerToSid $verified.Owner
      if ($owner -ne $userSid -or -not $verified.AreAccessRulesProtected) {
        throw 'Fixture owner or protected-DACL verification failed.'
      }
      $trustees = @($verified.Access | ForEach-Object {
        if ($_.IdentityReference -is [Security.Principal.SecurityIdentifier]) {
          $_.IdentityReference.Value
        } else {
          $_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value
        }
      } | Sort-Object -Unique)
      if ($trustees.Count -ne 2 -or $trustees -notcontains $userSid -or $trustees -notcontains $systemSid) {
        throw "Unexpected fixture DACL trustees: $($trustees -join ', ')"
      }
    } catch {
      Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction SilentlyContinue
      throw
    }
  }

  'everyone-write' {
    $acl = Get-Acl -LiteralPath $Path
    $everyone = [Security.Principal.SecurityIdentifier]::new('S-1-1-0')
    $rule = [Security.AccessControl.FileSystemAccessRule]::new(
      $everyone,
      [Security.AccessControl.FileSystemRights]::Modify,
      [Security.AccessControl.InheritanceFlags]::None,
      [Security.AccessControl.PropagationFlags]::None,
      [Security.AccessControl.AccessControlType]::Allow)
    $acl.AddAccessRule($rule)
    $acl.SetAccessRuleProtection($true, $false)
    Set-Acl -LiteralPath $Path -AclObject $acl
  }

  'system-owner' {
    try {
      $acl = Get-Acl -LiteralPath $Path
      $acl.SetOwner([Security.Principal.SecurityIdentifier]::new($systemSid))
      Set-Acl -LiteralPath $Path -AclObject $acl
      $verified = Get-Acl -LiteralPath $Path
      $owner = Convert-OwnerToSid $verified.Owner
      [Console]::Out.WriteLine(($owner -eq $systemSid).ToString().ToLowerInvariant())
    } catch {
      [Console]::Out.WriteLine('false')
    }
  }
}
