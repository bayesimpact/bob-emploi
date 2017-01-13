#!/usr/bin/env bash

set -e

readonly AWS_REGION="eu-central-1"

# Our ECR repository.
readonly ECR="951168128976.dkr"

readonly ECR_DOMAIN="${ECR}.ecr.${AWS_REGION}.amazonaws.com"

readonly LOCAL_PROJECT="bob-emploi"
readonly PROJECT="bob-emploi"

TAG="$1"

# Log in.
$(aws ecr get-login --region="${AWS_REGION}")

function push() {
  local IMAGE="${LOCAL_PROJECT}/$1"
  local IMAGE_FULL_TAG="${ECR_DOMAIN}/${PROJECT}/$1:$2"
  docker tag "docker.bayesimpact.org/${IMAGE}" "${IMAGE_FULL_TAG}"
  docker push "${IMAGE_FULL_TAG}"
}

push frontend-flask "${TAG}"
push frontend "${TAG}"
