"""Easy access to our job Airtables for data analysis."""

import os
from typing import Any, Dict, Iterable, Optional

from airtable import airtable
import pandas


def load_prefixed_info(
        job_groups: Iterable[str], airtable_ids: str, *,
        job_group_id_field: str, columns: Dict[str, Any]) \
        -> pandas.DataFrame:
    """Load job group info by prefix from AirTable.

    Args:
        job_groups: an iterable of job groups.
        airtable_ids: a colon separated list of the ID of your AirTable app and the name of the
            table to import.
        job_group_id_field: the name of the field containing the prefix for job group IDs.
        columns: a set of field names with a default value for each.
    Returns:
        A pandas DataFrame keyed by job group with the fields.
    """

    airtable_api_key = os.getenv('AIRTABLE_API_KEY')
    if not airtable_api_key:
        raise ValueError(
            'No API key found. Create an airtable API key at '
            'https://airtable.com/account and set it in the AIRTABLE_API_KEY '
            'env var.')

    base_id, table, *others = airtable_ids.split(':')
    view: Optional[str]
    if others:
        [view] = others
    else:
        view = None

    info = pandas.DataFrame(index=job_groups, columns=columns.keys())

    client = airtable.Airtable(base_id, airtable_api_key)
    sorted_records = sorted(
        client.iterate(table, view=view),
        key=lambda record: str(record['fields'].get(job_group_id_field)))
    for record in sorted_records:
        fields = record['fields']
        job_group_id_prefix = fields.get(job_group_id_field)
        if not job_group_id_prefix:
            continue
        for column in columns:
            if column not in fields:
                continue
            field_value = fields[column]
            affected_job_groups = info.index.str.startswith(job_group_id_prefix)
            if isinstance(field_value, str):
                info.loc[affected_job_groups, column] = field_value.strip()
            else:
                info.loc[affected_job_groups, column] = field_value

    for column, default_value in columns.items():
        info[column].fillna(default_value, inplace=True)

    return info
