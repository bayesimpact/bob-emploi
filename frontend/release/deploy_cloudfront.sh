#!/bin/bash
# Script to deploy new versions of cloudfront configuration from cloudfront.json.
#
# To get the latest version from AWS locally, run:
#   deploy_cloudfront.sh download
#
# To update the config, first get your changes reviewed, then run:
#   deploy_cloudfront.sh upload
# Note that this will update your local file as well to retrieve the updated
# ETag.
#
# It uses awscli (usually installed by pip) and jq (can be installed through
# apt-get or brew).

set -e

# The ID of Bob's distribution on AWS.
readonly DISTRIBUTION_ID=E3BI8P0VPS4VAY
readonly CONFIG_FILE="$(dirname "${BASH_SOURCE[0]}")/cloudfront.json"

function download_live_config() {
  aws cloudfront get-distribution-config --id "$DISTRIBUTION_ID" | \
    jq . --sort-keys > "$CONFIG_FILE"
}

if [ "$1" == "download" ]; then
  download_live_config
  exit
fi

if [ "$1" != "upload" ]; then
  echo "Run this script with \"upload\" or \"download\" command."
  exit 1
fi

if [ -n "$(git diff HEAD --shortstat 2> /dev/null | tail -n1)" ]; then
  echo "Current git status is dirty. Commit, stash or revert your changes before uploading." 1>&2
  exit 2
fi

# Ensures that the Continuous Integration is successful.
if [ -x "$(which hub)" ]; then
  readonly CI_STATUS="$(hub ci-status "${BRANCH:-HEAD}")"
  if [ "${CI_STATUS}" != "success" ]; then
    echo "Continuous integration is \"${CI_STATUS}\", fix before uploading:"
    hub ci-status -v "${BRANCH:-HEAD}"
    exit 3
  fi
fi

# Get the ETag from the latest config that was in Git. If this does not match
# with the current version in the console, the automatic upload won't work.
readonly ETAG_ON_MASTER="$(git show "origin/master:./$CONFIG_FILE" | jq -r .ETag)"

# Extract the distribution config.
readonly TEMP_CONFIG_FILE="$(mktemp --suffix=.json)"
jq .DistributionConfig "$CONFIG_FILE" > "$TEMP_CONFIG_FILE"

# Update AWS Cloudfront.
if ! aws cloudfront update-distribution \
  --id "$DISTRIBUTION_ID" \
  --distribution-config "file://$TEMP_CONFIG_FILE" \
  --if-match "$ETAG_ON_MASTER"; then
  echo "AWS live config and the config in origin/master are out of sync. Fix that first, then run this script again."
  exit 4
fi

rm "$TEMP_CONFIG_FILE"

# Get latest ETag and config locally.
download_live_config
