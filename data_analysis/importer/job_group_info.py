"""Importer for general job groups info.

This script gathers information from ROME and other sources and uploads to
MongoDB some basic info about a job group.

You can try it out on a local instance:
 - Start your local environment with `docker-compose up frontend-dev`.
 - Run this script:
    docker-compose run --rm data-analysis-prepare \
        python bob_emploi/data_analysis/importer/job_group_info.py \
        --rome_csv_pattern data/rome/csv/unix_{}_v331_utf8.csv \
        --job_requirements_json data/job_offers/job_offers_requirements.json \
        --job_application_complexity_json data/job_application_complexity.json \
        --application_mode_csv data/imt/application_modes.csv \
        --handcrafted_assets_airtable appMRMtWV61Kibt37:advice:viwJ1OsSqK8YTSoIq \
        --domains_airtable appMRMtWV61Kibt37:domains
"""

import json
import os
import re
import typing
from typing import Any, Callable, Dict, Iterable, List, Mapping, Optional, Tuple

from airtable import airtable
import pandas
import pymongo

from bob_emploi.data_analysis.importer import airtable_to_protos
from bob_emploi.data_analysis.lib import cleaned_data
from bob_emploi.data_analysis.lib import mongo
from bob_emploi.data_analysis.lib import rome_genderization

_APPLICATION_MODE_PROTO_FIELDS = {
    'R1': 'PLACEMENT_AGENCY',
    'R2': 'PERSONAL_OR_PROFESSIONAL_CONTACTS',
    'R3': 'SPONTANEOUS_APPLICATION',
    'R4': 'OTHER_CHANNELS',
}
_JOB_PROTO_JSON_FIELDS = [
    'name', 'masculineName', 'feminineName', 'codeOgr']
AIRTABLE_API_KEY = os.getenv('AIRTABLE_API_KEY')
USERS_MONGO_URL = os.getenv('USERS_MONGO_URL')


