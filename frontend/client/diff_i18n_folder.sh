#!/bin/bash
#
# Check wether i18n extraction has added or dropped any key.

readonly TMP_FOLDER="$(mktemp -d)"
cp -r src/translations/. "$TMP_FOLDER"

npm run --silent i18n

# TODO(cyrille): Do the same for all plugins.
if ! diff -ar src/translations "$TMP_FOLDER"; then
  echo 'Translations files are not stable after extraction.'
  rm -rf "$TMP_FOLDER"
  exit 1
fi

rm -rf "$TMP_FOLDER"
