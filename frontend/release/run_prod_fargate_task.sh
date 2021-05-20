#!/bin/bash
# Template to run a frontend-flask task on AWS: update the command line.

# Use a valid deployment as first parameter.
# If you need environment variables, use '-e VAR_NAME VAR_VALUE' as many times as needed.
# The rest of the arguments is the command to run on frontend-flask.
# For instance:
#     run_prod_fargate_task.sh fr -e NODRY_RUN 1 \
#         python bob_emploi/frontend/server/mail/mail_blast.py \
#         nps send --days-since-any-email 0 --registered-to-days-ago 7
# Basic tasks:
# elasticSearch sync example:
#	Get command and needed environment variables from
#	./scheduled-tasks/sync-user-elasticsearch.json
#	- if environment value is REDACTED replace it by the one found by running:
#		aws events list-targets-by-rule --rule sync-user-elasticsearch

source "$(dirname "${BASH_SOURCE[0]}")/../cli/bashrc"
readonly DEPLOYMENT=${1:-fr}
readonly STACK_NAME=$(__bob_get_stack $DEPLOYMENT | jq -r '.stackId')
export AWS_DEFAULT_REGION=$(__bob_get_stack_region $DEPLOYMENT)

shift
ENV_JSON='[]'
while [[ "$1" == "-e" ]]; do
  shift
  ENV_JSON=$(jq --arg var "$1" --arg value "$2" '. + [{
    name: $var,
    value: $value
  }]' <<< $ENV_JSON)
  shift 2
done

# TODO(cyrille): Consider splitting.
readonly COMMAND="$*"

CACHED_STACK_OUTPUT=$(mktemp -t XXXXX.json)
function stack_output {
  if ! [ -s "$CACHED_STACK_OUTPUT" ]; then
    aws cloudformation describe-stacks --stack-name "$STACK_NAME" |
      jq '.Stacks[0].Outputs' > "$CACHED_STACK_OUTPUT"
  fi
  jq -r --arg key "$1" '.[]|select(.OutputKey == $key).OutputValue' "$CACHED_STACK_OUTPUT"
}

readonly SUBNETS=$(bob_stack_var $DEPLOYMENT AvailabilitySubnets | jq -R 'split(",")')
readonly NETWORK_CONFIG=$(jq -n \
  --argjson subnets "$SUBNETS" \
  --arg sg "$(stack_output ECSServiceSecurityGroup)" '{
  awsvpcConfiguration: {
      subnets: $subnets,
      securityGroups: [$sg],
      assignPublicIp: "ENABLED"
  }
}')
# TODO(cyrille): Allow for more parameters in containerOverrides (eg taskRoleArn).
readonly OVERRIDE=$(jq -n --argjson env "$ENV_JSON" --arg cmd "$COMMAND" '{
  containerOverrides: [{
    name: "flask",
    command: [$cmd],
    environment: $env
  }]
}')

aws ecs run-task \
  --task-definition bob-frontend-server \
  --launch-type FARGATE \
  --cluster "$(stack_output ECSCluster)" \
  --network-configuration "$NETWORK_CONFIG"  \
  --overrides "$OVERRIDE"

rm "$CACHED_STACK_OUTPUT"
