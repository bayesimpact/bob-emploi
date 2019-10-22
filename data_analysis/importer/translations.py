"""Importer for string translations."""

import os
from typing import Any, Dict, List, Optional

from airtable import airtable

from bob_emploi.data_analysis.lib import mongo


def airtable2dicts(base_id: str, table: str, view: Optional[str] = None) -> List[Dict[str, Any]]:
    """Import the translations in MongoDB."""

    api_key = os.getenv('AIRTABLE_API_KEY')
    if not api_key:
        raise ValueError(
            'No API key found. Create an airtable API key at '
            'https://airtable.com/account and set it in the AIRTABLE_API_KEY '
            'env var.')
    client = airtable.Airtable(base_id, api_key)
    return list(record['fields'] for record in client.iterate(table, view=view))


if __name__ == '__main__':
    mongo.importer_main(airtable2dicts, 'test')
