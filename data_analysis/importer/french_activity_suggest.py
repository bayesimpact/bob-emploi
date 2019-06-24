"""Module to upload the NAF data set - the French activities dataset for activity suggest.

To run it, you need an Algolia API key suited for updating the activities index.
Check out https://www.algolia.com/api-keys to find such a key.

docker-compose run --rm -e ALGOLIA_API_KEY=<the key> \
    data-analysis-prepare python \
    bob_emploi/data_analysis/importer/french_activity_suggest.py
"""

import json
import os
import time
import typing

from algoliasearch import search_client
from algoliasearch import helpers
import pandas

from bob_emploi.data_analysis.lib import cleaned_data


def prepare_activities(data_folder: str = 'data', stats_filename: typing.Optional[str] = None) \
        -> typing.List[typing.Dict[str, typing.Any]]:
    """Prepare activities for upload to Algolia.

    Args:
        data_folder: the root of the data folder.
        stats_filename: path to a file containing stats about activities, the
            number of hiring done whithin a given period per activity and per
            job group.

    Returns:
        A list of dict JSON-like objects each containing properties of a French
        activity.
    """

    activities = cleaned_data.naf_subclasses(data_folder)

    # Set activity ID on objectID as this is what Algolia uses.
    activities['objectID'] = activities.index

    if stats_filename:
        activity_stats = pandas.read_csv(stats_filename)
        activities['hiring'] = activity_stats.groupby('APE700').nb_embauches.sum()
        activities.hiring.fillna(0, inplace=True)
    else:
        activities['hiring'] = 0

    activities['naf'] = activities.index

    return typing.cast(
        typing.List[typing.Dict[str, typing.Any]],
        activities[['objectID', 'naf', 'name', 'hiring']].to_dict(orient='records'))


def upload(batch_size: int = 5000) -> None:
    """Upload French activity suggestions to Algolia index."""

    suggestions = prepare_activities('data', 'data/dpae-count.csv')
    client = search_client.SearchClient.create(
        os.getenv('ALGOLIA_APP_ID', 'K6ACI9BKKT'),
        os.getenv('ALGOLIA_API_KEY'))
    index_name = os.getenv('ALGOLIA_ACTIVITIES_INDEX', 'activities')
    activities_index = client.init_index(index_name)
    tmp_index_name = '{}_{}'.format(index_name, round(time.time()))
    tmp_activities_index = client.init_index(tmp_index_name)

    try:
        tmp_activities_index.set_settings(activities_index.get_settings())
        # TODO(pascal): Add synonyms if we start having some.
        for start in range(0, len(suggestions), batch_size):
            tmp_activities_index.add_objects(suggestions[start:start + batch_size])

        # OK we're ready finally replace the index.
        client.move_index(tmp_index_name, index_name)
    except helpers.AlgoliaException:
        tmp_activities_index.clear_index()
        print(json.dumps(suggestions[:10], indent=2))
        raise


if __name__ == '__main__':
    upload()
