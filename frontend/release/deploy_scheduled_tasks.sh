#!/bin/bash
# Script to deploy new versions of Scheduld Tasks.
# To get the latest version from AWS locally, run:
#   deploy_scheduled_tasks.sh download
# To deploy a local version of a rule to AWS, run:
#   deploy_scheduled_tasks.sh upload <rule_name>
#
# It uses awscli (usually installed by pip) and jq (can be installed through
# apt-get or brew).

set -e

readonly RELEASE_FOLDER="$(dirname "${BASH_SOURCE[0]}")"
source "$RELEASE_FOLDER/../cli/bashrc"

# Keep in sync with cloudformation.json
readonly TASK_NAME="bob-frontend-server"
REGION=$(__bob_get_stack_region $1)
if [ "$REGION" ]; then
  readonly DEPLOYMENT="$1"
fi
if [ "$DEPLOYMENT" ]; then
  shift
else
  # TODO(cyrille): Update all scheduled tasks targets to point to
  # stack cluster and task definitions.
  readonly DEPLOYMENT="fr"
  REGION="$(__bob_get_stack_region fr)"
fi

export AWS_DEFAULT_REGION="$REGION"

echo Running script for deployment "$DEPLOYMENT"

readonly FOLDER="$RELEASE_FOLDER/scheduled-tasks/$DEPLOYMENT"

# Python script that unpacks the 'Input' vars that are stored as JSON strings in AWS, also redact
# environment variables.
readonly PY_UNPACK_INPUT_AND_REDACT_ENV_VARS="import sys, json
rule = json.load(sys.stdin)
for target in rule.get('Targets', []):
  # The target's inputs are JSON stringified inside the JSON, so we extract
  # it.
  if 'Input' not in target:
    continue
  target['Input'] = json.loads(target['Input'])
  if len(sys.argv) > 1 and sys.argv[1] == 'REDACTED':
    # Redact all env vars.
    for container in target['Input'].get('containerOverrides', []):
      for env in container.get('environment', []):
        if env['value']:
          env['value'] = 'REDACTED'
print(json.dumps(rule, sort_keys=True, indent=2))"

# Python script that inject environment variables then packs the 'Input' vars that are stored as
# JSON strings in AWS.
readonly PY_INJECT_ENV_VARS_AND_PACK_INPUT="import os, json, sys
rule = json.load(sys.stdin)
for target in rule.get('Targets', []):
  # Add env vars back.
  for container in target['Input'].get('containerOverrides', []):
    for env in container.get('environment', []):
      if env['value'] == 'REDACTED':
        name = env['name']
        try:
          env['value'] = os.environ[name]
        except KeyError:
          raise KeyError(
            'Set the production env var for \"{}\". You can run this script with '
            'download <rule_name> to see its current value in prod.'.format(name))
  # The target's inputs need to be JSON stringified inside the JSON, so we encode it.
  target['Input'] = json.dumps(target['Input'])
print(json.dumps(rule))"

function download_and_unpack_rule() {
  local rule="$1"
  local should_redact="$2"
  aws events list-targets-by-rule --rule "$rule" | \
    python3 -c "$PY_UNPACK_INPUT_AND_REDACT_ENV_VARS" "$should_redact"
}

function download_index_file() {
  local stack_rules
  stack_rules="$(jq '[.Resources[]|select(.Type == "AWS::Events::Rule")|.Properties|select(has("ScheduleExpression")).Name]' "$RELEASE_FOLDER/cloudformation/main_template.json")"
  aws events list-rules |
    # We only keep rules not created by Zappa.
    jq -S '.Rules |= [.[] | select(.RoleArn // "" | test("Zappa") | not)]' |
    # We only keep rules that are not in the CloudFormation stack.
    jq --argjson stack_rules "$stack_rules" '.Rules |= [.[]|select([.Name]|inside($stack_rules)|not)]' > "$FOLDER/index.json"
}

