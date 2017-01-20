#!/bin/bash
EXIT=0

echo "Running pep8..."
find -name "*.py" | grep -v _pb2.py$ | xargs pep8 || EXIT=$?

echo "Running pylint..."
find -name "*.py" | grep -v _pb2.py$ | xargs pylint || EXIT=$?

echo "Running tests..."
nosetests $@ || EXIT=$?

exit $EXIT
