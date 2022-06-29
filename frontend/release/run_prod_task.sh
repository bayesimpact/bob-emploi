#!/bin/bash
# Template to run a frontend-flask task on AWS: update the command line.

source "$(dirname "${BASH_SOURCE[0]}")/../cli/bashrc"

# Basic tasks:
# elasticSearch sync example:
#	- modify the the containerOverrides object by the one found in:
#	./scheduled-tasks/sync-user-elasticsearch.json
#	- if environment value is REDACTED replace it by the one found by running:
#		aws events list-targets-by-rule --rule sync-user-elasticsearch
readonly DEPLOYMENT=fr
readonly CLUSTER="$(bob_stack_resource "$DEPLOYMENT" ECSCluster)"
readonly TASK_DEFINITION="$(bob_stack_resource "$DEPLOYMENT" TaskDefinition)"
readonly SUBNETS="$(bob_stack_var "$DEPLOYMENT" AvailabilitySubnets | sed -e 's/,/","/g')"
readonly SECURITY_GROUP="$(bob_stack_resource "$DEPLOYMENT" ECSServiceSecurityGroup)"
readonly AWS_REGION="$(__bob_get_stack_region "$DEPLOYMENT")"

RUN_TASK_RESULT=$(aws ecs run-task \
  --task-definition "$TASK_DEFINITION" \
  --launch-type FARGATE \
  --cluster "$CLUSTER" \
  --network-configuration '{
    "awsvpcConfiguration": {
      "assignPublicIp": "ENABLED",
      "subnets": ["'${SUBNETS}'"],
      "securityGroups": ["'"$SECURITY_GROUP"'"]
    }
  }' \
  --region "$AWS_REGION" \
  --overrides '{
    "containerOverrides": [{
      "name": "flask",
      "command": ["python", "bob_emploi/frontend/server/mail/mail_blast.py", "bob-research-recruit", "list", "--registered-to-days-ago", "7"],
    }]
  }')
if [ $? -ne 0 ]; then
  exit $?
fi

readonly TASK_ARN="$(jq '.tasks[0].taskArn' -r <<< $RUN_TASK_RESULT)"
echo "The task has been started with ARN: $TASK_ARN"

echo "To see the logs, run:"
echo "  ecs-cli logs --region $AWS_REGION --cluster $CLUSTER --task-id $(basename "$TASK_ARN")"
