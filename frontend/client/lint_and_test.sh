#!/bin/bash
EXIT=0

echo "Running lint…"
npm run --silent lint || EXIT=$?

echo "Checking for new or unused translations…"
./diff_i18n_folder.sh || EXIT=$?

echo "Running tests…"
npm --silent test || EXIT=$?

echo "Running node tests…"
npm run --silent test:node || EXIT=$?

echo "Checking Typescript types…"
npm run --silent check-types || EXIT=$?

exit $EXIT
