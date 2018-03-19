#!/bin/bash
EXIT=0

echo "Running pycodestyle..."
find bob_emploi/data_analysis -name "*.py" | grep -v _pb2.py$ | xargs pycodestyle || EXIT=$?

echo "Running pylint..."
find bob_emploi/data_analysis -name "*.py" | grep -v _pb2.py$ | xargs pylint --load-plugins pylint_quotes --load-plugins pylint_doc_spacing || EXIT=$?

echo "Running tests..."
nosetests bob_emploi/data_analysis $@ || EXIT=$?

exit $EXIT
