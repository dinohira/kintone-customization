# Requires: PowerShell 5+
param(
  [Parameter(Mandatory=$false)] [ValidateSet('major','minor','patch')] [string] $Part = 'patch',
  [Parameter(Mandatory=$false)] [string] $File = '2Aフロートウィンドウ.js',
  [switch] $WhatIf
)

function Get-NewVersion([string]$current,[string]$part){
  if (-not ($current -match '^(\d+)\.(\d+)\.(\d+)$')){ throw "Invalid semver: $current" }
  $maj = [int]$Matches[1]; $min = [int]$Matches[2]; $pat = [int]$Matches[3]
  switch($part){
    'major' { $maj++; $min=0; $pat=0 }
    'minor' { $min++; $pat=0 }
    default { $pat++ }
  }
  return "$maj.$min.$pat"
}

if (-not (Test-Path -LiteralPath $File)){
  throw "File not found: $File"
}

$content = Get-Content -LiteralPath $File -Raw

# 1) ヘッダ @version の抽出と更新
$headerPattern = '(?m)(^\s*\*\s*@version\s*)(\d+\.\d+\.\d+)(\s*$)'
$headerMatch = [regex]::Match($content, $headerPattern)
if (-not $headerMatch.Success){
  throw "@version header not found in $File"
}
$current = $headerMatch.Groups[2].Value
$next = Get-NewVersion -current $current -part $Part

$updated = [regex]::Replace($content, $headerPattern, { param($m) $m.Groups[1].Value + $next + $m.Groups[3].Value })

# 2) 定数 FW_VERSION の更新（シングル/ダブルクォート両対応）
$fwPattern = '(?m)(const\s+FW_VERSION\s*=\s*["\'])(\d+\.\d+\.\d+)(["\'])'
if ([regex]::IsMatch($updated, $fwPattern)){
  $updated = [regex]::Replace($updated, $fwPattern, { param($m) $m.Groups[1].Value + $next + $m.Groups[3].Value })
} else {
  Write-Warning "FW_VERSION constant not found. Only @version updated."
}

if ($WhatIf){
  Write-Host "Current : $current" -ForegroundColor Yellow
  Write-Host "Next    : $next" -ForegroundColor Green
  exit 0
}

Set-Content -LiteralPath $File -Value $updated -Encoding UTF8
Write-Host "Bumped $File: $current -> $next" -ForegroundColor Green
