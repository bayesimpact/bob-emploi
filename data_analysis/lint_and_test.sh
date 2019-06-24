#!/bin/bash
EXIT=0

echo "Running type analysis..."
mypy bob_emploi/data_analysis --strict --ignore-missing-imports || EXIT=$?

echo "Running pycodestyle..."
find bob_emploi/data_analysis -name "*.py" | grep -v _pb2.py$ | xargs pycodestyle || EXIT=$?

echo "Running pylint..."
find bob_emploi/data_analysis -name "*.py" | grep -v _pb2.py$ | xargs pylint || EXIT=$?

echo "Running tests..."
nosetests bob_emploi/data_analysis $@ || EXIT=$?

exit $EXIT
