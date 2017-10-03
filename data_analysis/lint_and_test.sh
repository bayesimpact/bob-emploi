#!/bin/bash
EXIT=0

echo "Running pep8..."
find -name "*.py" | grep -v _pb2.py$ | grep -v ./bob_emploi/frontend | xargs pep8 || EXIT=$?

echo "Running pylint..."
find -name "*.py" | grep -v _pb2.py$ | grep -v ./bob_emploi/frontend | xargs pylint --load-plugins pylint_quotes || EXIT=$?

echo "Running tests..."
nosetests --exclude-dir=bob_emploi/frontend $@ || EXIT=$?

exit $EXIT
