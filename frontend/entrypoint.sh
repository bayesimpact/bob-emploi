#!/bin/bash

set -e

echo "Compiling protobuffers..."
protoc -I . -I /usr/local/share/proto bob_emploi/frontend/api/*.proto --js_out=import_style=commonjs,binary:.

$@
