#!/bin/bash
#
# Get a fresh auth token for a Bob logged in URL, e.g.
# https://www.bob-emploi.fr/projet/0?userId=0000000000000000&authToken=11111.000
#
# CAUTION: only use this script if the user has explicitly pinged us.

set -e

source "$(dirname "${BASH_SOURCE[0]}")/bashrc"

readonly SOURCE_URL="$1"
if [[ -z "$SOURCE_URL" ]]; then
    echo "Usage: ${BASH_SOURCE[0]} \"https://www.bob-emploi.fr/<Bob signed-in URL>\""
    exit 1
fi

readonly USER_REGEX=".*userId=([0-9a-f]+).*"
if ! [[ $SOURCE_URL =~ $USER_REGEX ]]; then
    echo "Could not find userId in $SOURCE_URL"
    exit 2
fi
readonly USER_ID=${BASH_REMATCH[1]}

readonly AUTH_TOKEN_REGEX="(.*authToken=)[0-9a-f.]+(.*)"
if ! [[ $SOURCE_URL =~ $AUTH_TOKEN_REGEX ]]; then
    echo "Could not find authToken in $SOURCE_URL"
    exit 3
fi

readonly AUTH_TOKEN="$(curl -s https://www.bob-emploi.fr/api/user/$USER_ID/generate-auth-tokens \
  -H "Authorization: $(bob_prod_var ADMIN_AUTH_TOKEN)" \
  -H "Content-Type: application/json" | jq .auth -r)"

echo ${BASH_REMATCH[1]}${AUTH_TOKEN}${BASH_REMATCH[2]}
