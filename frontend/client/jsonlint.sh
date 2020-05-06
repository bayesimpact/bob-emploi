#!/bin/bash

EXIT=0

if ! [[ -x $(which jsonlint) ]]; then
  PATH="$PATH:node_modules/.bin/"
fi

if [[ "$2" == "--fix" ]]; then
  readonly SHOULD_FIX=1
else
  readonly SHOULD_FIX=
fi

function jsonlint_file {
  local tmpjson="$(mktemp)"
  jsonlint -s "$1" > "$tmpjson"
  if ! diff -yd --suppress-common-lines "$1" "$tmpjson"; then
    >&2 echo "Lint errors in $1"
    if [[ -n $SHOULD_FIX ]]; then
      >&2 echo "Fixing…"
      cp "$tmpjson" "$1"
    fi
    rm "$tmpjson"
    return 1
  fi
  rm "$tmpjson"
}

for json_file in $(find "$1" -path ./node_modules -prune -o -name \*.json); do
  jsonlint_file "$json_file" || EXIT=$?
done

exit $EXIT