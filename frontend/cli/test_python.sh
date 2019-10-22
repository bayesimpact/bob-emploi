#!/bin/bash
# Runs nosetest with IDE readable output in the relevant docker, and for the relevant file,
# depending on where the file to check is.

readonly project_path=$1
readonly file_path=$2
readonly relative_file_path=${file_path#"$project_path/"}

if [[ $relative_file_path == frontend* ]]; then
    service="frontend-flask-test"
    folder="frontend"
elif [[ $relative_file_path == analytics* ]]; then
    service="analytics"
    folder="analytics"
else
    service="data-analysis-prepare"
    folder="data_analysis"
fi

if [[ $relative_file_path == *_test.py ]]; then
    echo "Running tests in $relative_file_path..."
    path="$relative_file_path"
else
    echo "Running tests for $service..."
    path="$folder"
fi

docker-compose run -e TEST_REAL_DATA --rm --no-deps $service nosetests --with-machineout "bob_emploi/$path"
