#!/bin/bash

set -e

function build_dist_folder {
  # Build the dist folder inside a container to benefit from Docker caching.
  docker-compose build --pull frontend-dev-webpack
  readonly dockerfile="$(mktemp --tmpdir=frontend/release)"
  sed -e 's/^FROM.*$/\0:'${1-latest}/ < frontend/release/Dockerfile.build > "$dockerfile"
  readonly image="bayesimpact/bob-emploi-frontend-build:${1:-latest}"
  docker build -f "$dockerfile" -t "$image" frontend
  rm "$dockerfile"

  readonly container=$(docker create "$image")
  docker cp $container:/usr/app/dist ./frontend
  docker rm $container
}

build_dist_folder "${1:-latest}"

# Build the frontend container.
docker build --pull \
  --build-arg GIT_SHA1="$GIT_SHA1" \
  -f frontend/release/Dockerfile \
  -t "bayesimpact/bob-emploi-frontend:${1:-latest}" \
  frontend

# Build the frontend-flask container.
docker-compose build --pull frontend-flask
