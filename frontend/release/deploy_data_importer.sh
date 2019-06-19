#!/bin/bash
# Script to deploy a data-analysis-prepare release to be used by scheduled tasks.
#
# The canonical place for our releases are the AWS docker images repository (aka ECR).
#
# Environment variable required:
# - GITHUB_TOKEN: GitHub credentials to check CI status, update the release and
#   the prod-data-importer branch.
# - SLACK_INTEGRATION_URL: Webhook to report deploy status to Slack.
#
# Usage:
# frontend/release/deploy.sh 2019-02-12_DATA_00

set -e
readonly DIRNAME=$(dirname "$0")
# Import functions echo_error, echo_warning...
source "$DIRNAME/echo_with_colors.sh"

readonly TAG="$1"
if [ -z "$TAG" ]; then
  echo_error 'No tag provided.'
  exit 1
fi

if [ -z "$(git tag -l "$TAG")" ]; then
  echo_error "The tag $TAG does not exist locally."
  exit 2
fi

if ! command -v aws >/dev/null 2>&1; then
  echo_error 'Install and configure the aws CLI that is necessary for deployment.'
  echo "* Ask your favorite admin for the access to the AWS project if you do not have it yet"
  echo "* Log into your AWS console and go to IAM (https://console.aws.amazon.com/iam/home)"
  echo "* Create a new 'Access key ID' and the corresponding 'Secret' if you do not already have one"
  echo "* Run 'aws configure' and add your credentials (make sure to set the region to 'eu-west-3')"
  exit 4
fi

if [ -z "$SLACK_INTEGRATION_URL" ]; then
  echo_error 'Set up the Slack integration first.'
  echo "* Find private URL for Slack Integration at https://bayesimpact.slack.com/apps/A0F7XDUAZ-incoming-webhooks"
  echo "* Add this URL in your bashrc as SLACK_INTEGRATION_URL env var"
  exit 5
fi

readonly DOCKER_REPO="bob-emploi/data-analysis-prepare"
readonly DOCKER_TAG="tag-$TAG"
readonly ECR="951168128976.dkr"
readonly ECR_DOMAIN="${ECR}.ecr.${AWS_DEFAULT_REGION}.amazonaws.com"
readonly DOCKER_IMAGE="${ECR_DOMAIN}/$DOCKER_REPO:$DOCKER_TAG"
readonly ECS_FAMILY="data-importer"
readonly GIT_ORIGIN_WITH_WRITE_PERMISSION=https://$GITHUB_TOKEN@github.com/bayesimpact/bob-emploi-internal.git


echo_info 'Creating a task definition revision…'
# Do not print sensitive info from AWS.
readonly CURRENT_SETTINGS=${-}
set +x
readonly PREVIOUS_DOCKER_IMAGE=$(
  aws ecs describe-task-definition --task-definition $ECS_FAMILY | \
    python3 -c "import sys, json; containers = json.load(sys.stdin)['taskDefinition']['containerDefinitions']; print(containers[0]['image'])")

if [ "$PREVIOUS_DOCKER_IMAGE" == "$DOCKER_IMAGE" ]; then
  echo_info 'The task definition is already up-to-date.'
else
  readonly CONTAINERS_DEFINITION=$(
    aws ecs describe-task-definition --task-definition $ECS_FAMILY | \
      python3 -c "import sys, json; containers = json.load(sys.stdin)['taskDefinition']['containerDefinitions']; containers[0]['image'] = '$DOCKER_IMAGE'; print(json.dumps(containers))")

  aws ecs register-task-definition --family=$ECS_FAMILY --container-definitions "$CONTAINERS_DEFINITION" > /dev/null

  set -$CURRENT_SETTINGS

  echo_success 'Task definition is updated!'

  git remote set-url origin $GIT_ORIGIN_WITH_WRITE_PERMISSION
  git push -f origin $TAG:prod-data-importer

  # Ping Slack to say the deployment is done.
  readonly SLACK_MESSAGE=$(mktemp)
  echo '{"text": "A new version of data importers has been deployed ('${TAG}')."}' > $SLACK_MESSAGE
  wget -o /dev/null -O /dev/null --post-file=$SLACK_MESSAGE "$SLACK_INTEGRATION_URL"
  echo_info 'Just sent the following message to Slack:'
  cat $SLACK_MESSAGE
  echo_info ''
  rm -f $SLACK_MESSAGE
fi
