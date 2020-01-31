#!/bin/bash
EXIT=0

echo "Running lint…"
npm run --silent lint || EXIT=$?

echo "Extracting translations…"
npm run --silent i18n || EXIT=$?

echo "Running tests…"
npm --silent test || EXIT=$?

echo "Running node tests…"
npm run --silent test:node || EXIT=$?

echo "Checking Typescript types…"
npm run --silent check-types || EXIT=$?

exit $EXIT
