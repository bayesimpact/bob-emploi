#!/bin/bash
EXIT=0

echo "Running type analysis..."
# TODO(cyrille): Add more and more files.
readonly TYPED_FILES="\
  bob_emploi/data_analysis/importer/airtable_to_protos.py \
  bob_emploi/data_analysis/i18n/*.py \
  bob_emploi/data_analysis/lib"
mypy $TYPED_FILES --strict --ignore-missing-imports || EXIT=$?

echo "Running pycodestyle..."
find bob_emploi/data_analysis -name "*.py" | grep -v _pb2.py$ | xargs pycodestyle || EXIT=$?

echo "Running pylint..."
find bob_emploi/data_analysis -name "*.py" | grep -v _pb2.py$ | xargs pylint --load-plugins pylint_quotes --load-plugins pylint_doc_spacing || EXIT=$?

echo "Running tests..."
nosetests bob_emploi/data_analysis $@ || EXIT=$?

exit $EXIT
