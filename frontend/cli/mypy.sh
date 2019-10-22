#!/bin/bash
# Runs mypy in the relevant docker, depending on where the file to check is.

readonly project_path=$1
readonly file_path=$2

if [[ $file_path == $project_path/frontend* ]]; then
    folder="bob_emploi/frontend/server"
    service="frontend-flask-test"
elif [[ $file_path == $project_path/analytics* ]]; then
    folder="bob_emploi/analytics"
    service="analytics"
else
    folder="bob_emploi/data_analysis"
    service="data-analysis-prepare"
fi

docker-compose run --rm --no-deps $service mypy $folder --strict --ignore-missing-imports --implicit-reexport