function check_rule() {
  if [[ $1 == --exit-code ]]; then
    local return=1
    shift
  fi
  local rule="$1"
  local verb="$2"

  local ALL_INDEX_RULES=$(jq -rc '.Rules[].Name' $FOLDER/index.json)
  local ALL_TARGET_RULES=$(cd $FOLDER && ls *.json | sed s/\.json$//)
  local ALL_COMMON_RULES=$(echo "$ALL_INDEX_RULES $ALL_TARGET_RULES" | tr " " "\n" | sort | uniq -d)
  if ! grep -x "$rule" <<< "$ALL_COMMON_RULES" > /dev/null ; then
    echo "Invalid choice '$rule'. choose the rule to $verb from" $ALL_COMMON_RULES
    if [ "$return" ]; then
      return 2
    else
      exit 2
    fi
  fi
}

if [ "$1" == "list" ]; then
  for rule in $(jq ".Rules[].Name" -r "$FOLDER/index.json"); do
    echo $rule
  done
  exit 0
fi

if [ "$1" == "download" ]; then
  readonly RULE="$2"
  if [[ -n "$RULE" ]]; then
    check_rule "$RULE" download
    download_and_unpack_rule "$RULE"
    exit 0
  fi

  download_index_file
  for rule in $(jq ".Rules[].Name" -r "$FOLDER/index.json"); do
     download_and_unpack_rule $rule "REDACTED" > "$FOLDER/$rule.json"
  done
  exit 0
fi

if [ "$1" == "upload" ]; then
  readonly RULE="$2"
  if [[ -z "$RULE" ]]; then
    echo "Need a rule name to upload."
    exit 1
  fi

  check_rule "$RULE" upload

  aws events put-rule --name "$RULE" --cli-input-json "$(jq -c '.Rules[] | select(.Name=="'$RULE'") | del(.Arn)' "$FOLDER/index.json")"
  aws events put-targets --cli-input-json "$(
    jq '. + {Rule: "'$RULE'"}' "$FOLDER/$RULE.json" | \
    python3 -c "$PY_INJECT_ENV_VARS_AND_PACK_INPUT")"
  exit 0
fi

if [ "$1" == "run" ]; then
  readonly RULE="$2"
  if [[ -z "$RULE" ]]; then
    echo "Need a rule name to upload."
    exit 1
  fi

  check_rule "$RULE" run

  aws ecs run-task \
    --task-definition "$(jq -r '.Targets[0].EcsParameters.TaskDefinitionArn' "$FOLDER/$RULE.json")" \
    --overrides "$(python3 -c "$PY_INJECT_ENV_VARS_AND_PACK_INPUT" < "$FOLDER/$RULE.json" | jq -r '.Targets[0].Input')"
  exit 0
fi

if [ "$1" == "delete" ]; then
  readonly RULE="$2"
  if [[ -z "$RULE" ]]; then
    echo "Need a rule name to delete."
    exit 1
  fi

  check_rule "$RULE" delete

  readonly TASK_IDS=$(jq -r '.Targets[].Id' "$FOLDER/$RULE.json")
  read -p "Are you sure you want to delete $RULE [yN]? " -n 1 -r
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled deletion for $RULE."
    exit 0
  fi
  aws events remove-targets --rule "$RULE" --ids $TASK_IDS
  aws events delete-rule --name "$RULE"
  download_index_file
  exit 0
fi

if [ "$1" == "clean" ]; then
  download_index_file
  sleep 1
  for file in "$FOLDER"/*.json; do
    filename="${file%".json"}"
    filename="${filename#"$FOLDER/"}"
    if [[ $filename != index ]] && ! check_rule --exit-code "$filename" clean > /dev/null; then
      rm "$file"
    fi
  done
  exit
fi

echo "Usage:"
echo "  > \`deploy_scheduled_tasks.sh [deployment] list\` to list all available rules."
echo "  > \`deploy_scheduled_tasks.sh [deployment] download\` to download all rules from AWS to this folder."
echo "  > \`deploy_scheduled_tasks.sh [deployment] upload <rule_name>\` to upload one of them."
echo "  > \`deploy_scheduled_tasks.sh [deployment] download <rule_name>\` to view a rule's definition."
echo "  > \`deploy_scheduled_tasks.sh [deployment] run <rule_name>\` to run a rule immediately."
exit 1
