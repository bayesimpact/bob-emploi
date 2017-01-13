#!/bin/bash

# Current dir, containing patches.
readonly PATCHES_DIR="$(dirname "${BASH_SOURCE[0]}")"
# Node modules dir to patch.
readonly MODULES_DIR="$(dirname "${PATCHES_DIR}")/node_modules"

function patch {
  module=$1
  version=$2

  readonly dir="${MODULES_DIR}/${module}"
  readonly installed_version=$(cat "${dir}/package.json" | grep "^ *\"version\"" | sed -e "s/^.* \"//;s/\".*$//")

  if [ "$installed_version" != "$version" ]; then
    echo "This patch is suppose to apply to $module version $version, but we found version $installed_version instead." >&2
    exit 1
  fi

  cp -R "${PATCHES_DIR}/${module}" "${MODULES_DIR}"
}

patch "webpack-dev-server" "1.14.1"
# https://github.com/webpack/webpack-dev-server/pull/430
