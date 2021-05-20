"""Unit tests for the frontend.server.mail.templates.mailjet_templates module."""

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


if __name__ == '__main__':
    unittest.main()
