#!/bin/bash
# Runs mypy in the relevant docker, depending on where the file to check is.

readonly cli_dir="$( dirname "${BASH_SOURCE[0]}" )"
readonly service="$( "$cli_dir/find_service.sh" "$@" test )"

if [[ "$service" == "frontend-flask-test" ]]; then
    folder="bob_emploi/frontend/server"
elif [[ "$service" == "analytics" ]]; then
    folder="bob_emploi/analytics"
elif [[ "$service" == "data-analysis-prepare" ]]; then
    folder="bob_emploi/data_analysis"
else
    folder="bob_emploi"
fi

docker-compose --ansi never run --rm --no-deps $service mypy $folder --strict --ignore-missing-imports
