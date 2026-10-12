#!/usr/bin/env bash
# Zero-downtime rolling update for the docker-compose stack.
# Starts the new image next to the old one, waits until it is healthy, then retires the old container.
# If the new container never becomes healthy, it is removed and the old one keeps serving (automatic rollback).
#
# Usage (on the server, in the deploy directory):  ./scripts/rolling-deploy.sh ghcr.io/akhilmonanilkumar/tradeplay:<sha>
set -euo pipefail

IMAGE="${1:?usage: rolling-deploy.sh <image:tag>}"
SERVICE=app
TIMEOUT="${HEALTH_TIMEOUT:-90}"

export APP_IMAGE="$IMAGE"
echo "▶ pulling $IMAGE"
docker compose pull "$SERVICE"

old_ids=$(docker compose ps -q "$SERVICE" || true)

if [ -z "$old_ids" ]; then
  echo "▶ first deploy"
  docker compose up -d --wait
  exit 0
fi

echo "▶ starting new replica alongside: $old_ids"
docker compose up -d --no-deps --no-recreate --scale "$SERVICE=2" "$SERVICE"

new_id=$(docker compose ps -q "$SERVICE" | grep -vxF "$old_ids" | head -n1)
[ -n "$new_id" ] || { echo "✗ new container not created"; exit 1; }

echo "▶ waiting for $new_id to become healthy (max ${TIMEOUT}s)"
status=starting
for _ in $(seq 1 "$TIMEOUT"); do
  status=$(docker inspect -f '{{.State.Health.Status}}' "$new_id" 2>/dev/null || echo missing)
  [ "$status" = healthy ] && break
  [ "$status" = unhealthy ] && break
  sleep 1
done

if [ "$status" != healthy ]; then
  echo "✗ new replica is $status — rolling back"
  docker logs --tail 50 "$new_id" || true
  docker rm -f "$new_id" >/dev/null
  exit 1
fi

echo "▶ healthy — draining old replica(s)"
sleep 5   # let Caddy notice the new upstream
for id in $old_ids; do
  docker stop -t 20 "$id" >/dev/null && docker rm "$id" >/dev/null
done
docker compose up -d --no-deps --no-recreate --scale "$SERVICE=1" "$SERVICE"
docker image prune -f >/dev/null
echo "✓ rolled out $IMAGE"
