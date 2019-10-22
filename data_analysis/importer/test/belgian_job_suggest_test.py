"""Tests for the belgian_job_suggest module."""

import os
from os import path
import unittest

from bob_emploi.data_analysis.importer import belgian_job_suggest


class BelgianJobSuggestTestCase(unittest.TestCase):
    """Unit tests for each dataset."""

    is_real_data = os.getenv('TEST_REAL_DATA')
    test_data_folder = path.join(path.dirname(__file__), 'testdata')
    data_folder = 'data' if is_real_data else test_data_folder
    maxDiff = None

    def test_json_to_dicts(self) -> None:
        """Basic usage."""

        suggestions = belgian_job_suggest.json_to_dicts(
            self.data_folder, path.join(self.data_folder, 'competent_jobs.json'))
        self.assertEqual(13110 if self.is_real_data else 60, len(suggestions))

        # Point-check.
        traffic_expert = next(sugg for sugg in suggestions if sugg.get('objectID') == '51907-129')
        self.assertEqual({
            'jobGroupNameFr': "Recherche en sciences de l'homme et de la société",
            'objectID': '51907-129',
            'romeId': 'K2401',
            'extendedRomeId': 'K240101',
            'jobNameFr': 'Expert de la circulation',
            'jobNameMasculineFr': 'Expert de la circulation',
            'jobNameFeminineFr': 'Expert de la circulation',
            'jobGroupNameNl': 'Onderzoek humane wetenschappen',
            'jobNameNl': 'Verkeersdeskundige',
            'jobNameMasculineNl': 'Verkeersdeskundige',
            'jobNameFeminineNl': 'Verkeersdeskundige',
        }, traffic_expert)

        # Other point-check, with OGR code.
        economy_researcher = next(sugg for sugg in suggestions if sugg.get('codeOgr') == '12607')
        self.assertEqual({
            'jobGroupNameFr': "Recherche en sciences de l'homme et de la société",
            'objectID': '3206-11',
            'romeId': 'K2401',
            'extendedRomeId': 'K240101',
            'jobNameFr': 'Chercheur / Chercheuse en économie',
            'jobNameMasculineFr': 'Chercheur en économie',
            'jobNameFeminineFr': 'Chercheuse en économie',
            'jobGroupNameNl': 'Onderzoek humane wetenschappen',
            'jobNameNl': 'Onderzoeker economie',
            'jobNameMasculineNl': 'Onderzoeker economie',
            'jobNameFeminineNl': 'Onderzoeker economie',
            'codeOgr': '12607',
        }, economy_researcher)


if __name__ == '__main__':
    unittest.main()
