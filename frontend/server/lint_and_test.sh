#!/bin/bash
EXIT=0

readonly DIRNAME="$(dirname "${BASH_SOURCE[0]}")"

echo "Running type analysis..."
# TODO(pascal): Check https://github.com/python/mypy/issues/7030 to see what to do with the
# --implicit-reexport flag
mypy bob_emploi/frontend/server --strict --ignore-missing-imports --implicit-reexport || EXIT=$?

echo "Running pycodestyle..."
find -name "*.py" | grep -v test/vendor | grep -v _pb2.py$ | xargs pycodestyle --config="$DIRNAME/.pycodestyle" || EXIT=$?

echo "Running pylint..."
find -name "*.py" | grep -v test/vendor | grep -v _pb2.py$ | xargs pylint || EXIT=$?

echo "Checking doc..."
if ! diff <(python bob_emploi/frontend/server/scoring.py) bob_emploi/frontend/server/scoring.md; then
    EXIT=1
    echo "Scoring models documentation is not up to date."
    echo "Please, run
    python bob_emploi/frontend/server/scoring.py > bob_emploi/frontend/server/scoring.md"
fi

echo "Running tests..."
nosetests $@ || EXIT=$?

exit $EXIT
