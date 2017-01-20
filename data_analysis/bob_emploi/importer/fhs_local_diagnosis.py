# encoding: utf-8
"""Import FHS stats as local diagnosis on MongoDB.

You can try it out on a local instance:
 - Start your local environment with `docker-compose up plan-comparator-dev`.
 - Run this script:
    docker-compose run --rm data-analysis-prepare \
        python bob_emploi/importer/fhs_local_diagnosis.py \
        --durations_csv data/fhs_category_a_duration_motann.csv \
        --mongo_url mongodb://plan-comparator-db/test
"""
import locale
import pandas

from bob_emploi.lib import cleaned_data
from bob_emploi.lib import mongo

locale.setlocale(locale.LC_ALL, 'fr_FR.UTF-8')
# Minimum (inclusive) number of job seekers required to use the data.
_MINIMUM_GROUP_SIZE = 10


def fhs2dicts(durations_csv, data_folder='data'):
    """Import stats from FHS as local diagnosis.

    Args:
        durations_csv: path to a CSV file containing one line for each job
        seeker, some of their properties and the duration of their last
        category A unemployment period. See the full doc in the
        `fhs_category_a_duration.py` script.

    Returns:
        A list of dict compatible with the JSON version of
        job_pb2.LocalJobStats with an additional unique "_id" field.
    """
    durations = _local_durations(data_folder, durations_csv)[[
        'duration', 'city_id', 'city_name', 'departement_id', 'region_id']]
    local_job_stats = []
    for diagnosed_plan in durations.itertuples():
        index, duration, city_id, city_name, departement_id, region_id = (
            diagnosed_plan)
        local_job_stats.append({
            '_id': index,
            'bestCity': {
                'cityId': city_id,
                'name': city_name or '',
                'departementId': departement_id or '',
                'regionId': region_id or '',
            },
            'unemploymentDuration': duration,
        })
    return local_job_stats


def _local_durations(data_folder, durations_csv):
    # See http://go/pe:notebooks/datasets/FHS_category_A_duration.ipynb
    job_seekers = pandas.read_csv(durations_csv, dtype={'city_id': str})

    _augment_cities(data_folder, job_seekers, 'city_id')

    city_diagnoses = _city_durations(job_seekers)
    # Score diagnoses: shorter duration of unemployment is better.
    city_diagnoses['score'] = -city_diagnoses.duration.apply(
        lambda d: d['days'])

    area_diagnoses = city_diagnoses.sort_values('score', ascending=False)

    return pandas.concat([
        city_diagnoses,
        # Best city diagnoses per département.
        _find_best_cities(area_diagnoses, 'departement_id', 'd'),
        # Best city diagnoses per région.
        _find_best_cities(area_diagnoses, 'region_id', 'r'),
        # Best city diagnoses country wide.
        area_diagnoses.groupby('code_rome', group_keys=False).first(),
    ])


def _augment_cities(data_folder, job_seekers, city_field):
    """Augment the job seekers data frame with cities info.

    It fixes old city ID to their current ID. It also adds the fields
    "departement_id", "region_id" and "city_name".

    Args:
        job_seekers: the job seekers data frame.
        city_field: the field containing the city ID.
    """
    french_cities = cleaned_data.french_cities(data_folder, unique=True)

    actual_cities = job_seekers[city_field].map(french_cities.current_city_id)
    actual_cities.dropna(inplace=True)
    job_seekers.loc[actual_cities.index, city_field] = actual_cities
    job_seekers['departement_id'] = job_seekers[city_field].map(
        french_cities.departement_id)
    job_seekers['region_id'] = job_seekers[city_field].map(
        french_cities.region_id)
    job_seekers['city_name'] = job_seekers[city_field].map(french_cities.name)


def _find_best_cities(area_diagnoses, grouping_field, id_prefix):
    groups = area_diagnoses[area_diagnoses[grouping_field].notnull()].groupby(
        [grouping_field, 'code_rome'], sort=False, group_keys=False)
    best_cities = groups.first().reset_index()
    best_cities.index = (
        id_prefix + best_cities[grouping_field] + ':' + best_cities.code_rome)
    return best_cities


def _city_durations(job_seekers):
    # Assign ghost town IDs at the département level.
    groups = job_seekers.groupby(
        ['city_id', 'code_rome'], sort=False, group_keys=False)
    ghosts = groups.filter(lambda d: len(d) < _MINIMUM_GROUP_SIZE)
    job_seekers.loc[ghosts.index, 'city_id'] = (
        'ghost-d' + ghosts['departement_id'])
    job_seekers.loc[ghosts.index, 'city_name'] = ''

    # Assign ghost town IDs at the région level.
    groups = job_seekers.loc[ghosts.index].groupby(
        ['city_id', 'code_rome'], sort=False, group_keys=False)
    ghosts = groups.filter(lambda d: len(d) < _MINIMUM_GROUP_SIZE)
    job_seekers.loc[ghosts.index, 'city_id'] = 'ghost-r' + ghosts['region_id']
    job_seekers.loc[ghosts.index, 'city_name'] = ''

    # Assign ghost town IDs at the country level.
    groups = job_seekers.loc[ghosts.index].groupby(
        ['city_id', 'code_rome'], sort=False, group_keys=False)
    ghosts = groups.filter(lambda d: len(d) < _MINIMUM_GROUP_SIZE)
    job_seekers.loc[ghosts.index, 'city_id'] = 'ghost'
    job_seekers.loc[ghosts.index, 'city_name'] = ''

    # Compute diagnoses across real and ghost cities.
    groups = job_seekers.groupby(
        ['city_id', 'code_rome'], sort=False, group_keys=False)
    city_diagnoses = groups.apply(_duration_diagnosis)
    return city_diagnoses


def _duration_diagnosis(job_seekers):
    """Compute the diagnosis from a group of actual job seekers.

    This function might be surprising as it returns a DataFrame with only one
    row: this is because it is meant to be called in a GroupBy.apply method
    that will call this function repeatedly with different group of job seekers
    and aggregate the output in one big DataFrame.

    Args:
        job_seekers: a DataFrame of job seekers that share the same job group
            and some kind of locality.
    Returns:
        A DataFrame with the following columns:
            - code_rome: the ID of the job group
            - duration: the unemployment duration estimation
            - departement_id: the ID of the département or None if the group
              covers multiple départements.
            - region_id: the ID of the région or None if the group covers
              multiple régions.
        The DataFrame has only one row indexed with <city_id>:<code_rome>.
    """
    if len(job_seekers) < _MINIMUM_GROUP_SIZE:
        return None
    estimation = {
        'days': int(job_seekers.duration.median()),
    }
    departement_ids = job_seekers.departement_id.unique()
    region_ids = job_seekers.region_id.unique()
    code_rome = job_seekers.iloc[0]['code_rome']
    group_index = job_seekers.iloc[0]['city_id'] + ':' + code_rome
    return pandas.DataFrame({
        'city_id': [job_seekers.iloc[0]['city_id']],
        'city_name': [job_seekers.iloc[0]['city_name']],
        'code_rome': [code_rome],
        'duration': [estimation],
        'departement_id': [
            departement_ids[0] if len(departement_ids) == 1 else None],
        'region_id': [region_ids[0] if len(region_ids) == 1 else None],
    }, index=[group_index])


if __name__ == "__main__":
    mongo.importer_main(fhs2dicts, 'fhs_local_diagnosis')  # pragma: no cover
