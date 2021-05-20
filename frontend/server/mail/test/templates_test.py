"""Sanity checks on Mailjet templates."""

import json
import os
from os import path
import re
from typing import Set
import unittest

from bob_emploi.frontend.server.mail import mustache

_TEMPLATE_PATH = path.join(path.dirname(path.dirname(__file__)), 'templates')

# Regexp to match MJML tags e.g. {{var:foo}}, {%endif%} etc.
_MJML_TAG_PATTERN = re.compile(r'([ \n]*\n[ \n]*|{{[^}]*}}|{[^{}]*})', re.MULTILINE)


class MailjetTemplatesTest(unittest.TestCase):
    """Sanity checks on Mailjet templates."""

    templates: Set[str]

    @classmethod
    def setUpClass(cls) -> None:
        super().setUpClass()
        cls.templates = {
            dirname for dirname in os.listdir(_TEMPLATE_PATH)
            if dirname != '__pycache__' and os.path.isdir(os.path.join(_TEMPLATE_PATH, dirname))
        }

    def test_json(self) -> None:
        """Check that all .mjml are valid JSONs."""

        for template in self.templates:
            mjml_file = path.join(_TEMPLATE_PATH, template, 'template.mjml')
            try:
                with open(mjml_file, 'r') as mjml:
                    json.load(mjml)
            except Exception as error:
                raise ValueError(
                    f'Email "{template}" does not have a correct JSON format for the MJML file '
                    f'({mjml_file}):\n{error}') from error

    def test_mustache_in_html(self) -> None:
        """Check that all .html contain valid mustache tags."""

        for template in self.templates:
            html_file = path.join(_TEMPLATE_PATH, template, 'template.html')
            with open(html_file, 'r') as html_handle:
                html_soup = html_handle.read()

            vars_file_path = path.join(_TEMPLATE_PATH, template, 'vars-example.json')
            try:
                with open(vars_file_path, 'r') as vars_file:
                    context = json.load(vars_file)
                try:
                    mustache.instantiate(html_soup, context)
                except Exception as err:
                    raise ValueError(f'Error in template {template}') from err
                continue
            except FileNotFoundError:
                pass

            txt_vars_file_path = path.join(_TEMPLATE_PATH, template, 'vars.txt')
            with open(txt_vars_file_path, 'r') as vars_file:
                context = {key.strip(): '' for key in vars_file}
            try:
                mustache.instantiate(html_soup, context)
            except Exception as err:
                raise ValueError(f'Error in template {template}') from err


if __name__ == '__main__':
    unittest.main()
