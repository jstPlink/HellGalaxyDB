$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$base = Join-Path $root 'data\'
$out  = Join-Path $root 'data\'

function Read-Positional($path) {
  $lines = Get-Content -Path $path -Encoding UTF8
  $maxCols = 0
  $rows = @()
  foreach ($line in $lines) {
    # simple CSV split respecting quotes
    $fields = [System.Collections.Generic.List[string]]::new()
    $cur = ""
    $inQuotes = $false
    for ($i=0; $i -lt $line.Length; $i++) {
      $ch = $line[$i]
      if ($inQuotes) {
        if ($ch -eq '"') {
          if ($i+1 -lt $line.Length -and $line[$i+1] -eq '"') { $cur += '"'; $i++ }
          else { $inQuotes = $false }
        } else { $cur += $ch }
      } else {
        if ($ch -eq '"') { $inQuotes = $true }
        elseif ($ch -eq ',') { $fields.Add($cur); $cur = "" }
        else { $cur += $ch }
      }
    }
    $fields.Add($cur)
    if ($fields.Count -gt $maxCols) { $maxCols = $fields.Count }
    $rows += ,($fields.ToArray())
  }
  return ,$rows
}

# ---------- ENTITIES.csv: build ID -> name lookup ----------
$entRows = Read-Positional ($base + 'HS - Entity - ENTITIES.csv')
$lookup = @{}
for ($i=1; $i -lt $entRows.Count; $i++) {
  $r = $entRows[$i]
  if ($r.Length -lt 3) { continue }
  $id = $r[0]
  if ([string]::IsNullOrWhiteSpace($id)) { continue }
  $lookup[$id] = @{ Label = $r[1]; Description = $r[2]; Producer = if($r.Length -gt 9){$r[9]}else{""} }
}
Write-Output ("Entities lookup entries: " + $lookup.Count)

function Get-Name($id) { if ($lookup.ContainsKey($id)) { return $lookup[$id].Label } else { return $id } }
function Get-Desc($id) { if ($lookup.ContainsKey($id)) { return $lookup[$id].Description } else { return "" } }
function Get-Prod($id) { if ($lookup.ContainsKey($id)) { return $lookup[$id].Producer } else { return "" } }

function NumOrZero($v) { if ([string]::IsNullOrWhiteSpace($v)) { return 0 } else { try { return [double]$v } catch { return 0 } } }
function BoolOf($v) { return ($v -eq 'TRUE') }

# ---------- Body.csv rows 6..27 (index 5..26) ----------
$bodyRows = Read-Positional ($base + 'HS - Entity - Modules - Body.csv')
$bodyItems = @()
for ($i=5; $i -le 26; $i++) {
  $r = $bodyRows[$i]
  if ([string]::IsNullOrWhiteSpace($r[0])) { continue }
  $id = $r[0]
  $bodyItems += [ordered]@{
    ID = $id
    Name = Get-Name $id
    Description = Get-Desc $id
    Producer = Get-Prod $id
    ItemType = $r[1]
    PowerConsumption = NumOrZero $r[2]
    Incorporated = BoolOf $r[3]
    Quality = NumOrZero $r[4]
    Price = NumOrZero $r[5]
    Rarity = $r[6]
    ModuleType = $r[8]
    BoosterSpeedMultiplier = NumOrZero $r[9]
    StressDriveSpeedMultiplier = NumOrZero $r[10]
    HullIntegrity = NumOrZero $r[11]
    ShieldModule = $r[12]
    Shield = NumOrZero $r[13]
    PowerModule = $r[14]
    Power = NumOrZero $r[15]
    HeatModule = $r[16]
    Heat = NumOrZero $r[17]
    CargoModule = $r[18]
    Cargo = NumOrZero $r[19]
    Socket1 = NumOrZero $r[20]
    Socket2 = NumOrZero $r[21]
    Socket3 = NumOrZero $r[22]
    Socket4 = NumOrZero $r[23]
    BonusSocket1 = NumOrZero $r[24]
    BonusSocket2 = NumOrZero $r[25]
    BonusSocket3 = NumOrZero $r[26]
    BonusSocket4 = NumOrZero $r[27]
    SocketValue = NumOrZero $r[28]
    MaxP1 = NumOrZero $r[30]
    MaxP2 = NumOrZero $r[31]
    MaxP3 = NumOrZero $r[32]
  }
}
Write-Output ("Body items: " + $bodyItems.Count)
$bodyItems | ConvertTo-Json -Depth 4 | Out-File -FilePath ($out + 'data_body.json') -Encoding utf8

# ---------- Engine.csv rows 6..40 (index 5..39) ----------
$engRows = Read-Positional ($base + 'HS - Entity - Modules - Engine.csv')
$engItems = @()
for ($i=5; $i -le 39; $i++) {
  $r = $engRows[$i]
  if ([string]::IsNullOrWhiteSpace($r[0])) { continue }
  $id = $r[0]
  $engItems += [ordered]@{
    ID = $id
    Name = Get-Name $id
    Description = Get-Desc $id
    Producer = Get-Prod $id
    ItemType = $r[1]
    PowerConsumption = NumOrZero $r[2]
    Incorporated = BoolOf $r[3]
    Quality = NumOrZero $r[4]
    Price = NumOrZero $r[5]
    Rarity = $r[6]
    ModuleType = $r[8]
    SpeedIncrement = NumOrZero $r[9]
    BoostChargeConsumption = NumOrZero $r[10]
    Socket = NumOrZero $r[11]
    IncorporatedSocket = BoolOf $r[12]
    AdditionalSocket = NumOrZero $r[13]
    MaxSpeedCheck = NumOrZero $r[15]
    NeededCost = NumOrZero $r[17]
  }
}
Write-Output ("Engine items: " + $engItems.Count)
$engItems | ConvertTo-Json -Depth 4 | Out-File -FilePath ($out + 'data_engine.json') -Encoding utf8

