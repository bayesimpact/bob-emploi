#!/bin/bash
readonly BRANCH=$1
readonly TAG=$2

set -x


# For Data release tags.
if [ -n "$TAG" ] && [[ "$TAG" =~ .*_DATA_.* ]]; then
  touch skip-frontend skip-analytics publish-on-aws
  exit
fi

if [ "$BRANCH" == "master" ] || [ -n "$TAG" ]; then
  # Run all tests on master and frontend tags.
  exit
fi

readonly SKIP_ALL="skip-data-analysis skip-frontend skip-analytics"
# Do not run CI if the branch doesn't exist anymore.
if [ -z "$(git ls-remote --heads origin "$BRANCH")" ]; then
  touch ${SKIP_ALL}
  exit
fi

# Do not run CI if the branch has already been updated.
if [ "$(git ls-remote --heads origin "$BRANCH" | cut -f1)" != "$(git rev-parse HEAD)" ]; then
  touch ${SKIP_ALL}
  exit
fi

# Find the most recent commit that was in master (considered as green).
readonly LAST_GREEN="$(git merge-base HEAD origin/master)"
readonly DIFF_FILES=$(mktemp)
git diff --name-only "${LAST_GREEN}" "${BRANCH}"> "${DIFF_FILES}"

# Ignore changes on some files.
sed -i -e "/^README.md$/d" "${DIFF_FILES}"

if [ -z "$(grep -v ^data_analysis/ "${DIFF_FILES}")" ]; then
  # Changes are only in data_analysis.
  touch skip-frontend skip-analytics
fi

if [ -z "$(grep -v ^frontend/ "${DIFF_FILES}")" ] && [ -z "$(grep ^frontend/server/api/ "${DIFF_FILES}")" ]; then
  # Changes are only in frontend, and not in frontend/server/api.
  touch skip-data-analysis skip-analytics
fi

if [ -z "$(grep -v ^analytics/ "${DIFF_FILES}")" ]; then
  # Changes are only in analytics.
  touch skip-frontend skip-data-analysis
fi

rm "${DIFF_FILES}"
