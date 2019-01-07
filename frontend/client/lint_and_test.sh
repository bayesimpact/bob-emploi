#!/bin/bash
EXIT=0

echo "Running lint..."
npm run lint || EXIT=$?

echo "Running test..."
npm test || EXIT=$?

exit $EXIT
