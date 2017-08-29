"""Unit tests for the bob_emploi.frontend.advisor module."""
import unittest

import mock
import mongomock

from bob_emploi.frontend import advisor
from bob_emploi.frontend import companies
from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2


class _BaseTestCase(unittest.TestCase):

    def setUp(self):
        super(_BaseTestCase, self).setUp()
        self.database = mongomock.MongoClient().test
        self.database.action_templates.insert_one({
            '_id': 'rec1CWahSiEtlwEHW',
            'goal': 'Reorientation !',
        })
        self.user = user_pb2.User(
            features_enabled=user_pb2.Features(advisor=user_pb2.ACTIVE),
            profile=user_pb2.UserProfile(name='Margaux', gender=user_pb2.FEMININE))
        advisor.clear_cache()


@mock.patch(advisor.mail.__name__ + '.send_template')
class MaybeAdviseTestCase(_BaseTestCase):
    """Unit tests for the maybe_advise function."""

    def test_no_advice_if_project_incomplete(self, mock_send_template):
        """Test that the advice do not get populated when the project is marked as incomplete."""
        project = project_pb2.Project(is_incomplete=True)
        advisor.maybe_advise(self.user, project, self.database)

        self.assertEqual(len(project.advices), 0)

        mock_send_template.assert_not_called()

    def test_missing_module(self, mock_send_template):
        """Test that the advisor does not crash when a module is missing."""
        project = project_pb2.Project(advices=[project_pb2.Advice(
            advice_id='does-not-exist',
            status=project_pb2.ADVICE_ACCEPTED)])
        project_before = str(project)
        advisor.maybe_advise(self.user, project, self.database)

        self.assertEqual(project_before, str(project))

        mock_send_template.assert_not_called()

    def test_find_all_pieces_of_advice(self, mock_send_template):
        """Test that the advisor scores all advice modules."""
        mock_send_template().status_code = 200
        mock_send_template.reset_mock()
        project = project_pb2.Project(
            project_id='1234',
            target_job=job_pb2.Job(
                name='Steward/ Hôtesse',
                feminine_name='Hôtesse',
                masculine_name='Steward',
            ),
        )
        self.database.advice_modules.insert_many([
            {
                'adviceId': 'spontaneous-application',
                'triggerScoringModel': 'constant(2)',
                'isReadyForProd': True,
            },
            {
                'adviceId': 'other-work-env',
                'triggerScoringModel': 'constant(0)',
                'isReadyForProd': True,
            },
        ])

        advisor.maybe_advise(self.user, project, self.database, 'http://base.example.com')

        self.assertEqual(['spontaneous-application'], [a.advice_id for a in project.advices])
        self.assertEqual(project_pb2.ADVICE_RECOMMENDED, project.advices[0].status)

        mock_send_template.assert_called_once()
        data = mock_send_template.call_args[0][2]
        self.assertEqual(
            ['advices', 'baseUrl', 'firstName', 'ofProjectTitle', 'projectId'],
            sorted(data.keys()))
        self.assertEqual('http://base.example.com', data['baseUrl'])
        self.assertEqual('Margaux', data['firstName'])
        self.assertEqual('d\'hôtesse', data['ofProjectTitle'])
        self.assertEqual('1234', data['projectId'])

    def test_recommend_advice_none(self, mock_send_template):
        """Test that the advisor does not recommend anyting if all modules score 0."""
        project = project_pb2.Project()
        self.database.advice_modules.insert_many([
            {
                'adviceId': 'spontaneous-application',
                'triggerScoringModel': 'constant(0)',
                'isReadyForProd': True,
            },
            {
                'adviceId': 'other-work-env',
                'triggerScoringModel': 'constant(0)',
                'isReadyForProd': True,
            },
        ])

        advisor.maybe_advise(self.user, project, self.database)

        self.assertFalse(project.advices)

        mock_send_template.assert_not_called()

    def test_incompatible_advice_modules(self, mock_send_template):
        """Test that the advisor discard incompatible advice modules."""
        mock_send_template().status_code = 200
        mock_send_template.reset_mock()
        project = project_pb2.Project()
        self.database.advice_modules.insert_many([
            {
                'adviceId': 'other-work-env',
                'airtableId': 'abc',
                'triggerScoringModel': 'constant(2)',
                'isReadyForProd': True,
                'incompatibleAdviceIds': ['def'],
            },
            {
                'adviceId': 'spontaneous-application',
                'airtableId': 'def',
                'triggerScoringModel': 'constant(3)',
                'isReadyForProd': True,
                'incompatibleAdviceIds': ['abc'],
            },
            {
                'adviceId': 'final-one',
                'airtableId': 'ghi',
                'triggerScoringModel': 'constant(1)',
                'isReadyForProd': True,
            },
        ])

        advisor.maybe_advise(self.user, project, self.database)

        self.assertEqual(
            ['spontaneous-application', 'final-one'],
            [a.advice_id for a in project.advices])
        mock_send_template.assert_called_once()


