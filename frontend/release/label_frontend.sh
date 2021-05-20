#!/bin/bash
# Add a label to the frontend docker image, depending on what is inside of it.
# Assumes the image is already built locally.

TAG=$1
LABEL_KEY="org.bayesimpact.deployments"

# TODO(cyrille): Find a cleaner way to fetch the name of the built docker image.
DOCKER_IMAGE="bayesimpact/bob-emploi-frontend:${TAG:-latest}"
LABEL="$(docker inspect "$DOCKER_IMAGE" -f "{{ index .Config.Labels \"$LABEL_KEY\"}}")"
if [ -n "$LABEL" ]; then
  echo "Image is already tagged with '$LABEL', not neccessary to do it again."
  exit 0
fi

BUILT_DEPLOYMENTS=""
while read dep; do
  BUILT_DEPLOYMENTS="$BUILT_DEPLOYMENTS,$dep"
done < <(docker-compose run --no-deps --rm frontend find /usr/share/bob-emploi/html -mindepth 1 -maxdepth 1 -type d | sed 's~.*/~~')
# Drop the first comma.
BUILT_DEPLOYMENTS=${BUILT_DEPLOYMENTS:1}

echo "FROM $DOCKER_IMAGE" | docker build - -t "$DOCKER_IMAGE" --label "$LABEL_KEY"="$BUILT_DEPLOYMENTS"
