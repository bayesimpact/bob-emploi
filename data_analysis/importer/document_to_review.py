"""Importer for document to review from Airtable to MongoDB."""

import argparse
import os
from typing import List, Optional

from airtable import airtable
from bson import objectid
import pymongo

from bob_emploi.data_analysis.importer import airtable_to_protos
from bob_emploi.frontend.api import review_pb2

_AIRTABLE_API_KEY = os.getenv('AIRTABLE_API_KEY')


def import_new_records(
        base_id: str, table: str, mongo_table: pymongo.collection.Collection,
        view: Optional[str] = None) -> None:
    """Import new records from Airtable to MongoDB."""

    if not _AIRTABLE_API_KEY:
        raise ValueError(
            'No API key found. Create an airtable API key at '
            'https://airtable.com/account and set it in the AIRTABLE_API_KEY '
            'env var.')
    client = airtable.Airtable(base_id, _AIRTABLE_API_KEY)
    records = client.iterate(table, view=view)

    converter = airtable_to_protos.ProtoAirtableConverter(
        proto_type=review_pb2.DocumentToReview,
        id_field=None,
        required_fields=('anonymized_url',))

    num_inserted = 0
    num_updated = 0
    for record in records:
        mongo_id = record.get('fields', {}).get('mongo_id')

        proto_data = converter.convert_record(record)
        airtable_id = proto_data.pop('_id')
        if record['fields'].get('anonymized_url'):
            proto_data['anonymizedUrl'] = record['fields']['anonymized_url'][0]['url']

        if mongo_id:
            # Already added, let's update it.
            document_json = mongo_table.find_one_and_update(
                {'_id': objectid.ObjectId(mongo_id)},
                {'$set': proto_data},
            )
            any_pending_or_done_review = document_json.get('numPendingReviews', 0) or \
                document_json.get('numDoneReviews', 0)
            timeout_review_count = sum(
                1 for review in document_json.get('reviews', [])
                if review.get('status') == 'REVIEW_TIME_OUT')
            client.update(table, airtable_id, {
                'Bayes help needed': not any_pending_or_done_review,
                'review_timeouts': timeout_review_count,
            })
            num_updated += 1
            continue

        result = mongo_table.insert_one(proto_data)
        mongo_id = str(result.inserted_id)
        client.update(table, airtable_id, {'mongo_id': mongo_id, 'Bayes help needed': True})
        num_inserted += 1

    print(f'{num_updated:d} documents updated.')
    print(f'{num_inserted:d} documents added.')


def main(string_args: Optional[List[str]] = None) -> None:
    """Importer for document to review from Airtable to MongoDB."""

    parser = argparse.ArgumentParser(
        description='Import documents to review from Airtable to MongoDB.')
    parser.add_argument(
        '--mongo_url', help='URL of the MongoDB base to store documents to review', required=True)
    parser.add_argument(
        '--mongo_collection', default='cvs_and_letters',
        help='Name of the MongoDB collection storing documents to review')
    parser.add_argument('--base_id', help='ID of the AirTable app', required=True)
    parser.add_argument('--table', help='Name of the Airtable table to import', required=True)
    parser.add_argument('--view', help='Name of the Airtable view to import')

    args = parser.parse_args(string_args)

    mongo_table = pymongo.MongoClient(args.mongo_url)\
        .get_database()\
        .get_collection(args.mongo_collection)
    import_new_records(args.base_id, args.table, mongo_table, view=args.view)


if __name__ == '__main__':
    main()
