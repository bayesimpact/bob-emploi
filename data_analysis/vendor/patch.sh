#!/bin/bash
# This is a hot fix for pylint to display the files that are linted. TODO(pascal): add it to pylint.

sed -i 's/^\( *\)self.set_current_module.modname, filepath.*$/\0\n\1print("Linting %s" % filepath)/' /usr/local/lib/python3.7/site-packages/pylint/lint/pylinter.py
