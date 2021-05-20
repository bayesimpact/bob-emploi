"""Unit test for Radar's export module."""

import datetime
import io
import itertools
import typing
import unittest
from unittest import mock

from google.protobuf import timestamp_pb2

from bob_emploi.frontend.api.radar import output_pb2
from bob_emploi.frontend.api.radar import typeform_pb2

from bob_emploi.data_analysis.radar import export


def _create_proto_timestamp(instant: datetime.datetime) -> timestamp_pb2.Timestamp:
    proto = timestamp_pb2.Timestamp()
    proto.FromDatetime(instant)
    return proto


class PrepareExportsTest(unittest.TestCase):
    """Test the prepare_domain_export function."""

    def test_prepare_domain_export(self) -> None:
        """Basic use of the prepare_domain_export function."""

        profile = typeform_pb2.HiddenFields(
            age='16',
            counselor_email='martin@milo.fr',
            counselor_id='123',
            dossier_id='456',
            school_level='ii',
            structure_id='502',
        )
        exports = list(export.prepare_domain_export([
            typeform_pb2.Photo(
                hidden=profile,
                submitted_at=_create_proto_timestamp(datetime.datetime(2021, 3, 1)),
                answers=[
                    typeform_pb2.ChoiceAnswer(
                        field=typeform_pb2.AnswerField(ref='job-people'),
                        choice=typeform_pb2.Choice(label='Niveau 1'),
                    ),
                    typeform_pb2.ChoiceAnswer(
                        field=typeform_pb2.AnswerField(ref='job-tools'),
                        choice=typeform_pb2.Choice(label='Niveau 2'),
                    ),
                    typeform_pb2.ChoiceAnswer(
                        field=typeform_pb2.AnswerField(ref='job-skills'),
                        choice=typeform_pb2.Choice(label='Niveau 4'),
                    ),
                ],
            ),
            typeform_pb2.Photo(
                hidden=profile,
                submitted_at=_create_proto_timestamp(datetime.datetime(2021, 7, 1)),
                answers=[
                    typeform_pb2.ChoiceAnswer(
                        field=typeform_pb2.AnswerField(ref='job-people'),
                        choice=typeform_pb2.Choice(label='Niveau 3'),
                    ),
                    typeform_pb2.ChoiceAnswer(
                        field=typeform_pb2.AnswerField(ref='job-tools'),
                        choice=typeform_pb2.Choice(label='Niveau 4'),
                    ),
                    typeform_pb2.ChoiceAnswer(
                        field=typeform_pb2.AnswerField(ref='job-skills'),
                        choice=typeform_pb2.Choice(label='Niveau 4'),
                    ),
                ],
            ),
        ]))

        groups = {
            key: list(values)
            for key, values in itertools.groupby(
                sorted(exports), lambda export: export.elasticsearch_index)
        }
        self.assertEqual(
            {'radar-achievements', 'radar-domains', 'radar-photos', 'radar-skills'},
            groups.keys())

        radar_photos = groups['radar-photos']
        self.assertEqual(2, len(radar_photos))
        radar_photo_0 = typing.cast(output_pb2.PhotoExport, radar_photos[0].proto)
        self.assertEqual(16, radar_photo_0.filters.age)
        self.assertEqual('123', radar_photo_0.filters.counselor_id)
        self.assertTrue(radar_photo_0.filters.dossier_id)
        self.assertNotEqual('456', radar_photo_0.filters.dossier_id)
        self.assertEqual(0, radar_photo_0.domains_count)
        self.assertEqual(0, radar_photo_0.autonomous_after_months)
        self.assertEqual(1, radar_photo_0.photo_index)

        radar_photo_1 = typing.cast(output_pb2.PhotoExport, radar_photos[1].proto)
        self.assertEqual(1, radar_photo_1.domains_count)
        self.assertEqual(1, radar_photo_1.new_domains_count)
        self.assertEqual(4, radar_photo_1.autonomous_after_months)
        self.assertEqual(2, radar_photo_1.photo_index)

        radar_domains = groups['radar-domains']
        self.assertEqual(7, len(radar_domains))
        self.assertIn('Emploi', {
            typing.cast(output_pb2.DomainExport, output.proto).domain
            for output in radar_domains
        })
        job_output = typing.cast(output_pb2.DomainExport, next(
            output.proto
            for output in radar_domains
            if typing.cast(output_pb2.DomainExport, output.proto).domain == 'Emploi'))
        self.assertEqual(7, job_output.start_autonomy_score)
        self.assertEqual(4, job_output.autonomy_score_delta)
        self.assertEqual(4, job_output.autonomous_after_months)
        self.assertEqual(4, job_output.mobilized_after_months)
        self.assertEqual(0, job_output.knowledgeable_after_months)
        self.assertEqual(0, job_output.interested_after_months)

        radar_skills = groups['radar-skills']
        self.assertEqual(21, len(radar_skills))
        self.assertIn('Emploi', {
            typing.cast(output_pb2.SkillExport, output.proto).domain
            for output in radar_skills
        })
        self.assertIn('Outils', {
            typing.cast(output_pb2.SkillExport, output.proto).skill
            for output in radar_skills
        })
        skill_output = typing.cast(output_pb2.SkillExport, next(
            output.proto
            for output in radar_skills
            if typing.cast(output_pb2.SkillExport, output.proto).domain == 'Emploi' and
            typing.cast(output_pb2.SkillExport, output.proto).skill == 'Outils'))
        self.assertEqual(2, skill_output.start_autonomy_score)
        self.assertEqual(2, skill_output.autonomy_score_delta)

        radar_achievements = groups['radar-achievements']
        self.assertEqual(2, len(radar_achievements), msg=radar_achievements)
        self.assertEqual({'Emploi'}, {
            typing.cast(output_pb2.DomainAchievement, output.proto).domain
            for output in radar_achievements
        })
        self.assertEqual({'3. Mobilisation', '4. Autonomie'}, {
            typing.cast(output_pb2.DomainAchievement, output.proto).achievement
            for output in radar_achievements
        })
        self.assertEqual([1, 1], [
            typing.cast(output_pb2.DomainAchievement, output.proto).score
            for output in radar_achievements
        ])


