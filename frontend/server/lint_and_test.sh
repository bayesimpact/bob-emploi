#!/bin/bash
EXIT=0

readonly DIRNAME="$(dirname "${BASH_SOURCE[0]}")"

echo "Running type analysis..."
mypy bob_emploi/frontend/server --strict --ignore-missing-imports || EXIT=$?

echo "Running pycodestyle..."
pycodestyle bob_emploi/frontend/server || EXIT=$?

echo "Running pylint..."
pylint bob_emploi/frontend/server || EXIT=$?

echo "Checking doc..."
if ! diff <(python bob_emploi/frontend/server/scoring.py) bob_emploi/frontend/server/scoring.md; then
    EXIT=1
    echo "Scoring models documentation is not up to date."
    echo "Please, run
    python bob_emploi/frontend/server/scoring.py > bob_emploi/frontend/server/scoring.md"
fi

function run_tests() {
    local coverage="$1" exit_code
    local cmd=(-m unittest discover bob_emploi/frontend/server '*_test.py' --buffer)
    if [ -z "$coverage" ]; then
        python "${cmd[*]}" || return $?
    else
        coverage erase
        coverage run "${cmd[@]}" || exit_code=$?
        coverage report --fail-under 90 || exit_code=$?
        coverage html -d cover
        coverage xml
        return ${exit_code:-0}
    fi
}
echo "Running tests..."
run_tests "$COVERAGE" || EXIT=$?

exit $EXIT
