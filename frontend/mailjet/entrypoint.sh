#!/usr/bin/env bash

if [[ $(npm run mailjet -- list-actions) == *" $1 "* ]]; then
    npm run mailjet -- "$@"
else
    "$@"
fi