class ExportTest(unittest.TestCase):
    """Test the main function."""

    @mock.patch(export.__name__ + '.typeform.iterate_results')
    @mock.patch('elasticsearch.Elasticsearch')
    @mock.patch('elasticsearch.helpers.bulk')
    @mock.patch('boto3.Session')
    def test_main(
            self,
            mock_boto3_session: mock.MagicMock,
            mock_elasticsearch_bulk: mock.MagicMock,
            unused_mock_elasticsearch: mock.MagicMock,
            mock_iterate_results: mock.MagicMock) -> None:
        """Basic use of the main function."""

        profile = typeform_pb2.HiddenFields(
            age='16',
            counselor_email='martin@milo.fr',
            counselor_id='123',
            dossier_id='456',
            school_level='ii',
            structure_id='502',
        )
        mock_iterate_results.return_value = iter([
            typeform_pb2.Photo(
                hidden=profile,
                submitted_at=_create_proto_timestamp(datetime.datetime(2021, 3, 1)),
                answers=[
                    typeform_pb2.ChoiceAnswer(
                        field=typeform_pb2.AnswerField(ref='job-people'),
                        choice=typeform_pb2.Choice(label='Niveau 1'),
                    ),
                    typeform_pb2.ChoiceAnswer(
                        field=typeform_pb2.AnswerField(ref='job-tools'),
                        choice=typeform_pb2.Choice(label='Niveau 2'),
                    ),
                    typeform_pb2.ChoiceAnswer(
                        field=typeform_pb2.AnswerField(ref='job-skills'),
                        choice=typeform_pb2.Choice(label='Niveau 4'),
                    ),
                ],
            ),
            typeform_pb2.Photo(
                hidden=profile,
                submitted_at=_create_proto_timestamp(datetime.datetime(2021, 7, 1)),
                answers=[
                    typeform_pb2.ChoiceAnswer(
                        field=typeform_pb2.AnswerField(ref='job-people'),
                        choice=typeform_pb2.Choice(label='Niveau 3'),
                    ),
                    typeform_pb2.ChoiceAnswer(
                        field=typeform_pb2.AnswerField(ref='job-tools'),
                        choice=typeform_pb2.Choice(label='Niveau 4'),
                    ),
                    typeform_pb2.ChoiceAnswer(
                        field=typeform_pb2.AnswerField(ref='job-skills'),
                        choice=typeform_pb2.Choice(label='Niveau 4'),
                    ),
                ],
            ),
        ])

        mock_boto3_session().get_credentials().access_key = 'my-access-key'
        mock_boto3_session().get_credentials().secret_key = 'my-secret-key'
        mock_boto3_session().get_credentials().token = None
        mock_elasticsearch_bulk.return_value = 'Success!!'

        output = io.StringIO()
        export.main([], out=output)

        self.assertEqual('Success!!', output.getvalue())

        docs = list(mock_elasticsearch_bulk.call_args[0][1])
        self.assertEqual(
            {'radar-photos', 'radar-domains', 'radar-skills', 'radar-achievements'},
            {d.get('_index') for d in docs})

        self.assertEqual('502', docs[0].get('doc', {}).get('structureId'))
        self.assertEqual('50', docs[0].get('doc', {}).get('departementId'))
        self.assertEqual('ML GRANVILLE', docs[0].get('doc', {}).get('structureName'))


if __name__ == '__main__':
    unittest.main()
