# Orca: independent local-container fork

Upstream: stablyai/orca, MIT license retained. Fork: brndnbrlw/orca.
Base: b1fefd9fcd3b93e6e12a9bbc51e217976ead61b3 (2026-11-13).
This project retains Orca branding and is independent of ASH.

## Design

Use the upstream Node orcad host and actual React browser client. Preserve workspaces, terminals, native agent integrations, pairing, local artifacts, and clean browser sessions. Disable vendor telemetry, reporting uploads, cloud relays/sharing/push, automatic vendor updates and background promotion. Preserve local operational logs for troubleshooting. Enforce disabled executable plugins, cloud recipes, and browser credential imports at backend boundaries, including saved approvals. Keep non-executable plugin contributions where supported.

Run as an unprivileged user in a Linux container. Publish only host loopback, keep pairing authentication, persist only the container-owned data/workspace volume, make system/assets immutable, and use no host credentials, browser profiles, Docker socket, privileged mode, or sandbox bypass. Browser access beyond loopback requires a separately reviewed HTTPS deployment.

Terminals deliberately execute code and can contact configured models/repositories/browser targets. Application policy cannot sandbox arbitrary terminal code; container filesystem and network boundaries remain necessary. This is not a claim that all upstream or dependency defects are eliminated.

## Implementation sequence

1. Create separate GitHub fork and checkout; preserve upstream license and source history.
2. Inventory actual telemetry transports and privileged workflows with independent reviewers.
3. Add immutable fork policy and guards; fix asset containment and browser upgrade admission with boundary regression tests.
4. Build pinned Node daemon and upstream browser assets in Linux with frozen pnpm dependencies. Avoid full desktop release/native platforms that are not used.
5. Package non-root runtime, persistent data, immutable assets, and short-lived manual local pairing. Disable startup pairing secrets in logs.
6. Bring up isolated local container runtime, build image, and publish only 127.0.0.1.
7. Verify HTTP assets, unauthorized/authenticated RPC, browser rendering, terminal bash/python, persistence across restart, and policy-denied workflows. Test without paid model calls or host credentials.
8. Review changed source, run appropriate type/build/test gates and pnpm check:changed before pushing; record actual evidence and remaining limitations.

## Acceptance evidence

Record commands, image/container identifiers, effective user/mount/port configuration, build and test results, and actual local URL. Do not label deployment complete before a real running container has passed checks. If the Windows VM cannot run WSL2 because nested virtualization is unavailable, report that exact failure, keep source/build preparation, and request only the host change needed; never restart automatically.
