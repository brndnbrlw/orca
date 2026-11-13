function Resolve-OrcaContainerEngine {
  param([string]$RequestedEngine = 'podman')
  if (Get-Command -Name $RequestedEngine -ErrorAction SilentlyContinue) { return $RequestedEngine }
  if ($RequestedEngine -ne 'podman') { throw "Container engine not found: $RequestedEngine" }
  $portablePath = Join-Path $env:LOCALAPPDATA 'Programs/OrcaContainerRuntime/podman-6.2.0/podman-6.2.0/usr/bin/podman.exe'
  if (Test-Path -LiteralPath $portablePath -PathType Leaf) { return $portablePath }
  throw 'Install Podman or pass its absolute executable path with -Engine.'
}
