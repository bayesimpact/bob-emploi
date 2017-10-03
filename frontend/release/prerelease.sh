#!/bin/bash

readonly TAG=$1
readonly REPOSITORY_URL="$(sed -e "s/git@github.com:/https:\/\/github.com\//;s/\.git$//" <<< "${CIRCLE_REPOSITORY_URL}")"
# Ping Slack to say the prerelease is ready.
# Find private URL for Slack Integration at
# https://bayesimpact.slack.com/apps/A0F7XDUAZ-incoming-webhooks.
curl --data "{\"text\": \"A demo for the pre-release $TAG is <http://go/bob:demo/tag-$TAG|ready for review>. See <${REPOSITORY_URL}/compare/prod...$TAG|Git changes>\"}" "$SLACK_INTEGRATION_URL"

