#!/bin/bash
set -e
readonly DIRNAME=$(dirname "$0")
# Import functions echo_error, echo_warning...
source "$DIRNAME/echo_with_colors.sh"

if [ -n "$DRY_RUN" ]; then
  echo_warning 'DRY RUN: will not actually modify anything.'
fi

readonly TAG=$1
readonly REPOSITORY_URL="$(sed -e "s/git@github.com:/https:\/\/github.com\//;s/\.git$//" <<< "${CIRCLE_REPOSITORY_URL}")"
readonly RELEASE_NOTES="$(hub release show $TAG 2> /dev/null)"
if [ -z "$RELEASE_NOTES" ]; then
  echo_error "No release notes found. Build again this workflow step when they are ready (go to https://circleci.com/gh/bayesimpact/workflows/bob-emploi-internal and click 'Rerun failed jobs on the failed workflow'). To create the notes, rerun 'frontend/release/release.sh $TAG' on your machine if the original release script is lost."
  exit 1
fi

# TODO(florian): When CircleCI opens an API endpoint to validate the approval steps remotely,
# use it to allow team members to validate directly from Slack.
# New line in Slack message (https://github.com/cleentfaar/slack/issues/21).
readonly SLACK_MESSAGE="A demo for the release candidate $TAG is <http://go/bob:demo/tag-$TAG|ready for review>. See <${REPOSITORY_URL}/compare/prod...$TAG|Git changes>. After getting 2 manual approvals, <https://circleci.com/workflow-run/$CIRCLE_WORKFLOW_ID|approve the release workflow>."
readonly SLACK_PAYLOAD=$(jq -n -r \
  --arg slack_message "$SLACK_MESSAGE" \
  --arg release_notes "$RELEASE_NOTES" \
  '{"text": $slack_message,
    "attachments": [{
      "fields": [{
        "title": "Release Notes",
        "value": $release_notes,
        "short": false
      }]
    }]
  }')
if [ -z "$DRY_RUN" ]; then
  # Ping Slack to say the release candidate is ready to be tested.
  # Find private URL for Slack Integration at
  # https://bayesimpact.slack.com/apps/A0F7XDUAZ-incoming-webhooks.
  curl --data "$SLACK_PAYLOAD" "$SLACK_INTEGRATION_URL"
else
  echo "Would send the following payload to $SLACK_INTEGRATION_URL:"
  echo "$SLACK_PAYLOAD"
fi
