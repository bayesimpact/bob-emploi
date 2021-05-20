#!/bin/bash

# A script to deploy a stack parameter for a given deployment.

readonly DIRNAME="$(dirname "${BASH_SOURCE[0]}")"

source "$DIRNAME/../../cli/bashrc"

function deploy_stack_param {
  local deployment updated_params region stack param value
  deployment=$1
  param=$2
  value=$3
  {
    read -r region; read -r stack
  } < <(__bob_get_stack "$deployment" | jq -r '.region,.stackId')
  if [ -z "$region" ]; then
    echo "No stack found"
    exit 1
  fi
  # TODO(cyrille): Use __bob_stack_params.
  set -- --region "$region" --stack-name "$stack"
  updated_params="$(aws cloudformation describe-stacks "$@" |
    jq -r --arg param "$param" --arg value "$value" '
      .Stacks[].Parameters |
      map(if .ParameterKey == $param then
        .ParameterValue = $value
      else
        del(.ParameterValue)|.UsePreviousValue=true
      end)
    '
  )"
  echo "Deploying new parameter to '$deployment' stack..."
  aws cloudformation update-stack "$@" --parameters "$updated_params" --use-previous-template
  echo "Waiting for the deployment to complete..."
  echo "You may cancel this process, the update will still proceed."
  aws cloudformation wait stack-update-complete "$@" &&
    echo "The new parameter has been deployed, the stack is now up-to-date! Thanks for waiting."
}

deploy_stack_param "$@"
