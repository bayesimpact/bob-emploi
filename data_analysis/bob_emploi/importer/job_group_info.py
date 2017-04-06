"""Importer for general job groups info.

This script gathers information from ROME and other sources and uploads to
MongoDB some basic info about a job group.

You can try it out on a local instance:
 - Start your local environment with `docker-compose up frontend-dev`.
 - Run this script:
    docker-compose run -e AIRTABLE_API_KEY=$AIRTABLE_API_KEY \
        --rm data-analysis-prepare \
        python bob_emploi/importer/job_group_info.py \
        --rome_csv_pattern data/rome/csv/unix_%s_v331_utf8.csv \
        --job_requirements_json data/job_offers/job_offers_requirements.json \
        --job_application_complexity_json data/job_application_complexity.json \
        --handcrafted_assets_airtable appMRMtWV61Kibt37:advice:viwJ1OsSqK8YTSoIq \
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

_JOB_PROTO_JSON_FIELDS = [
    'name', 'masculineName', 'feminineName', 'codeOgr']
AIRTABLE_API_KEY = os.getenv('AIRTABLE_API_KEY')


def make_dicts(
        rome_csv_pattern,
        job_requirements_json,
        job_application_complexity_json,
        handcrafted_assets_airtable):
    """Import job info in MongoDB.

    Args:
        rome_csv_pattern: pattern of paths to CSV file containing the ROME data.
            It must contain a '%s' that will be replaced by
            'referentiel_code_rome', 'referentiel_env_travail',
            'liens_rome_referentiels' and 'referentiel_appellation'.
        job_requirements_json: path to a JSON file containing requirements per
            job group.
        job_application_complexity_json: path to a JSON file containing the
            application complexity of each job group.
        handcrafted_assets_airtable: the base ID and the table named joined by
            a ':' of the AirTable containing the advice per job group (short
            texts describing assets required).
    Returns:
        A list of dict that maps the JSON representation of JobGroup protos.
    """
    job_groups = cleaned_data.rome_job_groups(
        filename=rome_csv_pattern % 'referentiel_code_rome')
    jobs = cleaned_data.rome_jobs(
        filename=rome_csv_pattern % 'referentiel_appellation')
    holland_codes = cleaned_data.rome_holland_codes(
        filename=rome_csv_pattern % 'referentiel_code_rome_riasec')
    rome_texts = cleaned_data.rome_texts(
        filename=rome_csv_pattern % 'texte')
    rome_work_environments = cleaned_data.rome_work_environments(
        links_filename=rome_csv_pattern % 'liens_rome_referentiels',
        ref_filename=rome_csv_pattern % 'referentiel_env_travail')
    handcrafted_assets = _load_assets_from_airtable(*handcrafted_assets_airtable.split(':'))

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

    # Add skills.
    rome_to_skills = cleaned_data.rome_to_skills(
        filename_items=rome_csv_pattern % 'coherence_item',
        filename_skills=rome_csv_pattern % 'referentiel_competence')
    skills_grouped = rome_to_skills.groupby('code_rome')
    job_groups['requirements'] = skills_grouped.apply(
        _group_skills_as_proto_list)

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

    # Add Hollande Code https://en.wikipedia.org/wiki/Holland_Codes.
    # Will later be used for job similarity measures.
    job_groups['hollandCodeMajor'] = holland_codes.major
    job_groups['hollandCodeMinor'] = holland_codes.minor

    # Add description, working environment and requirement as text.
    job_groups['description'] = rome_texts.definition
    job_groups['workingEnvironment'] = rome_texts.working_environment
    job_groups['requirementsText'] = rome_texts.requirements

    # Add work environment items.
    job_groups['workEnvironmentKeywords'] = (
        rome_work_environments.groupby('code_rome').apply(
            _group_work_environment_items))
    # Fill NaN with empty {}.
    job_groups['workEnvironmentKeywords'] = (
        job_groups.workEnvironmentKeywords.apply(
            lambda k: k if isinstance(k, dict) else {}))

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
    return {
        section_name.lower().replace('secteurs', 'sectors'): env.name.tolist()
        for section_name, env in work_environments.groupby('section')
    }


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
        raise ValueError('%d errors while importing from Airtable:\n%s' % (
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
                    'The field %s is not formatted correctly: %s' % (airtable_name, error)))
    if errors:
        raise ValueError('The job %s has %d, errors:\n%s' % (
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
                'Each line should start with a * and an upper case, found: %s' % line)
    return '\n'.join(lines)


if __name__ == "__main__":
    mongo.importer_main(make_dicts, 'job_group_info')  # pragma: no cover
