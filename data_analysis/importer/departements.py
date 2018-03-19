"""Importer of French Département data in MongoDB."""

from bob_emploi.data_analysis.lib import cleaned_data
from bob_emploi.data_analysis.lib import mongo


def make_dicts(french_departements_tsv, french_oversea_departements_tsv, prefix_tsv):
    """Import départements info in MongoDB.

    Args:
        french_departements_tsv: path to a TSV file containing the main
            information about départements from INSEE.
        french_oversea_departements_tsv: path to a TSV file containing the
            information about oversea collectivities.
        prefix_tsv: path to a TSV file containing the prefix for each
            département.
    Returns:
        A list of dict that maps the JSON representation of Departement protos.
    """

    departements = cleaned_data.french_departements(
        filename=french_departements_tsv,
        oversea_filename=french_oversea_departements_tsv,
        prefix_filename=prefix_tsv)
    departements['_id'] = departements.index
    return departements[['_id', 'name', 'prefix']].to_dict('records')


if __name__ == '__main__':
    mongo.importer_main(make_dicts, 'departements')  # pragma: no cover
