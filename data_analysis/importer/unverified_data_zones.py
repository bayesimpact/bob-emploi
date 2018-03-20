"""Importer for the unverified data zones.

You can try it out on a local instance:
 - Start your local environment with `docker-compose up frontend-dev`.
 - Run this script:
    docker-compose run --rm data-analysis-prepare \
        python bob_emploi/importer/unverified_data_zones.py \
        --data_folder data \
        --mongo_url mongodb://frontend-db/test
"""

from os import path
import hashlib

import pandas

from bob_emploi.data_analysis.lib import cleaned_data
from bob_emploi.data_analysis.lib import mongo


def csv2dicts(data_folder):
    """Import the list of unverified data zones into our DB.

    Args:
        data_folder: path to the folder containing the folder with data zone files.
    """

    unverified_data_zones = get_data_zones(data_folder)
    result = []
    for entry in unverified_data_zones.itertuples():
        key_string = entry.postcodes + ':' + entry.rome_id
        key = hashlib.md5(key_string.encode('utf-8')).hexdigest()
        result.append({
            '_id': key,
            'postcodes': entry.postcodes,
            'romeId': entry.rome_id,
        })
    return result


def get_data_zones(data_folder='data'):
    """Read the data zone files and massage them in the right format.

    More info can be found in notebooks/research/evaluation/unverified_data_zones.ipynb
    """

    file1_path = path.join(data_folder, 'unverified_data_zones/assign_mm_ale0.csv')
    file2_path = path.join(data_folder, 'unverified_data_zones/assign_mm_aleNOT0.csv')
    file3_path = path.join(data_folder, 'unverified_data_zones/Code_Postaux_Bloques.csv')

    file1 = pandas.read_csv(file1_path)
    file1 = file1[['rome', 'codepostal']]
    file1.columns = ['rome_id', 'postcode']

    file2 = pandas.read_csv(file2_path)
    file2 = file2[['rome', 'codepostal']]
    file2.columns = ['rome_id', 'postcode']

    data_zones = pandas.concat([file1, file2])

    file3 = pandas.read_csv(file3_path)
    file3.columns = ['postcodes', 'postcode']

    city_stats = cleaned_data.french_city_stats(data_folder)
    city_stats = city_stats[~city_stats.city_id.isin(['13055', '75056', '69123'])]
    postcode_to_range_mapping = {}
    for zip_codes in city_stats.zipCode:
        for zip_code in zip_codes.split('-'):
            postcode_to_range_mapping[zip_code] = zip_codes

    job_groups = cleaned_data.rome_job_groups(data_folder)
    rome_ids = job_groups.reset_index()
    rome_ids['merge_id'] = 1
    rome_ids = rome_ids[['code_rome', 'merge_id']]
    rome_ids.columns = ['rome_id', 'merge_id']
    file3['merge_id'] = 1
    outer_product = pandas.merge(file3, rome_ids, how='outer', on=['merge_id'])

    massaged_file3 = outer_product[['rome_id', 'postcode']]
    data_zones = pandas.concat([data_zones, massaged_file3])

    padded_postcodes = data_zones.postcode.astype(str).str.pad(5, 'left', '0')
    data_zones['postcodes'] = padded_postcodes.map(postcode_to_range_mapping)
    data_zones.drop_duplicates(['rome_id', 'postcodes'], inplace=True)
    return data_zones


if __name__ == '__main__':
    mongo.importer_main(csv2dicts, 'unverified_data_zones')  # pragma: no cover
