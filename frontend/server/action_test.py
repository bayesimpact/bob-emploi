"""Unit tests for the bob_emploi.frontend.action module."""
import unittest

import mongomock

from bob_emploi.frontend import action
from bob_emploi.frontend.api import action_pb2
from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2


class InstantiateTestCase(unittest.TestCase):
    """Unit tests for the instantiate function."""

    def test_dynamic_sticky_steps(self):
        """Check that dynamic fields of sticky steps are populated."""
        new_action = action_pb2.Action()
        database = mongomock.MongoClient().test
        database.sticky_action_steps.insert_one({
            '_id': 'step1',
            'title': 'Trouver un job de %masculineJobName',
            'content': 'Regarder sur le [ROME](http://go/rome/%romeId).',
            'link': 'http://lbb.fr/city/%cityId/rome/%romeId',
            'linkName': 'Les bonnes boites de %cityName',
            'finishCheckboxCaption': "J'ai trouvé un job de %masculineJobName",
        })
        action.instantiate(
            new_action,
            user_pb2.User(),
            project_pb2.Project(
                mobility=geo_pb2.Location(city=geo_pb2.FrenchCity(
                    city_id='45123',
                    name='Orléans',
                    departement_id='45',
                    region_id='84')),
                target_job=job_pb2.Job(
                    masculine_name='Pompier',
                    code_ogr='78910',
                    job_group=job_pb2.JobGroup(rome_id='A1101', name='Combattants')),
            ),
            action_pb2.ActionTemplate(
                action_template_id='my-sticky',
                step_ids=['step1']),
            set(), database, None)

        step = new_action.steps[0]
        self.assertEqual('http://lbb.fr/city/45123/rome/A1101', step.link)
        self.assertEqual('Regarder sur le [ROME](http://go/rome/A1101).', step.content)


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
