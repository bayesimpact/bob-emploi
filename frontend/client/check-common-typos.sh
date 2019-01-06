#!/bin/bash

readonly ERROR='\033[0;31mERROR\033[0m'

if grep ’ -r ./src; then
  echo -e "$ERROR: Replace curly quotes by straight quotes."
  exit 1
fi

if grep Pôle\ Emploi -r ./src; then
  echo -e "$ERROR: \"Pôle emploi\" is spelled with a lowercase e."
  exit 2
fi
