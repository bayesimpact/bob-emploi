"""Module to upload the French city locations to MongoDB."""

import pandas

from bob_emploi.frontend.api import geo_pb2
from bob_emploi.data_analysis.lib import cleaned_data
from bob_emploi.data_analysis.lib import mongo


def csv2dicts(stats_filename, urban_context_filename):
    """Prepare cities for upload to MongoDB.

    Args:
        stats_filename: path to a file containing stats about cities.
        urban_context_filename: path to a file containing urban context
        info for each cities.

    Returns:
        A list of dict JSON-like object compatible with the geo_pb2.FrenchCity
        proto.
    """

    city_stats = pandas.read_csv(
        stats_filename,
        sep=',', header=None, usecols=[10, 19, 20],
        names=['_id', 'longitude', 'latitude'],
        dtype={'_id': str, 'latitude': float, 'longitude': float})
    city_stats.dropna()
    urban_contexts = cleaned_data.french_urban_areas(filename=urban_context_filename)
    city_stats['urbanContext'] = city_stats['_id'].map(urban_contexts.periurban)\
        .fillna(geo_pb2.UNKNOWN_URBAN_CONTEXT).astype(int)
    return city_stats.to_dict(orient='records')


if __name__ == '__main__':
    mongo.importer_main(csv2dicts, 'cities')
