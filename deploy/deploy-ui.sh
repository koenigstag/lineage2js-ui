#!/usr/bin/env bash
#
# Deploys the web client. Runs *on the VPS*, not locally: VITE_* vars are
# baked into the bundle at build time, so whichever machine builds is the one
# that has to hold them -- and keeping them in a file on the box rather than
# in GitHub repository variables means adding one is an edit, not a trip
# through a workflow's env: block.
#
# nginx serves the result from $TARGET; see nginx/l2-client.conf. The build
# output cannot be served straight out of the checkout, because $HOME is
# drwxr-x--- and www-data cannot traverse it.
#
#   ssh myhost '~/lineage2/lineage2js-ui/deploy/deploy-ui.sh'
#
set -euo pipefail

REPO="${REPO:-$HOME/lineage2/lineage2js-ui}"
TARGET="${TARGET:-/srv/l2client/dist}"
BRANCH="${BRANCH:-main}"

cd "$REPO"

# A pull here fails whenever a new commit starts tracking a .gitkeep that
# already exists untracked on the box (the asset folders are gitignored except
# for their structure). Deleting the untracked marker is safe -- the real
# assets next to it are not touched -- but it is left as a manual step on
# purpose, so this script never removes files on its own.
git pull --ff-only origin "$BRANCH"

pnpm install --frozen-lockfile

# Plain `build`, not `build:pages`: served at the root of its own host, so the
# base path is "/" rather than the /lineage2js-ui/ subdirectory Pages needed.
# Reads packages/ui/.env.production, which is gitignored and lives only here.
pnpm --filter @lineage2js/ui build

mkdir -p "$TARGET"
rsync -a --delete packages/ui/dist/ "$TARGET/"

echo "Deployed $(git rev-parse --short HEAD) to $TARGET"
