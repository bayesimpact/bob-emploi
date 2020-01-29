#!/bin/bash

set -e

# Tag to use for Docker images.
readonly TAG="${1:-latest}"
# Folder where to build the client Docker. If empty, will work in a tmp folder
# and clean up on leaving.
BUILD_DIR="$2"

if [ -z "$BUILD_DIR" ]; then
  readonly TEMP_BUILD_DIR="$(mktemp -d)"
  BUILD_DIR="$TEMP_BUILD_DIR"
fi

if [ -z "$CLIENT_VERSION" ]; then
  CLIENT_VERSION="$(echo $GIT_SHA1 | cut -c -7)"
fi
readonly PROD_CLIENT_VERSION="prod.$CLIENT_VERSION"

function build_dist_folder {
  tag=$1
  build_dir=$2

  # Build the dist folder inside a container to benefit from Docker caching.
  time docker-compose build --pull frontend-dev
  readonly dockerfile="$(mktemp --tmpdir=$build_dir)"
  # We retag with the image hash not to include the tag in the Dockerfile.
  image_hash=$(docker inspect --format='{{.Id}}' bayesimpact/bob-emploi-dev:${tag} | sed -e "s/.*://")
  docker tag bayesimpact/bob-emploi-dev:${tag} bayesimpact/bob-emploi-dev:${image_hash}
  sed -e 's/^FROM.*$/\0:'${image_hash}/ < frontend/release/Dockerfile.build > "$dockerfile"
  readonly image="bayesimpact/bob-emploi-frontend-build:${tag}"
  time docker build --build-arg CLIENT_VERSION="$PROD_CLIENT_VERSION" -f "$dockerfile" -t "$image" "$build_dir"
  rm "$dockerfile"

  readonly container=$(docker create "$image")
  docker cp $container:/usr/app/dist "$build_dir"
  if [ -z "$CIRCLECI" ] || [ -n "$CIRCLE_STAGE" ]; then
    docker rm $container
  fi
}

build_dist_folder "$TAG" "$BUILD_DIR"

# Build the frontend container.
cp \
  frontend/release/nginx.conf \
  frontend/release/entrypoint.sh \
  frontend/release/Dockerfile \
  frontend/client/cfg/const_dist.json5 \
  "$BUILD_DIR"
time docker build --pull \
  --build-arg GIT_SHA1="$GIT_SHA1" \
  --build-arg CLIENT_VERSION="$PROD_CLIENT_VERSION" \
  -t "bayesimpact/bob-emploi-frontend:$TAG" \
  "$BUILD_DIR"

if [ -n "$TEMP_BUILD_DIR" ]; then
  rm -rf "$TEMP_BUILD_DIR"
fi

# Build the frontend-flask container.
docker-compose build --pull frontend-flask
