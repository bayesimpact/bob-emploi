#!/bin/bash

# TODO(pascal): Remove once https://github.com/mongomock/mongomock/issues/391 is closed.
if ( pip show mongomock | grep Version:\ 3.9.0 ); then
  echo "mongomock version 3.9.0, patching…"
  readonly VENDOR_DIR="$(dirname "${BASH_SOURCE[0]}")"
  cp "$VENDOR_DIR/mongomock/collection.py" /usr/local/lib/python3.6/site-packages/mongomock/collection.py
else
  echo "mongomock version has been updated: not patching."
  exit 1
fi
