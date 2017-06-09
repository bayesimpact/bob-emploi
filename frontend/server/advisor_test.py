"""Unit tests for the bob_emploi.frontend.advisor module."""
import datetime
import unittest

import mock
import mongomock

from bob_emploi.frontend import advisor
from bob_emploi.frontend import companies
from bob_emploi.frontend import now
from bob_emploi.frontend.api import advisor_pb2
from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2


class MaybeAdviseTestCase(unittest.TestCase):
    """Unit tests for the maybe_advise function."""

    def setUp(self):
        super(MaybeAdviseTestCase, self).setUp()
        self.database = mongomock.MongoClient().test
        self.database.action_templates.insert_one({
            '_id': 'rec1CWahSiEtlwEHW',
            'goal': 'Reorientation !',
        })
        self.user = user_pb2.User(features_enabled=user_pb2.Features(advisor=user_pb2.ACTIVE))
        advisor.clear_cache()

    def test_no_advice_if_project_incomplete(self):
        """Test that the advice do not get populated when the project is marked as incomplete."""
        project = project_pb2.Project(is_incomplete=True)
        advisor.maybe_advise(self.user, project, self.database)

        self.assertEqual(len(project.advices), 0)

    def test_missing_module(self):
        """Test that the advisor does not crash when a module is missing."""
        project = project_pb2.Project(advices=[project_pb2.Advice(
            advice_id='does-not-exist',
            status=project_pb2.ADVICE_ACCEPTED)])
        project_before = str(project)
        advisor.maybe_advise(self.user, project, self.database)

        self.assertEqual(project_before, str(project))

    def test_find_all_pieces_of_advice(self):
        """Test that the advisor scores all advice modules."""
        project = project_pb2.Project()
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

        advisor.maybe_advise(self.user, project, self.database)

        self.assertEqual(['spontaneous-application'], [a.advice_id for a in project.advices])
        self.assertEqual(project_pb2.ADVICE_RECOMMENDED, project.advices[0].status)

    def test_recommend_advice_none(self):
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

    def test_incompatible_advice_modules(self):
        """Test that the advisor discard incompatible advice modules."""
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
            job_search_length_months=7,
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
                        'codeOgr': "5678",
                        'percentSuggested': 55,
                    },
                    {
                        'codeOgr': "1234",
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


class SelectAdviceForEmailTestCase(unittest.TestCase):
    """Unit tests for the select_advice_for_email function."""

    def setUp(self):
        super(SelectAdviceForEmailTestCase, self).setUp()
        self.database = mongomock.MongoClient().test
        self.database.advice_modules.insert_one({
            'adviceId': 'easy-advice',
            'isEasy': True,
        })
        advisor.clear_cache()

    def test_no_projects(self):
        """User has no projects."""
        self.assertFalse(advisor.select_advice_for_email(
            user_pb2.User(user_id=str(mongomock.ObjectId())), user_pb2.TUESDAY, self.database))

    def test_not_in_advisor(self):
        """User does not use the advisor yet."""
        user_not_in_advisor = user_pb2.User(
            user_id=str(mongomock.ObjectId()),
            projects=[project_pb2.Project()],
        )
        self.assertFalse(advisor.select_advice_for_email(
            user_not_in_advisor, user_pb2.TUESDAY, self.database))

    def test_one_advice_module_only(self):
        """Only one advice module was recommended."""
        user = user_pb2.User(
            user_id=str(mongomock.ObjectId()),
            features_enabled=user_pb2.Features(advisor=user_pb2.ACTIVE),
            projects=[project_pb2.Project(advices=[project_pb2.Advice(
                advice_id='only-advice')])],
        )
        advice = advisor.select_advice_for_email(user, user_pb2.TUESDAY, self.database)
        self.assertTrue(advice)
        self.assertEqual('only-advice', advice.advice_id)

    def test_priority_advice_on_monday(self):
        """Priority advice on Monday."""
        user = user_pb2.User(
            user_id=str(mongomock.ObjectId()),
            features_enabled=user_pb2.Features(advisor=user_pb2.ACTIVE),
            projects=[project_pb2.Project(advices=[
                project_pb2.Advice(
                    advice_id='priority-advice',
                    num_stars=3,
                    score=9,
                ),
                project_pb2.Advice(
                    advice_id='easy-advice',
                    num_stars=1,
                    score=2,
                ),
            ])],
        )
        advice = advisor.select_advice_for_email(user, user_pb2.MONDAY, self.database)
        self.assertTrue(advice)
        self.assertEqual('priority-advice', advice.advice_id)

    def test_easy_advice_on_friday(self):
        """Easy advice on Friday."""
        user = user_pb2.User(
            user_id=str(mongomock.ObjectId()),
            features_enabled=user_pb2.Features(advisor=user_pb2.ACTIVE),
            projects=[project_pb2.Project(advices=[
                project_pb2.Advice(
                    advice_id='priority-advice',
                    num_stars=3,
                    score=9,
                ),
                project_pb2.Advice(
                    advice_id='easy-advice',
                    num_stars=1,
                    score=2,
                ),
            ])],
        )
        advice = advisor.select_advice_for_email(user, user_pb2.FRIDAY, self.database)
        self.assertTrue(advice)
        self.assertEqual('easy-advice', advice.advice_id)

    def test_any_advice_in_the_week(self):
        """Any advice in the middle of the week."""
        user = user_pb2.User(
            user_id=str(mongomock.ObjectId()),
            features_enabled=user_pb2.Features(advisor=user_pb2.ACTIVE),
            projects=[project_pb2.Project(advices=[
                project_pb2.Advice(
                    advice_id='priority-advice',
                    num_stars=3,
                    score=8,
                ),
                project_pb2.Advice(
                    advice_id='easy-advice',
                    num_stars=1,
                    score=2,
                ),
            ])],
        )
        advice_given = set()

        for unused_index in range(101):
            advice = advisor.select_advice_for_email(user, user_pb2.WEDNESDAY, self.database)
            self.assertTrue(advice)
            self.assertIn(advice.advice_id, {'easy-advice', 'priority-advice'})
            advice_given.add(advice.advice_id)
            if len(advice_given) > 2:
                break

        # This could fail with a probability of .8^100 ~= 2e-10.
        self.assertEqual({'easy-advice', 'priority-advice'}, advice_given)

    @mock.patch(now.__name__ + '.get')
    def test_different_advice_during_the_week(self, mock_now):
        """Different advice during the week."""
        user_id = mongomock.ObjectId()
        user = user_pb2.User(
            user_id=str(user_id),
            features_enabled=user_pb2.Features(advisor=user_pb2.ACTIVE),
            projects=[project_pb2.Project(advices=[
                project_pb2.Advice(
                    advice_id='priority-advice',
                    num_stars=3,
                    score=8,
                ),
                project_pb2.Advice(
                    advice_id='other-advice',
                    num_stars=2,
                    score=9,
                ),
                project_pb2.Advice(
                    advice_id='easy-advice',
                    num_stars=1,
                    score=2,
                ),
            ])],
        )
        advice_given = set()

        mock_now.return_value = datetime.datetime(2017, 4, 3, 13, 00)
        advice = advisor.select_advice_for_email(user, user_pb2.MONDAY, self.database)
        advice_given.add(advice.advice_id)
        self.database.email_history.update_one(
            {'_id': user_id},
            {'$set': {'advice_modules.%s' % advice.advice_id: mock_now().isoformat() + 'Z'}},
            upsert=True,
        )

        mock_now.return_value = datetime.datetime(2017, 4, 5, 13, 00)
        advice = advisor.select_advice_for_email(user, user_pb2.WEDNESDAY, self.database)
        advice_given.add(advice.advice_id)
        self.database.email_history.update_one(
            {'_id': user_id},
            {'$set': {'advice_modules.%s' % advice.advice_id: mock_now().isoformat() + 'Z'}},
            upsert=True,
        )

        mock_now.return_value = datetime.datetime(2017, 4, 7, 13, 00)
        advice = advisor.select_advice_for_email(user, user_pb2.FRIDAY, self.database)
        advice_given.add(advice.advice_id)

        self.assertEqual(3, len(advice_given), msg=advice_given)


class SelectTipsForEmailTestCase(unittest.TestCase):
    """Unit tests for the select_tips_for_email function."""

    def setUp(self):
        super(SelectTipsForEmailTestCase, self).setUp()
        self.database = mongomock.MongoClient().test
        advisor.clear_cache()

    def test_no_tips(self):
        """No tips."""
        self.database.advice_modules.insert_one({
            'adviceId': 'has-no-tips',
        })
        tips = advisor.select_tips_for_email(
            user_pb2.User(user_id=str(mongomock.ObjectId())),
            project_pb2.Project(),
            advisor_pb2.AdviceModule(advice_id='has-no-tips'),
            self.database)
        self.assertFalse(tips)

    def test_three_tips(self):
        """Only three tips."""
        self.database.advice_modules.insert_one({
            'adviceId': 'has-3-tips',
            'tipTemplateIds': ['tip-a', 'tip-b', 'tip-c'],
        })
        self.database.tip_templates.insert_many([
            {
                '_id': 'tip-a',
                'actionTemplateId': 'tip-a',
                'emailTitle': 'First tip',
                'isReadyForEmail': True,
            },
            {
                '_id': 'tip-b',
                'actionTemplateId': 'tip-b',
                'emailTitle': 'Second tip',
                'isReadyForEmail': True,
            },
            {
                '_id': 'tip-c',
                'actionTemplateId': 'tip-c',
                'emailTitle': 'Third tip',
                'isReadyForEmail': True,
            },
        ])
        tips = advisor.select_tips_for_email(
            user_pb2.User(user_id=str(mongomock.ObjectId())),
            project_pb2.Project(),
            advisor_pb2.AdviceModule(advice_id='has-3-tips'),
            self.database)
        self.assertEqual(
            ['First tip', 'Second tip', 'Third tip'],
            sorted(t.title for t in tips))

    def test_favor_tips_never_given(self):
        """Favor tips that were never sent."""
        self.database.advice_modules.insert_one({
            'adviceId': 'my-advice',
            'tipTemplateIds': ['tip-a', 'tip-b'],
        })
        self.database.tip_templates.insert_many([
            {
                '_id': 'tip-a',
                'actionTemplateId': 'tip-a',
                'title': 'Tip already sent',
                'isReadyForEmail': True,
            },
            {
                '_id': 'tip-b',
                'actionTemplateId': 'tip-b',
                'title': 'Tip never sent',
                'isReadyForEmail': True,
            },
        ])
        user_id = mongomock.ObjectId()
        self.database.email_history.update_one(
            {'_id': user_id},
            {'$set': {'tips.tip-a': now.get().isoformat() + 'Z'}},
            upsert=True,
        )
        tips = advisor.select_tips_for_email(
            user_pb2.User(user_id=str(user_id)),
            project_pb2.Project(),
            advisor_pb2.AdviceModule(advice_id='my-advice'),
            self.database,
            num_tips=1)
        self.assertEqual(['Tip never sent'], sorted(t.title for t in tips))


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
