"""Unit tests for the frontend.server.mail.templates.mailjet_templates module."""

import json
import os
import unittest

from bob_emploi.frontend.server.mail.templates import mailjet_templates

_TEMPLATES_PATH = os.path.join(os.path.dirname(__file__), '..', 'templates')


class MapTests(unittest.TestCase):
    """Sanity checks for the templates map."""

    def test_folders(self) -> None:
        """Check that Mailjet folders exist."""

        for name in mailjet_templates.MAP:
            self.assertTrue(
                os.path.isdir(os.path.join(_TEMPLATES_PATH, name)),
                msg=f'Template {name} does not have a corresponding folder.'
            )

    def test_i18n_consistancy(self) -> None:
        """Check that templates do not have both i18n and noI18n."""

        for name, definition in mailjet_templates.MAP.items():
            self.assertFalse(
                definition.get('i18n') and definition.get('noI18n'),
                msg=f'Template {name} has both i18n and noI18n keys.'
            )


class TemplatesTest(unittest.TestCase):
    """Sanity checks on values from MailJet templates."""

    def test_json_index_lint(self) -> None:
        """Lint checks on mailjlet.json."""

        index_filename = os.path.join(mailjet_templates.PATH, 'mailjet.json')
        with open(index_filename, 'r', encoding='utf-8') as index_file:
            index_as_text = index_file.read()
        index = json.loads(index_as_text)
        self.assertEqual(
            json.dumps(index, indent=2, sort_keys=True, ensure_ascii=False) + '\n',
            index_as_text,
            msg='mailjet.json must be indented and sorted properly')


if __name__ == '__main__':
    unittest.main()
