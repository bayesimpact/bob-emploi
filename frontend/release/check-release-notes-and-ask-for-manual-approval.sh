#!/bin/bash
set -e
readonly DIRNAME=$(dirname "$0")
# Import functions echo_error, echo_warning...
source "$DIRNAME/echo_with_colors.sh"

if [ -n "$DRY_RUN" ]; then
  echo_warning 'DRY RUN: will not actually modify anything.'
fi

readonly TAG=$1
readonly REPOSITORY_URL="https://github.com/$CIRCLE_PROJECT_USERNAME/$CIRCLE_PROJECT_REPONAME"
readonly RELEASE_NOTES="$(hub release show $TAG 2> /dev/null)"
if [ -z "$RELEASE_NOTES" ]; then
  echo_error "No release notes found. Build again this workflow step when they are ready (go to https://circleci.com/gh/$CIRCLE_PROJECT_USERNAME/workflows/$CIRCLE_PROJECT_REPONAME and click 'Rerun failed jobs on the failed workflow'). To create the notes, rerun 'frontend/release/release.sh $TAG' on your machine if the original release script is lost."
  exit 1
fi

# TODO(florian): When CircleCI opens an API endpoint to validate the approval steps remotely,
# use it to allow team members to validate directly from Slack.
# New line in Slack message (https://github.com/cleentfaar/slack/issues/21).
readonly SLACK_MESSAGE="<!here> A demo for the release candidate $TAG is <https://go.bayes.org/bob:demo/tag-$TAG|ready for review>. See <${REPOSITORY_URL}/compare/prod...$TAG|Git changes>. After getting 3 manual approvals, <https://circleci.com/workflow-run/$CIRCLE_WORKFLOW_ID|approve the release workflow>.

Fellow reviewers, do not forget to:
• check that a new user can go through the workflow, see their assessment and select and read some advice, without being blocked. :rocket:
• check the flow for desktop and mobile. :iphone: :computer:
• go to the <https://go.bayes.org/bob:demo/tag-$TAG/conseiller/integration-imilo|integration-imilo page> to check all the pieces of advice.
• @eng, make sure no error has been logged to <https://sentry.io/bayes-impact/bob-emploi-demo/|bob-emploi-demo> on Sentry.
• of course have a look to the release notes to know where to be even more careful.
Bob will be forever grateful :heart:"
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
