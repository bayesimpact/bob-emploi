"""Importer of French Région data in MongoDB."""

import typing
from typing import Any, Dict, List

from bob_emploi.data_analysis.lib import cleaned_data
from bob_emploi.data_analysis.lib import mongo


def make_dicts(french_regions_tsv: str, prefix_tsv: str) -> List[Dict[str, Any]]:
    """Import régions info in MongoDB.

    Args:
        french_regions_tsv: path to a TSV file containing the main
            information about régions from INSEE.
        prefix_tsv: path to a TSV file containing the prefix for each
            région.
    Returns:
        A list of dict that maps the JSON representation of Departement protos.
    """

    regions = cleaned_data.french_regions(
        filename=french_regions_tsv,
        prefix_filename=prefix_tsv)
    regions['_id'] = regions.index
    return typing.cast(List[Dict[str, Any]], regions[['_id', 'name', 'prefix']].to_dict('records'))


if __name__ == '__main__':
    mongo.importer_main(make_dicts, 'regions')
