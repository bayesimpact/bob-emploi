"""Sanity checks on values from MailJet templates."""

import os
import unittest

from bob_emploi.data_analysis.lib import checker
from bob_emploi.frontend.server.asynchronous.i18n import extract_mailjet_strings
from bob_emploi.frontend.server.mail.templates import mailjet_templates


class Templatestest(unittest.TestCase):
    """Sanity checks on values from MailJet templates."""

    def test_extracted_strings(self) -> None:
        """Checks on extracted strings."""

        checkers = (
            checker.SpacesChecker(),
            checker.QuotesChecker(),
        )
        errors = []
        for campaign_id in sorted(mailjet_templates.MAP):
            folder = os.path.join(mailjet_templates.PATH, campaign_id)
            for entry in extract_mailjet_strings.extract_from_mailjet(folder):
                for each_checker in checkers:
                    try:
                        each_checker.check_value(entry.msgid, 'fr')
                    except ValueError as error:
                        errors.append((campaign_id, entry, error))
        if not errors:
            return
        if len(errors) > 1:
            print(f'{len(errors)} errors:\n')
            for campaign_id, entry, exception in errors:
                print(f'{campaign_id}: {exception}\n\n')
        for campaign_id, entry, exception in errors:
            raise ValueError(
                f'Mailjet template "{campaign_id}" has an error at {entry.occurrences}\n',
            ) from exception


if __name__ == '__main__':
    unittest.main()
