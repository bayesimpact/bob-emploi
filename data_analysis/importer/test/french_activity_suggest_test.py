"""Tests for the bob_emploi.importer.french_activity_suggest module."""

from os import path
import unittest

from bob_emploi.data_analysis.importer import french_activity_suggest


class PrepareActivitiesTestCase(unittest.TestCase):
    """Integration tests for the prepare_activities function."""

    stats_csv = path.join(path.dirname(__file__), 'testdata/dpae-count.csv')
    testdata_folder = path.join(path.dirname(__file__), 'testdata')

    def test_basic_usage(self):
        """Basic Usage."""

        activities = french_activity_suggest.prepare_activities(self.testdata_folder)
        self.assertEqual(732, len(activities))
        self.assertEqual(
            [
                {
                    'objectID': '0111Z',
                    'naf': '0111Z',
                    'name':
                    "Culture de céréales (à l'exception du riz), de "
                    'légumineuses et de graines oléagineuses',
                    'hiring': 0,
                },
                {
                    'objectID': '0112Z',
                    'naf': '0112Z',
                    'name': 'Culture du riz',
                    'hiring': 0,
                },
            ],
            activities[:2])

    def test_with_stats(self):
        """Give a file containing stats as well."""

        activities = french_activity_suggest.prepare_activities(
            self.testdata_folder, stats_filename=self.stats_csv)
        self.assertEqual(
            [
                {
                    'objectID': '0111Z',
                    'naf': '0111Z',
                    'name':
                    "Culture de céréales (à l'exception du riz), de "
                    'légumineuses et de graines oléagineuses',
                    'hiring': 180,
                },
                {
                    'objectID': '0112Z',
                    'naf': '0112Z',
                    'name': 'Culture du riz',
                    'hiring': 20,
                },
            ],
            activities[:2])


if __name__ == '__main__':
    unittest.main()
