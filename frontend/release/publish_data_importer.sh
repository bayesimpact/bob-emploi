#!/usr/bin/env bash

set -e

REMOTE_TAG="$1"
LOCAL_TAG="${2:-latest}"

readonly PROJECT="bob-emploi"
readonly DOCKER_COMPOSE_SERVICE="data-analysis-prepare"
# The ECR repository.
readonly ECR="951168128976.dkr"
readonly ECR_DOMAIN="${ECR}.ecr.${AWS_DEFAULT_REGION}.amazonaws.com"

readonly IMAGE="${PROJECT}/${DOCKER_COMPOSE_SERVICE}"
readonly LOCAL_IMAGE="docker.bayesimpact.org/$IMAGE:$LOCAL_TAG"
readonly REMOTE_IMAGE="${ECR_DOMAIN}/$IMAGE:$REMOTE_TAG"

docker tag "${LOCAL_IMAGE}" "${REMOTE_IMAGE}"
docker push "${REMOTE_IMAGE}"
