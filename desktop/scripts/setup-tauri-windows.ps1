# Prepara o ambiente Windows e abre o app Tauri em modo dev.
#   powershell -ExecutionPolicy Bypass -File desktop\scripts\setup-tauri-windows.ps1
#   -Full  regenera o build web antes (sem ele, usa desktop\web se ja existir)
#   -Build gera o instalador NSIS (src-tauri\target\release\bundle\nsis) em vez de abrir o app
# Tudo vai para desktop\tauri-setup.log.
param([switch]$Full, [switch]$Build)
$ErrorActionPreference = 'Continue'
$desktop = Split-Path -Parent $PSScriptRoot
$log = Join-Path $desktop 'tauri-setup.log'
Set-Content -Path $log -Value "== $(Get-Date -Format s) setup-tauri-windows" -Encoding UTF8

function Say($text) { Write-Host $text -ForegroundColor Cyan; Add-Content -Path $log -Value $text -Encoding UTF8 }
function Run($exe, [string[]]$argv) {
  Say "> $exe $($argv -join ' ')"
  & $exe @argv 2>&1 | ForEach-Object { $line = "$_"; Write-Host $line; Add-Content -Path $log -Value $line -Encoding UTF8 }
  if ($LASTEXITCODE -ne 0) { throw "$exe $($argv -join ' ') falhou (codigo $LASTEXITCODE)" }
}
function Refresh-Path {
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User') + ";$env:USERPROFILE\.cargo\bin"
}

try {
  Refresh-Path
  # 1. Rust (toolchain MSVC)
  if (-not (Get-Command rustup -ErrorAction SilentlyContinue)) {
    Say 'Instalando o Rust (rustup)...'
    Run 'winget' @('install', '--id', 'Rustlang.Rustup', '-e', '--accept-source-agreements', '--accept-package-agreements')
    Refresh-Path
  }
  Run 'rustup' @('default', 'stable-msvc')
  Run 'cargo' @('--version')

  # 2. Ferramentas C++ do Visual Studio (linker MSVC)
  $vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
  $vc = $null
  if (Test-Path $vswhere) {
    $vc = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
  }
  if ($vc) { Say "Ferramentas C++: $vc" } else {
    Say 'Instalando Visual Studio Build Tools (C++)... pode demorar.'
    Run 'winget' @('install', '--id', 'Microsoft.VisualStudio.2022.BuildTools', '-e', '--accept-source-agreements', '--accept-package-agreements',
      '--override', '--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended')
  }

  # 3. Dependencias, testes e app
  Push-Location $desktop
  Run 'npm' @('install', '--no-audit', '--no-fund')
  Run 'npm' @('run', 'test:rust')
  $hasWeb = Test-Path (Join-Path $desktop 'web\index.html')
  if ($Build) { Run 'npm' @('run', 'tauri:build') }
  elseif ($Full -or -not $hasWeb) { Run 'npm' @('run', 'tauri:dev') }
  else { Run 'npm' @('run', 'tauri:dev:fast') }
  Say '== OK'
} catch {
  Say "== ERRO: $_"
  Read-Host 'Falhou. Veja desktop\tauri-setup.log. Enter para fechar'
} finally {
  Pop-Location -ErrorAction SilentlyContinue
}
