param([string]$Engine = 'podman', [string]$Image = 'localhost/orca:local', [string]$Target = 'runtime')
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'resolve-engine.ps1')
$Engine = Resolve-OrcaContainerEngine $Engine
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$contextRoot = Join-Path ([IO.Path]::GetTempPath()) ('orca-container-build-' + [guid]::NewGuid())
[IO.Directory]::CreateDirectory($contextRoot) | Out-Null
# The Git source list excludes host state, dependency stores, ignored credentials, and build outputs.
$listPath = Join-Path $contextRoot 'source-files.txt'
Push-Location -LiteralPath $repoRoot
try {
  $files = & git -c core.quotepath=false ls-files --cached --others --exclude-standard
  if ($LASTEXITCODE -ne 0) { throw 'Cannot enumerate Orca source' }
  [IO.File]::WriteAllLines($listPath, [string[]]$files, [Text.UTF8Encoding]::new($false))
  & tar.exe -cf (Join-Path $contextRoot 'orca-source.tar') -T $listPath
  if ($LASTEXITCODE -ne 0) { throw 'Cannot archive Orca source' }
  $metadataRoot = Join-Path $contextRoot 'source-git'
  & git clone --bare --template= --no-hardlinks --local $repoRoot $metadataRoot
  if ($LASTEXITCODE -ne 0) { throw 'Cannot preserve source Git identity' }
  & git -C $metadataRoot config core.bare false
  # The Windows source archive contains working-tree CRLF; normalize it for Git comparisons in Linux.
  & git -C $metadataRoot config core.autocrlf true
  & git -C $metadataRoot config --unset-all remote.origin.url
  & tar.exe -cf (Join-Path $contextRoot 'orca-git.tar') -C $metadataRoot .
  if ($LASTEXITCODE -ne 0) { throw 'Cannot archive source Git identity' }
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Dockerfile') -Destination (Join-Path $contextRoot 'Dockerfile')
  $formatArguments = if ([IO.Path]::GetFileNameWithoutExtension($Engine) -eq 'podman') { @('--format', 'docker') } else { @() }
  & $Engine build @formatArguments --target $Target --tag $Image --file (Join-Path $contextRoot 'Dockerfile') $contextRoot
  if ($LASTEXITCODE -ne 0) { throw 'Orca image build failed' }
} finally {
  Pop-Location
}
Write-Output "Built $Image. Source archive retained at $contextRoot for reproducibility."
