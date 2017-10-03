"""Importer for general job groups info.

This script gathers information from ROME and other sources and uploads to
MongoDB some basic info about a job group.

You can try it out on a local instance:
 - Start your local environment with `docker-compose up frontend-dev`.
 - Run this script:
    docker-compose run -e AIRTABLE_API_KEY=$AIRTABLE_API_KEY \
        --rm data-analysis-prepare \
        python bob_emploi/importer/job_group_info.py \
        --rome_csv_pattern data/rome/csv/unix_{}_v331_utf8.csv \
        --job_requirements_json data/job_offers/job_offers_requirements.json \
        --job_application_complexity_json data/job_application_complexity.json \
        --application_mode_csv data/imt/application_modes.csv \
        --handcrafted_assets_airtable appMRMtWV61Kibt37:advice:viwJ1OsSqK8YTSoIq \
        --domains_airtable appMRMtWV61Kibt37:domains \
        --mongo_url mongodb://frontend-db/test
"""
import json
import os
import re

from airtable import airtable
import pandas

from bob_emploi.lib import cleaned_data
from bob_emploi.lib import mongo
from bob_emploi.lib import rome_genderization

_APPLICATION_MODE_PROTO_FIELDS = {
    'R1': 'PLACEMENT_AGENCY',
    'R2': 'PERSONAL_OR_PROFESSIONAL_CONTACTS',
    'R3': 'SPONTANEOUS_APPLICATION',
    'R4': 'UNDEFINED_APPLICATION_MODE',
}
_JOB_PROTO_JSON_FIELDS = [
    'name', 'masculineName', 'feminineName', 'codeOgr']
AIRTABLE_API_KEY = os.getenv('AIRTABLE_API_KEY')


def make_dicts(
        rome_csv_pattern,
        job_requirements_json,
        job_application_complexity_json,
        application_mode_csv,
        rome_fap_crosswalk_txt,
        handcrafted_assets_airtable,
        domains_airtable,
        info_by_prefix_airtable):
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
        info_by_prefix_airtable: the base ID and the table name joined by a ':'
            of the AirTable containing some manually specified info for group of
            job group (by ROME ID prefix).
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

    # Add skills.
    rome_to_skills = cleaned_data.rome_to_skills(
        filename_items=rome_csv_pattern.format('coherence_item'),
        filename_skills=rome_csv_pattern.format('referentiel_competence'))
    skills_grouped = rome_to_skills.groupby('code_rome')
    job_groups['requirements'] = skills_grouped.apply(
        _group_skills_as_proto_list)
    # Replace NaN by empty dicts.
    job_groups['requirements'] = job_groups.requirements.apply(
        lambda r: r if isinstance(r, dict) else {})

    # Combine requirements from json file.
    with open(job_requirements_json) as job_requirements_file:
        job_requirements_list = json.load(job_requirements_file)
        job_requirements_dict = {
            job_requirement.pop('_id'): job_requirement
            for job_requirement in job_requirements_list}
    for job_group in job_groups.itertuples():
        job_group.requirements.update(
            job_requirements_dict.get(job_group.Index, {}))

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

    # Set index as field.
    job_groups.index.name = 'romeId'
    job_groups.reset_index(inplace=True)
    job_groups['_id'] = job_groups['romeId']

    return job_groups.to_dict('records')


def _create_jobs_sampler(num_samples):
    def _sampling(jobs):
        if num_samples is not None and len(jobs) > num_samples:
            jobs = jobs.sample(n=num_samples)
        return jobs[_JOB_PROTO_JSON_FIELDS].to_dict('records')
    return _sampling


def _group_skills_as_proto_list(skills):
    """Combine a dataframe of skills as a JSON-proto list."""
    return {'skills': [
        {'name': skill.skill_name,
         'skill': {
             'skillId': skill.code_ogr,
             'kind': (
                 'PRACTICAL_SKILL' if skill.skill_is_practical
                 else 'THEORETICAL_SKILL')}}
        for skill in skills.itertuples()]}


