#!/bin/bash
# Script to deploy new versions of cloudfront configurations from the json files in the current folder.
# Needs bob-emploi-deploy-cloudfront IAM policy or equivalent.
# https://console.aws.amazon.com/iam/home?region=us-east-1#/policies/arn:aws:iam::951168128976:policy/bob-emploi-deploy-cloudfront$jsonEditor
#
# To get the latest version from AWS locally, run:
#   deploy.sh download
#
# To check if the live version is different from one in git, run:
#   CHECK_REVISION=<git sha1> deploy.sh check
#
# To update the configs, first get your changes reviewed, then submit to master, the CD will run:
#   deploy.sh upload
#
# It uses awscli (usually installed by pip) and jq (can be installed through
# apt-get or brew).

set -e
set -o pipefail

readonly ACTION=$1
readonly CURRENT_FOLDER="$(dirname "${BASH_SOURCE[0]}")"
readonly CURRENT_GIT_FOLDER="$(dirname "$(git ls-files "${BASH_SOURCE[0]}")")"

if [[ -z "$GITHUB_TOKEN" ]]; then
  readonly GIT_ORIGIN_WITH_WRITE_PERMISSION="origin"
else
  readonly GIT_ORIGIN_WITH_WRITE_PERMISSION="https://$GITHUB_TOKEN@github.com/bayesimpact/bob-emploi-internal.git"
fi

if [ "$ACTION" != "download" ] && [ "$ACTION" != "upload" ] && [ "$ACTION" != "check" ]; then
  echo "Run this script with \"upload\", \"check\" or \"download\" command."
  exit 1
fi

readonly ONLY_DEPLOYMENT=$2