def make_dicts(
        rome_csv_pattern: str,
        job_requirements_json: str,
        job_application_complexity_json: str,
        application_mode_csv: str,
        rome_fap_crosswalk_txt: str,
        handcrafted_assets_airtable: str,
        domains_airtable: str,
        strict_diplomas_airtable: str,
        info_by_prefix_airtable: str,
        fap_growth_2012_2022_csv: str,
        imt_market_score_csv: str,
        jobboards_airtable: Optional[str] = None,
        skills_for_future_airtable: Optional[str] = None,
        specific_to_job_airtable: Optional[str] = None) \
        -> List[Dict[str, Any]]:
    """Import job info in MongoDB.

    Args:
        rome_csv_pattern: pattern of paths to CSV file containing the ROME data.
            It must contain a '{}' that will be replaced by
            'referentiel_code_rome', 'referentiel_env_travail',
            'liens_rome_referentiels' and 'referentiel_appellation'.
        job_requirements_json: path to a JSON file containing requirements per
            job group.
        job_application_complexity_json: path to a JSON file containing the
            application complexity of each job group.
        application_mode_csv: path to a CSV file containing the application mode
            data from emploi-store-dev API.
        rome_fap_crosswalk_txt: path to a TXT file containing the crosswalk
            from FAP codes to ROME job group codes.
        handcrafted_assets_airtable: the base ID and the table named joined by
            a ':' of the AirTable containing the advice per job group (short
            texts describing assets required).
        domains_airtable: the base ID and the table name joined by a ':' of the
            AirTable containing the domain name for each sector.
        strict_diplomas_airtable: the base ID and the table name joined by a ':' of the
            AirTable which tells if a diploma is strictly required.
        info_by_prefix_airtable: the base ID and the table name joined by a ':'
            of the AirTable containing some manually specified info for group of
            job group (by ROME ID prefix).
        fap_growth_2012_2022_csv: path to a CSV file containing the growth of
            FAP job groups for the period 2012-2022.
        imt_market_score_csv: path to a CSV containing market score info from IMT.
        jobboards_airtable: the base ID and the table name joined by a ':' of the Airtable of the
            job boards.
        skills_for_future_airtable: the base ID and the table name joined by a ':' of the Airtable
            of the skills for the future.
        specific_to_job_airtable: the base ID and the table name joined by a ':' of the Airtable
            of the specific to job pieces advice.
    Returns:
        A list of dict that maps the JSON representation of JobGroup protos.
    """

    job_groups = cleaned_data.rome_job_groups(
        filename=rome_csv_pattern.format('referentiel_code_rome'))
    jobs = cleaned_data.rome_jobs(
        filename=rome_csv_pattern.format('referentiel_appellation'))
    holland_codes = cleaned_data.rome_holland_codes(
        filename=rome_csv_pattern.format('referentiel_code_rome_riasec'))
    rome_texts = cleaned_data.rome_texts(
        filename=rome_csv_pattern.format('texte'))
    rome_work_environments = cleaned_data.rome_work_environments(
        links_filename=rome_csv_pattern.format('liens_rome_referentiels'),
        ref_filename=rome_csv_pattern.format('referentiel_env_travail'))
    handcrafted_assets = _load_assets_from_airtable(*handcrafted_assets_airtable.split(':'))
    sector_domains = _load_domains_from_airtable(*domains_airtable.split(':'))
    info_by_prefix = _load_prefix_info_from_airtable(
        job_groups.index, *info_by_prefix_airtable.split(':'))
    application_modes = _get_application_modes(
        application_mode_csv, rome_fap_crosswalk_txt)
    fap_growth_2012_2022 = pandas.read_csv(fap_growth_2012_2022_csv)
    jobboards_by_rome = _load_items_from_airtable(
        'JobBoard', job_groups.index, jobboards_airtable, 'for-job-group')
    skills_for_future_by_rome = _load_items_from_airtable(
        'Skill', job_groups.index, skills_for_future_airtable, 'rome_prefixes')
    specific_to_job_by_rome = _load_items_from_airtable(
        'DynamicAdvice', job_groups.index, specific_to_job_airtable, 'for-job-group')
    users_highest_degrees = _load_highest_degrees_from_mongo()

    # Genderize names.
    masculine, feminine = rome_genderization.genderize(jobs.name)
    jobs['masculineName'] = masculine
    jobs['feminineName'] = feminine

    # List jobs and pick samples.
    jobs.index.name = 'codeOgr'
    jobs.reset_index(inplace=True)
    jobs_grouped = jobs.groupby('code_rome')
    job_groups['samples'] = jobs_grouped.apply(_create_jobs_sampler(3))
    job_groups['samples'] = job_groups.samples.apply(
        lambda s: s if isinstance(s, list) else [])
    job_groups['jobs'] = jobs_grouped.apply(_create_jobs_sampler(None))
    job_groups['jobs'] = job_groups.jobs.apply(
        lambda s: s if isinstance(s, list) else [])

    # Add info by prefix.
    job_groups = job_groups.join(info_by_prefix)

    # Combine requirements from json file.
    with open(job_requirements_json) as job_requirements_file:
        job_requirements_list = json.load(job_requirements_file)
        job_requirements_dict = {
            job_requirement.pop('_id'): job_requirement
            for job_requirement in job_requirements_list}
    job_groups['requirements'] = job_groups.index.map(job_requirements_dict)
    # Replace NaN by empty dicts.
    job_groups['requirements'] = job_groups.requirements.apply(
        lambda r: r if isinstance(r, dict) else {})

    # Combine requirements from AirTable.
    for job_group in job_groups.itertuples():
        job_group.requirements.update(handcrafted_assets.get(job_group.Index, {}))

    application_complexity = pandas.read_json(job_application_complexity_json)
    application_complexity.set_index('_id', inplace=True)
    job_groups['applicationComplexity'] = application_complexity['applicationComplexity']
    job_groups.applicationComplexity.fillna('UNKNOWN_APPLICATION_COMPLEXITY', inplace=True)

    # Add Hollande Code https://en.wikipedia.org/wiki/Holland_Codes.
    # Will later be used for job similarity measures.
    job_groups['hollandCodeMajor'] = holland_codes.major
    job_groups.hollandCodeMajor.fillna('', inplace=True)
    job_groups['hollandCodeMinor'] = holland_codes.minor
    job_groups.hollandCodeMinor.fillna('', inplace=True)

    # Add description, working environment and requirement as text.
    job_groups['description'] = rome_texts.definition
    job_groups.description.fillna('', inplace=True)
    job_groups['workingEnvironment'] = rome_texts.working_environment
    job_groups.workingEnvironment.fillna('', inplace=True)
    job_groups['requirementsText'] = rome_texts.requirements
    job_groups.requirementsText.fillna('', inplace=True)

    # Add work environment items.
    rome_work_environments['domain'] = rome_work_environments['name'].map(sector_domains)
    job_groups['workEnvironmentKeywords'] = \
        rome_work_environments.groupby('code_rome').apply(_group_work_environment_items)
    # Fill NaN with empty {}.
    job_groups['workEnvironmentKeywords'] = job_groups.workEnvironmentKeywords.apply(
        lambda k: k if isinstance(k, dict) else {})

    # Add application modes.
    job_groups['applicationModes'] = application_modes
    job_groups['applicationModes'] = job_groups.applicationModes.apply(
        lambda m: m if isinstance(m, dict) else {})

    # Add growth for the 2012-2022 period.
    job_groups['growth20122022'] = _get_growth_2012_2022(
        fap_growth_2012_2022, rome_fap_crosswalk_txt)
    job_groups.loc[job_groups.growth20122022 == 0, 'growth20122022'] = .000001
    job_groups['growth20122022'].fillna(0, inplace=True)

    # Add best departements.
    job_groups['departementScores'] = _get_less_stressful_departements_count(imt_market_score_csv)
    # Fill NaN with empty [].
    job_groups['departementScores'] = job_groups.departementScores.apply(
        lambda s: s if isinstance(s, list) else [])
    job_groups['bestDepartements'] = job_groups.departementScores.apply(lambda ds: ds[:11])

    # Add national market score.
    job_groups['nationalMarketScore'] = _get_national_market_scores(imt_market_score_csv)
    job_groups['nationalMarketScore'].fillna(0, inplace=True)

    # Add diploma requirements.
    job_groups['is_diploma_strictly_required'] = _load_strict_diplomas_from_airtable(
        *strict_diplomas_airtable.split(':'))
    job_groups['is_diploma_strictly_required'].fillna(False, inplace=True)

    # Add job_boards.
    if jobboards_by_rome:
        job_groups['jobBoards'] = job_groups.index.map(jobboards_by_rome)

    # Add skills for the future.
    if skills_for_future_by_rome:
        job_groups['skillsForFuture'] = job_groups.index.map(skills_for_future_by_rome)

    # Add specific to job advice.
    if specific_to_job_by_rome:
        job_groups['specificAdvice'] = job_groups.index.map(specific_to_job_by_rome)

    # Add highest degree counts from user base.
    if users_highest_degrees is not None:
        job_groups['userDegrees'] = users_highest_degrees
        # Fill NaN with empty [].
        job_groups['userDegrees'] = job_groups.userDegrees.apply(
            lambda d: d if isinstance(d, list) else [])

    # Set index as field.
    job_groups.index.name = 'romeId'
    job_groups.reset_index(inplace=True)
    job_groups['_id'] = job_groups['romeId']

    return typing.cast(List[Dict[str, Any]], job_groups.to_dict('records'))


