#!/bin/bash

set -e

# Generate _pb2.py files from proto.
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

# Generate _json.py file from json.
readonly MAILJET_TEMPLATES_FOLDER=bob_emploi/frontend/server/mail/templates
touch "$MAILJET_TEMPLATES_FOLDER/__init__.py"
python "bob_emploi/frontend/server/mail/create_mailjet_template_map.py" "$MAILJET_TEMPLATES_FOLDER/mailjet.json" > "$MAILJET_TEMPLATES_FOLDER/mailjet_templates.py"

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
