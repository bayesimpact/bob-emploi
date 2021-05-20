"""Script to update the "VAE_Stats" in AirTable.

Data originally from https://www.education.gouv.fr/cid123187/dispositif-academique-de-validation-des-acquis-12-700-diplomes-delivres-en-2017.html

Run it using:
  docker-compose run \
    -e AIRTABLE_API_KEY=$AIRTABLE_API_KEY \
    --rm data-analysis-prepare \
    python bob_emploi/data_analysis/misc/vae_stats_to_airtable.py
"""

import os
from os import path

from airtable import airtable
import pandas as pd


_FIELDNAME = 'vae_ratio_in_diploma'


def main(
        api_key: str, base_id: str = 'appMRMtWV61Kibt37', table: str = 'VAE_Stats',
        data_folder: str = 'data', filename: str = 'vae-2018.xls',
        sheetname: str = 'Figure 5 web') -> None:
    """Update an AirTable field based on data from XLS file."""

    file = pd.ExcelFile(path.join(data_folder, filename))
    vae_stats = file.parse(sheetname, header=1).dropna()
    vae_stats.set_index(vae_stats.columns[0], inplace=True)

    diplomas = {
        diploma.Index: diploma[-1]
        for diploma in vae_stats.itertuples()
    }

    # Upload them to AirTable.
    client = airtable.Airtable(base_id, api_key)
    records = client.iterate(table)

    for record in records:
        try:
            value = diplomas.pop(record.get('fields').get('name'))
        except KeyError:
            continue
        client.update(table, record.get('id'), {_FIELDNAME: value})

    for name, value in diplomas.items():
        client.create(table, {'name': name, _FIELDNAME: value})


if __name__ == '__main__':
    main(os.getenv('AIRTABLE_API_KEY', ''))
