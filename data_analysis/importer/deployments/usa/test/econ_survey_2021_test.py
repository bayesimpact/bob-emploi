"""Tests for the bob_emploi.data_analysis.importer.deployments.usa.eon_survey_2021 module."""

import base64
import json
import os
import unittest
from unittest import mock

import requests_mock
import mongomock

from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.api import user_profile_pb2
from bob_emploi.data_analysis.importer.deployments.usa import econ_survey_2021

_TESTDATA_FOLDER = os.path.join(os.path.dirname(__file__), 'testdata')


class ConvertAnswerToUseTest(unittest.TestCase):
    """Tests of the convert_answer_to_user function."""

    @mock.patch.dict(econ_survey_2021.STATE_MAP, {'New York': 'NY'})
    def test_basic_user(self) -> None:
        """Test a basic conversion."""

        # Pulled from real data in the survey.
        answer = {
            'id': '1',
            'age': '30',
            'gender': 'Male',
            'enrolled': 'No',
            'educ': "Bachelor's degree (for example: BA, BS, AB)",
            'familysituation': 'In a relationship, with kids',
            'state': 'New York',
            'lasttimejob': '6-12 months ago',
            'lasttimesearch': 'Within the last month',
            'hrs_search_lookonline': '2',
            'mins_search_lookonline': '0',
            'hrs_search_applyonline': '0',
            'mins_search_applyonline': '0',
            'hrs_search_editresume': '1',
            'mins_search_editresume': '20',
            'hrs_search_researchpath': '0',
            'mins_search_researchpath': '0',
            'hrs_search_plan': '0',
            'mins_search_plan': '0',
            'hrs_search_contactemployers': '0',
            'mins_search_contactemployers': '40',
            'hrs_search_contactfriends': '0',
            'mins_search_contactfriends': '0',
            'hrs_search_contactpublic': '0',
            'mins_search_contactpublic': '0',
            'hrs_search_contactprivate': '0',
            'mins_search_contactprivate': '0',
            'hrs_search_other': '0',
            'mins_search_other': '0',
            'impt_skillmatch': 'Very important',
            'impt_interestmatch': 'Very important',
            'impt_posimpact': 'Extremely important',
            'impt_salary': 'Slightly important',
            'impt_speed': 'Very important',
            'impt_covid': 'Slightly important',
            'challenge_motivation': 'Moderately challenging',
            'challenge_identifyjob': 'Moderately challenging',
            'challenge_startsearch': 'Very challenging',
            'challenge_knowsearch': 'Very challenging',
            'challenge_jobinfo': 'Very challenging',
            'challenge_training': 'Moderately challenging',
            'challenge_toughmkt': 'Very challenging',
            'challenge_salary': 'Extremely challenging',
            'challenge_speed': 'Not challenging',
            'challenge_life': 'Extremely challenging',
            'challenge_discrim': 'Moderately challenging',
            'specificjob': 'No',
            'specificjobtitle': '',
            'specificjobmeaning': '',
        }
        user = econ_survey_2021.convert_answer_to_user(answer)
        self.assertEqual(2021, user.registered_at.ToDatetime().year)
        self.assertEqual(user_profile_pb2.MASCULINE, user.profile.gender)
        self.assertEqual(user_profile_pb2.FAMILY_WITH_KIDS, user.profile.family_situation)
        project = user.projects[0]
        self.assertEqual('NY', project.city.region_id)
        self.assertFalse(project.HasField('target_job'))


@requests_mock.mock()
@mock.patch.dict(os.environ, {
    'ALGOLIA_API_KEY': 'fake-key',
    'ELASTICSEARCH_URL': 'https://myuser:mypass@elastic-test:9200',
})
@mongomock.patch()
class MainTest(unittest.TestCase):
    """Tests of the main function."""

    def test_main(self, mock_requests: 'requests_mock._RequestObjectProxy') -> None:
        """Typical run of the main script."""

        mock_requests.post(
            'https://k6aci9bkkt-dsn.algolia.net/1/indexes/jobs_en/query',
            json={'hits': []})
        mock_requests.post(
            'https://k6aci9bkkt-dsn.algolia.net/1/indexes/jobs_en/query',
            additional_matcher=lambda r: r.json().get('query') == 'Voice-Over Artist',
            json={'hits': [{
                'jobGroupId': '11-8888',
                'jobGroupName': 'Cinema Artists',
            }]})
        bob_requests = mock_requests.post(
            'https://us.hellobob.com/api/project/diagnose',
            # base64 encoding of a diagnostic proto {category_id: "custom-main-challenge"}
            # as long as the category_id field has tag #5.
            text='KhVjdXN0b20tbWFpbi1jaGFsbGVuZ2U=\n')
        mock_requests.head('https://elastic-test:9200/econ-survey-2021-answers')
        elastic_search_requests = mock_requests.post(
            'https://elastic-test:9200/_bulk',
            json={'items': []})

        econ_survey_2021.main([
            # An extract of the original file with only some matches.
            '--soc_titles_xlsx',
            os.path.join(_TESTDATA_FOLDER, 'usa/bayes_econ_survey_soc_occ_title.xlsx'),
            '--states_txt', os.path.join(_TESTDATA_FOLDER, 'usa/states.txt'),
            # An extract of the original file with only the 9 first answers.
            '--input_csv', os.path.join(_TESTDATA_FOLDER, 'bayes_survey.csv'),
            '--es_index', 'econ-survey-2021-answers',
        ])

        self.assertEqual(9, bob_requests.call_count)

        users: list[user_pb2.User] = []
        for bob_request in bob_requests.request_history:
            user = user_pb2.User()
            user.ParseFromString(base64.decodebytes(bob_request.text.encode('ascii')))
            users.append(user)

        # Job group from Algolia.
        self.assertEqual('11-8888', users[2].projects[0].target_job.job_group.rome_id)
        # Job group from Excel file.
        self.assertEqual('29-1141', users[3].projects[0].target_job.job_group.rome_id)
        # Job group from Excel file but with date-time error fixed.
        self.assertEqual('11-2011', users[6].projects[0].target_job.job_group.rome_id)

        self.assertEqual(1, elastic_search_requests.call_count)
        bulk_lines = elastic_search_requests.last_request.text.strip().split('\n')
        self.assertEqual(18, len(bulk_lines), msg=bulk_lines)
        self.assertEqual(
            {'update': {'_id': '1', '_index': 'econ-survey-2021-answers', '_type': '_doc'}},
            json.loads(bulk_lines[0]))
        first_doc = json.loads(bulk_lines[1])
        self.assertEqual(
            'custom-main-challenge',
            first_doc.get('doc', {}).get('project', {}).get('diagnostic', {}).get('categoryId'))
        self.assertIn('2021-12-01T', first_doc.get('doc', {}).get('registeredAt'))


if __name__ == '__main__':
    unittest.main()
