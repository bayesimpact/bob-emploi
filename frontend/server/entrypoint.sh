#!/bin/bash

set -e

protoc -I . -I /usr/local/share/proto/ bob_emploi/frontend/api/*.proto --python_out=.
touch bob_emploi/frontend/api/__init__.py

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
