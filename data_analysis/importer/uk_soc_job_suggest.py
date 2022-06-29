"""Module to upload the English-UK job titles dataset to Algolia for job suggest.

To run it, you need an Algolia API key suited for updating the en jobs index.
Check out https://www.algolia.com/api-keys to find such a key.

docker-compose run --rm -e ALGOLIA_API_KEY=<the key> \
    data-analysis-prepare python \
    bob_emploi/data_analysis/importer/uk_soc_job_suggest.py
"""

import hashlib
import json
import logging
import os
from os import path
import time
import typing
from typing import Any

from algoliasearch import exceptions
from algoliasearch import search_client
import pandas

from bob_emploi.data_analysis.lib import uk_cleaned_data


def prepare_job_titles(data_folder: str = 'data') -> list[dict[str, Any]]:
    """Prepare jobs for upload to Algolia.

    Args:
        data_folder: the root of the data folder.

    Returns:
        A list of dict JSON-like objects each containing properties of a UK-English job title.
    """

    job_titles = pandas.read_excel(
        path.join(data_folder, 'uk/soc/soc2010.xls'),
        sheet_name='SOC2010 Full Index V7', dtype='str')
    job_titles = job_titles.rename(
        {
            'SOC 2010': 'jobGroupId',
        },
        axis='columns',
    )

    job_titles['name'] = job_titles.INDEXOCC.str.split(', ').str[::-1].str.join(' ').apply(
        lambda name: name if name == name.upper() else name.capitalize())

    job_titles['objectID'] = job_titles.name.apply(
        lambda name: hashlib.sha1(name.encode('utf-8')).hexdigest()[:8]
    )

    job_groups = uk_cleaned_data.uk_soc2010_job_groups(data_folder)
    job_titles['jobGroupName'] = job_titles.jobGroupId.map(job_groups.name)

    # Remove the job titles that are not in minor groups.
    job_titles.dropna(subset=['jobGroupName'], inplace=True)

    occupations = uk_cleaned_data.uk_national_occupations(data_folder)\
        .set_index('occ_code').tot_emp
    job_titles['numEmployed'] = job_titles.jobGroupId.map(occupations)

    useful_columns = ['jobGroupId', 'jobGroupName', 'name', 'numEmployed', 'objectID']
    return typing.cast(
        list[dict[str, Any]], job_titles[useful_columns].to_dict(orient='records'))


def upload(batch_size: int = 5000, data_folder: str = 'data') -> None:
    """Upload UK occupation suggestions to Algolia index."""

    suggestions = prepare_job_titles(data_folder)
    client = search_client.SearchClient.create(
        os.environ.get('ALGOLIA_APP_ID', 'K6ACI9BKKT'),
        os.environ.get('ALGOLIA_API_KEY'))
    index_name = os.environ.get('ALGOLIA_EN_JOBS_INDEX', 'jobs_en_UK')
    jobs_index = client.init_index(index_name)
    tmp_index_name = f'{index_name}_{round(time.time())}'
    tmp_jobs_index = client.init_index(tmp_index_name)

    try:
        tmp_jobs_index.set_settings(jobs_index.get_settings())
        # TODO(pascal): Add synonyms if we start having some.
        for start in range(0, len(suggestions), batch_size):
            tmp_jobs_index.save_objects(suggestions[start:start + batch_size])

        # OK we're ready finally replace the index.
        client.move_index(tmp_index_name, index_name)
    except exceptions.AlgoliaException as error:
        tmp_jobs_index.delete()
        logging.error(
            'An error occurred while saving to Algolia:\n%s',
            json.dumps(suggestions[:10], indent=2), exc_info=error)
        raise


if __name__ == '__main__':
    upload()
