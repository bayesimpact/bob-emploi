"""Unit tests for the companies module."""

import unittest

import mock

from bob_emploi.frontend.server import companies
from bob_emploi.frontend.api import project_pb2


@mock.patch(companies.emploi_store.__name__ + '.Client')
class CompaniesTestCase(unittest.TestCase):
    """Unit tests for the module."""

    @mock.patch(companies.__name__ + '._EMPLOI_STORE_DEV_CLIENT_ID', 'client-id')
    @mock.patch(companies.__name__ + '._EMPLOI_STORE_DEV_SECRET', 'secret')
    def test_get_lbb_companies(self, mock_emploi_store_client):
        """Basic usage of LBB call."""

        mock_emploi_store_client().get_lbb_companies.return_value = [
            'Auchan', 'Carrefour', 'Leclerc',
        ]
        project = project_pb2.Project()
        project.mobility.city.city_id = '69123'
        project.target_job.job_group.rome_id = 'A5432'

        all_companies = list(companies.get_lbb_companies(project))

        self.assertEqual(['Auchan', 'Carrefour', 'Leclerc'], all_companies)
        mock_emploi_store_client.assert_called_with(
            client_id='client-id', client_secret='secret')
        mock_emploi_store_client().get_lbb_companies.assert_called_with(
            city_id='69123', rome_codes=['A5432'], distance=10, contract=None)

    @mock.patch(companies.__name__ + '._EMPLOI_STORE_DEV_CLIENT_ID', 'client-id')
    @mock.patch(companies.__name__ + '._EMPLOI_STORE_DEV_SECRET', 'secret')
    @mock.patch(companies.logging.__name__ + '.error')
    def test_get_lbb_companies_fail(self, mock_log_error, mock_emploi_store_client):
        """LBB crashed."""

        mock_emploi_store_client().get_lbb_companies.side_effect = IOError
        project = project_pb2.Project()
        project.mobility.city.city_id = '69123'
        project.target_job.job_group.rome_id = 'A5432'

        # Should not crash.
        all_companies = list(companies.get_lbb_companies(project))

        self.assertFalse(all_companies)
        mock_log_error.assert_called()

    @mock.patch(companies.logging.__name__ + '.warning')
    def test_get_lbb_companies_no_credentials(self, mock_log_warning, mock_emploi_store_client):
        """Missing Emploi Store Dev credentials."""

        project = project_pb2.Project()
        project.mobility.city.city_id = '69123'
        project.target_job.job_group.rome_id = 'A5432'

        # Should not crash.
        all_companies = list(companies.get_lbb_companies(project))

        self.assertFalse(all_companies)
        mock_emploi_store_client.assert_not_called()
        mock_log_warning.assert_called()


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