def _group_work_environment_items(work_environments):
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
            raise ValueError(
                'Some sectors are not in any domain:\n"{}"'
                .format('"\n"'.join(sectors[sectors.domain.isnull()].name.tolist())))
        environment['domains'] = [
            {
                'name': domain_name,
                'sectors': env.name.tolist(),
            }
            for domain_name, env in sectors.groupby('domain')
        ]

    return environment


def _load_domains_from_airtable(base_id, table, view=None):
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
    domains = {}
    errors = []
    for record in client.iterate(table, view=view):
        fields = record['fields']
        sector = fields.get('name')
        if not sector:
            continue
        domain = fields.get('domain_name')
        if not domain:
            errors.append(ValueError(
                'Sector "{}" on record "{}" has no domain_name set.'
                .format(sector, record['id'])))
            continue
        domains[sector] = domain
    if errors:
        raise ValueError('{:d} errors while importing from Airtable:\n{}'.format(
            len(errors), '\n'.join(str(error) for error in errors)))
    return domains


def _load_assets_from_airtable(base_id, table, view=None):
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
    assets = []
    errors = []
    for record in client.iterate(table, view=view):
        try:
            assets.append(_load_asset_from_airtable(record['fields']))
        except ValueError as error:
            errors.append(error)
    if errors:
        raise ValueError('{:d} errors while importing from Airtable:\n{}'.format(
            len(errors), '\n'.join(str(error) for error in errors)))
    return dict(assets)


_AIRTABLE_ASSET_TO_PROTO_FIELD = {
    'skillsShortText': 'SKILLS',
    'bonusSkillsShortText': 'BONUS SKILLS',
    'trainingsShortText': 'TRAINING',
}

_MARKDOWN_LIST_LINE_REGEXP = re.compile(r'^\* [A-ZÀÉÇÊ]|^  \* ')


def _load_asset_from_airtable(airtable_fields):
    assets = {}
    errors = []
    for proto_name, airtable_name in _AIRTABLE_ASSET_TO_PROTO_FIELD.items():
        value = airtable_fields.get(airtable_name)
        if value:
            try:
                assets[proto_name] = _assert_markdown_list(value)
            except ValueError as error:
                errors.append(ValueError(
                    'The field {} is not formatted correctly: {}'.format(airtable_name, error)))
    if errors:
        raise ValueError('The job {} has {:d}, errors:\n{}'.format(
            airtable_fields.get('code_rome'), len(errors),
            '\n'.join(str(error) for error in errors)))
    return airtable_fields['code_rome'], assets


def _assert_markdown_list(value):
    lines = value.strip().split('\n')
    if not lines:
        return ''
    for line in lines:
        if not _MARKDOWN_LIST_LINE_REGEXP.match(line):
            raise ValueError(
                'Each line should start with a * and an upper case, found: {}'.format(line))
    return '\n'.join(lines)


def _load_prefix_info_from_airtable(job_groups, base_id, table, view=None):
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
    columns = ['inDomain']
    info = pandas.DataFrame(index=job_groups, columns=columns)

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
            info.loc[info.index.str.startswith(rome_prefix), column] = fields[column]

    return info.fillna('')


def _get_application_modes(application_mode_csv, rome_fap_crosswalk_txt):
    modes = pandas.read_csv(application_mode_csv)
    rome_fap_mapping = cleaned_data.rome_fap_mapping(
        filename=rome_fap_crosswalk_txt)

    app_modes_map = modes.sort_values('RECRUT_PERCENT', ascending=False).\
        groupby('FAP_CODE').apply(_get_app_modes_perc)
    application_modes = rome_fap_mapping.fap_codes.apply(
        lambda faps: {fap: app_modes_map[fap] for fap in faps if fap in app_modes_map})
    return application_modes


def _get_app_modes_perc(fap_modes):
    return {
        'modes': [
            {'mode': _APPLICATION_MODE_PROTO_FIELDS[row.APPLICATION_TYPE_CODE],
             'percentage': row.RECRUT_PERCENT}
            for row in fap_modes.itertuples()]}


if __name__ == '__main__':
    mongo.importer_main(make_dicts, 'job_group_info')  # pragma: no cover
