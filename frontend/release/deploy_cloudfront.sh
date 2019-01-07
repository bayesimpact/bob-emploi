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
    jq . --sort-keys
}

function mktemp_json() {
  mktemp -t XXXXXXXX.json
}

if [ "$1" == "download" ]; then
  download_live_config | jq .DistributionConfig > "$CONFIG_FILE"
  exit
fi

if [ "$1" != "upload" ]; then
  echo "Run this script with \"upload\" or \"download\" command."
  exit 1
fi

if [ -n "$(git diff HEAD --shortstat 2> /dev/null | tail -n1)" ]; then
  echo "Current git status is dirty. Commit, stash or revert your changes before uploading." 1>&2
  if [ -z "$DRY_RUN" ]; then
    exit 2
  fi
fi

# Ensures that the Continuous Integration is successful.
if [ -x "$(which hub)" ]; then
  readonly CI_STATUS="$(hub ci-status "${BRANCH:-HEAD}")"
  if [ "${CI_STATUS}" != "success" ]; then
    echo "Continuous integration is \"${CI_STATUS}\", fix before uploading:"
    if [ -z "$DRY_RUN" ]; then
      hub ci-status -v "${BRANCH:-HEAD}"
      exit 3
    fi
  fi
fi

# Check that the live version is in sync with origin/master.
readonly TEMP_PROD_FILE="$(mktemp_json)"
readonly TEMP_PROD_CONFIG_FILE="$(mktemp_json)"
download_live_config > "$TEMP_PROD_FILE"
readonly ETAG_IN_PROD="$(jq -r .ETag "$TEMP_PROD_FILE")"
jq .DistributionConfig "$TEMP_PROD_FILE" > "$TEMP_PROD_CONFIG_FILE"
rm "$TEMP_PROD_FILE"

readonly TEMP_MASTER_CONFIG_FILE="$(mktemp_json)"
git show "origin/master:./$CONFIG_FILE" > "$TEMP_MASTER_CONFIG_FILE"

if diff "$TEMP_PROD_CONFIG_FILE" "$TEMP_MASTER_CONFIG_FILE"; then
  echo "AWS live config and the config in origin/master are out of sync. Fix that first, then run this script again."
  rm "$TEMP_PROD_CONFIG_FILE"
  rm "$TEMP_MASTER_CONFIG_FILE"
  if [ -z "$DRY_RUN" ]; then
    exit 5
  fi
fi

rm "$TEMP_MASTER_CONFIG_FILE"

if diff "$TEMP_PROD_CONFIG_FILE" "$CONFIG_FILE"; then
  echo "There is no diff to upload."
  if [ -z "$DRY_RUN" ]; then
    exit 6
  fi
fi

rm "$TEMP_PROD_CONFIG_FILE"

if [ -n "$DRY_RUN" ]; then
  echo "Dry run, not trying to upload to AWS."
  exit 7
fi

# Update AWS Cloudfront.
if ! aws cloudfront update-distribution \
  --id "$DISTRIBUTION_ID" \
  --distribution-config "file://$CONFIG_FILE" \
  --if-match "$ETAG_IN_PROD"; then
  echo "AWS live config and the config in origin/master are out of sync. Fix that first, then run this script again."
  exit 4
fi