# Checks needed for the deployment.
if [ "$ACTION" == "upload" ]; then
  # Check that there is no pending changes.
  if [ -n "$(git diff HEAD --shortstat -- "$CURRENT_GIT_FOLDER/*.json" 2> /dev/null | tail -n1)" ]; then
    echo "Current git status is dirty. Commit, stash or revert your changes before uploading." 1>&2
    if [ -z "$DRY_RUN" ]; then
      exit 2
    fi
  fi

  # Check that we are up to date with origin/master.
  readonly MASTER_HASH="$(git log -1 --pretty=format:"%h" "origin/master" -- "$CURRENT_GIT_FOLDER/*.json")"
  readonly CURRENT_HASH="$(git log -1 --pretty=format:"%h" HEAD -- "$CURRENT_GIT_FOLDER/*.json")"
  if [ "$MASTER_HASH" != "$CURRENT_HASH" ]; then
    echo "Do not upload manually, please let the Continuous Deployment do its job." 1>&2
    if [ -z "$DRY_RUN" ]; then
      exit 3
    fi
  fi
fi

function download_live_config() {
  aws cloudfront get-distribution-config --id "$1" | jq . --sort-keys
}

function mktemp_json() {
  mktemp -t XXXXXXXX.json
}

function deploy_cloudfront() {
  local deployment="$1"
  # The ID of Bob's distribution on AWS.
  local distribution_id="$2"
  local config_file="$CURRENT_FOLDER/$deployment.json"

  if [ -n "$ONLY_DEPLOYMENT" ] && [[ "$deployment" != "$ONLY_DEPLOYMENT" ]]; then
    return
  fi

  if [ "$ACTION" == "download" ]; then
    download_live_config "$distribution_id" | jq .DistributionConfig > "$config_file"
    return
  fi

  # Get the prod (live) version.
  local temp_prod_file="$(mktemp_json)"
  local temp_prod_config_file="$(mktemp_json)"
  download_live_config "$distribution_id" > "$temp_prod_file"
  local etag_in_prod="$(jq -r .ETag "$temp_prod_file")"
  jq .DistributionConfig "$temp_prod_file" > "$temp_prod_config_file"
  rm "$temp_prod_file"

  if [ "$ACTION" == "check" ]; then
    local check_revision="${CHECK_REVISION:-origin/master}"
    local checked_config_file=$(mktemp_json)
    git show "$check_revision:$CURRENT_GIT_FOLDER/$deployment.json" > "$checked_config_file"
    if ! test -s "$checked_config_file"; then
      echo "The config didn't exist at $check_revision. Ignoring."
      rm "$checked_config_file"
      return
    elif ! diff "$temp_prod_config_file" "$checked_config_file"; then
      echo "The config version at $check_revision is different from the prod (live) one."
      rm "$checked_config_file"
      exit 8
    fi
    rm "$checked_config_file"
    echo "OK, the config version at $check_revision is live."
    return
  fi

  if diff "$temp_prod_config_file" "$config_file"; then
    echo "There is no diff to upload (prod version is up to date)."
    if [ -z "$DRY_RUN" ]; then
      return
    fi
  fi

  local cloudfront_branch_config_file=$(mktemp_json)
  git show "origin/cloudfront:$CURRENT_GIT_FOLDER/$deployment.json" > "$cloudfront_branch_config_file"
  # Check that the config exists on the cloudfront branch.
  if ! [ -s "$cloudfront_branch_config_file" ]; then
    rm "$cloudfront_branch_config_file"
    echo "Config did not exist for $deployment in branch cloudfront."
    echo "Checking that the committed config is the one in prod..."
    if ! diff "$temp_prod_config_file" "$temp_prod_updated_config_file"; then
      echo "AWS prod (live) config is not consistent with the newly added config for '$deployment'."
      echo "Run '${BASH_SOURCE[0]} download' to make sure you have the latest config."
      exit 9
    fi
    return
  fi
  # Check that the prod version matches the last one submitted to the cloudfront branch.
  if ! diff "$temp_prod_config_file" "$cloudfront_branch_config_file"; then
    echo "AWS prod (live) config and the config in origin/cloudfront are out of sync. This should NOT happen: somebody played with the prod config without using git or the CD pipeline."
    echo "Rollback your changes then create a PR to get those changes reviewed. See http://go/bob:cloudfront-as-code"
    if [ -z "$DRY_RUN" ]; then
      rm "$cloudfront_branch_config_file"
      rm "$temp_prod_config_file"
      exit 5
    fi
  fi
  rm "$cloudfront_branch_config_file"

  if [ -n "$DRY_RUN" ]; then
    echo "Dry run, not trying to upload to AWS."
    rm "$temp_prod_config_file"
    return
  fi

  # Update AWS Cloudfront.
  if ! aws cloudfront update-distribution \
    --id "$distribution_id" \
    --distribution-config "file://$config_file" \
    --if-match "$etag_in_prod"; then
    echo "AWS live config and the config in origin/master are out of sync. Fix that first, then run this script again."
    rm "$temp_prod_config_file"
    exit 4
  fi

  # Download the updated config.
  temp_prod_updated_file="$(mktemp_json)"
  temp_prod_updated_config_file="$(mktemp_json)"
  download_live_config "$distribution_id" > "$temp_prod_updated_file"
  local etag_updated_in_prod="$(jq -r .ETag "$temp_prod_updated_file")"
  jq .DistributionConfig "$temp_prod_updated_file" > "$temp_prod_updated_config_file"
  rm "$temp_prod_updated_file"

  # Check that the downloaded config corresponds to the one we've just uploaded.
  if ! diff "$temp_prod_updated_config_file" "$config_file"; then
    echo "There is a diff between the uploaded config and the one we get when downloading. Reverting..."
    if ! aws cloudfront update-distribution \
      --id "$distribution_id" \
      --distribution-config "file://$temp_prod_config_file" \
      --if-match "$etag_updated_in_prod"; then
      rm "$temp_prod_config_file"
      echo "Unable to revert, panic now!"
      exit 6
    fi
    rm "$temp_prod_config_file"
    exit 7
  fi
  rm "$temp_prod_config_file"
  git push -f "$GIT_ORIGIN_WITH_WRITE_PERMISSION" HEAD:cloudfront
}

while read deployment; do
  read distribution_id
  echo "Deployment \"$deployment\":"
  deploy_cloudfront $deployment $distribution_id
done < <(jq -r 'to_entries[]|.key, .value' "$CURRENT_FOLDER/index.json")
echo 'Plugin "Jobflix":'
deploy_cloudfront jobflix ESNEY2397EVJ3
