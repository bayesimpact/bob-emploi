#!/bin/bash
# Upload the code for our Lambda functions directly to AWS Lambda.
# Needs bob-emploi-deploy-lambda IAM policy or equivalent.
# https://console.aws.amazon.com/iam/home?region=us-east-1#/policies/arn:aws:iam::951168128976:policy/bob-emploi-deploy-lambda$serviceLevelSummary
#
# To use the new version, you would need to update the "LambdaAuxPageRedirect" parameter
# in the cloudformation stack.
set -e

readonly LAMBDA_FOLDER="$(dirname "$0")/lambdas"

# TODO(cyrille): Move this treatment inside the relevant dockers.
function make_zip() {
  filename=$1
  creation_instruction="$2"
  index_path="${LAMBDA_FOLDER}/${filename}"

  if ! [ -f "$index_path" ]; then
    abs_path="$(realpath --relative-to . -m $index_path)"
    >&2 echo "The file $abs_path doesn't exist, it will be ignored."
    if [ -n "$creation_instruction" ]; then
      >&2 echo "To create the file, run:"
      >&2 echo "    $creation_instruction"
    fi
    return
  fi
  if [[ $filename = *.zip ]]; then
    realpath "$index_path"
    return
  fi

  if [ ! -f "$index_path" ] && [ ! -d "$index_path" ]; then
    >&2 echo "The lambda you wish to upload does not exist at \"$index_path\"."
    exit 1
  fi
  if [ -d "$index_path" ] && [ ! -f "$index_path/index.js" ]; then
    >&2 echo "The lambda folder \"$index_path\" should have an index.js file at its root."
    exit 2
  fi

  zip_file="$(mktemp -t XXXXXXXX.zip)"
  rm "$zip_file"
  if [ -f "$index_path" ]; then
    pushd "$LAMBDA_FOLDER" > /dev/null
    zip -q "${zip_file}" "$filename"
    # TODO(cyrille): Change this, since zipnote has a bug in its MacOS version.
    printf '@ %s\n@=index.js\n' "$filename" | zipnote -w "${zip_file}"
  else
    pushd "$index_path" > /dev/null
    zip -qr "$zip_file" .
  fi
  popd > /dev/null
  realpath "$zip_file"
}

function upload_lambda() {
  filename="$1"; lambda_function_name=$2; creation_instruction="$3"

  zip_file=$(make_zip "$filename" "$creation_instruction")
  if [ -z "$zip_file" ]; then
    return
  fi
  previous_code_sha_256="$(
    aws --region=us-east-1 lambda get-function --function-name "${lambda_function_name}" | \
    jq -r .Configuration.CodeSha256)"
  new_code_sha_256="$(aws --region=us-east-1 lambda update-function-code \
    --function-name "${lambda_function_name}" \
    --zip-file "fileb://$zip_file" | \
    jq -r .CodeSha256)"
  rm "${zip_file}"

  if [ "$previous_code_sha_256" != "$new_code_sha_256" ]; then
    function_arn="$(aws --region=us-east-1 lambda publish-version --function-name "${lambda_function_name}" | \
      jq -r .FunctionArn)"
    # TODO(cyrille): Update output message for when the lambda is not relevant to Cloudfront.
    echo "New version of $lambda_function_name published, update cloudfront.json: $function_arn"
  else
    echo "$lambda_function_name already up to date."
  fi
}

if [ -n "$1" ]; then
  upload_lambda "$@"
  exit
fi

# TODO(cyrille): Generate those as zip-files using Typescript and an npm script.
upload_lambda opengraph_redirect.js opengraph-redirect
upload_lambda aux_pages_redirect.js bob-aux-pages-redirect

upload_lambda ../../../data_analysis/data/monitoring.zip monitoring \
  "docker-compose run --rm data-analysis-prepare make data/monitoring.zip"
