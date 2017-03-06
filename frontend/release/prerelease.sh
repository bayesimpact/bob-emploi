#!/bin/bash

readonly TAG=$1
# Ping Slack to say the prerelease is ready.
# Find private URL for Slack Integration at
# https://bayesimpact.slack.com/apps/A0F7XDUAZ-incoming-webhooks.
wget -o /dev/null -O /dev/null --background --post-data="{\"text\": \"A demo for the pre-release $TAG is <http://go/bob:demo/tag-$TAG|ready for review>. See <${CIRCLE_REPOSITORY_URL}/compare/prod...$TAG|Git changes>\"}" "$SLACK_INTEGRATION_URL"

