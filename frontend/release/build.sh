#!/bin/bash

set -e

if [ -z "${CIRCLECI}" ]; then
  # `docker rm` doesn't work on CircleCI.
  readonly RM_FLAG="--rm"
fi

# Package Client App in dist folder.
docker-compose build --pull frontend-dev-webpack
docker-compose run ${RM_FLAG} frontend-dev-webpack npm run dist

# Build the frontend container.
docker build --pull \
  --build-arg GIT_SHA1="$GIT_SHA1" \
  -f frontend/release/Dockerfile \
  -t docker.bayesimpact.org/bob-emploi/frontend \
  frontend

# Build the frontend-flask container.
docker-compose build --pull frontend-flask
