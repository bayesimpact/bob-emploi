#!/bin/bash

set -e

# TODO(cyrille): Also build mailjet_pb.d.ts once typescript-protobuf v0.7 is released.
shopt -s extglob
protoc -I . -I /usr/local/share/proto bob_emploi/frontend/api/!(mailjet).proto --json-ts_out=quiet:/tmp --js_out=import_style=commonjs,binary:.
# Opt out of update notifier.
npm --no-update-notifier config set update-notifier false

mkdir -p /tmp/bob_emploi
npx json5 cfg/colors.json5 > /tmp/bob_emploi/colors.json
npx json5 plugins/ali/cfg/colors.json5 > /tmp/bob_emploi/ali_colors.json
npx json5 plugins/jobflix/cfg/colors.json5 > /tmp/bob_emploi/jobflix_colors.json

# This runs a npm script in silent mode without explicitly calling `npm run`. To run a verbose npm
# script, enter the full command `npm run my-script`.
if npm run | grep "^  $1\$"; then
    npm run -s $@
else
    $@
fi