# TODO(cyrille): Factorize with local_diagnosis.
def _get_less_stressful_departements_count(market_score_csv: str) -> pandas.DataFrame:
    market_stats = cleaned_data.market_scores(filename=market_score_csv)
    market_stats_dept = market_stats[market_stats.AREA_TYPE_CODE == 'D'].reset_index()

    def _zero_to_minus_one(val: int) -> int:
        return val if val else -1

    return market_stats_dept\
        .sort_values('market_score', ascending=False)\
        .groupby(['rome_id'])\
        .apply(lambda x: x.to_dict(orient='records'))\
        .apply(lambda departements: [{
            'departementId': d['departement_id'],
            'localStats': {'imt': {
                'yearlyAvgOffersPer10Candidates':
                _zero_to_minus_one(d['yearly_avg_offers_per_10_candidates']),
            }},
        } for d in departements])


def _get_national_market_scores(market_score_csv: str) -> pandas.Series:
    market_stats = cleaned_data.market_scores(filename=market_score_csv).reset_index()
    return market_stats[market_stats.AREA_TYPE_CODE == 'F'].set_index('rome_id')\
        .market_score


def _create_jobs_sampler(num_samples: Optional[int]) \
        -> Callable[[pandas.DataFrame], List[Dict[str, Any]]]:
    def _sampling(jobs: pandas.DataFrame) -> List[Dict[str, Any]]:
        if num_samples is not None and len(jobs) > num_samples:
            jobs = jobs.sample(n=num_samples)
        return typing.cast(List[Dict[str, Any]], jobs[_JOB_PROTO_JSON_FIELDS].to_dict('records'))
    return _sampling


