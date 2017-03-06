"""Script to update the "Networking as first application mode" field in AirTable.

The goal of this script is to help manual investigations per job groups. The
uploaded data is only there for a visual check, not to be programmatically
reused: programs should use the IMT directly.

Run it using:
  docker-compose run \
    -e AIRTABLE_API_KEY=$AIRTABLE_API_KEY \
    --rm data-analysis-prepare \
    python bob_emploi/imt_application_mode_to_airtable.py
"""
import os

from airtable import airtable

from bob_emploi.lib import cleaned_data


def main(
        api_key, base_id='appMRMtWV61Kibt37', table='Job Groups',
        field='Networking as first application mode', data_folder='data'):
    """Update an AirTable field based on IMT data.

    Args:
        api_key: the API key to access AirTable (see https://airtable.com/account).
        base_id: the ID of the AirTable base to update (see https://airtable.com/api).
        table: the name of the AirTable table to update.
        field: the name of the AirTable field to update.
        data_folder: the folder containing the scraped IMT data.
    """
    imt = cleaned_data.scraped_imt(data_folder)

    # Create the set of ROME ID of job groups that use network as their first
    # application mode.
    job_groups_use_network = set()
    for unused_index, row in imt.reset_index().drop_duplicates('rome_id').iterrows():
        if not row.applicationModes:
            continue
        if any(m['first'] != 'PERSONAL_OR_PROFESSIONAL_CONTACTS'
               for m in row.applicationModes.values()):
            continue
        job_groups_use_network.add(row.rome_id)

    # Upload them to AirTable.
    client = airtable.Airtable(base_id, api_key)
    records = client.iterate(table)

    for record in records:
        if record.get('fields').get('code_rome') not in job_groups_use_network:
            continue
        client.update(table, record.get('id'), {field: True})


if __name__ == '__main__':
    main(os.getenv('AIRTABLE_API_KEY'))
