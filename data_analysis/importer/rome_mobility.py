"""Importer for ROME mobility data as JobsExploration to MongoDB.

It uses 3 ROME tables as input:
    - the list of ROME job groups with their ROME codes and names,
    - the list of ROME jobs with their OGR codes and names,
    - the mobility table: a list of pointers from one job (or group) to
      another using only their code (ROME code and OGR code).

The output (in Mongo) is a Plans protobuffer for each ROME job group containing
a list of job groups and jobs that it are linked to with both codes and names.

You can try it out on a local instance:
 - Start your local environment with `docker-compose up plan-comparator-dev`.
 - Run this script:
    docker-compose run --rm data-analysis-prepare \
        python bob_emploi/data_analysis/importer/rome_mobility.py \
        --rome_csv_pattern data/rome/csv/unix_{}_v331_utf8.csv \
        --mongo_url mongodb://frontend-db/test
"""

import locale

import pandas

from bob_emploi.frontend.api import discovery_pb2
from bob_emploi.data_analysis.lib import cleaned_data
from bob_emploi.data_analysis.lib import mongo
from bob_emploi.data_analysis.lib import rome_genderization

locale.setlocale(locale.LC_TIME, 'fr_FR.utf8')

# Mobility type between source and target jobs.
MOBILITY_TYPES = {'1': discovery_pb2.CLOSE, '2': discovery_pb2.EVOLUTION}


def csv2dicts(rome_csv_pattern):
    """Import the ROME mobility data in MongoDB.

    We group the mobility data as JobGroups (we find a set of similar jobs
    either for a specific job or for a job group).

    To get all mobility data for a given job, you have to to look both for the
    data for this job (keyed by OGR code) and for the data for its job group
    (keyed by ROME code). As OGR code and ROME code use different namespaces
    there's no conflict to use it directly with its key.

    Args:
        rome_csv_pattern: pattern of paths to CSV files containing the ROME
            data. It must contain a '{}' that will be replaced by
            'referentiel_code_rome', 'rubrique_mobilite' and
            'referentiel_appellation'.
    """

    mobility = pandas.read_csv(
        rome_csv_pattern.format('rubrique_mobilite'), dtype=str)
    job_groups = cleaned_data.rome_job_groups(
        filename=rome_csv_pattern.format('referentiel_code_rome'))

    jobs = cleaned_data.rome_jobs(
        filename=rome_csv_pattern.format('referentiel_appellation'))
    jobs.index.name = 'codeOgr'
    masculine_job_names, feminine_job_names = (
        rome_genderization.genderize(jobs.name))
    jobs['masculineName'] = masculine_job_names
    jobs['feminineName'] = feminine_job_names
    jobs_names = jobs.name
    jobs.reset_index(inplace=True)
    jobs_samples = jobs.groupby('code_rome').apply(_sample_jobs(3))

    mobility.rename(columns={
        'code_rome': 'source_job_group',
        'code_appellation_source': 'source_job',
        'code_rome_cible': 'target_job_group',
        'code_appellation_cible': 'target_job',
        'code_type_mobilite': 'mobility_type',
        }, inplace=True)

    mobility['target_job_group_name'] = (
        mobility.target_job_group.map(job_groups.name))
    mobility.target_job_group_name.fillna('', inplace=True)
    mobility['target_job_group_samples'] = (
        mobility.target_job_group.map(jobs_samples).fillna(False))
    mobility['target_job_name'] = mobility.target_job.map(jobs_names)
    mobility.target_job_name.fillna('', inplace=True)
    mobility['target_job_masculine_name'] = mobility.target_job.map(
        masculine_job_names)
    mobility.target_job_masculine_name.fillna('', inplace=True)
    mobility['target_job_feminine_name'] = mobility.target_job.map(
        feminine_job_names)
    mobility.target_job_feminine_name.fillna('', inplace=True)

    return dataframe2dicts(mobility)


def dataframe2dicts(mobility):
    """Convert a pandas DataFrame with the ROME mobility data to MongoDB dicts.

    We group the mobility data as JobGroups (we find a set of similar jobs
    either for a specific job or for a job group).

    To get all mobility data for a given job, you have to look both for the
    data for this job (keyed by OGR code) and for the data for its job group
    (keyed by ROME code). As OGR code and ROME code use different namespaces
    there's no conflict to use it directly with its key.
    """

    mobility['source'] = mobility.source_job.where(
        mobility.source_job.notnull(), other=mobility.source_job_group)

    return mobility.groupby('source').apply(_mobility_to_groups).tolist()


def _mobility_to_groups(mobility):
    _id = mobility.source.iloc[0]
    groups = []

    # Get mobility targeting job groups and pick some sample jobs in there.
    job_groups = mobility[mobility.target_job.isnull()].to_dict('records')
    for group in job_groups:
        samples = group['target_job_group_samples']
        groups.append({
            'jobGroup': {
                'romeId': group['target_job_group'],
                'name': group['target_job_group_name'],
                'samples': samples if samples else []},
            'mobility_type': MOBILITY_TYPES.get(
                group['mobility_type'][0], discovery_pb2.UNKNOWN_MOBILITY_TYPE),
        })

    # Get mobility targeting jobs and group them as job groups.
    jobs = mobility[mobility.target_job.notnull()]
    if not jobs.empty:
        groups.extend(jobs.groupby('target_job_group').apply(
            _group_jobs_as_samples).tolist())

    return {'_id': _id, 'jobGroups': groups}


def _group_jobs_as_samples(jobs):
    samples = jobs[[
        'target_job', 'target_job_name', 'target_job_masculine_name',
        'target_job_feminine_name']]
    samples.rename(columns={
        'target_job': 'codeOgr',
        'target_job_name': 'name',
        'target_job_masculine_name': 'masculineName',
        'target_job_feminine_name': 'feminineName',
    }, inplace=True)

    return {'jobGroup': {
        'romeId': jobs.target_job_group.iloc[0],
        'name': jobs.target_job_group_name.iloc[0],
        'samples': samples.to_dict('records'),
    }}


def _sample_jobs(num_samples):
    def _sampling(jobs):
        if len(jobs.index) > num_samples:
            jobs = jobs.sample(n=num_samples)
        jobs = jobs[['codeOgr', 'name', 'masculineName', 'feminineName']]
        return jobs.to_dict('records')
    return _sampling


if __name__ == '__main__':
    mongo.importer_main(csv2dicts, 'similar_jobs')
