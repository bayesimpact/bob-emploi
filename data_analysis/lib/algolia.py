"""Helper functions for algolia index handling."""

import json
import logging
import time
from typing import Any, Iterable

from algoliasearch import exceptions
from algoliasearch import search_client

from bob_emploi.data_analysis.lib import batch


# TODO(cyrille): Use wherever relevant.
def upload(items: Iterable[Any], *, app_id: str, api_key: str, index: str, batch_size: int = 5000) \
        -> None:
    """Seamlessly upload items to Algolia, by creating a temporary index."""

    client = search_client.SearchClient.create(app_id, api_key)
    _index = client.init_index(index)
    tmp_index_name = f'{index}_{round(time.time())}'
    tmp_index = client.init_index(tmp_index_name)

    batch_items: list[Any] = []
    try:
        previous_settings = _index.get_settings()
        # move_index doesn't allow its source to have replicas.
        # The destination replicas are kept anyway.
        del previous_settings['replicas']
        tmp_index.set_settings(previous_settings)
        # TODO(pascal): Add synonyms if we start having some.
        for batch_items in batch.batch_iterator(items, batch_size):
            tmp_index.save_objects(batch_items)

        # OK we're ready finally replace the index.
        client.move_index(tmp_index_name, index)
    except exceptions.AlgoliaException as error:
        tmp_index.delete()
        logging.error(
            'An error occurred while saving to Algolia:\n%s',
            json.dumps(batch_items[:10], indent=2), exc_info=error)
        raise
