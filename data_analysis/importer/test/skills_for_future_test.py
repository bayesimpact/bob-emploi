"""Unit tests for the skills_for_future importer module."""

import unittest
from unittest import mock

import airtablemock

from bob_emploi.data_analysis.importer import skills_for_future
from bob_emploi.data_analysis.lib import mongo
from bob_emploi.frontend.api import skill_pb2


@mock.patch(skills_for_future.__name__ + '._AIRTABLE_API_KEY', new='apikey42')
class TestCase(airtablemock.TestCase):
    """Test the importer for skill for future."""

    def test_get_skills_per_rome_prefix(self) -> None:
        """Test the importer for skill for future."""

        base = airtablemock.Airtable('the-base', 'apikey42')
        base.create('the-table', {
            'name': 'Orientation client',
            'description': 'Chercher activement des idées pour aider les gens',
            'TIME_TO_MARKET': 55,
            'BREADTH_OF_JOBS': 82,
            'JOB_SATISFACTION': 58,
            'BETTER_INCOME': 33,
            'NO_AUTOMATISATION': 36,
            'value_score': 3.93,
            'rome_prefixes': 'J12, B11, B15',
        })
        base.create('the-table', {
            'name': 'Enseignement',
            'description': "Partager ses compétence et les enseigner à d'autres",
            'TIME_TO_MARKET': 70,
            'BREADTH_OF_JOBS': 67,
            'JOB_SATISFACTION': 79,
            'BETTER_INCOME': 54,
            'NO_AUTOMATISATION': 21,
            'value_score': 5.49,
            'rome_prefixes': 'B11, B15, K21',
        })

        skills_per_rome_pefix = dict(mongo.collection_to_proto_mapping(
            skills_for_future.get_skills_per_rome_prefix('the-base', 'the-table'),
            skill_pb2.JobSkills))

        self.assertEqual({'B11', 'B15', 'K21', 'J12'}, skills_per_rome_pefix.keys())

        # Point checks
        self.assertEqual(
            ['Enseignement', 'Orientation client'],
            [skill.name for skill in skills_per_rome_pefix['B11'].skills])
        self.assertEqual(
            [
                skill_pb2.JOB_SATISFACTION,
                skill_pb2.TIME_TO_MARKET,
            ],
            skills_per_rome_pefix['B11'].skills[0].assets)

    def test_too_many_skills(self) -> None:
        """Make sure we do not get too many skills per rome prefix."""

        base = airtablemock.Airtable('the-base', 'apikey42')
        for i in range(25):
            base.create('the-table', {
                'name': f'Skill {i}',
                'description': 'Chercher activement des idées pour aider les gens',
                'TIME_TO_MARKET': 55,
                'BREADTH_OF_JOBS': 82,
                'JOB_SATISFACTION': 58,
                'BETTER_INCOME': 33,
                'NO_AUTOMATISATION': 36,
                'value_score': i + 0.93,
                'rome_prefixes': 'J12',
            })

        skills_per_rome_pefix = dict(mongo.collection_to_proto_mapping(
            skills_for_future.get_skills_per_rome_prefix('the-base', 'the-table'),
            skill_pb2.JobSkills))

        self.assertEqual(
            ['Skill 24', 'Skill 23', 'Skill 22', 'Skill 21', 'Skill 20'],
            [skill.name for skill in skills_per_rome_pefix['J12'].skills])


if __name__ == '__main__':
    unittest.main()
