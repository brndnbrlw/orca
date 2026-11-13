param([string]$Engine = 'podman', [string]$Image = 'localhost/orca:local')
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'resolve-engine.ps1')
$Engine = Resolve-OrcaContainerEngine $Engine
$profilePath = Join-Path $PSScriptRoot 'chromium-seccomp.json'
& $Engine container inspect orca *> $null
if ($LASTEXITCODE -eq 0) { throw 'Container orca already exists. Stop/remove that container explicitly before replacing it; preserve the orca-data volume.' }
& $Engine run -d --name orca -p 127.0.0.1:6768:6768 -v orca-data:/data --read-only --tmpfs /tmp:rw,nosuid,nodev,size=512m --cap-drop ALL --security-opt no-new-privileges --security-opt "seccomp=$profilePath" --pids-limit 512 --memory 4g --cpus 2 --shm-size 256m --stop-timeout 30 --restart unless-stopped $Image
if ($LASTEXITCODE -ne 0) { throw 'Orca container start failed' }
Write-Output 'Orca: http://127.0.0.1:6768/. Generate an owner access link with: podman exec orca orca pair --address 127.0.0.1 --rotate'
