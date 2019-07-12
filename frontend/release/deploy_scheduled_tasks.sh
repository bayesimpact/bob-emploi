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

readonly FOLDER="$(dirname "${BASH_SOURCE[0]}")/scheduled-tasks"

# Python script that unpacks the 'Input' vars that are stored as JSON strings in AWS, also redact
# environment variables.
readonly PY_UNPACK_INPUT_AND_REDACT_ENV_VARS="import sys, json
rule = json.load(sys.stdin)
for target in rule.get('Targets', []):
  # The target's inputs are JSON stringified inside the JSON, so we extract
  # it.
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

if [ "$1" == "download" ]; then
  readonly RULE="$2"
  if [[ -n "$RULE" ]]; then
    download_and_unpack_rule "$RULE"
    exit 0
  fi

  aws events list-rules | jq -S . > "$FOLDER/index.json"
  for rule in $(jq ".Rules[].Name" -r frontend/release/scheduled-tasks/index.json); do
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

  readonly ALL_INDEX_RULES=$(jq -rc '.Rules[].Name' $FOLDER/index.json)
  readonly ALL_TARGET_RULES=$(cd $FOLDER && ls *.json | sed s/\.json$//)
  readonly ALL_COMMON_RULES=$(sort <<< "$ALL_INDEX_RULES $ALL_TARGET_RULES" | uniq -d)
  if [[ " ${ALL_RULES//$'\n'/ } " != *\ $RULE\ * ]]; then
    echo "Invalid choice '$RULE'. choose the rule to upload from" $ALL_RULES
    exit 2
  fi

  aws events put-rule --name "$RULE" --cli-input-json "$(jq -c '.Rules[] | select(.Name=="'$RULE'") | del(.Arn)' "$FOLDER/index.json")"
  aws events put-targets --cli-input-json "$(
    jq '. + {Rule: "'$RULE'"}' "$FOLDER/$RULE.json" | \
    python3 -c "$PY_INJECT_ENV_VARS_AND_PACK_INPUT")"
  exit 0
fi

echo "Usage:"
echo "  > \`deploy_scheduled_tasks.sh download\` to download all rules from AWS to this folder."
echo "  > \`deploy_scheduled_tasks.sh upload <rule_name>\` to upload one of them."
echo "  > \`deploy_scheduled_tasks.sh download <rule_name>\` to view a rule's definition."
exit 1