def _group_work_environment_items(work_environments: pandas.DataFrame) -> Dict[str, List[str]]:
    """Combine work environment items as a dict.

    Returns:
        A dict compatible with the JSON version of the job_pb2.WorkEnvironment
        protobuf.
    """

    environment = {
        section_name.lower().replace('secteurs', 'sectors'): env.name.tolist()
        for section_name, env in work_environments.groupby('section')
    }

    # Add domains.
    if 'sectors' in environment:
        sectors = work_environments[work_environments.section.str.lower() == 'secteurs']
        if sectors.domain.isnull().sum():
            all_sectors = '"\n"'.join(sectors[sectors.domain.isnull()].name.tolist())
            raise ValueError(f'Some sectors are not in any domain:\n"{all_sectors}"')
        environment['domains'] = [
            {
                'name': domain_name,
                'sectors': env.name.tolist(),
            }
            for domain_name, env in sectors.groupby('domain')
        ]

    return environment


def _load_domains_from_airtable(base_id: str, table: str, view: Optional[str] = None) \
        -> Dict[str, str]:
    """Load domain data from AirTable.

    Args:
        base_id: the ID of your AirTable app.
        table: the name of the table to import.
    Returns:
        A map from sector names to domain names.
    """

    if not AIRTABLE_API_KEY:
        raise ValueError(
            'No API key found. Create an airtable API key at '
            'https://airtable.com/account and set it in the AIRTABLE_API_KEY '
            'env var.')
    client = airtable.Airtable(base_id, AIRTABLE_API_KEY)
    domains: Dict[str, str] = {}
    errors: List[ValueError] = []
    for record in client.iterate(table, view=view):
        fields = record['fields']
        sector = fields.get('name')
        if not sector:
            continue
        domain = fields.get('domain_name')
        if not domain:
            errors.append(ValueError(
                f'Sector "{sector}" on record "{record["id"]}" has no domain_name set.'))
            continue
        domains[sector] = domain
    if errors:
        raise ValueError(
            f'{len(errors):d} errors while importing from Airtable:\n' +
            '\n'.join(str(error) for error in errors))
    return domains


def _load_strict_diplomas_from_airtable(
        base_id: str, table: str, view: Optional[str] = None) -> pandas.Series:
    """Load strict requirement for diplomas data from AirTable.

    Args:
        base_id: the ID of your AirTable app.
        table: the name of the table to import.
    Returns:
        A series indexed on ROME code with boolean values.
    """

    if not AIRTABLE_API_KEY:
        raise ValueError(
            'No API key found. Create an airtable API key at '
            'https://airtable.com/account and set it in the AIRTABLE_API_KEY '
            'env var.')
    client = airtable.Airtable(base_id, AIRTABLE_API_KEY)
    diploma_required = {
        record['fields'].get('code_rome'): record['fields'].get(
            'is_diploma_strictly_required', False)
        for record in client.iterate(table, view=view)
    }
    return pandas.Series(diploma_required)


def _load_assets_from_airtable(base_id: str, table: str, view: Optional[str] = None) \
        -> Dict[str, Dict[str, str]]:
    """Load assets data from AirTable.

    Args:
        base_id: the ID of your AirTable app.
        table: the name of the table to import.
    """

    if not AIRTABLE_API_KEY:
        raise ValueError(
            'No API key found. Create an airtable API key at '
            'https://airtable.com/account and set it in the AIRTABLE_API_KEY '
            'env var.')
    client = airtable.Airtable(base_id, AIRTABLE_API_KEY)
    assets: List[Tuple[str, Dict[str, str]]] = []
    errors: List[ValueError] = []
    for record in client.iterate(table, view=view):
        try:
            assets.append(_load_asset_from_airtable(record['fields']))
        except ValueError as error:
            errors.append(error)
    if errors:
        raise ValueError(
            f'{len(errors):d} errors while importing from Airtable:\n' +
            '\n'.join(str(error) for error in errors))
    return dict(assets)


_AIRTABLE_ASSET_TO_PROTO_FIELD = {
    'skillsShortText': 'SKILLS',
    'bonusSkillsShortText': 'BONUS SKILLS',
    'trainingsShortText': 'TRAINING',
}

