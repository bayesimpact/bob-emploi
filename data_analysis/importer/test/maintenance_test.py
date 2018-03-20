"""Unit tests for the maintenance module."""

import unittest

import mock
import mongomock
import requests
import requests_mock

from bob_emploi.data_analysis.importer import maintenance


class ScoringModelCheckTestCase(unittest.TestCase):
    """Unit tests for the check_scoring_models method."""

    def setUp(self):
        super(ScoringModelCheckTestCase, self).setUp()
        # Setup a DB with no problems.
        self._db = mongomock.MongoClient().test
        self._db.advice_modules.insert_one({'triggerScoringModel': 'advice-volunteer'})
        self._db.application_tips.insert_one({'filters': ['for-women']})
        self._db.associations.insert_one({'filters': ['for-long-search(7)']})
        self._db.contact_lead.insert_one({'filters': ['for-single-parent']})
        self._db.diagnostic_sentences.insert_one({'filters': ['for-women']})
        self._db.events.insert_one({'filters': ['for-reorientation']})
        self._db.jobboards.insert_one({'filters': ['for-young(25)']})
        self._db.tip_templates.insert_one({'filters': ['for-complex-application']})

    @mock.patch(maintenance.logging.__name__ + '.error')
    def test_check_all(self, mock_logging_error):
        """No problems with scoring models."""

        maintenance.check_scoring_models(self._db)
        self.assertFalse(mock_logging_error.called)

    @mock.patch(maintenance.logging.__name__ + '.error')
    def test_missing_collection(self, mock_logging_error):
        """A collection from the config is missing."""

        # Note it could be any of the collection of _SCORING_MODEL_FIELDS.
        self._db.associations.drop()
        maintenance.check_scoring_models(self._db)
        mock_logging_error.assert_called_once()
        self.assertIn('associations', mock_logging_error.call_args[0])

    @mock.patch(maintenance.logging.__name__ + '.error')
    def test_only_empty_fields(self, mock_logging_error):
        """A collection from the config has only empty fields."""

        # Note it could be any of the collection of _SCORING_MODEL_FIELDS.
        self._db.associations.drop()
        self._db.associations.insert_one({'filters': []})
        maintenance.check_scoring_models(self._db)
        mock_logging_error.assert_called_once()
        self.assertIn('associations', mock_logging_error.call_args[0])

    @mock.patch(maintenance.logging.__name__ + '.error')
    def test_unknown_scoring_model(self, mock_logging_error):
        """A record has an unknown scoring model."""

        # Note it could be any of the collection of _SCORING_MODEL_FIELDS.
        self._db.associations.drop()
        self._db.associations.insert_one({'_id': 'culprit', 'filters': ['unknown-not-implemented']})
        maintenance.check_scoring_models(self._db)
        mock_logging_error.assert_called_once()
        self.assertIn('associations', mock_logging_error.call_args[0])
        self.assertIn('culprit', mock_logging_error.call_args[0])


# The tqdm patch is there only to hide the progress bar during tests.
@mock.patch(maintenance.tqdm.__name__ + '.tqdm', new=lambda iterable: iterable)
class UrlCheckTestCase(unittest.TestCase):
    """Unit tests for the check_urls method."""

    def setUp(self):
        super(UrlCheckTestCase, self).setUp()
        # Setup a DB with no problems.
        self._db = mongomock.MongoClient().test
        self._db.associations.insert_one({'link': '/'})
        self._db.jobboards.insert_one({'link': '/'})
        self._db.tip_templates.insert_one({'link': '/'})

    @mock.patch(maintenance.logging.__name__ + '.error')
    def test_check_all(self, mock_logging_error):
        """No problems with internal URLs."""

        maintenance.check_urls(self._db)
        self.assertFalse(mock_logging_error.called)

    @mock.patch(maintenance.logging.__name__ + '.error')
    def test_missing_collection(self, mock_logging_error):
        """A collection from the config is missing."""

        # Note it could be any of the collection of _URL_FIELDS.
        self._db.associations.drop()
        maintenance.check_urls(self._db)
        mock_logging_error.assert_called_once()
        self.assertIn('associations', mock_logging_error.call_args[0])

    @mock.patch(maintenance.logging.__name__ + '.error')
    def test_only_empty_fields(self, mock_logging_error):
        """A collection from the config has only empty fields."""

        # Note it could be any of the collection of _URL_FIELDS.
        self._db.associations.drop()
        self._db.associations.insert_one({'link': ''})
        maintenance.check_urls(self._db)
        mock_logging_error.assert_called_once()
        self.assertIn('associations', mock_logging_error.call_args[0])

    @mock.patch(maintenance.logging.__name__ + '.error')
    @requests_mock.mock()
    def test_actual_link(self, mock_logging_error, mock_requests):
        """Check with an external working link."""

        mock_requests.get('https://www.google.com', status_code=200)
        # Note it could be any of the collection of _URL_FIELDS.
        self._db.associations.insert_one({'link': 'https://www.google.com'})
        maintenance.check_urls(self._db)
        self.assertFalse(mock_logging_error.called, msg=mock_logging_error.call_args)

    @mock.patch(maintenance.logging.__name__ + '.error')
    @requests_mock.mock()
    def test_link_to_missing_page(self, mock_logging_error, mock_requests):
        """Check with a link to a missing page."""

        mock_requests.get('http://does-not-exist.com', status_code=404)
        # Note it could be any of the collection of _URL_FIELDS.
        self._db.associations.insert_one({
            '_id': 'link-to-missing', 'link': 'http://does-not-exist.com'})
        maintenance.check_urls(self._db)
        mock_logging_error.assert_called_once()
        self.assertIn('associations', mock_logging_error.call_args[0])
        self.assertIn('link-to-missing', mock_logging_error.call_args[0])
        self.assertIn(404, mock_logging_error.call_args[0])
        self.assertIn('http://does-not-exist.com', mock_logging_error.call_args[0])

    @mock.patch(maintenance.logging.__name__ + '.error')
    @requests_mock.mock()
    def test_link_raise_exception(self, mock_logging_error, mock_requests):
        """Check with a link that cannot be resolved in time."""

        mock_requests.get('https://www.gooooogle.com', exc=requests.exceptions.ConnectTimeout)
        # Note it could be any of the collection of _URL_FIELDS.
        self._db.associations.insert_one({
            '_id': 'timeout-link', 'link': 'https://www.gooooogle.com'})
        maintenance.check_urls(self._db)
        mock_logging_error.assert_called_once()
        self.assertIn('associations', mock_logging_error.call_args[0])
        self.assertIn('timeout-link', mock_logging_error.call_args[0])
        self.assertIn('ConnectTimeout', mock_logging_error.call_args[0])
        self.assertIn('https://www.gooooogle.com', mock_logging_error.call_args[0])

    @mock.patch(maintenance.logging.__name__ + '.error')
    @requests_mock.mock()
    def test_link_raise_ssl_exception(self, mock_logging_error, mock_requests):
        """Check with a link that blocks on an SSL exception."""

        mock_requests.get('https://www.gooooogle.com', exc=requests.exceptions.SSLError)
        # Note it could be any of the collection of _URL_FIELDS.
        self._db.associations.insert_one({
            '_id': 'bad-ssl-link', 'link': 'https://www.gooooogle.com'})
        maintenance.check_urls(self._db)
        self.assertFalse(mock_logging_error.called)


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
