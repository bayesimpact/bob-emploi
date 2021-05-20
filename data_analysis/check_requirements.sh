#!/bin/bash

set -eo pipefail

# Ensure there's no missing installed requirements.
pip show $(grep -v '^#' installed_requirements.txt) > /dev/null

# Ensure we won't re-install any requirements.
if sort <<< "$(
    pip list | tail -n +3 | sed 's/ .*//'
    grep -vE '^(#|([^ =]+<))' requirements.txt | sed 's/[ =].*//'
)" | uniq -d | grep .; then
  >&2 echo "The requirements listed above are already installed."
  exit 1
fi
