"""Unit tests for the maintenance module."""

import unittest
from unittest import mock

import mongomock
import requests
import requests_mock

from bob_emploi.data_analysis.importer import maintenance
from bob_emploi.data_analysis.importer.test.testdata import test_pb2


# The tqdm patch is there only to hide the progress bar during tests.
@mock.patch(maintenance.tqdm.__name__ + '.tqdm', new=lambda iterable: iterable)
class ScoringModelCheckTestCase(unittest.TestCase):
    """Unit tests for the check_scoring_models method."""

    def setUp(self) -> None:
        super().setUp()
        # Setup a DB with no problems.
        self._db = mongomock.MongoClient().test
        patcher = mock.patch.dict(maintenance.import_status.IMPORTERS, {
            'has_scoring_models': maintenance.import_status.Importer(
                name='Test Importer',
                script='airtable_to_protos',
                args=None,
                proto_type=test_pb2.ScoringModels,
                is_imported=True,
                run_every=None,
                key='',
                has_pii=False)}, clear=True)
        self._db.has_scoring_models.insert_one({'filters': ['for-women']})
        patcher.start()
        self.addCleanup(patcher.stop)

    @mock.patch(maintenance.logging.__name__ + '.error')
    def test_check_all(self, mock_logging_error: mock.MagicMock) -> None:
        """No problems with scoring models."""

        maintenance.check_scoring_models(self._db)
        self.assertFalse(mock_logging_error.called, msg=mock_logging_error.call_args)

    @mock.patch(maintenance.logging.__name__ + '.error')
    def test_missing_collection(self, mock_logging_error: mock.MagicMock) -> None:
        """A collection from the config is missing."""

        self._db.has_scoring_models.drop()
        maintenance.check_scoring_models(self._db)
        mock_logging_error.assert_called_once()
        self.assertIn('has_scoring_models', mock_logging_error.call_args[0])

    @mock.patch(maintenance.logging.__name__ + '.error')
    def test_only_empty_fields(self, mock_logging_error: mock.MagicMock) -> None:
        """A collection from the config has only empty fields."""

        self._db.has_scoring_models.drop()
        self._db.has_scoring_models.insert_one({'filters': []})
        maintenance.check_scoring_models(self._db)
        mock_logging_error.assert_called_once()
        self.assertIn('has_scoring_models', mock_logging_error.call_args[0])

    @mock.patch(maintenance.logging.__name__ + '.error')
    def test_unknown_scoring_model(self, mock_logging_error: mock.MagicMock) -> None:
        """A record has an unknown scoring model."""

        self._db.has_scoring_models.drop()
        self._db.has_scoring_models.insert_one(
            {'_id': 'culprit', 'filters': ['unknown-not-implemented']})
        maintenance.check_scoring_models(self._db)
        mock_logging_error.assert_called_once()
        self.assertIn('has_scoring_models', mock_logging_error.call_args[0])
        self.assertIn('culprit', mock_logging_error.call_args[0])


