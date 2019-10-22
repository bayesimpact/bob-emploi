#!/bin/bash
# Builds the docker container most relevant to the current file, without running the tests, or .

readonly project_path=$1
readonly file_path=$2
readonly relative_file_path=${file_path#"$project_path/"}

if [[ $relative_file_path == frontend/client* ]]; then
    service="frontend-dev"
elif [[ $relative_file_path == frontend/server* ]]; then
    service="frontend-flask"
    if [[ $relative_file_path == *_test.py ]]; then
        service="$service-test"
    fi
elif [[ $relative_file_path == frontend* ]]; then
    echo "No relevant service to build."
    exit 1
elif [[ $relative_file_path == analytics* ]]; then
    service="analytics"
elif [[ $relative_file_path == data_analysis/notebooks* ]]; then
    service="data-analysis-notebooks"
else
    service="data-analysis-prepare"
fi

docker-compose build --build-arg SKIP_TEST=1 "$service"
