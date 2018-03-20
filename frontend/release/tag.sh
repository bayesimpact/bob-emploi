#!/bin/bash
set -e

readonly TAG_PREFIX="$(date +%Y-%m-%d)_"
readonly TAG="${TAG_PREFIX}$(printf %02d $(git tag -l "${TAG_PREFIX}*" | wc -l))"

git fetch origin master
git tag "${TAG}" origin/master
git push --tags origin

echo $TAG
