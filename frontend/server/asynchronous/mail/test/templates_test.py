"""Sanity checks on Mailjet templates."""

import json
import os
from os import path
from typing import Set
import unittest


_TEMPLATE_PATH = path.join(path.dirname(path.dirname(__file__)), 'templates')


class MailjetTemplatesTest(unittest.TestCase):
    """Sanity checks on Mailjet templates."""

    templates: Set[str]

    @classmethod
    def setUpClass(cls) -> None:
        super().setUpClass()
        cls.templates = {
            dirname for dirname in os.listdir(_TEMPLATE_PATH)
            if os.path.isdir(os.path.join(_TEMPLATE_PATH, dirname))
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


if __name__ == '__main__':
    unittest.main()
