#!/bin/bash
# Upload the code for our Lambda functions directly to AWS Lambda.
#
# To actually deploy it, you would need to publish a new version at
# https://console.aws.amazon.com/lambda/home?region=us-east-1#/functions/opengraph-redirect
# and then update the Lambda Function Association in the Default Behavior of
# our CloudFront distribution
# https://console.aws.amazon.com/cloudfront/home?region=us-east-1#distribution-settings:E3BI8P0VPS4VAY
#
# TODO(pascal): Do the above steps more automatically but add the same
# precaution than in deploy.sh and make it only work with reviewed, tagged and
# released code.
set -e

readonly LAMBDA_FOLDER="$(dirname "$0")"

function upload_lambda() {
  filename=$1; lambda_function_name=$2
  zip_file="$(mktemp --suffix=.zip)"
  index_path="${LAMBDA_FOLDER}/${filename}"

  rm "${zip_file}"
  zip -q "${zip_file}" "${index_path}"
  # Rename the file inside the zip as it needs to be index.js.
  printf "@ ${index_path}\n@=index.js\n" | zipnote -w "${zip_file}"
  aws --region=us-east-1 lambda update-function-code \
    --function-name "${lambda_function_name}" \
    --zip-file "fileb://$(realpath "${zip_file}")"
  rm "${zip_file}"
}

upload_lambda opengraph-redirect.js opengraph-redirect
