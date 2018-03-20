#!/usr/bin/env bash

set -e

readonly PROJECT="bob-emploi"

REMOTE_TAG="$1"
LOCAL_TAG="${2:-latest}"

function push() {
  local IMAGE="bayesimpact/$PROJECT-$1"
  local OPTIONAL="$2"
  if [[ -n "$OPTIONAL" ]] && [[ -z "$(docker images -a -q "$IMAGE:$LOCAL_TAG" 2> /dev/null)" ]]; then
    return
  fi
  docker tag "$IMAGE:$LOCAL_TAG" "$IMAGE:$REMOTE_TAG"
  docker push "$IMAGE:$REMOTE_TAG"
}

push frontend-server
push frontend
push analytics-count-users optional
