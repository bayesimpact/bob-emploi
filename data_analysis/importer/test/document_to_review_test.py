"""Unit tests for the document_to_review module."""

import unittest
from unittest import mock

import airtablemock
from bson import objectid
import mongomock
import pymongo

from bob_emploi.data_analysis.importer import document_to_review


@mock.patch(document_to_review.__name__ + '._AIRTABLE_API_KEY', 'abc')
class DocumentToReviewImporterTest(airtablemock.TestCase):
    """Test the document_to_review module."""

    @mongomock.patch()
    def test_import(self):
        """Test importing a CV in mongo."""

        base = airtablemock.Airtable('a12345', 'apikey42')
        base.create('cvs_and_cover_letters', {
            'anonymized_url': [{'url': 'http://mycv.com/PascalCorpet'}],
            'name': 'Pascal',
        })
        document_to_review.main([
            '--mongo_url', 'mongodb://localhost/test',
            '--base_id', 'a12345',
            '--table', 'cvs_and_cover_letters',
        ])

        records = list(base.iterate('cvs_and_cover_letters'))
        self.assertEqual(['Pascal'], [r.get('fields', {}).get('name') for r in records])
        mongo_id = records[0]['fields']['mongo_id']
        self.assertTrue(mongo_id)

        database = pymongo.MongoClient()
        mongo_records = list(database.test.cvs_and_letters.find())
        self.assertEqual(['Pascal'], [r.get('name') for r in mongo_records])
        self.assertEqual('http://mycv.com/PascalCorpet', mongo_records[0].get('anonymizedUrl'))
        self.assertEqual(mongo_id, str(mongo_records[0].get('_id')))

    @mongomock.patch()
    def test_skip_import(self):
        """Test not importing a CV in mongo if already present."""

        base = airtablemock.Airtable('a12345', 'apikey42')
        record_id = base.create('cvs_and_cover_letters', {
            'anonymized_url': [{'url': 'http://mycv.com/PascalCorpet'}],
            'name': 'Pascal',
        })['id']
        document_to_review.main([
            '--mongo_url', 'mongodb://localhost/test',
            '--base_id', 'a12345',
            '--table', 'cvs_and_cover_letters',
        ])

        base.update('cvs_and_cover_letters', record_id, {'name': 'Lascap'})
        document_to_review.main([
            '--mongo_url', 'mongodb://localhost/test',
            '--base_id', 'a12345',
            '--table', 'cvs_and_cover_letters',
        ])

        records = list(base.iterate('cvs_and_cover_letters'))
        mongo_id = records[0]['fields']['mongo_id']
        self.assertTrue(mongo_id)
        self.assertTrue(records[0]['fields'].get('Bayes help needed'))

        database = pymongo.MongoClient()
        mongo_record = database.test.cvs_and_letters.find_one({'_id': objectid.ObjectId(mongo_id)})
        self.assertTrue(mongo_record)
        self.assertEqual('Lascap', mongo_record.get('name'))
        self.assertEqual('http://mycv.com/PascalCorpet', mongo_record.get('anonymizedUrl'))

        database.test.cvs_and_letters.update_one(
            {'_id': objectid.ObjectId(mongo_id)},
            {'$set': {'numDoneReviews': 1, 'reviews': [{'status': 'REVIEW_TIME_OUT'}]}},
        )

        document_to_review.main([
            '--mongo_url', 'mongodb://localhost/test',
            '--base_id', 'a12345',
            '--table', 'cvs_and_cover_letters',
        ])

        record = next(base.iterate('cvs_and_cover_letters'))['fields']
        self.assertFalse(record.get('Bayes help needed'))
        self.assertEqual(1, record.get('review_timeouts'))


if __name__ == '__main__':
    unittest.main()