_MARKDOWN_LIST_LINE_REGEXP = re.compile(r'^\* [A-ZÀÉÇÊ]|^  \* ')


def _load_asset_from_airtable(airtable_fields: Dict[str, Any]) -> Tuple[str, Dict[str, str]]:
    assets: Dict[str, str] = {}
    errors: List[ValueError] = []
    for proto_name, airtable_name in _AIRTABLE_ASSET_TO_PROTO_FIELD.items():
        value = airtable_fields.get(airtable_name)
        if value:
            try:
                assets[proto_name] = _assert_markdown_list(value)
            except ValueError as error:
                errors.append(ValueError(
                    f'The field {airtable_name} is not formatted correctly: {error}'))
    if errors:
        raise ValueError(
            f'The job {airtable_fields.get("code_rome")} has {len(errors):d} errors:\n' +
            '\n'.join(str(error) for error in errors))
    return airtable_fields['code_rome'], assets


def _assert_markdown_list(value: str) -> str:
    lines = value.strip().split('\n')
    if not lines:
        return ''
    for line in lines:
        if not _MARKDOWN_LIST_LINE_REGEXP.match(line):
            raise ValueError(f'Each line should start with a * and an upper case, found: {line}')
    return '\n'.join(lines)


def _load_prefix_info_from_airtable(
        job_groups: Iterable[str], base_id: str, table: str, view: Optional[str] = None) \
        -> pandas.DataFrame:
    """Load info by prefix from AirTable.

    Args:
        job_groups: an iterable of job groups.
        base_id: the ID of your AirTable app.
        table: the name of the table to import.
    Returns:
        A pandas DataFrame keyed by job group with the fields.
    """

    if not AIRTABLE_API_KEY:
        raise ValueError(
            'No API key found. Create an airtable API key at '
            'https://airtable.com/account and set it in the AIRTABLE_API_KEY '
            'env var.')
    columns = {
        'hasFreelancers': False,
        'inAWorkplace': 'dans une entreprise',
        'inDomain': '',
        'likeYourWorkplace': 'comme la vôtre',
        'placePlural': 'des entreprises',
        'preferredApplicationMedium': 'UNKNOWN_APPLICATION_MEDIUM',
        'whatILoveAbout': '',
        'toTheWorkplace': "à l'entreprise",
        'whySpecificCompany': 'vous vous reconnaissez dans leurs valeurs',
        'atVariousCompanies': '',
        'whatILoveAboutFeminine': '',
    }
    info = pandas.DataFrame(index=job_groups, columns=columns.keys())

    client = airtable.Airtable(base_id, AIRTABLE_API_KEY)
    sorted_records = sorted(
        client.iterate(table, view=view),
        key=lambda record: str(record['fields'].get('rome_prefix')))
    for record in sorted_records:
        fields = record['fields']
        rome_prefix = fields.get('rome_prefix')
        if not rome_prefix:
            continue
        for column in columns:
            if column not in fields:
                continue
            field_value = fields[column]
            if isinstance(field_value, str):
                info.loc[info.index.str.startswith(rome_prefix), column] = field_value.strip()
            else:
                info.loc[info.index.str.startswith(rome_prefix), column] = field_value

    for column, default_value in columns.items():
        info[column].fillna(default_value, inplace=True)

    return info


def _load_items_from_airtable(
        proto_name: str, job_groups: Iterable[str],
        airtable_connection: Optional[str], rome_prefix_field: str) \
        -> Optional[Mapping[str, List[Dict[str, Any]]]]:
    if not airtable_connection:
        return None
    parts = airtable_connection.split(':')
    if len(parts) <= 2:
        base_id, table = parts
        view = None
    else:
        base_id, table, view = parts
    items: Dict[str, List[Dict[str, Any]]] = {job_group: [] for job_group in job_groups}
    converter = airtable_to_protos.PROTO_CLASSES[proto_name]
    client = airtable.Airtable(base_id, AIRTABLE_API_KEY)
    for record in client.iterate(table, view=view):
        item = converter.convert_record(record)
        del item['_id']
        job_group_prefixes = record['fields'].get(rome_prefix_field, '')
        for job_group_prefix in job_group_prefixes.split(','):
            job_group_prefix = job_group_prefix.strip()
            if not job_group_prefix:
                continue
            for job_group, items_for_group in items.items():
                if job_group.startswith(job_group_prefix):
                    items_for_group.append(item)
    return items


