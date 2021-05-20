#! /bin/bash
# Run typescript on core app and plugins.
#
# If an argument is given (either 'core' or a plugin name), it will extract only for this app.

EXIT=0
readonly FRONTEND="$(dirname ${BASH_SOURCE[0]})"
readonly ONLY_PLUGIN="$1"

function typecheck_plugin() {
    local dir="$1"
    local config_file="${dir}tsconfig.json"
    if ! [ -f "$config_file" ]; then
        # TODO(cyrille): Find a way to use global config as default.
        echo "No typescript config in $dir."
        if [ -n "$ONLY_PLUGIN" ]; then
            return 1
        fi
        return 0
    fi
    npx tsc -p "$config_file"
}
cd "$FRONTEND"
# TODO(cyrille): Find a way to use computed types from core for faster plugins typing.
for plugin in $(plugins/list_plugins); do
    dir="plugins/$plugin/"
    if [ -z "$ONLY_PLUGIN" ] || [[ "$ONLY_PLUGIN" == "$plugin" ]]; then
        echo "Checking $plugin..."
        typecheck_plugin "$dir" || EXIT=1
    fi
done
exit $EXIT
