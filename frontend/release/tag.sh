#!/bin/bash
set -e

# $1 is an optional RELEASE_TYPE name.
# It adds a suffix to the release tag
# e.g. 2019-02-12_DATA_01 for tags specifically done
# for data-analysis-prepare release.
# frontend releases have no suffix.
if [ -n "$1" ]; then
  readonly RELEASE_TYPE="_$1"
fi
readonly TAG_PREFIX="$(date +%Y-%m-%d)${RELEASE_TYPE}_"
readonly TAG="${TAG_PREFIX}$(printf %02d $(git tag -l "${TAG_PREFIX}*" | wc -l))"
readonly BRANCH=${2:-master}

if [[ -z "$GITHUB_TOKEN" ]]; then
  readonly GIT_ORIGIN_WITH_WRITE_PERMISSION="origin"
else
  readonly GIT_ORIGIN_WITH_WRITE_PERMISSION="https://$GITHUB_TOKEN@github.com/bayesimpact/bob-emploi-internal.git"
fi

git fetch origin $BRANCH
git tag "${TAG}" origin/$BRANCH
git push --tags "$GIT_ORIGIN_WITH_WRITE_PERMISSION"

echo $TAG
