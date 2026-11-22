#!/usr/bin/env bash
# LMN24 Guide TV - single-command guarded production rollout.
# Run using: git fetch origin main && git show origin/main:scripts/release-tv-production.sh | bash
set -Eeuo pipefail
cd /home/ubuntu/lmn24
test -f .env || { echo "Missing .env"; exit 1; }
SHA="$(git rev-parse origin/main)"
DB="$(node --env-file=.env -e 'const s=process.env.DATABASE_URL;if(!s)process.exit(2);const u=new URL(s);if(u.protocol!=="postgresql:"&&u.protocol!=="postgres:")process.exit(3);console.log(decodeURIComponent(u.pathname.slice(1)))')"
test -n "$DB" || { echo "Missing database name in DATABASE_URL"; exit 1; }
echo "Target Git commit: $SHA"
echo "Database: $DB (credentials hidden)"
tmp="$(mktemp -d)"
scratch="lmn24_tv_rehearsal_$$"
cleanup() {
  sudo -n -u postgres dropdb --if-exists "$scratch" >/dev/null 2>&1 || true
  rm -rf "$tmp"
}
trap cleanup EXIT
for file in \
  database/tests/tv_production_preflight.sql \
  database/migrations/20261122_tv_initial_schema.sql \
  database/migrations/20261121_tv_channel_activation_optional_number.sql \
  database/migrations/20261121_tv_epg_source_scope.sql \
  database/seed_tv_countries_249.sql; do
  mkdir -p "$tmp/$(dirname "$file")"
  git show "$SHA:$file" > "$tmp/$file"
done
sql() { sudo -n -u postgres psql -X -v ON_ERROR_STOP=1 -d "$1" < "$2"; }
echo "Checking production prerequisites (read-only)..."
sql "$DB" "$tmp/database/tests/tv_production_preflight.sql"
actual="$(sudo -n -u postgres psql -X -At -d "$DB" -c "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'tv_%'")"
if [ "$actual" != 0 ]; then
  echo "TV tables already exist ($actual): refusing first-time installation; manual review needed."
  exit 1
fi
echo "Building isolated PostgreSQL schema rehearsal..."
sudo -n -u postgres createdb "$scratch"
sudo -n -u postgres pg_dump --schema-only --no-owner --no-privileges -d "$DB" > "$tmp/current-schema.sql"
sudo -n -u postgres psql -X -v ON_ERROR_STOP=1 -d "$scratch" < "$tmp/current-schema.sql" > "$tmp/rehearsal.log"
sudo -n -u postgres pg_dump --data-only --table=public.country --no-owner --no-privileges -d "$DB" > "$tmp/country-data.sql"
sudo -n -u postgres psql -X -v ON_ERROR_STOP=1 -d "$scratch" < "$tmp/country-data.sql" >> "$tmp/rehearsal.log"
sql "$scratch" "$tmp/database/migrations/20261122_tv_initial_schema.sql" >> "$tmp/rehearsal.log"
sql "$scratch" "$tmp/database/migrations/20261121_tv_channel_activation_optional_number.sql" >> "$tmp/rehearsal.log"
sql "$scratch" "$tmp/database/migrations/20261121_tv_epg_source_scope.sql" >> "$tmp/rehearsal.log"
sql "$scratch" "$tmp/database/seed_tv_countries_249.sql" >> "$tmp/rehearsal.log"
echo "Isolated schema + 249 countries rehearsal passed."
echo "Starting mandatory precautionary backup..."
sudo -n systemctl start lmn24-backup.service
sudo -n systemctl is-failed --quiet lmn24-backup.service && { echo "Backup failed"; exit 1; }
echo "Applying TV migration to production..."
sql "$DB" "$tmp/database/migrations/20261122_tv_initial_schema.sql"
sql "$DB" "$tmp/database/migrations/20261121_tv_channel_activation_optional_number.sql"
sql "$DB" "$tmp/database/migrations/20261121_tv_epg_source_scope.sql"
sql "$DB" "$tmp/database/seed_tv_countries_249.sql"
count="$(sudo -n -u postgres psql -X -At -d "$DB" -c "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'tv_%'")"
test "$count" = 19 || { echo "Expected 19 TV tables, got $count"; exit 1; }
echo "TV schema installed (19 tables); deploying code..."
git show "$SHA:scripts/deploy-production.sh" | bash -s -- "$SHA"
echo "TV rollout completed. Public gate / EPG source activation remain separate decisions."
