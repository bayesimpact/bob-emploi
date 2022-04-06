"""Importer for local authority names."""

import csv
from typing import Any, Iterable

from bob_emploi.data_analysis.lib import mongo


# Columns in wards_counties_regions_local_authorities_2016 follow the following scheme:
#     AAAAYYXX
#     AAAA is the area level, which can be
#         - WD for Ward
#         - LAD for Local Authority District
#         - CTY for County
#         - GOR for Government Office Region
#         - CTRY for Country
#     YY describes the year for the updated data, which is 16 for very field except GOR.
#     XX describes the content of the field, which can be
#         - CD for ONS ID (format A12345678)
#         - NM for Name


def csv2dicts(wards_counties_regions_local_authorities_csv: str) -> Iterable[dict[str, Any]]:
    """Prepare the cities from the wards file."""

    with open(wards_counties_regions_local_authorities_csv, 'rt', encoding='utf-8-sig') as file:
        all_authorities = {ward['LAD16CD']: {
            '_id': ward['LAD16CD'],
            'name': ward['LAD16NM'],
            'prefix': 'in ',
        } for ward in csv.DictReader(file)}
    return all_authorities.values()


if __name__ == '__main__':
    mongo.importer_main(csv2dicts, 'local_authorities')