def _get_application_modes(application_mode_csv: str, rome_fap_crosswalk_txt: str) \
        -> pandas.DataFrame:
    modes = pandas.read_csv(application_mode_csv)
    rome_fap_mapping = cleaned_data.rome_fap_mapping(
        filename=rome_fap_crosswalk_txt)

    app_modes_map = modes.sort_values('RECRUT_PERCENT', ascending=False).\
        groupby('FAP_CODE').apply(_get_app_modes_perc)
    application_modes = rome_fap_mapping.fap_codes.apply(
        lambda faps: {fap: app_modes_map[fap] for fap in faps if fap in app_modes_map})
    return application_modes


def _get_app_modes_perc(fap_modes: pandas.DataFrame) -> Dict[str, Any]:
    return {
        'modes': [
            {'mode': _APPLICATION_MODE_PROTO_FIELDS[row.APPLICATION_TYPE_CODE],
             'percentage': row.RECRUT_PERCENT}
            for row in fap_modes.itertuples()]}


def _get_growth_2012_2022(fap_growth: pandas.DataFrame, rome_fap_crosswalk_txt: str) \
        -> pandas.DataFrame:
    fap_growth['num_jobs_2012'] = fap_growth.num_jobs_2022 - fap_growth.num_job_creations_2012_2022
    fap_growth['growth_2012_2022'] = \
        fap_growth.num_job_creations_2012_2022.div(fap_growth.num_jobs_2012)
    rome_fap_mapping = cleaned_data.rome_fap_mapping(
        filename=rome_fap_crosswalk_txt)
    rome_fap_flat_mapping = pandas.melt(
        rome_fap_mapping.fap_codes.apply(lambda s: pandas.Series(list(s))).reset_index(),
        id_vars=['index']).set_index('index').value.dropna().to_frame('fap_qualified_code')
    rome_fap_flat_mapping['fap_code'] = rome_fap_flat_mapping.fap_qualified_code.str[:3]
    multi_fap_groups = {
        'D0Z-D3Z': {'D0Z', 'D3Z'},
        'F0Z-F1Z': {'F0Z', 'F1Z'},
        'F2Z-F3Z': {'F2Z', 'F3Z'},
    }
    for fap_codes, fap_codes_as_set in multi_fap_groups.items():
        rome_fap_flat_mapping.loc[
            rome_fap_flat_mapping.fap_code.isin(fap_codes_as_set), 'fap_code'] = fap_codes
    rome_fap_flat_mapping.drop(
        rome_fap_flat_mapping[rome_fap_flat_mapping.fap_code == 'K0Z'].index, inplace=True)
    rome_fap_flat_mapping['growth_2012_2022'] = \
        rome_fap_flat_mapping.fap_code.map(fap_growth.set_index('fap_codes').growth_2012_2022)
    rome_fap_flat_mapping['num_jobs_2012'] = \
        rome_fap_flat_mapping.fap_code.map(fap_growth.set_index('fap_codes').num_jobs_2012)

    return rome_fap_flat_mapping.groupby(level=0).apply(
        lambda faps: 0 if faps.num_jobs_2012.sum() == 0 else
        faps.growth_2012_2022.mul(faps.num_jobs_2012).sum() / faps.num_jobs_2012.sum())


def _load_highest_degrees_from_mongo() -> pandas.Series:
    if not USERS_MONGO_URL:
        return None
    client = pymongo.MongoClient(USERS_MONGO_URL).get_database()
    all_users = client.user.aggregate([
        {'$unwind': '$projects'},
        {'$match': {'projects.isIncomplete': {'$ne': True}}},
        {'$group': {
            '_id': {
                'romeId': '$projects.targetJob.jobGroup.romeId',
                'degree': '$profile.highestDegree',
            },
            'count': {'$sum': 1},
        }},
        {'$project': {
            'romeId': '$_id.romeId',
            'degreeCount': {'degree': '$_id.degree', 'count': '$count'},
        }},
        {'$group': {
            '_id': '$romeId',
            'degrees': {'$push': '$degreeCount'},
        }},
    ])
    return pandas.Series({r['_id']: r['degrees'] for r in all_users})


if __name__ == '__main__':
    mongo.importer_main(make_dicts, 'job_group_info')
