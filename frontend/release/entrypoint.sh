#!/bin/bash

# Update URL for flask backend.
if [ -n "${FLASK_URL}" ]; then
  sed -i -e "s/frontend-flask/${FLASK_URL}/" /etc/nginx/conf.d/default.conf
fi

# Replace the dist constants to use ones from the environment if any.

# Convert the JSON file in a map file with "key value" format.
readonly DIST_VARS=$(mktemp)
cut -s -d '"' -f 2,4 /usr/share/bob-emploi/dist.json | tr \" \  > "${DIST_VARS}"

function replace_string() {
  from=$1; to=$2; shift; shift
  from_pattern="$(sed -e 's/[]\/$*.^|[]/\\&/g' <<< "$from")"
  to_replacement="$(sed -e 's/[\/&]/\\&/g' <<< "$to")"
  sed -i -e "s/${from_pattern}/${to_replacement}/g" $@
}

function get_var_value() {
  key=$1; mapfile=$2
  grep "^${key} " "${mapfile}" | sed -e "s/^[^ ]* //"
}

readonly JS_APP_FILES="/usr/share/bob-emploi/html/assets/*.js"

function replace_var_if_value() {
  env_var=${!1}; key=$2
  if [ -n "${env_var}" ]; then
    replace_string \
      "$(get_var_value "$key" "${DIST_VARS}")" \
      "${env_var}" \
      "$JS_APP_FILES"
  fi
}

replace_var_if_value AMPLITUDE_TOKEN amplitudeToken
replace_var_if_value FACEBOOK_APP_ID facebookSSOAppId
replace_var_if_value GOOGLE_SSO_CLIENT_ID googleSSOClientId
replace_var_if_value GOOGLE_UA_ID googleUAID
replace_var_if_value LINKED_IN_CLIENT_ID linkedInClientId
replace_var_if_value SENTRY_PUBLIC_DSN sentryDSN
replace_string "$(cat /usr/share/bob-emploi/version)" "$CLIENT_VERSION" "$JS_APP_FILES"

rm "${DIST_VARS}"

nginx -g 'daemon off;'