@mock.patch(maintenance.tqdm.__name__ + '.tqdm', new=lambda iterable: iterable)
class UrlCheckTestCase(unittest.TestCase):
    """Unit tests for the check_urls method."""

    def setUp(self) -> None:
        super().setUp()
        # Setup a DB with no problems.
        self._db = mongomock.MongoClient().test
        patcher = mock.patch.dict(maintenance.import_status.IMPORTERS, {
            'has_url_link': maintenance.import_status.Importer(
                name='Test Importer',
                script='airtable_to_protos',
                args=None,
                proto_type=test_pb2.UrlLink,
                is_imported=True,
                run_every=None,
                key='',
                has_pii=False)}, clear=True)
        patcher.start()
        self.addCleanup(patcher.stop)
        self._db.has_url_link.insert_one({'link': '/'})

    @mock.patch(maintenance.logging.__name__ + '.error')
    def test_check_all(self, mock_logging_error: mock.MagicMock) -> None:
        """No problems with internal URLs."""

        maintenance.check_urls(self._db)
        self.assertFalse(mock_logging_error.called)

    @mock.patch(maintenance.logging.__name__ + '.error')
    def test_missing_collection(self, mock_logging_error: mock.MagicMock) -> None:
        """A collection from the config is missing."""

        # Note it could be any of the collection of _URL_FIELDS.
        self._db.has_url_link.drop()
        maintenance.check_urls(self._db)
        mock_logging_error.assert_called_once()
        self.assertIn('has_url_link', mock_logging_error.call_args[0])

    @mock.patch(maintenance.logging.__name__ + '.error')
    def test_only_empty_fields(self, mock_logging_error: mock.MagicMock) -> None:
        """A collection from the config has only empty fields."""

        # Note it could be any of the collection of _URL_FIELDS.
        self._db.has_url_link.drop()
        self._db.has_url_link.insert_one({'link': ''})
        maintenance.check_urls(self._db)
        mock_logging_error.assert_called_once()
        self.assertIn('has_url_link', mock_logging_error.call_args[0])

    @mock.patch(maintenance.logging.__name__ + '.error')
    def test_malformed_link(self, mock_logging_error: mock.MagicMock) -> None:
        """A collection from the config has only empty fields."""

        self._db.has_url_link.drop()
        self._db.has_url_link.insert_one({'link': 'htp:/www.google.fr/malformed.html'})
        maintenance.check_urls(self._db)
        mock_logging_error.assert_called_once()
        self.assertIn('has_url_link', mock_logging_error.call_args[0])

    @mock.patch(maintenance.logging.__name__ + '.error')
    @requests_mock.mock()
    def test_actual_link(
            self, mock_logging_error: mock.MagicMock,
            mock_requests: 'requests_mock._RequestObjectProxy') -> None:
        """Check with an external working link."""

        mock_requests.get('https://www.google.com', status_code=200)
        self._db.has_url_link.insert_one({'link': 'https://www.google.com'})
        maintenance.check_urls(self._db)
        self.assertFalse(mock_logging_error.called, msg=mock_logging_error.call_args)

    @mock.patch(maintenance.logging.__name__ + '.error')
    @requests_mock.mock()
    def test_link_to_missing_page(
            self, mock_logging_error: mock.MagicMock,
            mock_requests: 'requests_mock._RequestObjectProxy') -> None:
        """Check with a link to a missing page."""

        mock_requests.get('http://does-not-exist.com', status_code=404)
        self._db.has_url_link.insert_one({
            '_id': 'link-to-missing', 'link': 'http://does-not-exist.com'})
        maintenance.check_urls(self._db)
        mock_logging_error.assert_called_once()
        self.assertIn('has_url_link', mock_logging_error.call_args[0])
        self.assertIn('link-to-missing', mock_logging_error.call_args[0])
        self.assertIn(404, mock_logging_error.call_args[0])
        self.assertIn('http://does-not-exist.com', mock_logging_error.call_args[0])

    @mock.patch(maintenance.logging.__name__ + '.error')
    @requests_mock.mock()
    def test_link_raise_exception(
            self, mock_logging_error: mock.MagicMock,
            mock_requests: 'requests_mock._RequestObjectProxy') -> None:
        """Check with a link that cannot be resolved in time."""

        mock_requests.get('https://www.gooooogle.com', exc=requests.exceptions.ConnectTimeout)
        self._db.has_url_link.insert_one({
            '_id': 'timeout-link', 'link': 'https://www.gooooogle.com'})
        maintenance.check_urls(self._db)
        mock_logging_error.assert_called_once()
        self.assertIn('has_url_link', mock_logging_error.call_args[0])
        self.assertIn('timeout-link', mock_logging_error.call_args[0])
        self.assertIn('ConnectTimeout', mock_logging_error.call_args[0])
        self.assertIn('https://www.gooooogle.com', mock_logging_error.call_args[0])

    @mock.patch(maintenance.logging.__name__ + '.error')
    @requests_mock.mock()
    def test_link_raise_ssl_exception(
            self, mock_logging_error: mock.MagicMock,
            mock_requests: 'requests_mock._RequestObjectProxy') -> None:
        """Check with a link that blocks on an SSL exception."""

        mock_requests.get('https://www.gooooogle.com', exc=requests.exceptions.SSLError)
        # Note it could be any of the collection of _URL_FIELDS.
        self._db.associations.insert_one({
            '_id': 'bad-ssl-link', 'link': 'https://www.gooooogle.com'})
        maintenance.check_urls(self._db)
        self.assertFalse(mock_logging_error.called)


@mock.patch(maintenance.tqdm.__name__ + '.tqdm', new=lambda iterable: iterable)
@mock.patch(maintenance.scoring_base.__name__ + '._TEMPLATE_VARIABLES', {'%known': lambda p: ''})
class TemplateVariablesCheckTestCase(unittest.TestCase):
    """Unit tests for the check_template_variables method."""

    def setUp(self) -> None:
        super().setUp()
        # Setup a DB with no problems.
        self._db = mongomock.MongoClient().test
        patcher = mock.patch.dict(maintenance.import_status.IMPORTERS, {
            'has_template': maintenance.import_status.Importer(
                name='Test Importer',
                script='airtable_to_protos',
                args={},
                is_imported=True,
                run_every=None,
                key='',
                has_pii=False,
                proto_type=test_pb2.Template)}, clear=True)
        self._db.has_scoring_models.insert_one({'textTemplate': 'La tour %inCity'})
        patcher.start()
        self.addCleanup(patcher.stop)

    @mock.patch('logging.error')
    def test_missing_var(self, mock_logging_error: mock.MagicMock) -> None:
        """Check for non-implemented template variables."""

        self._db.has_template.insert_one({
            '_id': 'using-missing',
            'textTemplate': 'This is a %missingVariable and a %known variable',
        })
        maintenance.check_template_variables(self._db)
        mock_logging_error.assert_called_once()
        error_message = mock_logging_error.call_args[0][0] % mock_logging_error.call_args[0][1:]
        self.assertIn('%missingVariable', error_message)
        self.assertIn('using-missing', error_message)

    @mock.patch('logging.error')
    def test_unused_var(self, mock_logging_error: mock.MagicMock) -> None:
        """Check for unused template variables."""

        self._db.has_template.insert_one({
            '_id': 'using-no-variable',
            'textTemplate': 'This either',
        })
        maintenance.check_template_variables(self._db)
        mock_logging_error.assert_called_once()
        self.assertIn(
            '%known', mock_logging_error.call_args[0][0] % mock_logging_error.call_args[0][1:])


if __name__ == '__main__':
    unittest.main()
