#!/bin/bash
# Find which is the relevant docker-compose service to run on.

readonly project_path=$1
readonly file_path=$2
readonly test_service=$3
readonly relative_file_path=${file_path#"$project_path/"}

if [[ $relative_file_path == frontend/client* ]]; then
    echo "frontend-dev"
    exit
fi
if [[ $relative_file_path == frontend/server* ]]; then
    service="frontend-flask"
    if [[ $relative_file_path == *test* || -n "$test_service" ]]; then
        service="$service-test"
    fi
    echo $service
    exit
fi
if [[ $relative_file_path == frontend* ]]; then
    echo "No relevant service for $relative_file_path." 1>&2
    exit 1
fi
if [[ $relative_file_path == analytics* ]]; then
    echo "analytics"
    exit
fi
if [[ $relative_file_path == data_analysis/notebooks* ]]; then
    echo "data-analysis-notebooks"
    exit
fi

echo "data-analysis-prepare"
