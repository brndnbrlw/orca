# Orca local container fork

This is an independent fork of [stablyai/orca](https://github.com/stablyai/orca), retaining Orca's name, MIT license, browser UI, workspace model, terminals and native agent integrations. It is unrelated to ASH. The audited source base is `b1fefd9fcd3b93e6e12a9bbc51e217976ead61b3`.

## Behavior changes

- Vendor analytics, diagnostic/feedback uploads, cloud authentication, relay/push/connector factories, cloud artifact/skill sharing, vendor update/download refreshes and GitHub-star polling are permanently denied by `src/shared/orca-fork-policy.ts`. Saved consent and environment variables cannot enable these services. Local logs and local diagnostic capture remain available.
- Executable plugins, cloud recipes, browser credential imports and staged-cookie replay are denied at their execution boundaries. Non-executable plugin contributions and ordinary clean browser sessions remain available.
- New Claude and Codex chats and terminals default to **Ask**. Explicit user choices, including Full Access, are preserved. These approvals supplement the container boundary; they do not make arbitrary code trustworthy.
- HTTP/WebSocket admission checks Host and Origin. Static assets use real-path containment and live on the read-only image. Pairing is authenticated, and owner-generated unused offers expire after five minutes.
- The container runs as `node` (UID 1000), has no host credential/filesystem/socket mounts, drops all Linux capabilities, uses no-new-privileges and a read-only root filesystem, and publishes only `127.0.0.1:6768`. Memory, CPUs, processes and shared memory are bounded.
- The pinned agent-browser driver normally injects `--no-sandbox`. The immutable Chromium wrapper removes that driver default and rejects other insecure browser flags. Chromium's own namespace and Seccomp-BPF sandboxes remain enabled. `chromium-seccomp.json` derives from Podman 6.2.0's containers-common 0.70.0 profile, with only `chroot` made unconditional so Chromium can enter its private unprivileged user namespace. Container capabilities remain zero. The original Apache-2.0 license is included in `containers-common-LICENSE`.

## Build

A Linux x64 container engine is required. PowerShell helpers also detect the verified portable Podman install under the current user Programs directory. After a host reboot, start its existing machine with `podman machine start orca` (using the resolved executable when it is not on PATH). Podman on WSL2 is the verified Windows provider. The Node image and agent-browser release/hash are pinned; pnpm lockfiles are frozen. The source archive excludes ignored host credentials/state and dependencies; a separate credential-free bare clone preserves actual Git identity for Orca's build checks. Dockerfiles never copy the developer's `.git`, home or local credentials into the runtime image.

PowerShell, from the repository root:

```powershell
./config/docker/local/build.ps1 -Engine podman
```

Linux/macOS:

```sh
./config/docker/local/build.sh
```

The helpers retain their temporary source archive path for reproducibility. Builds include the upstream mobile web bundle, React web client, Node server, PTY native addon, browser driver, upstream notices and dependency notices. The desktop Electron application is not installed in this container.

## Run and pair

```powershell
./config/docker/local/run.ps1 -Engine podman
. ./config/docker/local/resolve-engine.ps1
$containerEngine = Resolve-OrcaContainerEngine
& $containerEngine exec orca orca pair --address 127.0.0.1 --rotate
```

Or on Linux:

```sh
./config/docker/local/run.sh
podman exec orca orca pair --address 127.0.0.1 --rotate
```

Open the access link printed by the **owner-only** pairing command within five minutes. It pairs this browser with the local server. Treat that link as a temporary secret. Already paired devices keep their access until revoked. Startup does not print pairing tokens. Plain [http://127.0.0.1:6768/](http://127.0.0.1:6768/) prompts for a pairing URL when the browser is new.

The optional `compose.yaml` uses the same settings; run it from this directory so the syscall profile resolves correctly. Do not publish this unencrypted endpoint to your LAN or the internet.

## Files, terminals and browser QA

The named `orca-data` volume holds `/data/home`, `/data/state` and `/data/workspaces`. Container restarts/replacement preserve it. This single-owner volume is not a backup or a multi-tenant isolation system. Profile credentials are sealed with a key in that private volume; a person who can read the whole volume or its backup can unseal them. Protect host/container-engine access and any backups.

Create a project in the UI, or import a folder:

```sh
podman exec orca node -e 'require("fs").mkdirSync("/data/workspaces/demo", {recursive:true})'
podman exec orca orca repo add --path /data/workspaces/demo --kind folder
podman exec orca orca terminal create --worktree path:/data/workspaces/demo --command 'python3 --version'
podman exec orca orca tab create --worktree path:/data/workspaces/demo --url http://127.0.0.1:6768/
podman exec orca orca snapshot --worktree path:/data/workspaces/demo
```

Bash, Python 3, Git and sandboxed Chromium are installed. Orca can inspect, interact with and screenshot browser pages. The headless Chromium provider does not offer Electron desktop computer use, browser profile import or live screencast; unsupported operations return explicit errors.

Native Claude/Codex integration is retained. Their separately installed CLIs and user-selected provider credentials are still needed for actual model work; paid inference is not part of this verification. SDK/provider traffic for tasks is separate from Orca's disabled vendor reporting. Do not inject your host's full environment, credential directory or browser profile into the container.

## Verification and limits

See `VERIFICATION.md` for the exact build, test and running-container evidence. The image health check proves HTTP asset serving; pairing, terminals, file persistence and browser operation require functional checks as well.

This is a bounded hardening review, not a claim that all security/privacy defects have been eliminated. Terminals and configured agents intentionally execute user code and may access the network. There is no blanket outbound firewall, per-tenant isolation, malware detection or organization authentication added here. Local browser testing checks actual initial requests; it is not an exhaustive audit of opaque third-party binaries. Future network hosting needs HTTPS, deployment-specific authentication/access policy, egress rules, storage backup and isolation review.

The read-only image prevents managed-server stop-file writes; normal container stop/restart uses signals. Vendor auto-updates and executable plugin/cloud paths remain unavailable. Keep current OS/package patches through reviewed image rebuilds.
