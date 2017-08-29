"""Script to compute the geographical bounding boxes of French départements.

Note that these are only approximative bounds as it relies on the centers of
the cities within each département. However for most purposes this is precise
enough.
"""
import sys

import pandas as pd

from bob_emploi.lib import cleaned_data


def main(output_csv, filename=None, data_folder='data'):
    """Compute the geographical bounding boxes of French départements.

    Args:
        output_csv: the filename where to write the result.
        data_folder: the root folder of the data.
        filename: the exact filename of the French cities with their lat/lng.
    """
    cities = cleaned_data.french_city_stats(data_folder=data_folder, filename_city_stats=filename)
    bounding_boxes = cities.groupby('departement_id').apply(_compute_bounding_box)
    bounding_boxes.to_csv(output_csv)


def _compute_bounding_box(cities):
    return pd.Series({
        'min_latitude': cities.latitude.min(),
        'max_latitude': cities.latitude.max(),
        'min_longitude': cities.longitude.min(),
        'max_longitude': cities.longitude.max(),
    })


if __name__ == '__main__':
    main(*sys.argv[1:])