class ExtraDataTestCase(_BaseTestCase):
    """Unit tests for maybe_advise to compute extra data for advice modules."""

    def setUp(self):
        super(ExtraDataTestCase, self).setUp()
        self.mail_patcher = mock.patch(advisor.mail.__name__ + '.send_template')
        mock_send_template = self.mail_patcher.start()
        mock_send_template().status_code = 200

    def tearDown(self):
        self.mail_patcher.stop()
        super(ExtraDataTestCase, self).tearDown()

    def test_advice_other_work_env_extra_data(self):
        """Test that the advisor computes extra data for the work environment advice."""
        project = project_pb2.Project(
            target_job=job_pb2.Job(job_group=job_pb2.JobGroup(rome_id='A1234')),
        )
        self.user.features_enabled.alpha = True
        self.database.job_group_info.insert_one({
            '_id': 'A1234',
            'workEnvironmentKeywords': {
                'structures': ['A', 'B'],
                'sectors': ['sector Toise', 'sector Gal'],
            },
        })
        self.database.advice_modules.insert_one({
            'adviceId': 'other-work-env',
            'triggerScoringModel': 'advice-other-work-env',
            'extraDataFieldName': 'other_work_env_advice_data',
            'isReadyForProd': True,
        })

        advisor.maybe_advise(self.user, project, self.database)

        advice = next(a for a in project.advices if a.advice_id == 'other-work-env')
        self.assertEqual(project_pb2.ADVICE_RECOMMENDED, advice.status)
        self.assertEqual(
            ['A', 'B'], advice.other_work_env_advice_data.work_environment_keywords.structures)
        self.assertEqual(
            ['sector Toise', 'sector Gal'],
            advice.other_work_env_advice_data.work_environment_keywords.sectors)

    def test_advice_improve_success_rate_extra_data(self):
        """Test that the advisor computes extra data for the "Improve Success Rate" advice."""
        project = project_pb2.Project(
            target_job=job_pb2.Job(job_group=job_pb2.JobGroup(rome_id='A1234')),
            mobility=geo_pb2.Location(city=geo_pb2.FrenchCity(departement_id='14')),
            job_search_length_months=6,
            weekly_applications_estimate=project_pb2.A_LOT,
            total_interview_count=1,
        )
        self.database.local_diagnosis.insert_one({
            '_id': '14:A1234',
            'imt': {
                'yearlyAvgOffersDenominator': 10,
                'yearlyAvgOffersPer10Candidates': 2,
            },
        })
        self.database.job_group_info.insert_one({
            '_id': 'A1234',
            'requirements': {
                'skills': [{'name': 'Humour'}, {'name': 'Empathie'}],
                'skillsShortText': '**Humour** et **empathie**',
            },
        })
        self.database.advice_modules.insert_one({
            'adviceId': 'improve-success',
            'triggerScoringModel': 'advice-improve-resume',
            'extraDataFieldName': 'improve_success_rate_data',
            'isReadyForProd': True,
        })
        advisor.clear_cache()

        advisor.maybe_advise(self.user, project, self.database)

        advice = next(a for a in project.advices if a.advice_id == 'improve-success')
        self.assertEqual(project_pb2.ADVICE_RECOMMENDED, advice.status)
        self.assertGreater(advice.improve_success_rate_data.num_interviews_increase, 50)
        self.assertFalse(advice.improve_success_rate_data.requirements.skills)
        self.assertEqual(
            '**Humour** et **empathie**',
            advice.improve_success_rate_data.requirements.skills_short_text)

    def test_advice_job_boards_extra_data(self):
        """Test that the advisor computes extra data for the "Find a Job Board" advice."""
        project = project_pb2.Project(
            target_job=job_pb2.Job(job_group=job_pb2.JobGroup(rome_id='A1234')),
            mobility=geo_pb2.Location(city=geo_pb2.FrenchCity(departement_id='14')),
            job_search_length_months=7,
            weekly_applications_estimate=project_pb2.A_LOT,
            total_interview_count=1,
        )
        self.database.jobboards.insert_one({'title': 'Indeed', 'filters': ['for-departement(14)']})
        self.database.advice_modules.insert_one({
            'adviceId': 'job-boards',
            'triggerScoringModel': 'advice-job-boards',
            'extraDataFieldName': 'job_boards_data',
            'isReadyForProd': True,
        })
        advisor.clear_cache()

        advisor.maybe_advise(self.user, project, self.database)

        advice = next(a for a in project.advices if a.advice_id == 'job-boards')
        self.assertEqual(project_pb2.ADVICE_RECOMMENDED, advice.status)
        self.assertEqual('Indeed', advice.job_boards_data.job_board_title)
        self.assertFalse(advice.job_boards_data.is_specific_to_job_group)
        self.assertTrue(advice.job_boards_data.is_specific_to_region)

    @mock.patch(companies.__name__ + '.get_lbb_companies')
    def test_advice_spontaneous_application_extra_data(self, mock_get_lbb_companies):
        """Test that the advisor computes extra data for the "Spontaneous Application" advice."""
        project = project_pb2.Project(
            target_job=job_pb2.Job(job_group=job_pb2.JobGroup(rome_id='A1234')),
            mobility=geo_pb2.Location(city=geo_pb2.FrenchCity(departement_id='14')),
            job_search_length_months=7,
            weekly_applications_estimate=project_pb2.A_LOT,
            total_interview_count=1,
        )
        self.database.local_diagnosis.insert_one({
            '_id': '14:A1234',
            'imt': {'applicationModes': {'Foo': {'first': 'SPONTANEOUS_APPLICATION'}}},
        })
        self.database.advice_modules.insert_one({
            'adviceId': 'my-advice',
            'triggerScoringModel': 'chantier-spontaneous-application',
            'extraDataFieldName': 'spontaneous_application_data',
            'isReadyForProd': True,
        })
        mock_get_lbb_companies.return_value = iter([
            {'name': 'EX NIHILO'},
            {'name': 'M.F.P MULTIMEDIA FRANCE PRODUCTIONS'},
        ])
        advisor.clear_cache()

        advisor.maybe_advise(self.user, project, self.database)

        advice = next(a for a in project.advices if a.advice_id == 'my-advice')
        self.assertEqual(project_pb2.ADVICE_RECOMMENDED, advice.status)
        self.assertEqual(
            ['EX NIHILO', 'M.F.P MULTIMEDIA FRANCE PRODUCTIONS'],
            [c.name for c in advice.spontaneous_application_data.companies])

    def test_advice_better_job_in_group_extra_data(self):
        """Test that the advisor computes extra data for the "Better Job in Group" advice."""
        project = project_pb2.Project(
            target_job=job_pb2.Job(code_ogr='1234', job_group=job_pb2.JobGroup(rome_id='A1234')),
            mobility=geo_pb2.Location(city=geo_pb2.FrenchCity(departement_id='14')),
            job_search_length_months=7,
            weekly_applications_estimate=project_pb2.A_LOT,
            total_interview_count=1,
        )
        self.database.job_group_info.insert_one({
            '_id': 'A1234',
            'jobs': [
                {'codeOgr': '1234', 'name': 'Pilote'},
                {'codeOgr': '5678', 'name': 'Pompier'},
                {'codeOgr': '9012', 'name': 'Facteur'},
            ],
            'requirements': {
                'specificJobs': [
                    {
                        'codeOgr': '5678',
                        'percentSuggested': 55,
                    },
                    {
                        'codeOgr': '1234',
                        'percentSuggested': 45,
                    },
                ],
            },
        })
        self.database.advice_modules.insert_one({
            'adviceId': 'my-advice',
            'triggerScoringModel': 'advice-better-job-in-group',
            'extraDataFieldName': 'better_job_in_group_data',
            'isReadyForProd': True,
        })
        advisor.clear_cache()

        advisor.maybe_advise(self.user, project, self.database)

        advice = next(a for a in project.advices if a.advice_id == 'my-advice')
        self.assertEqual(project_pb2.ADVICE_RECOMMENDED, advice.status)
        self.assertEqual('Pompier', advice.better_job_in_group_data.better_job.name)
        self.assertEqual(1, advice.better_job_in_group_data.num_better_jobs)

    def test_advice_association_help_extra_data(self):
        """Test that the advisor computes extra data for the "Find an association" advice."""
        project = project_pb2.Project(
            target_job=job_pb2.Job(code_ogr='1234', job_group=job_pb2.JobGroup(rome_id='A1234')),
            mobility=geo_pb2.Location(city=geo_pb2.FrenchCity(departement_id='14')),
            job_search_length_months=7,
            weekly_applications_estimate=project_pb2.A_LOT,
            total_interview_count=1,
        )
        self.database.associations.insert_many([
            {'name': 'Pôle emploi'},
            {'name': 'SNC', 'filters': ['for-departement(14,15,16)']},
            {'name': 'Ressort', 'filters': ['for-departement(69)']},
        ])
        self.database.advice_modules.insert_one({
            'adviceId': 'my-advice',
            'triggerScoringModel': 'advice-association-help',
            'extraDataFieldName': 'associations_data',
            'isReadyForProd': True,
        })
        advisor.clear_cache()

        advisor.maybe_advise(self.user, project, self.database)

        advice = next(a for a in project.advices if a.advice_id == 'my-advice')
        self.assertEqual(project_pb2.ADVICE_RECOMMENDED, advice.status)
        self.assertEqual('SNC', advice.associations_data.association_name)

    def test_advice_volunteer_extra_data(self):
        """Test that the advisor computes extra data for the "Volunteer" advice."""
        project = project_pb2.Project(
            target_job=job_pb2.Job(code_ogr='1234', job_group=job_pb2.JobGroup(rome_id='A1234')),
            mobility=geo_pb2.Location(city=geo_pb2.FrenchCity(departement_id='75')),
            job_search_length_months=7,
            weekly_applications_estimate=project_pb2.A_LOT,
            total_interview_count=1,
        )
        self.database.volunteering_missions.insert_one({
            '_id': '75',
            'missions': [
                {'associationName': 'BackUp Rural'},
                {'associationName': 'Construisons Ensemble Comment Faire'},
            ],
        })
        self.database.advice_modules.insert_one({
            'adviceId': 'my-advice',
            'triggerScoringModel': 'advice-volunteer',
            'extraDataFieldName': 'volunteer_data',
            'isReadyForProd': True,
        })
        advisor.clear_cache()

        advisor.maybe_advise(self.user, project, self.database)

        advice = next(a for a in project.advices if a.advice_id == 'my-advice')
        self.assertEqual(project_pb2.ADVICE_RECOMMENDED, advice.status)
        self.assertEqual(
            ['BackUp Rural', 'Construisons Ensemble Comment Faire'],
            sorted(advice.volunteer_data.association_names))

    def test_advice_events_extra_data(self):
        """Test that the advisor computes extra data for the "Events" advice."""
        project = project_pb2.Project(
            target_job=job_pb2.Job(code_ogr='1234', job_group=job_pb2.JobGroup(rome_id='A1234')),
            mobility=geo_pb2.Location(city=geo_pb2.FrenchCity(departement_id='75')),
            job_search_length_months=7,
            weekly_applications_estimate=project_pb2.A_LOT,
            total_interview_count=1,
        )
        self.database.advice_modules.insert_one({
            'adviceId': 'my-advice',
            'triggerScoringModel': 'advice-event',
            'extraDataFieldName': 'events_data',
            'isReadyForProd': True,
        })
        self.database.events.insert_many([
            {
                'title': 'AP HEROS CANDIDATS MADIRCOM - BORDEAUX',
                'link': 'https://www.workuper.com/events/ap-heros-candidats-madircom-bordeaux',
                'organiser': 'MADIRCOM',
                'startDate': '2017-08-29',
            },
            {
                'title': 'Le Salon du Travail et de la Mobilité Professionnelle',
                'link': 'https://www.workuper.com/events/le-salon-du-travail-et-de-la-mobilite-'
                        'professionnelle',
                'organiser': 'Altice Media Events',
                'startDate': '2018-01-19',
            },
        ])
        advisor.clear_cache()
        self.user.features_enabled.alpha = True

        advisor.maybe_advise(self.user, project, self.database)

        advice = next(a for a in project.advices if a.advice_id == 'my-advice')
        self.assertEqual(project_pb2.ADVICE_RECOMMENDED, advice.status)
        self.assertEqual('AP HEROS CANDIDATS MADIRCOM - BORDEAUX', advice.events_data.event_name)


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
