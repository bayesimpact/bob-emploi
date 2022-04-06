"""Importer for UK job groups info."""

import json
import typing
from typing import Any, Optional

import pandas as pd

from bob_emploi.frontend.api import skill_pb2
from bob_emploi.common.python import proto
from bob_emploi.common.python.i18n import translation
from bob_emploi.data_analysis.importer import airtable_to_protos
from bob_emploi.data_analysis.importer.deployments.uk import local_diagnosis
from bob_emploi.data_analysis.lib import market_score_derivatives
from bob_emploi.data_analysis.lib import mongo
from bob_emploi.data_analysis.lib import uk_cleaned_data


_SKILL_18N_FIELDS = tuple(proto.list_translatable_fields(skill_pb2.Skill, name_field='json_name'))


def _get_automation_risk(filename: str) -> pd.Series:
    automation = pd.read_excel(
        filename, dtype={'SOC10M code': str}, sheet_name='Table 9', skiprows=4, skipfooter=4)
    return automation.set_index('SOC10M code')['Probability of automation']


def make_dicts(
        *,
        postings_csv: str,
        occupations_csv: str,
        jobs_xls: str,
        soc2010_js: str,
        career_jumps_csv: str,
        automation_xls: str,
        info_by_prefix_airtable: str,
        occupation_requirements_json: str,
        skills_for_future_airtable: Optional[str] = None,) -> list[dict[str, Any]]:
    """Prepare job info for MongoDB."""

    job_groups = uk_cleaned_data.uk_soc2010_job_groups(filename=jobs_xls) \
        .reset_index().rename(columns={'Unit_Group': 'romeId'})
    job_groups['_id'] = job_groups['romeId']
    job_groups.set_index('_id', inplace=True)

    descriptions = uk_cleaned_data.uk_soc2010_group_descriptions(filename=soc2010_js)
    job_groups['description'] = descriptions['description']
    job_groups['samples'] = descriptions['jobs'].apply(
        lambda job_names: [{'name': name} for name in job_names])

    domains = uk_cleaned_data.uk_soc2010_job_groups(filename=jobs_xls, level='Major_Group')\
        .squeeze().str.capitalize()
    job_groups['domain'] = job_groups.romeId.str[:1].map(domains)

    local_stats = local_diagnosis.compute_market_score(
        postings_csv=postings_csv, occupations_csv=occupations_csv)

    job_groups['automationRisk'] = _get_automation_risk(automation_xls).mul(100).round(0)
    job_groups.loc[job_groups.automationRisk == 0, 'automationRisk'] = 1
    job_groups.automationRisk.fillna(0, inplace=True)

    job_groups = job_groups.join(local_diagnosis.load_prefixed_info_from_airtable(
        job_groups.index, info_by_prefix_airtable))

    # Add related job groups.
    career_jumps = pd.read_csv(career_jumps_csv, dtype='str')
    safe_career_jumps = career_jumps[
        career_jumps.target_job_group.map(job_groups.covidRisk) != 'COVID_RISKY']
    job_groups['relatedJobGroups'] = safe_career_jumps\
        .join(job_groups, on='job_group')\
        .join(job_groups, on='target_job_group', lsuffix='_source')\
        .groupby(['romeId_source'])\
        .apply(lambda df: [
            {
                'jobGroup': target_job,
                'mobilityType': 'CLOSE',
            }
            for target_job in df[['romeId', 'name', 'automationRisk']].to_dict('records')])
    # Fill NaN with empty [].
    job_groups['relatedJobGroups'] = job_groups.relatedJobGroups.apply(
        lambda s: s if isinstance(s, list) else [])

    # Add best counties.
    # TODO(cyrille): Rename field to a more generic area name.
    job_groups['departementScores'] = market_score_derivatives.get_less_stressful_districts(
        local_stats, max_districts=20)
    # Fill NaN with empty [].
    job_groups['departementScores'] = job_groups.departementScores.apply(
        lambda s: s if isinstance(s, list) else [])

    # Add occupation requirements from json file.
    with open(occupation_requirements_json, encoding='utf-8') as job_requirements_file:
        job_requirements_list = json.load(job_requirements_file)
        job_requirements_dict = {
            job_requirement.pop('_id'): job_requirement
            for job_requirement in job_requirements_list}
    job_groups['requirements'] = job_groups.index.map(job_requirements_dict)
    # Replace NaN by empty dicts.
    job_groups['requirements'] = job_groups.requirements.apply(
        lambda r: r if isinstance(r, dict) else {})

    # SkillsForFuture
    skills_for_future_by_rome = airtable_to_protos.load_items_from_prefix(
        'Skill', job_groups.index, skills_for_future_airtable, 'soc_prefixes_uk')
    if skills_for_future_by_rome:
        with translation.Translator() as translator:
            translated_skills_for_future_by_rome = {
                rome_id: [
                    skill | translator.ensure_translate_fields(
                        skill, locale='en_UK', fields=_SKILL_18N_FIELDS)
                    for skill in skills
                ]
                for rome_id, skills in skills_for_future_by_rome.items()
            }
        job_groups['skillsForFuture'] = job_groups.index.map(translated_skills_for_future_by_rome)

    return typing.cast(list[dict[str, Any]], job_groups.reset_index().to_dict('records'))


if __name__ == '__main__':
    mongo.importer_main(make_dicts, 'job_group_info')
