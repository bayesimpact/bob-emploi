"""Importer for UK job groups info."""

import typing
from typing import Any, Dict, List

import pandas as pd

from bob_emploi.data_analysis.importer.deployments.uk import local_diagnosis
from bob_emploi.data_analysis.lib import market_score_derivatives
from bob_emploi.data_analysis.lib import mongo
from bob_emploi.data_analysis.lib import uk_cleaned_data


def _get_automation_risk(filename: str) -> pd.Series:
    automation = pd.read_excel(
        filename, dtype={'SOC10M code': str}, sheet_name='Table 9', skiprows=4, skipfooter=4)
    return automation.set_index('SOC10M code')['Probability of automation']


def make_dicts(
        *,
        postings_csv: str,
        occupations_csv: str,
        jobs_xls: str,
        career_jumps_csv: str,
        automation_xls: str,
        info_by_prefix_airtable: str) -> List[Dict[str, Any]]:
    """Prepare job info for MongoDB."""

    job_groups = uk_cleaned_data.uk_soc2010_job_groups(filename=jobs_xls) \
        .reset_index().rename(columns={'Unit_Group': 'romeId'})
    job_groups['_id'] = job_groups['romeId']
    job_groups.set_index('_id', inplace=True)

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

    return typing.cast(List[Dict[str, Any]], job_groups.reset_index().to_dict('records'))


if __name__ == '__main__':
    mongo.importer_main(make_dicts, 'job_group_info')
