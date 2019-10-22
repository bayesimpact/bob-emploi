"""Tests for the bob_emploi.frontend.privacy module."""

import datetime
import unittest

from bob_emploi.frontend.server import privacy
from bob_emploi.frontend.api import options_pb2
from bob_emploi.frontend.api import user_pb2


class PrivacyTestCase(unittest.TestCase):
    """Unit tests for the privacy module."""

    def test_anonymize_proto(self) -> None:
        """Basic usage of anonymize_proto."""

        user = user_pb2.User()
        user.registered_at.FromDatetime(datetime.datetime(2017, 7, 19, 15, 43, 27, 12))
        user.google_id = 'Oh my god, this is personal!'
        user.revision = 42
        user.projects.add(project_id='abcde', deletion_reason='fine', title='app only')

        self.assertTrue(privacy.anonymize_proto(user))

        self.assertEqual(
            datetime.datetime(2017, 7, 19, 15),
            user.registered_at.ToDatetime())
        self.assertFalse(user.google_id)
        self.assertEqual(42, user.revision)
        self.assertFalse(user.projects[0].project_id)
        self.assertEqual('fine', user.projects[0].deletion_reason)
        self.assertEqual('app only', user.projects[0].title)

    def test_anonymize_proto_also_field_usages_to_clear(self) -> None:
        """anonymize_proto clears both personal identifier and app-only fields."""

        user = user_pb2.User()
        user.registered_at.FromDatetime(datetime.datetime(2017, 7, 19, 15, 43, 27, 12))
        user.google_id = 'Oh my god, this is personal!'
        user.revision = 42
        user.projects.add(project_id='abcde', deletion_reason='fine', title='app only')
        user.support_tickets.add(ticket_id='ticket-id')

        self.assertTrue(privacy.anonymize_proto(
            user, field_usages_to_clear={options_pb2.PERSONAL_IDENTIFIER, options_pb2.APP_ONLY}))

        self.assertEqual(
            datetime.datetime(2017, 7, 19, 15), user.registered_at.ToDatetime())
        self.assertFalse(user.google_id)
        self.assertFalse(user.revision)
        self.assertFalse(user.projects[0].project_id)
        self.assertEqual('fine', user.projects[0].deletion_reason)
        self.assertFalse(user.projects[0].title)
        self.assertFalse(user.support_tickets[0].ticket_id)

    def test_anonymize_proto_map(self) -> None:
        """anonymize_proto does not choke on a scalar map."""

        user = user_pb2.User()
        user.likes['pascal'] = True

        self.assertFalse(privacy.anonymize_proto(user))

        self.assertTrue(user.likes['pascal'])

    def test_redact_user(self) -> None:
        """redact_proto clears personal identifiers."""

        user = user_pb2.User()
        user.registered_at.FromDatetime(datetime.datetime(2017, 7, 19, 15, 43, 27, 12))
        user.google_id = 'Oh my god, this is personal!'
        user.projects.add(project_id='abcde')
        user.support_tickets.add(ticket_id='ticket-id')

        privacy.redact_proto(user)

        self.assertEqual(
            datetime.datetime(2017, 7, 19, 15, 43, 27, 12), user.registered_at.ToDatetime())
        self.assertEqual('REDACTED', user.google_id)
        self.assertEqual('REDACTED', user.projects[0].project_id)
        self.assertEqual('REDACTED', user.support_tickets[0].ticket_id)


if __name__ == '__main__':
    unittest.main()
