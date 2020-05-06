#!/bin/bash

# TODO(cyrille): Remove once https://github.com/gilbsgilbs/babel-plugin-i18next-extract/issues/131 is implemented.
sed -i -e "s/console\.warn/throw new Error/" node_modules/babel-plugin-i18next-extract/index.js
