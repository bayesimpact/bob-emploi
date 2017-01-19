"""Module to upload the French city locations to MongoDB."""
import pandas

from bob_emploi.lib import mongo


def csv2dicts(stats_filename):
    """Prepare cities for upload to MongoDB.

    Args:
        stats_filename: path to a file containing stats about cities.

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
    return city_stats.to_dict(orient='records')


if __name__ == '__main__':
    mongo.importer_main(csv2dicts, 'cities')  # pragma: no-cover
