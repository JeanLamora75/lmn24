#!/usr/bin/env bash
# LMN24 — controlled deployment of an exact Git commit on the OVH VPS.
# Run as ubuntu with: bash -s -- <40-character commit SHA>
set -Eeuo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: deploy-production.sh <commit-sha>" >&2
  exit 2
fi

TARGET_SHA="$1"
if [[ ! "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Invalid commit SHA" >&2
  exit 2
fi

APP_DIR="/home/ubuntu/lmn24"
cd "$APP_DIR"

if [ ! -f .env ]; then
  echo "Missing production .env; deployment stopped" >&2
  exit 1
fi

# Next.js may regenerate its tracked next-env.d.ts during a build.
# Only that specific unstaged generated file may be reset; block every other
# tracked/staged change so no human edits are silently discarded.
if [ -n "$(git status --porcelain --untracked-files=no -- . ':(exclude)apps/frontend/next-env.d.ts')" ] ||
   ! git diff --cached --quiet -- apps/frontend/next-env.d.ts; then
  echo "Tracked files other than generated next-env.d.ts were modified on the VPS; deployment stopped" >&2
  exit 1
fi

if ! git diff --quiet -- apps/frontend/next-env.d.ts; then
  echo "Resetting only Next.js-generated apps/frontend/next-env.d.ts before deploying..."
  git restore --worktree -- apps/frontend/next-env.d.ts
fi

# Refuse a deploy when required privileges or services are unavailable.
sudo -n /usr/bin/systemctl is-active --quiet lmn24-backend.service
sudo -n /usr/bin/systemctl is-active --quiet lmn24-parser.service
sudo -n /usr/bin/systemctl is-active --quiet lmn24-frontend.service

git fetch --no-tags origin main
git cat-file -e "$TARGET_SHA^{commit}"
if ! git merge-base --is-ancestor "$TARGET_SHA" origin/main; then
  echo "Commit is not part of origin/main; deployment refused" >&2
  exit 1
fi

PREVIOUS_SHA="$(git rev-parse HEAD)"
echo "Currently deployed checkout: $PREVIOUS_SHA"
echo "Requested deployment:       $TARGET_SHA"

if [ "$PREVIOUS_SHA" = "$TARGET_SHA" ]; then
  echo "Commit already checked out; no deployment necessary."
  exit 0
fi

# Safeguard: never run automatic DB migrations or seeds on production.
# Existing backup service is required to succeed before any code change.
echo "Running precautionary production backup..."
sudo -n /usr/bin/systemctl start lmn24-backup.service

health_check() {
  local attempt
  for attempt in $(seq 1 45); do
    if curl -fsS --max-time 5 http://127.0.0.1:3001/health >/dev/null 2>&1 &&
       curl -fsS --max-time 5 http://127.0.0.1:3002/health >/dev/null 2>&1 &&
       curl -fsS --max-time 5 http://127.0.0.1:3000/fr >/dev/null 2>&1; then
      echo "Health checks OK: backend, parser, frontend."
      return 0
    fi
    sleep 2
  done
  echo "Health checks failed after 90 seconds." >&2
  return 1
}

SWITCH_ATTEMPTED=0
on_failure() {
  local failure_code="$1"
  trap - ERR
  echo "Deployment failed (exit $failure_code)." >&2
  if [ "$SWITCH_ATTEMPTED" -ne 1 ]; then
    exit "$failure_code"
  fi

  echo "Trying to restore the previous code version $PREVIOUS_SHA..." >&2
  if git switch --detach "$PREVIOUS_SHA" &&
     pnpm install --frozen-lockfile &&
     node --env-file=.env --run build &&
     sudo -n /usr/bin/systemctl restart lmn24-backend.service lmn24-parser.service lmn24-frontend.service &&
     health_check; then
    echo "Previous version restored successfully; database was not changed." >&2
  else
    echo "URGENT: automatic rollback failed; inspect systemd logs on the VPS." >&2
  fi
  exit "$failure_code"
}
trap 'on_failure "$?"' ERR

echo "Switching checkout to approved commit..."
SWITCH_ATTEMPTED=1
git switch --detach "$TARGET_SHA"

echo "Installing dependencies..."
pnpm install --frozen-lockfile

echo "Building all applications using production environment..."
node --env-file=.env --run build

echo "Restarting LMN24 services..."
sudo -n /usr/bin/systemctl restart lmn24-backend.service lmn24-parser.service lmn24-frontend.service

health_check
trap - ERR
echo "Deployment successful. Commit: $TARGET_SHA"