# ---------- Primary.csv: Gatling rows 10..39 (idx 9..38), Laser rows 49..63 (idx 48..62) ----------
$priRows = Read-Positional ($base + 'HS - Entity - Modules - Primary.csv')
function Build-WeaponItem($r, $class) {
  $id = $r[0]
  return [ordered]@{
    ID = $id
    Name = Get-Name $id
    Description = Get-Desc $id
    Producer = Get-Prod $id
    WeaponClass = $class
    PowerConsumption = NumOrZero $r[2]
    Incorporated = BoolOf $r[3]
    Quality = NumOrZero $r[4]
    Price = NumOrZero $r[5]
    Rarity = $r[6]
    WeaponType = $r[9]
    AmmoMagazineSize = NumOrZero $r[10]
    Rate = NumOrZero $r[11]
    ChargeTime = NumOrZero $r[12]
    BaseDamageMin = NumOrZero $r[13]
    BaseDamageMax = NumOrZero $r[14]
    ProjectileSpeed = NumOrZero $r[15]
    ProjectileAccuracy = NumOrZero $r[16]
    ProjectileRange = NumOrZero $r[17]
    RotableStructure = BoolOf $r[18]
    HeatGeneration = NumOrZero $r[19]
    AmmoType = $r[20]
    CritChance = NumOrZero $r[21]
    CritDamage = NumOrZero $r[22]
    DPA = NumOrZero $r[23]
    HPS = NumOrZero $r[24]
    DPS = NumOrZero $r[25]
    Socket = NumOrZero $r[26]
    StationUnlock = $r[27]
    NeededCost = NumOrZero $r[32]
  }
}
$primaryItems = @()
for ($i=9; $i -le 38; $i++) {
  $r = $priRows[$i]
  if ([string]::IsNullOrWhiteSpace($r[0])) { continue }
  $primaryItems += Build-WeaponItem $r "Gatling"
}
for ($i=48; $i -le 62; $i++) {
  $r = $priRows[$i]
  if ([string]::IsNullOrWhiteSpace($r[0])) { continue }
  $primaryItems += Build-WeaponItem $r "Laser"
}
Write-Output ("Primary items: " + $primaryItems.Count)
$primaryItems | ConvertTo-Json -Depth 4 | Out-File -FilePath ($out + 'data_primary.json') -Encoding utf8

# ---------- Secondary.csv: Rocket rows 10..19 (idx 9..18), Sonic rows 31..34 (idx 30..33) ----------
$secRows = Read-Positional ($base + 'HS - Entity - Modules - Secondary.csv')
function Build-SecondaryItem($r, $class) {
  $id = $r[0]
  return [ordered]@{
    ID = $id
    Name = Get-Name $id
    Description = Get-Desc $id
    Producer = Get-Prod $id
    WeaponClass = $class
    PowerConsumption = NumOrZero $r[2]
    Incorporated = BoolOf $r[3]
    Quality = NumOrZero $r[4]
    Price = NumOrZero $r[5]
    Rarity = $r[6]
    WeaponType = $r[9]
    AmmoMagazineSize = NumOrZero $r[10]
    Rate = NumOrZero $r[11]
    ChargeTime = NumOrZero $r[12]
    BaseDamageMin = NumOrZero $r[13]
    BaseDamageMax = NumOrZero $r[14]
    ProjectileSpeed = NumOrZero $r[15]
    ProjectileAccuracy = NumOrZero $r[16]
    ProjectileRange = NumOrZero $r[17]
    RotableStructure = BoolOf $r[18]
    HeatGeneration = NumOrZero $r[19]
    AmmoType = $r[20]
    CritChance = NumOrZero $r[21]
    CritDamage = NumOrZero $r[22]
    DPA = NumOrZero $r[23]
    DPS = NumOrZero $r[24]
    DPSNoCrit = NumOrZero $r[25]
    HPS = NumOrZero $r[26]
    Socket = NumOrZero $r[27]
  }
}
$secondaryItems = @()
for ($i=9; $i -le 18; $i++) {
  $r = $secRows[$i]
  if ([string]::IsNullOrWhiteSpace($r[0])) { continue }
  $secondaryItems += Build-SecondaryItem $r "Rocket"
}
for ($i=30; $i -le 33; $i++) {
  $r = $secRows[$i]
  if ([string]::IsNullOrWhiteSpace($r[0])) { continue }
  $secondaryItems += Build-SecondaryItem $r "SonicShooter"
}
Write-Output ("Secondary items: " + $secondaryItems.Count)
$secondaryItems | ConvertTo-Json -Depth 4 | Out-File -FilePath ($out + 'data_secondary.json') -Encoding utf8

Write-Output "DONE"
