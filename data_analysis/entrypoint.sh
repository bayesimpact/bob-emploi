#!/bin/bash

set -e

protoc -I . -I /usr/local/share/proto/ bob_emploi/frontend/api/*.proto --python_out=.
touch bob_emploi/__init__.py
touch bob_emploi/frontend/__init__.py
touch bob_emploi/frontend/api/__init__.py

$@
