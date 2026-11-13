# Orca fork verification

Verified on Windows 11 / WSL2, with rootless Podman 6.2.0. This records a bounded hardening review of the independent Orca fork based on `b1fefd9fcd3b93e6e12a9bbc51e217976ead61b3`.

## Functional evidence

- Real Node server and upstream React browser UI run in the local Linux container. The local page responds HTTP 200 at `http://127.0.0.1:6768/`.
- New browsers require pairing. Owner-only `orca pair --address 127.0.0.1 --rotate` creates an access offer without restarting. Owner offers have a five-minute expiration; backend regressions verify expiration across registry reload and no widening for loopback offers.
- Actual malformed/foreign Host and foreign/opaque Origin requests return HTTP 403. Foreign-Origin WebSocket upgrade returns 403. A plaintext unauthenticated `repo.list` attempt closes with 4001 and returns no project catalog.
- `orca repo add --kind folder` creates a persistent workspace under `/data/workspaces`. `orca terminal create`, followed by `orca terminal read`, executes Python 3 and Bash and returns `PYTHON_OK` and `BASH_OK` through the real PTY stream.
- Python/Bash output files and an independent persistence marker survive real container restart and replacement using `orca-data`.
- Actual browser tab creation and accessibility snapshot run through Orca's packaged agent-browser driver. Chromium's internal `chrome://sandbox` page reports Namespace, PID namespaces, Network namespaces, Seccomp-BPF and TSYNC enabled. Its renderer processes have UID 1000, zero effective capabilities, no-new-privileges and Seccomp mode 2. The main browser launch and renderer processes carry no sandbox-disable or certificate-bypass flags. Chromium's internal zygote/broker setup uses its own namespace flags and temporary capabilities; this does not disable the renderer sandbox.
- Actual relay pairing returns `{available:false, reason:'fork_policy'}`. Mobile and desktop policy regression suites verify saved consent/credentials cannot enable denied services.
- Edge pairing smoke initially found a desktop-only Linear listener incorrectly sent as an RPC, preventing workspace bootstrap. The fork supplies the typed listener boundary while preserving paired event-stream delivery and real Linear RPCs. Regression tests and final browser verification cover the fix.
- Narrow browser viewport is 390 pixels with no document-width overflow. This preserves upstream layout; it is not a complete mobile UX redesign.

## Build and checks

Builds use Node 24.22.1, pnpm 12.14.0 and Bun 1.4.4. Node image digest and agent-browser 0.39.4 SHA-256 are pinned in `Dockerfile` and `install-browser-driver.mjs`. Linux builds produce the actual Node host, CLI, PTY addon, upstream mobile bundle and React web client. License collection includes both lockfile workspaces and the Apache-2.0 syscall profile notice.

The review includes focused boundary/compatibility regressions, typechecking, formatting/linting, real browser smoke checks, frozen dependency builds and the upstream `pnpm check:changed` handoff gate. Raw build/check logs remain in the task's temporary verification area. Counts and final results are reported in the completion message; this document does not claim the entire upstream test suite was run.

Root production advisories were fixed with Hono 4.13.16 and @hono/node-server 2.1.6. Mobile production advisories were fixed with glob 14.0.2, minimatch 11.0.1 and node-forge 1.4.3; these replace earlier backports. Both production dependency audits return zero known vulnerabilities. Compatibility is checked by rebuilding the mobile bundle and running its affected tests.

## Agent runtimes

The image includes Claude Code 2.1.325 and Codex 0.169.0, installed from the frozen npm lockfile with package scripts disabled and only Claude's inspected local binary-placement script run explicitly. Both native CLI versions launch successfully as UID 1000. Their separate production dependency audit returns zero known vulnerabilities. Credential checks verify private writes, expired-token rejection, preservation after rejected imports, refusal of public-readable/symlinked credential files and removal of competing Foundry credentials from Claude's Bedrock launch environment.

Codex returned the actual assistant response `CODEX_GATEWAY_OK` through the Accela organization gateway using its scoped auth helper. A second actual assistant response, `CODEX_CATALOG_OK`, verifies the private Accela catalog eliminates model-refresh decoding errors. Claude is configured for Bedrock; its AWS session still requires refresh before authenticated inference can be verified. Orca itself opened a structured Codex chat and its actual assistant transcript returned `ORCA_CODEX_OK`. A native Codex read-only shell tool executed Python and returned `124423` with exit 0. Its app-server requirements report confirms plugins and in-app updates are pinned off and all telemetry exporters are `none`. After container replacement, the paired Edge UI loads the persistent workspace with zero page errors, no external UI request origins and no overflow at 390 pixels; admission and real browser snapshots still work.

## Remaining limits

Browser headless screencast, imported browser profiles and Electron desktop computer use are unavailable. The container is a single-owner local deployment, with intentional code execution and network access. It adds no tenant isolation, egress firewall, Entra authentication or internet deployment. Private profile credential sealing is reversible by a person who can read the volume and its local key. A volume is durable storage, not a backup.

This is not a guarantee that every upstream or third-party defect is eliminated. Local logs remain available. Static containment relies on immutable image assets and their ancestors. The HTTP health check proves asset serving, not agent/model functionality. Signals handle container shutdown because its install directory is read-only; managed stop-file writes are unavailable.
