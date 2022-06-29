"""Tests for the jobflix area endpoints."""

from bob_emploi.frontend.server.test import base_test


class JobflixAreasTests(base_test.ServerTestCase):
    """Unit tests for jobflix area endpoint."""

    def setUp(self) -> None:
        super().setUp()
        self._db.departements.insert_many([{'_id': '977'}])
        self._db.best_jobs_in_area.insert_many([
            {
                '_id': '31',
            },
            {
                '_id': '32',
            },
        ])

    def test_areas(self) -> None:
        """List all area with best jobs data."""

        http_response = self.app.get('/api/upskilling/areas')
        response = self.json_from_response(http_response)
        self.assertEqual({'areaIds': ['31', '32', '977']}, response)
