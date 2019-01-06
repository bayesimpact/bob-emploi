#!/bin/bash
#
# Delete a Bob user by email.
#
# CAUTION: only use this script if the user has explicitly requested to close
# their account for good.

set -e

source "$(dirname "${BASH_SOURCE[0]}")/bashrc"

curl https://www.bob-emploi.fr/api/user \
  -X DELETE \
  -H "Authorization: $(bob_prod_var ADMIN_AUTH_TOKEN)" \
  -H "Content-Type: application/json" \
  --data '{"profile": {"email": "'$1'"}}'

# The curl command above does not finish by a trailing line, so we add it here.
echo
