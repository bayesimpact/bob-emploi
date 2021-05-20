#!/bin/bash
# Runs nosetest with IDE readable output in the relevant docker, and for the relevant file,
# depending on where the file to check is.

readonly cli_dir="$( dirname "${BASH_SOURCE[0]}" )"
readonly service="$( "$cli_dir/find_service.sh" "$@" test )"
readonly project_path=$1
readonly file_path=$2
readonly relative_file_path=${file_path#"$project_path/"}
readonly verbose=$3

if [[ $relative_file_path == *_test.py ]]; then
    echo "Running tests in $relative_file_path..."
    path="$relative_file_path"
else
    echo "Running tests for $service..."
    if [[ "$service" == "frontend-flaks-test" ]]; then
        path="frontend"
    elif [[ "$service" == "analytics" ]]; then
        path="analytics"
    elif [[ "$service" == "data-analysis-prepare" ]]; then
        path="data_analysis"
    else
        path=""
    fi
fi

if [ -z "$verbose" ]; then
    readonly options="--with-terseout"
fi

docker-compose --ansi never run -e TEST_REAL_DATA --rm --no-deps $service nosetests "$options" "bob_emploi/$path"
