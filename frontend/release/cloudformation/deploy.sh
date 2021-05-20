#!/bin/bash
#
# Deploy the CloudFormation stack for all deployments, with updated template.
# TODO(cyrille): Merge with cloudfront/deploy.sh
#
# Assumes you have a fully setup aws CLI, with CloudFormation access.

set -e

readonly DIRNAME=$(dirname ${BASH_SOURCE[0]})
readonly GIT_DIRNAME="$(dirname "$(git ls-files "${BASH_SOURCE[0]}")")"
readonly ACTION=${1:-upload}
CHECK_EXIT=0

if [[ "$ACTION" != "check" ]] && [[ "$ACTION" != "upload" ]]; then
  echo "'$ACTION' is an invalid action. Please, use 'check' or 'upload'."
  exit 2
fi

if [[ "$ACTION" == "upload" ]] && [ -z "$CIRCLE_BUILD_NUM" ]; then
    >&2 echo "Need a revision to tag the update, using timestamp instead."
    if [ -z "$DRY_RUN" ]; then
      exit 1
    fi
    CIRCLE_BUILD_NUM="$(date "+%s")"
fi
if [ "$DRY_RUN" ]; then
    echo "This is a dry run. No update will be actually done on the production stacks."
fi
# Change set must only have alphanumeric characters or dashes.
readonly CHANGE_SET_NAME=$(sed s'/[^-a-zA-Z0-9]+/-/g' <<< "deploy-$CIRCLE_BUILD_NUM")

function check_template {
  # Check that the template is valid according to CloudFormation.
  aws cloudformation validate-template --template-body "file://$DIRNAME/main_template.json"
  # Check that the file is stable through jq.
  diff "$DIRNAME/main_template.json" <(jq '.' "$DIRNAME/main_template.json") || {
    >&2 echo "Template is not stable through jq invocation"
    exit 1
  }
  # Check that scheduled-tasks input is a valid JSON, well stringified.
  diff <(jq '.Resources |= map_values(
    select(.Type == "AWS::Events::Rule").Properties.Targets |= map(
      select(has("Input")).Input |= ((.["Fn::Sub"]? // .) |= (fromjson|tostring))
    )
  )' "$DIRNAME/main_template.json") "$DIRNAME/main_template.json" || {
    >&2 echo "Scheduled tasks input is not a valid JSON, with compact stringification."
    exit 1
  }
  # Check that scheduled-tasks input have a name.
  # TODO(cyrille): Ensure this name corresponds to the initial task name.
  if [[ $(jq '.Resources[]|select(.Type == "AWS::Events::Rule").Properties|.Targets[] |
    select(has("Input")).Input|(.["Fn::Sub"]? // .)|fromjson|.containerOverrides[0].name |
    select(not)' "$DIRNAME/main_template.json") == *null* ]]; then
    >&2 echo "A scheduled task ECS override is missing the initial container's name."
    exit 1
  fi
}

function check_stack {
  local check_revision=$1
  shift
  diff <(git show "$check_revision:$GIT_DIRNAME/main_template.json") <(aws cloudformation get-template $@ | jq .TemplateBody)
}

DEPLOYING_STACKS=""
function deploy_stack_server {
  local kept_parameters="$(jq '.Parameters|keys' $DIRNAME/main_template.json)"
  local new_parameters="$(
    aws cloudformation describe-stacks $@ |
    jq '.Stacks[0].Parameters' |
    jq --argjson kept "$kept_parameters" 'map(select(.ParameterKey as $key | ($kept[] | contains($key)) ))' |
    jq 'map(del(.ParameterValue)|.UsePreviousValue=true)'
  )"
  set -- $@ --change-set-name "$CHANGE_SET_NAME"

  aws cloudformation create-change-set $@ \
    --template-body "$(jq . "$DIRNAME/main_template.json")" \
    --parameters "$new_parameters"
  if ! aws cloudformation wait change-set-create-complete $@; then
    aws cloudformation describe-change-set $@ | >&2 jq -r '.StatusReason'
    exit 3
  fi
  if [ "$DRY_RUN" ]; then
    aws cloudformation describe-change-set $@
  else
    # TODO(cyrille): Handle failures gracefully (missing parameter).
    aws cloudformation execute-change-set $@
  fi
}

# No need to try deploying if template is invalid.
check_template

# Launch all stack updates
readonly DEPLOYABLE_STACKS="$(jq -r '.[]|select(.deprecatedFor | not)|.stackId,.region' "$DIRNAME/../stack_deployments.json")"
while read stack_name; do
  read region
  echo "$ACTION the template for ${stack_name}…"
  if [[ "$ACTION" == "check" ]]; then
    if ! check_stack "${CHECK_REVISION:-HEAD}" --stack-name "$stack_name" --region "$region"; then
      echo "Some difference were found while checking $stack_name"
      CHECK_EXIT=4
    fi
  elif [[ "$ACTION" == "upload" ]]; then
    if check_stack HEAD --stack-name "$stack_name" --region "$region"; then
      echo "No changes to upload on $stack_name."
      continue
    fi
    deploy_stack_server --stack-name "$stack_name" --region "$region" &&
      DEPLOYING_STACKS="$DEPLOYING_STACKS $stack_name $region"
  fi
done <<< "$DEPLOYABLE_STACKS"

if [[ "$ACTION" == "check" ]]; then
  exit $CHECK_EXIT
fi

if [ "$DRY_RUN" ] || [ -z "$DEPLOYING_STACKS" ]; then
  exit
fi

# Wait for all deployed stacks to be updated.
while read stack_name; do
  read region
  # TODO(cyrille): Rollback all updates if one fails.
  aws cloudformation wait stack-update-complete --stack-name "$stack_name" --region "$region"
  echo "Template deployed for ${stack_name}!"
done < <(tr ' ' '\n' <<< ${DEPLOYING_STACKS:1})
