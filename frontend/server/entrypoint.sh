#!/bin/bash

set -e

PROTO_FOLDERS="frontend/api"

if [ -n "$TEST_ENV" ]; then
  readonly TEST_FLAGS="--mypy_out=quiet:."
  PROTO_FOLDERS="$PROTO_FOLDERS frontend/server/test/testdata"
else
  readonly TEST_FLAGS=""
fi

for folder in $PROTO_FOLDERS; do
  protoc -I . -I /usr/local/share/proto/ bob_emploi/$folder/*.proto --python_out=. $TEST_FLAGS
  touch "bob_emploi/$folder/__init__.py"
done

# Try to be smart and run Python files:
if [[ $1 == *.py ]]; then
  KNOWN_PREFIX="bob_emploi/ bob_emploi/frontend bob_emploi/frontend/server/"
  for prefix in $KNOWN_PREFIX; do
    if [ -f "$prefix$1" ]; then
      python $prefix$@
      exit
    fi
  done
fi

$@
