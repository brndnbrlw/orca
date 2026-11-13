FROM docker.io/library/node:24.22.1-bookworm-slim@sha256:e1582112fb9f152ed38eefcd712efc93fee1becb519fdfa57574d5e07eaa5e7d AS build
ENV CI=1 ORCA_BACKGROUND_LAUNCH=1 ELECTRON_SKIP_BINARY_DOWNLOAD=1
WORKDIR /src
RUN apt-get update && apt-get install -y --no-install-recommends build-essential git python3 pkg-config ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@12.14.0 --activate
COPY orca-source.tar /tmp/orca-source.tar
COPY orca-git.tar /tmp/orca-git.tar
RUN tar -xf /tmp/orca-source.tar -C /src && mkdir -p /src/.git && tar -xf /tmp/orca-git.tar -C /src/.git && rm /tmp/orca-source.tar /tmp/orca-git.tar
# Skip the desktop Electron postinstall. Build only the packages and Node host needed here.
RUN pnpm install --frozen-lockfile --ignore-scripts && pnpm rebuild esbuild bun
RUN pnpm -C mobile install --frozen-lockfile --ignore-scripts && pnpm -C mobile rebuild esbuild && pnpm -C mobile run postinstall
RUN node config/docker/local/install-browser-driver.mjs && pnpm run build:packages && pnpm run build:mobile-web && pnpm run build:orcad && pnpm run build:web && node config/docker/local/collect-notices.mjs

FROM docker.io/library/node:24.22.1-bookworm-slim@sha256:e1582112fb9f152ed38eefcd712efc93fee1becb519fdfa57574d5e07eaa5e7d AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends bash python3 git ca-certificates chromium tini && rm -rf /var/lib/apt/lists/*
COPY --from=build /src/out/orcad /opt/orca/orcad
COPY --from=build /src/out/runtimes /opt/orca/runtimes
COPY --from=build /src/out/web /opt/orca/web
COPY --from=build /src/LICENSE /opt/orca/LICENSE
COPY --from=build /src/out/container-notices /opt/orca/third-party-notices
COPY --from=build /src/config/docker/local/entrypoint.sh /usr/local/bin/orca-container
COPY --from=build /src/config/docker/local/orca-cli.sh /usr/local/bin/orca
COPY --from=build /src/config/docker/local/chromium.py /usr/local/bin/orca-chromium
COPY --from=build /src/config/docker/local/use-bundled-node.mjs /opt/orca/use-bundled-node.mjs
RUN node /opt/orca/use-bundled-node.mjs
RUN chmod 755 /usr/local/bin/orca-container /usr/local/bin/orca /usr/local/bin/orca-chromium && mkdir -p /data/home /data/state /data/workspaces && chown -R node:node /data
ENV HOME=/data/home ORCA_USER_DATA=/data/state ORCA_USER_DATA_PATH=/data/state ORCA_BACKGROUND_LAUNCH=1 ORCA_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 DISABLE_TELEMETRY=1 DISABLE_ERROR_REPORTING=1 CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 ORCA_DIAGNOSTICS_DISABLED=1 ORCA_MOBILE_PUSH_MODE=disabled ORCA_BROWSER_EXECUTABLE=/usr/local/bin/orca-chromium NODE_ENV=production
USER node
WORKDIR /data/workspaces
EXPOSE 6768
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s CMD ["node", "-e", "fetch('http://127.0.0.1:6768/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/orca-container"]
