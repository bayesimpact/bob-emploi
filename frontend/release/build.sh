#!/bin/bash

set -e

# Package Client App in dist folder.
if $(docker inspect frontend-dev-webpack > /dev/null); then
  # On CircleCI remote Docker environment, containers cannot start with volumes
  # so we use a special script. Also the --rm option doesn't work on CircleCI.
  docker exec -t frontend-dev-webpack npm run dist
  # Copy the created dist back to the host, as we could not mount the volume that would have
  # allowed to do this automatically.
  docker cp frontend-dev-webpack:usr/app/dist ./frontend
else
  docker-compose build --pull frontend-dev-webpack
  docker-compose run $([[ -z ${CIRCLECI} ]] && echo --rm) frontend-dev-webpack npm run dist
fi

# Build the frontend container.
docker build --pull \
  --build-arg GIT_SHA1="$GIT_SHA1" \
  -f frontend/release/Dockerfile \
  -t bayesimpact/bob-emploi-frontend \
  frontend

# Build the frontend-flask container.
docker-compose build --pull frontend-flask
