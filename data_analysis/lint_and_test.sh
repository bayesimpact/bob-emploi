#!/bin/bash
EXIT=0

echo "Running type analysis..."
# TODO(pascal): Check https://github.com/python/mypy/issues/7030 to see what to do with the
# --implicit-reexport flag
mypy bob_emploi/data_analysis --strict --ignore-missing-imports --implicit-reexport || EXIT=$?

echo "Running pycodestyle..."
find bob_emploi/data_analysis -name "*.py" | grep -v _pb2.py$ | xargs pycodestyle || EXIT=$?

echo "Running pylint..."
find bob_emploi/data_analysis -name "*.py" | grep -v _pb2.py$ | xargs pylint || EXIT=$?

echo "Running tests..."
nosetests bob_emploi/data_analysis $@ || EXIT=$?

exit $EXIT
