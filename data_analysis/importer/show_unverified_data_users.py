"""This scripts import a list of users that accept to see unverified data in Bob.

The list is imported from Airtable.
"""

import os
import typing

from airtable import airtable

from bob_emploi.data_analysis.lib import mongo

API_KEY = os.getenv('AIRTABLE_API_KEY')


def airtable2dicts(base_id: str, table: str, view: typing.Optional[str] = None) \
        -> typing.List[typing.Dict[str, typing.Any]]:
    """Import the users email from Airtable.

    Args:
        base_id: the ID of your Airtable app.
        table: the name of the table to import.
        view: optional - the name of the view to import.
    Returns:
        an iterable of dict with the JSON values of the proto.
    """

    if not API_KEY:
        raise ValueError(
            'No API key found. Create an airtable API key at '
            'https://airtable.com/account and set it in the AIRTABLE_API_KEY '
            'env var.')
    client = airtable.Airtable(base_id, API_KEY)
    records = client.iterate(table, view=view)

    return [{'_id': r.get('fields', {}).get('email', '')} for r in records]


if __name__ == '__main__':
    mongo.importer_main(airtable2dicts, 'show_unverified_data_users')
