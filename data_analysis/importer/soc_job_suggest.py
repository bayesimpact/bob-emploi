"""Module to upload the English job titles dataset to Algolia for job suggest.

To run it, you need an Algolia API key suited for updating the en jobs index.
Check out https://www.algolia.com/api-keys to find such a key.

docker-compose run --rm -e ALGOLIA_API_KEY=<the key> \
    data-analysis-prepare python \
    bob_emploi/data_analysis/importer/soc_job_suggest.py
"""

import hashlib
import json
import os
from os import path
import sys
import time
import typing
from typing import Any, Dict, List, TextIO

from algoliasearch import exceptions
from algoliasearch import search_client
import pandas

from bob_emploi.data_analysis.lib import usa_cleaned_data


def prepare_job_titles(data_folder: str = 'data') -> List[Dict[str, Any]]:
    """Prepare jobs for upload to Algolia.

    Args:
        data_folder: the root of the data folder.

    Returns:
        A list of dict JSON-like objects each containing properties of a English job title.
    """

    job_titles = pandas.read_excel(path.join(data_folder, 'usa/soc/DMTF_2010.xls'), skiprows=6)
    job_titles = job_titles.rename(
        {
            '2010 SOC Code': 'jobGroupId',
            '2010 SOC Direct Match Title': 'name',
            '2010 SOC Title': 'jobGroupName',
        },
        axis='columns',
    )
    job_titles.dropna(subset=['jobGroupId'], inplace=True)
    job_titles['name'] = job_titles.name.str.strip()
    job_titles['jobGroupId'] = job_titles.jobGroupId.str.strip()
    job_titles['jobGroupName'] = job_titles.jobGroupName.str.strip()

    job_titles['objectID'] = job_titles.name.apply(
        lambda name: hashlib.sha1(name.encode('utf-8')).hexdigest()[:8]
    )

    # TODO(pascal): Clarify which SOC codes this are using (hint: a mix of 2010 and 2018).
    occupations = usa_cleaned_data.us_national_occupations(data_folder)\
        .drop_duplicates('occ_code')\
        .set_index('occ_code').tot_emp.dropna()
    job_titles['numEmployed'] = job_titles.jobGroupId.map(occupations)
    job_titles['numEmployed'].fillna(0, inplace=True)

    useful_columns = ['jobGroupId', 'jobGroupName', 'name', 'numEmployed', 'objectID']
    return typing.cast(
        List[Dict[str, Any]], job_titles[useful_columns].to_dict(orient='records'))


def upload(batch_size: int = 5000, data_folder: str = 'data', out: TextIO = sys.stdout) -> None:
    """Upload French city suggestions to Algolia index."""

    suggestions = prepare_job_titles(data_folder)
    client = search_client.SearchClient.create(
        os.environ.get('ALGOLIA_APP_ID', 'K6ACI9BKKT'),
        os.environ.get('ALGOLIA_API_KEY'))
    index_name = os.environ.get('ALGOLIA_EN_JOBS_INDEX', 'jobs_en')
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
    except exceptions.AlgoliaException:
        tmp_jobs_index.delete()
        out.write(json.dumps(suggestions[:10], indent=2))
        raise


if __name__ == '__main__':
    upload()
