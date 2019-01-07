"""Script to compute the geographical bounding boxes of French départements.

Note that these are only approximative bounds as it relies on simlified
geometries. However for most purposes this is precise enough.
"""

import csv
import json
from os import path
import sys


def main(output_csv, filename=None, data_folder='data'):
    """Compute the geographical bounding boxes of French départements.

    Args:
        output_csv: the filename where to write the result or a file object itself.
        data_folder: the root folder of the data.
        filename: the exact filename of the GeoJSON with the full geometries.
    """

    if not filename:
        filename = path.join(data_folder, 'geo/departements-avec-outre-mer.geojson')
    with open(filename) as file_handle:
        geo_json = json.load(file_handle)

    if hasattr(output_csv, 'write'):
        output_file = output_csv
    else:
        output_file = open(output_csv, 'w')

    writer = csv.DictWriter(
        output_file,
        ['departement_id', 'max_latitude', 'max_longitude', 'min_latitude', 'min_longitude'])
    writer.writeheader()
    for feature in geo_json.get('features'):
        writer.writerow(dict(
            _compute_bounding_box(feature['geometry']),
            departement_id=feature['properties']['code']))

    if output_csv != output_file:
        output_file.close()


def _compute_bounding_box(geometry):
    points_iterator = iter(_list_all_points(geometry))
    min_longitude, min_latitude = next(points_iterator)
    max_longitude, max_latitude = min_longitude, min_latitude
    for longitude, latitude in points_iterator:
        if longitude < min_longitude:
            min_longitude = longitude
        elif longitude > max_longitude:
            max_longitude = longitude

        if latitude < min_latitude:
            min_latitude = latitude
        elif latitude > max_latitude:
            max_latitude = latitude
    return {
        'max_latitude': max_latitude,
        'max_longitude': max_longitude,
        'min_latitude': min_latitude,
        'min_longitude': min_longitude,
    }


def _list_all_points(geometry):
    if geometry['type'] == 'Polygon':
        for ring in geometry['coordinates']:
            for point in ring:
                yield point
        return

    if geometry['type'] == 'MultiPolygon':
        for polygon in geometry['coordinates']:
            for ring in polygon:
                for point in ring:
                    yield point
        return

    raise NotImplementedError('Does not know how to handle type {}'.format(geometry['type']))


if __name__ == '__main__':
    main(*sys.argv[1:])  # pylint: disable=no-value-for-parameter
