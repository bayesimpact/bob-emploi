#!/bin/bash
#
# Delete a Bob user by email.
#
# CAUTION: only use this script if the user has explicitly requested to close
# their account for good.

set -e

source "$(dirname "${BASH_SOURCE[0]}")/bashrc"

readonly BOB_DEPLOYMENT="${BOB_DEPLOYMENT:-fr}"
readonly PROD_HOST="$(bob_stack_var "$BOB_DEPLOYMENT" PublicDomainName)"

if [ -z "$PROD_HOST" ]; then
    >&2 echo "Couldn't find a valid host name, please check BOB_DEPLOYMENT=\"$BOB_DEPLOYMENT\" is a valid deployment."
    exit 1
fi

curl "https://$PROD_HOST/api/user" \
  -X DELETE \
  -H "Authorization: $(bob_prod_var "$BOB_DEPLOYMENT" ADMIN_AUTH_TOKEN)" \
  -H "Content-Type: application/json" \
  --data '{"profile": {"email": "'$1'"}}'

# The curl command above does not finish by a trailing line, so we add it here.
echo
