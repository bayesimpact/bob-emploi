#!/bin/bash
# Script to deply new versions of Scheduld Tasks.
#
# To get the latest version from AWS locally, run:
#   deploy_scheduled_tasks.sh download
#
# It uses awscli (usually installed by pip) and jq (can be installed through
# apt-get or brew).

set -e

readonly FOLDER="$(dirname "${BASH_SOURCE[0]}")/scheduled-tasks"

if [ "$1" == "download" ]; then
  aws events list-rules > "$FOLDER/index.json"
  for rule in $(jq ".Rules[].Name" -r frontend/release/scheduled-tasks/index.json); do
    aws events list-targets-by-rule --rule "$rule" | \
      python3 -c "import sys, json
rule = json.load(sys.stdin)
for target in rule.get('Targets', []):
  # The target's inputs are JSON stringified inside the JSON, so we extract
  # it.
  target['Input'] = json.loads(target['Input'])
  # Redact all env vars.
  for container in target['Input'].get('containerOverrides', []):
    for env in container.get('environment', []):
      if env['value']:
        env['value'] = 'REDACTED'
print(json.dumps(rule, sort_keys=True, indent=2))" \
      > "$FOLDER/$rule.json"
  done
fi

# TODO(pascal): Implement the upload aka deployment.
echo "Deployment is not implemented yet, one can only download from AWS."
exit 1
