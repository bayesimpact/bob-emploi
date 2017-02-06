#!/usr/bin/env bash

set -e

readonly PROJECT="bob-emploi"

TAG="$1"

function push() {
  local IMAGE="bayesimpact/${PROJECT}-$1"
  docker tag "${IMAGE}" "${IMAGE}:$2"
  docker push "${IMAGE}:$2"
}

push frontend-server "${TAG}"
push frontend "${TAG}"
