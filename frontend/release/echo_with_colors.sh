#!/usr/bin/env bash
# Helpers to echo strings with colors.
function echo_error {
  # Red.
  echo -e "\033[31mERROR: $1\033[0m"
}

function echo_success {
  # Green.
  echo -e "\033[32m$1\033[0m"
}

function echo_warning {
  # Orange.
  echo -e "\033[33m$1\033[0m"
}

function echo_info {
  # Blue.
  echo -e "\033[36m$1\033[0m"
}
