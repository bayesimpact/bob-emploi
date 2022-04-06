"""Unit test for Radar's mail_counselor module."""

import datetime
import unittest
from unittest import mock

from google.protobuf import timestamp_pb2

from bob_emploi.common.python.test import nowmock
from bob_emploi.data_analysis.radar import mail_counselors
from bob_emploi.frontend.api.radar import typeform_pb2


def _create_proto_timestamp(instant: datetime.datetime) -> timestamp_pb2.Timestamp:
    proto = timestamp_pb2.Timestamp()
    proto.FromDatetime(instant)
    return proto


@nowmock.patch(new=lambda: datetime.datetime(2021, 6, 28))
class MailCounselorsTest(unittest.TestCase):
    """Test the main function."""

    @mock.patch(mail_counselors.__name__ + '.typeform.iterate_results')
    @mock.patch(mail_counselors.__name__ + '.mail_send.send_template')
    def test_group_dossiers(
            self,
            mock_send_template: mock.MagicMock,
            mock_iterate_results: mock.MagicMock) -> None:
        """Send one email to each counselor."""

        mock_iterate_results.return_value = iter([
            typeform_pb2.Photo(
                hidden=typeform_pb2.HiddenFields(
                    counselor_email='martin@milo.fr',
                    dossier_id='456',
                ),
                submitted_at=_create_proto_timestamp(datetime.datetime(2021, 4, 1)),
            ),
            typeform_pb2.Photo(
                hidden=typeform_pb2.HiddenFields(
                    counselor_email='martin@milo.fr',
                    dossier_id='789',
                ),
                submitted_at=_create_proto_timestamp(datetime.datetime(2021, 4, 2)),
            ),
            typeform_pb2.Photo(
                hidden=typeform_pb2.HiddenFields(
                    counselor_email='pascal@milo.fr',
                    dossier_id='135135',
                ),
                submitted_at=_create_proto_timestamp(datetime.datetime(2021, 4, 2)),
            ),
            typeform_pb2.Photo(
                hidden=typeform_pb2.HiddenFields(
                    counselor_email='martin@milo.fr',
                    dossier_id='456',
                ),
                submitted_at=_create_proto_timestamp(datetime.datetime(2021, 4, 5)),
            ),
            # Dossier ignored as we have a recent photo.
            typeform_pb2.Photo(
                hidden=typeform_pb2.HiddenFields(
                    counselor_email='martin@milo.fr',
                    dossier_id='2424242',
                ),
                submitted_at=_create_proto_timestamp(datetime.datetime(2021, 6, 3)),
            ),
        ])

        mail_counselors.main([])

        self.assertEqual(
            ['martin@milo.fr', 'pascal@milo.fr'],
            sorted(call[1]['recipient'].email for call in mock_send_template.call_args_list))

        martin_call = mock_send_template.call_args_list[0]
        if martin_call[1]['recipient'].email != 'martin@milo.fr':
            martin_call = mock_send_template.call_args_list[1]
        self.assertEqual(
            {'prenom': '', 'dateDeLaPhotoPrecedente': '2021-04-05', 'idsJeunes': ['456', '789']},
            martin_call[1].get('template_vars'),
            msg=martin_call)


if __name__ == '__main__':
    unittest.main()
