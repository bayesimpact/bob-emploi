"""Unit tests for the bob_emploi.importer.volunteering_missions module."""

import unittest
from unittest import mock

import requests

from bob_emploi.frontend.api import association_pb2
from bob_emploi.data_analysis.importer import volunteering_missions
from bob_emploi.data_analysis.lib import mongo


class VolunteeringMissionImporterTestCase(unittest.TestCase):
    """Unit tests for the Volunteering Missions importer."""

    @mock.patch(volunteering_missions.__name__ + '.check_coverage')
    @mock.patch(requests.__name__ + '.get')
    def test_get_missions_dict(
            self, mock_get: mock.MagicMock, mock_check: mock.MagicMock) -> None:
        """Basic usage."""

        mock_get().text = (
            '''
<jobs>
  <job>
    <JobTitle>Bénévolat : Cool Mission</JobTitle>
    <JobId>12345</JobId>
    <JobDescription>Mission proposée par Bayes Impact&lt;br /&gt;'''
            '''&lt;b&gt;Informations complémentaires&lt;/b&gt;Nothing</JobDescription>
    <applyURL>https://www.example.com/yes?param=true</applyURL>
    <PostalCode>69006</PostalCode>
  </job>
  <job>
    <JobTitle>Bénévolat : Cool Mission #2</JobTitle>
    <JobId>4200</JobId>
    <JobDescription>Mission proposée par Bayes Impact&lt;br /&gt;'''
            '''&lt;b&gt;Informations complémentaires&lt;/b&gt;Nothing</JobDescription>
    <applyURL>https://www.example.com/no</applyURL>
    <PostalCode>75002</PostalCode>
  </job>
</jobs>
''')
        # Coverage check is skipped for this test.
        mock_check.return_value = True
        missions = dict(mongo.collection_to_proto_mapping(
            volunteering_missions.get_missions_dicts(),
            association_pb2.VolunteeringMissions))

        self.assertEqual({'69', '75'}, missions.keys())
        self.assertEqual(['Cool Mission #2'], [m.title for m in missions['75'].missions])
        self.assertEqual(
            'https://www.example.com/no?utm_source=bob-emploi',
            missions['75'].missions[0].link)
        self.assertEqual(
            'https://www.example.com/yes?param=true&utm_source=bob-emploi',
            missions['69'].missions[0].link)

    @mock.patch(volunteering_missions.__name__ + '.check_coverage')
    @mock.patch(requests.__name__ + '.get')
    def test_country_wide(
            self, mock_get: mock.MagicMock, mock_check: mock.MagicMock) -> None:
        """Mission available countrywide."""

        mock_get().text = (
            '''
<jobs>
  <job>
    <JobTitle>Bénévolat : Cool Mission</JobTitle>
    <JobId>12345</JobId>
    <JobDescription>Mission proposée par Bayes Impact&lt;br /&gt;'''
            '''&lt;b&gt;Informations complémentaires&lt;/b&gt;Nothing</JobDescription>
    <applyURL>https://www.example.com/yes</applyURL>
    <PostalCode>13001</PostalCode>
  </job>
  <job>
    <JobTitle>Bénévolat : Cool Mission</JobTitle>
    <JobId>12345</JobId>
    <JobDescription>Mission proposée par Bayes Impact&lt;br /&gt;'''
            '''&lt;b&gt;Informations complémentaires&lt;/b&gt;Nothing</JobDescription>
    <applyURL>https://www.example.com/yes</applyURL>
    <PostalCode>31000</PostalCode>
  </job>
  <job>
    <JobTitle>Bénévolat : Cool Mission</JobTitle>
    <JobId>12345</JobId>
    <JobDescription>Mission proposée par Bayes Impact&lt;br /&gt;'''
            '''&lt;b&gt;Informations complémentaires&lt;/b&gt;Nothing</JobDescription>
    <applyURL>https://www.example.com/yes</applyURL>
    <PostalCode>33000</PostalCode>
  </job>
  <job>
    <JobTitle>Bénévolat : Cool Mission</JobTitle>
    <JobId>12345</JobId>
    <JobDescription>Mission proposée par Bayes Impact&lt;br /&gt;'''
            '''&lt;b&gt;Informations complémentaires&lt;/b&gt;Nothing</JobDescription>
    <applyURL>https://www.example.com/yes</applyURL>
    <PostalCode>35000</PostalCode>
  </job>
  <job>
    <JobTitle>Bénévolat : Cool Mission</JobTitle>
    <JobId>12345</JobId>
    <JobDescription>Mission proposée par Bayes Impact&lt;br /&gt;'''
            '''&lt;b&gt;Informations complémentaires&lt;/b&gt;Nothing</JobDescription>
    <applyURL>https://www.example.com/yes</applyURL>
    <PostalCode>59000</PostalCode>
  </job>
  <job>
    <JobTitle>Bénévolat : Cool Mission</JobTitle>
    <JobId>12345</JobId>
    <JobDescription>Mission proposée par Bayes Impact&lt;br /&gt;'''
            '''&lt;b&gt;Informations complémentaires&lt;/b&gt;Nothing</JobDescription>
    <applyURL>https://www.example.com/yes</applyURL>
    <PostalCode>69001</PostalCode>
  </job>
  <job>
    <JobTitle>Bénévolat : Cool Mission</JobTitle>
    <JobId>12345</JobId>
    <JobDescription>Mission proposée par Bayes Impact&lt;br /&gt;'''
            '''&lt;b&gt;Informations complémentaires&lt;/b&gt;Nothing</JobDescription>
    <applyURL>https://www.example.com/yes</applyURL>
    <PostalCode>06000</PostalCode>
  </job>
  <job>
    <JobTitle>Bénévolat : Cool Mission</JobTitle>
    <JobId>12345</JobId>
    <JobDescription>Mission proposée par Bayes Impact&lt;br /&gt;'''
            '''&lt;b&gt;Informations complémentaires&lt;/b&gt;Nothing</JobDescription>
    <applyURL>https://www.example.com/yes</applyURL>
    <PostalCode>34000</PostalCode>
  </job>
  <job>
    <JobTitle>Bénévolat : Cool Mission</JobTitle>
    <JobId>12345</JobId>
    <JobDescription>Mission proposée par Bayes Impact&lt;br /&gt;'''
            '''&lt;b&gt;Informations complémentaires&lt;/b&gt;Nothing</JobDescription>
    <applyURL>https://www.example.com/yes</applyURL>
    <PostalCode>44000</PostalCode>
  </job>
  <job>
    <JobTitle>Bénévolat : Cool Mission</JobTitle>
    <JobId>12345</JobId>
    <JobDescription>Mission proposée par Bayes Impact&lt;br /&gt;'''
            '''&lt;b&gt;Informations complémentaires&lt;/b&gt;Nothing</JobDescription>
    <applyURL>https://www.example.com/yes</applyURL>
    <PostalCode>67000</PostalCode>
  </job>
  <job>
    <JobTitle>Bénévolat : Cool Mission</JobTitle>
    <JobId>12345</JobId>
    <JobDescription>Mission proposée par Bayes Impact&lt;br /&gt;'''
            '''&lt;b&gt;Informations complémentaires&lt;/b&gt;Nothing</JobDescription>
    <applyURL>https://www.example.com/yes</applyURL>
    <PostalCode>75001</PostalCode>
  </job>
</jobs>
''')
        # Coverage check is skipped for this test.
        mock_check.return_value = True
        missions = dict(mongo.collection_to_proto_mapping(
            volunteering_missions.get_missions_dicts(),
            association_pb2.VolunteeringMissions))

        self.assertEqual({''}, missions.keys())
        self.assertEqual(['Cool Mission'], [m.title for m in missions[''].missions])

    @mock.patch(requests.__name__ + '.get')
    def test_low_coverage_missions(self, mock_get: mock.MagicMock) -> None:
        """Check that an error is raised when mission have a low coverage."""

        mock_get().text = (
            '''
<jobs>
  <job>
    <JobTitle>Bénévolat : Cool Mission</JobTitle>
    <JobId>12345</JobId>
    <JobDescription>Mission proposée par Bayes Impact&lt;br /&gt;'''
            '''&lt;b&gt;Informations complémentaires&lt;/b&gt;Nothing</JobDescription>
    <applyURL>https://www.example.com/yes?param=true</applyURL>
    <PostalCode>69006</PostalCode>
  </job>
  <job>
    <JobTitle>Bénévolat : Cool Mission #2</JobTitle>
    <JobId>4200</JobId>
    <JobDescription>Mission proposée par Bayes Impact&lt;br /&gt;'''
            '''&lt;b&gt;Informations complémentaires&lt;/b&gt;Nothing</JobDescription>
    <applyURL>https://www.example.com/no</applyURL>
    <PostalCode>75002</PostalCode>
  </job>
</jobs>
''')
        with self.assertRaises(ValueError):
            volunteering_missions.get_missions_dicts()


if __name__ == '__main__':
    unittest.main()
