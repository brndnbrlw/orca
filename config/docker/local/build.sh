#!/bin/sh
set -eu
engine=${CONTAINER_ENGINE:-podman}
image=${ORCA_IMAGE:-localhost/orca:local}
repo=$(CDPATH= cd -- "$(dirname -- "$0")/../../.." && pwd)
context=$(mktemp -d "${TMPDIR:-/tmp}/orca-container-build.XXXXXX")
cd "$repo"
git ls-files -z --cached --others --exclude-standard > "$context/source-files.txt"
tar --null -T "$context/source-files.txt" -cf "$context/orca-source.tar"
git clone --bare --template= --no-hardlinks --local "$repo" "$context/source-git"
git -C "$context/source-git" config core.bare false
git -C "$context/source-git" config --unset-all remote.origin.url
tar -cf "$context/orca-git.tar" -C "$context/source-git" .
cp config/docker/local/Dockerfile "$context/Dockerfile"
if [ "$(basename "$engine")" = "podman" ]; then set -- --format docker; else set --; fi
"$engine" build "$@" --target runtime --tag "$image" --file "$context/Dockerfile" "$context"
printf 'Built %s. Source archive: %s\n' "$image" "$context"
