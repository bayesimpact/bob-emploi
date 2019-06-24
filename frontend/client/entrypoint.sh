#!/bin/bash

set -e

protoc -I . -I /usr/local/share/proto bob_emploi/frontend/api/*.proto --json-ts_out=quiet:. --js_out=import_style=commonjs,binary:.

# This runs a npm script in silent mode without explicitly calling `npm run`. To run a verbose npm
# script, enter the full command `npm run my-script`.
if npm run | grep "^  $1\$"; then
    npm run -s $@
else
    $@
fi
