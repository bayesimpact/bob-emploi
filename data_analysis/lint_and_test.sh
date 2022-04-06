#!/bin/bash
EXIT=0

echo "Running type analysis..."
mypy bob_emploi/data_analysis --strict --ignore-missing-imports || EXIT=$?

echo "Running pycodestyle..."
pycodestyle bob_emploi/data_analysis || EXIT=$?

echo "Running pylint..."
pylint bob_emploi/data_analysis || EXIT=$?

function run_tests() {
    local coverage="$1" exit_code
    local cmd=(-m unittest discover bob_emploi/data_analysis '*_test.py' --buffer)
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
