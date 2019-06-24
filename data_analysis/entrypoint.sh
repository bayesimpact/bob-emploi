#!/bin/bash

set -e

PROTO_FOLDERS="frontend/api"

if [ -n "$TEST_ENV" ]; then
  PROTO_FOLDERS="$PROTO_FOLDERS data_analysis/importer/test/testdata"
fi

for folder in $PROTO_FOLDERS; do
  protoc -I . -I /usr/local/share/proto/ bob_emploi/$folder/*.proto --python_out=.  --mypy_out=quiet:.
  touch "bob_emploi/$folder/__init__.py"
done

touch bob_emploi/__init__.py
touch bob_emploi/data_analysis/__init__.py
touch bob_emploi/frontend/__init__.py
touch bob_emploi/frontend/api/__init__.py

# Try to be smart and run Python files:
if [[ $1 == *.py ]]; then
  KNOWN_PREFIX="bob_emploi/ bob_emploi/data_analysis/"
  for prefix in $KNOWN_PREFIX; do
    if [ -f "$prefix$1" ]; then
      python $prefix$@
      exit
    fi
  done
fi

$@
