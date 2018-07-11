"""Unit tests for the timeout_reviews module."""

import datetime
import unittest

import mock
import mongomock

from bob_emploi.frontend.api import review_pb2
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server.asynchronous import timeout_reviews


@mock.patch(
    timeout_reviews.__name__ + '._USER_DB',
    new_callable=lambda: mongomock.MongoClient().test)
@mock.patch(
    timeout_reviews.now.__name__ + '.get',
    new=lambda: datetime.datetime(2018, 5, 11))
class TestCase(unittest.TestCase):
    """Unit tests for the timeout_reviews module."""

    def test_timeout(self, mock_db):
        """Simple timeout."""

        mock_db.cvs_and_cover_letters.insert_one({
            'anonymizedUrl': 'https://dl.airtable.com/4KDBTy2WSGa1JvGbPYsA_CV%20de%20Pascal.png',
            'kind': 'DOCUMENT_RESUME',
            'name': 'Pascal',
            'reviews': [
                {
                    'sentAt': '2018-05-02T08:39:38Z',
                    'reviewerId': 'aca69757aff44770db7d7e49',
                    'status': 'REVIEW_SENT'
                },
            ],
            'numPendingReviews': 1,
            'ownerEmail': 'pascal@wanadoo.fr',
        })
        timeout_reviews.main([])

        document = proto.create_from_mongo(
            mock_db.cvs_and_cover_letters.find_one(), review_pb2.DocumentToReview)
        self.assertFalse(document.num_pending_reviews)
        self.assertEqual(review_pb2.REVIEW_TIME_OUT, document.reviews[0].status)
        self.assertEqual('aca69757aff44770db7d7e49', document.reviews[0].reviewer_id)
        self.assertEqual('pascal@wanadoo.fr', document.owner_email)

    def test_timeout_only_some_reviews(self, mock_db):
        """Timeout some reviews but not all."""

        mock_db.cvs_and_cover_letters.insert_one({
            'anonymizedUrl': 'https://dl.airtable.com/4KDBTy2WSGa1JvGbPYsA_CV%20de%20Pascal.png',
            'kind': 'DOCUMENT_RESUME',
            'name': 'Pascal',
            'reviews': [
                # Review already done.
                {
                    'sentAt': '2018-05-02T08:39:38Z',
                    'reviewerId': 'aca69757aff44770db7d7e49',
                    'status': 'REVIEW_DONE'
                },
                # Review to timeout.
                {
                    'sentAt': '2018-05-02T08:39:38Z',
                    'reviewerId': 'aca69757aff44770db7d7e49',
                    'status': 'REVIEW_SENT'
                },
                # Review too recent to timeout.
                {
                    'sentAt': '2018-05-10T08:39:38Z',
                    'reviewerId': 'aca69757aff44770db7d7e49',
                    'status': 'REVIEW_SENT'
                },
                # Review to timeout.
                {
                    'sentAt': '2018-05-02T08:39:38Z',
                    'reviewerId': 'aca69757aff44770db7d7e49',
                    'status': 'REVIEW_SENT'
                },
            ],
            'numPendingReviews': 3,
            'ownerEmail': 'pascal@wanadoo.fr',
        })
        timeout_reviews.main([])

        document = proto.create_from_mongo(
            mock_db.cvs_and_cover_letters.find_one(), review_pb2.DocumentToReview)
        self.assertEqual(1, document.num_pending_reviews)
        self.assertEqual(
            [
                review_pb2.REVIEW_DONE,
                review_pb2.REVIEW_TIME_OUT,
                review_pb2.REVIEW_SENT,
                review_pb2.REVIEW_TIME_OUT,
            ],
            [r.status for r in document.reviews])
        self.assertEqual('aca69757aff44770db7d7e49', document.reviews[0].reviewer_id)
        self.assertEqual('pascal@wanadoo.fr', document.owner_email)


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
