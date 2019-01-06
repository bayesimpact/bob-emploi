#!/bin/bash
# This is a hot fix for pylint to display the files that are linted. TODO(pascal): add it to pylint.

sed -i '/self.set_current_module.modname, filepath/a \            print("Linting %s" % filepath)' /usr/local/lib/python3.6/site-packages/pylint/lint.py
